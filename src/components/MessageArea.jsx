import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useConversation } from "../hooks/useConversation";
import { useMetadata } from "../stores/inboxHooks";
import { getProfileByAddress } from "../helpers/circlesRpcCall";
import {
  formatMessageTimestamp,
  getMessageText,
  isRenderableMessage,
} from "../helpers/messageContent";

function MessageArea({ conversation, xmtpClient, onBack, className }) {
  const [inputValue, setInputValue] = useState("");
  const [circlesProfile, setCirclesProfile] = useState(null);
  const [composerError, setComposerError] = useState("");
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
    if (metadata.identifier || (metadata.name && metadata.name.startsWith('0x'))) {
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
        // Sync messages for this conversation from network
        await sync(true);
        console.log("Loaded messages for conversation:", conversation.id);
      } catch (error) {
        console.error("Error loading messages:", error);
      }
    };

    loadMessages();
  }, [conversation, sync]);

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
      <div className={`message-area${className ? ` ${className}` : ''}`}>
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
    if (peerAddress.startsWith('0x')) {
      return peerAddress.slice(2, 4).toUpperCase();
    }
    return peerAddress && peerAddress.length >= 2
      ? peerAddress.slice(0, 2).toUpperCase()
      : "??";
  };
  const avatarText = getAvatarText();

  return (
    <div className={`message-area${className ? ` ${className}` : ''}`}>
      <div className="message-area-header">
        {onBack && (
          <button className="back-btn" onClick={onBack} aria-label="Back">&#8592;</button>
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

      <div className="message-input-container">
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
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor" />
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
