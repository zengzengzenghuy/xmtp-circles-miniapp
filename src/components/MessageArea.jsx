import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useConversation } from "../hooks/useConversation";
import { useMetadata } from "../stores/inboxHooks";
import { useWalletClient } from "wagmi";
import { encodeFunctionData } from "viem";
import {
  isMiniappMode,
  sendTransactions as miniappSendTransactions,
} from "@aboutcircles/miniapp-sdk";
import {
  getProfileByAddress,
  getCirclesMaxFlow,
  circlesGetTransferData,
} from "../helpers/circlesRpcCall";
import { callHubTransfer, encodeMessageId } from "../helpers/hubTransfer";
import {
  formatMessageTimestamp,
  getMessageText,
  isRenderableMessage,
} from "../helpers/messageContent";

const CRC_PREFIX = "crc_transfer# ";
const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 24; // ~2 minutes

function CRCTransferBubble({
  message,
  isSent,
  peerDisplayName,
  connectedAddress,
  overrideTxHash,
}) {
  const [txHash, setTxHash] = useState(null);
  const resolvedTxHash = overrideTxHash || txHash;
  const messageText = getMessageText(message.content);

  let transferData = { value: "", to: "", note: "" };
  try {
    transferData = JSON.parse(messageText.slice(CRC_PREFIX.length));
  } catch {
    // malformed payload
  }
  const { value: txValue, to: txTo, note: txNote } = transferData;

  // Poll circles_getTransferData to recover tx hash — runs for both sender and receiver.
  // Sender uses overrideTxHash in the same session; this polling handles page-refresh recovery.
  useEffect(() => {
    if (!connectedAddress || txHash || overrideTxHash) return;

    let cancelled = false;
    let attempts = 0;
    let encoded;

    try {
      encoded = encodeMessageId(message.id);
    } catch (e) {
      console.warn("CRCTransferBubble: could not encode messageId", e.message);
      return;
    }

    const poll = async () => {
      while (!cancelled && attempts < POLL_MAX_ATTEMPTS) {
        attempts++;
        try {
          const transfers = await circlesGetTransferData(connectedAddress);
          console.log("Transfer ", transfers);
          console.log("Looking for encoded ", encoded);
          const match = Array.isArray(transfers)
            ? transfers.find((t) => t.data === encoded)
            : null;
          if (match) {
            if (!cancelled) setTxHash(match.transactionHash);
            return;
          }
        } catch (e) {
          console.warn("circlesGetTransferData error:", e.message);
        }
        console.log("fetching transfer data");
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [message.id, connectedAddress, overrideTxHash]);

  // Sender (EOA): overrideTxHash is a real hash string, render immediately.
  // Sender (SCW/miniapp): overrideTxHash is null, poll RPC for the real hash.
  // Hide only when sender has no hash yet and isn't polling (crcTxHashes entry missing entirely).
  if (isSent && !resolvedTxHash && overrideTxHash === undefined) return null;

  const label = isSent ? `Sent ${txValue} CRC` : `Sent ${txValue} CRC`;

  return (
    <div
      className={`message-content crc-transfer-bubble${isSent ? " crc-transfer-bubble--sent" : ""}`}>
      <span className="crc-bubble-icon">&#9679;</span>
      <div className="crc-bubble-text">{label}</div>
      {txNote ? <div className="crc-bubble-note">Note: {txNote}</div> : null}
      {resolvedTxHash && (
        <a
          className="crc-bubble-txlink"
          href={`https://gnosisscan.io/tx/${resolvedTxHash}`}
          target="_blank"
          rel="noopener noreferrer">
          View transaction &#8599;
        </a>
      )}
      {!isSent && !resolvedTxHash && (
        <span className="crc-bubble-pending">Looking up transaction…</span>
      )}
      <div className="message-timestamp">
        {formatMessageTimestamp(message.sentAtNs)}
      </div>
    </div>
  );
}

function CRCTransferFlow({
  onClose,
  onTxComplete,
  peerAddress,
  sinkAddress,
  sourceAddress,
  conversation,
}) {
  const [step, setStep] = useState("picker"); // "picker" | "form" | "sign"
  const [to] = useState(peerAddress || "");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [maxFlow, setMaxFlow] = useState(null);
  const [txState, setTxState] = useState("idle"); // "idle" | "pending" | "done" | "error"
  const [txError, setTxError] = useState("");
  const { data: wagmiWalletClient } = useWalletClient();
  const walletClient = isMiniappMode()
    ? {
        writeContract: async ({ address, abi, functionName, args }) => {
          const data = encodeFunctionData({ abi, functionName, args });
          const hashes = await miniappSendTransactions([
            {
              to: "0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8",
              value: "0",
              data,
            }, // hardcode the HUB_V2_ADDRESS into the `to` address. TODO: fix the empty `to` when passing address to miniapp
          ]);
          return hashes[0];
        },
        sendTransaction: async (tx) => {
          const hashes = await miniappSendTransactions([
            {
              to: tx.to,
              value: tx.value ? String(tx.value) : "0",
              data: tx.data || "0x",
            },
          ]);
          return hashes[0];
        },
        sendBatchTransactions: async (txs) => {
          const hashes = await miniappSendTransactions(
            txs.map((tx) => ({
              to: tx.to,
              value: tx.value ? String(tx.value) : "0",
              data: tx.data || "0x",
            })),
          );
          return hashes[0];
        },
      }
    : wagmiWalletClient;

  useEffect(() => {
    if (step !== "form" || !sourceAddress || !sinkAddress) return;
    setMaxFlow(null);
    getCirclesMaxFlow(sourceAddress, sinkAddress)
      .then(setMaxFlow)
      .catch(() => setMaxFlow("—"));
  }, [step, sourceAddress, sinkAddress]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="crc-overlay" onClick={handleOverlayClick}>
      <div className="crc-modal">
        {step === "picker" && (
          <>
            <div className="crc-picker-header">
              <button
                className="crc-back-btn"
                onClick={onClose}
                aria-label="Close">
                &#8592;
              </button>
            </div>
            <div className="crc-modal-body">
              <button
                className="crc-action-item"
                onClick={() => setStep("form")}>
                <span className="crc-action-icon">&#9679;</span>
                <div className="crc-action-label">
                  <span className="crc-action-name">Transfer CRC</span>
                  <span className="crc-action-desc">
                    Send Circles with notes
                  </span>
                </div>
                <span className="crc-action-chevron">&#8250;</span>
              </button>
            </div>
          </>
        )}

        {step === "form" && (
          <>
            <div className="crc-modal-header">
              <button
                className="crc-back-btn"
                onClick={() => setStep("picker")}
                aria-label="Back">
                &#8592;
              </button>
              <h2 className="crc-modal-title">Transfer CRC</h2>
            </div>
            <div className="crc-modal-body crc-form-body">
              <div className="crc-field">
                <label className="crc-label">To</label>
                <input
                  className="crc-input crc-input-readonly"
                  type="text"
                  value={to}
                  readOnly
                />
              </div>
              <div className="crc-field">
                <label className="crc-label">Value</label>
                <input
                  className="crc-input"
                  type="number"
                  placeholder="0.00"
                  min="0"
                  max={maxFlow ?? undefined}
                  value={value}
                  onChange={(e) => {
                    const input = e.target.value;
                    if (
                      maxFlow !== null &&
                      parseFloat(input) > parseFloat(maxFlow)
                    ) {
                      setValue(maxFlow);
                    } else {
                      setValue(input);
                    }
                  }}
                />
                <span className="crc-field-hint">
                  {maxFlow === null
                    ? "Loading send limit…"
                    : `Send Limit: ${maxFlow} CRC`}
                </span>
              </div>
              <div className="crc-field">
                <label className="crc-label">Note</label>
                <textarea
                  className="crc-input crc-textarea"
                  placeholder="Add a message or emoji..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows="3"
                />
              </div>
            </div>
            <div className="crc-modal-footer">
              <button
                className="crc-send-btn"
                onClick={() => setStep("sign")}
                disabled={!to.trim() || !value.trim()}>
                Send
              </button>
            </div>
          </>
        )}

        {step === "sign" && (
          <>
            <div className="crc-modal-header">
              <button
                className="crc-back-btn"
                onClick={() => {
                  if (txState !== "pending") setStep("form");
                }}
                aria-label="Back"
                disabled={txState === "pending"}>
                &#8592;
              </button>
              <h2 className="crc-modal-title">Confirm Transfer</h2>
            </div>
            <div className="crc-modal-body crc-sign-body">
              {txState === "done" ? (
                <div className="crc-tx-done">
                  <span className="crc-tx-done-icon">&#10003;</span>
                  <p className="crc-tx-done-text">Transaction complete</p>
                </div>
              ) : (
                <>
                  <div className="crc-sign-summary">
                    <div className="crc-sign-row">
                      <span className="crc-sign-key">To</span>
                      <span className="crc-sign-val">{to}</span>
                    </div>
                    <div className="crc-sign-row">
                      <span className="crc-sign-key">Amount</span>
                      <span className="crc-sign-val">{value} CRC</span>
                    </div>
                    {note && (
                      <div className="crc-sign-row">
                        <span className="crc-sign-key">Note</span>
                        <span className="crc-sign-val">{note}</span>
                      </div>
                    )}
                  </div>
                  {txError && <p className="crc-tx-error">{txError}</p>}
                  <p className="crc-sign-prompt">
                    Sign the transaction to confirm this transfer.
                  </p>
                </>
              )}
            </div>
            <div className="crc-modal-footer">
              {txState === "done" ? (
                <button className="crc-send-btn" onClick={onClose}>
                  Close
                </button>
              ) : (
                <button
                  className="crc-send-btn"
                  disabled={txState === "pending"}
                  onClick={async () => {
                    setTxError("");
                    setTxState("pending");
                    try {
                      const { hash, messageId } = await callHubTransfer({
                        walletClient,
                        source: sourceAddress,
                        sink: sinkAddress,
                        amountCRC: value,
                        note,
                        peerDisplay: to,
                        conversation,
                      });
                      onTxComplete?.(messageId, null);
                      setTxState("done");
                    } catch (err) {
                      setTxError(err.message || "Transaction failed");
                      setTxState("idle");
                    }
                  }}>
                  {txState === "pending"
                    ? "Waiting for signature…"
                    : "Sign & Send"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MessageArea({
  conversation,
  xmtpClient,
  syncAllConversations,
  onBack,
  className,
  connectedAddress,
}) {
  const [inputValue, setInputValue] = useState("");
  const [circlesProfile, setCirclesProfile] = useState(null);
  const [composerError, setComposerError] = useState("");
  const [showCRCTransfer, setShowCRCTransfer] = useState(false);
  const [crcTxHashes, setCrcTxHashes] = useState({});
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const previousMessageCountRef = useRef(0);

  // Get metadata for the conversation
  const metadata = useMetadata(conversation?.id || "");

  // Use the conversation hook to get messages and send functionality
  const {
    messages,
    name,
    peerInboxId,
    sync,
    sendText,
    sending: isSending,
    loading: isLoadingMessages,
  } = useConversation(conversation?.id || "");

  // Helper to get full peer address (not truncated)
  const getFullPeerAddress = () => {
    if (
      metadata.identifier ||
      (metadata.name && metadata.name.startsWith("0x"))
    ) {
      return metadata.identifier || metadata.name;
    }
    return null;
  };

  // Fetch Circles profile for the peer
  useEffect(() => {
    const fetchCirclesProfile = async () => {
      const fullAddress = getFullPeerAddress();
      if (!fullAddress || !conversation) {
        setCirclesProfile(null);
        return;
      }

      try {
        const profile = await getProfileByAddress(fullAddress);
        setCirclesProfile(profile);
      } catch (error) {
        console.error("Error fetching Circles profile:", error);
        setCirclesProfile(null);
      }
    };

    fetchCirclesProfile();
  }, [conversation?.id, metadata.identifier, metadata.name]);

  // Load messages when conversation changes
  useEffect(() => {
    if (!conversation) return;
    setComposerError("");
    setInputValue("");
    previousMessageCountRef.current = 0;

    const loadMessages = async () => {
      try {
        // Sync all conversations first, then sync this conversation from network
        if (syncAllConversations) {
          await syncAllConversations();
        }
        await sync(true);
        console.log("Loaded messages for conversation:", conversation.id);
      } catch (error) {
        console.error("Error loading messages:", error);
      }
    };

    loadMessages();
  }, [conversation, sync, syncAllConversations]);

  useEffect(() => {
    setShowCRCTransfer(false);
  }, [conversation?.id]);

  const visibleMessages = useMemo(
    () => messages.filter(isRenderableMessage),
    [messages],
  );

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || !conversation || isSending) return;

    setComposerError("");
    try {
      await sendText(text);
      setInputValue("");
      await sync();
    } catch (error) {
      console.error("Error sending message:", error);
      setComposerError(error.message || "Failed to send message");
    }
  }, [inputValue, conversation, isSending, sendText, sync]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const behavior = previousMessageCountRef.current > 0 ? "smooth" : "auto";
    messagesEndRef.current?.scrollIntoView({ behavior });
    previousMessageCountRef.current = visibleMessages.length;
  }, [visibleMessages]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, [inputValue]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  if (!conversation) {
    return (
      <div className={`message-area${className ? ` ${className}` : ""}`}>
        <div className="no-conversation">
          <div className="no-conversation-content">
            <h2>Select a conversation</h2>
            <p>Pick a chat from the sidebar or start a new one</p>
          </div>
        </div>
      </div>
    );
  }

  // Use the metadata from store - prefer name (which is now the identifier address)
  const peerAddress = name
    ? String(name).slice(0, 6) + "..." + String(name).slice(-4)
    : peerInboxId
      ? String(peerInboxId).slice(0, 12) + "..."
      : conversation?.id
        ? String(conversation.id).slice(0, 8) + "..."
        : "Unknown";

  // Determine display name - use Circles profile name if available
  const displayName = circlesProfile?.name || peerAddress;
  const fullAddress = getFullPeerAddress();

  // Get avatar initials safely - for addresses, skip the "0x" prefix
  const getAvatarText = () => {
    if (circlesProfile?.name) {
      return circlesProfile.name.slice(0, 2).toUpperCase();
    }
    if (peerAddress.startsWith("0x")) {
      return peerAddress.slice(2, 4).toUpperCase();
    }
    return peerAddress && peerAddress.length >= 2
      ? peerAddress.slice(0, 2).toUpperCase()
      : "??";
  };
  const avatarText = getAvatarText();

  return (
    <div className={`message-area${className ? ` ${className}` : ""}`}>
      <div className="message-area-header">
        {onBack && (
          <button className="back-btn" onClick={onBack} aria-label="Back">
            &#8592;
          </button>
        )}
        {circlesProfile && circlesProfile.previewImageUrl ? (
          <img
            src={circlesProfile.previewImageUrl}
            alt={circlesProfile.name}
            className="conversation-avatar-image-small"
          />
        ) : (
          <div className="conversation-avatar-small">{avatarText}</div>
        )}
        <div className="header-info">
          <span className="header-address">{displayName}</span>
          {circlesProfile?.name && fullAddress && (
            <span className="header-subtitle">{fullAddress}</span>
          )}
        </div>
      </div>

      <div className="messages-container">
        {isLoadingMessages ? (
          <div className="no-messages">
            <p>Loading messages...</p>
          </div>
        ) : visibleMessages.length === 0 ? (
          <div className="no-messages">
            <p>No messages yet</p>
            <p className="no-messages-hint">
              Send a message to start the conversation
            </p>
          </div>
        ) : (
          visibleMessages.map((message) => {
            const isSent = message.senderInboxId === xmtpClient?.inboxId;
            const messageText = getMessageText(message.content);

            if (messageText.startsWith(CRC_PREFIX)) {
              return (
                <div
                  key={message.id}
                  className={`message ${isSent ? "sent" : "received"}`}>
                  <CRCTransferBubble
                    message={message}
                    isSent={isSent}
                    peerDisplayName={displayName}
                    connectedAddress={connectedAddress}
                    overrideTxHash={
                      isSent ? crcTxHashes[message.id] : undefined
                    }
                  />
                </div>
              );
            }

            return (
              <div
                key={message.id}
                className={`message ${isSent ? "sent" : "received"}`}>
                <div className="message-content">
                  <div className="message-text">{messageText}</div>
                  <div className="message-timestamp">
                    {formatMessageTimestamp(message.sentAtNs)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {showCRCTransfer && (
        <CRCTransferFlow
          onClose={() => setShowCRCTransfer(false)}
          onTxComplete={(msgId, hash) =>
            setCrcTxHashes((prev) => ({ ...prev, [msgId]: hash }))
          }
          peerAddress={circlesProfile?.name || fullAddress}
          sinkAddress={fullAddress}
          sourceAddress={connectedAddress}
          conversation={conversation}
        />
      )}

      <div className="message-input-container">
        <button
          className="composer-plus-btn"
          onClick={() => setShowCRCTransfer(true)}
          aria-label="Actions">
          +
        </button>
        <textarea
          ref={textareaRef}
          className="message-input"
          placeholder="Message"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (composerError) {
              setComposerError("");
            }
          }}
          onKeyDown={handleKeyDown}
          rows="1"
          disabled={isSending}
        />
        <button
          className="send-btn"
          onClick={() => void handleSend()}
          disabled={!inputValue.trim() || isSending}
          aria-label="Send">
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path
              d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"
              fill="currentColor"
            />
          </svg>
        </button>
      </div>
      {composerError && (
        <div className="message-input-error">{composerError}</div>
      )}
    </div>
  );
}

export default MessageArea;
