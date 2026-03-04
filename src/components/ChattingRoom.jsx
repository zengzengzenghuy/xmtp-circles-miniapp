import React, { useState, useEffect, useCallback, useRef } from "react";
import { ConsentState, IdentifierKind } from "@xmtp/browser-sdk";
import { parseInviteFromSearch, isInviteExpired } from "./arcade/helpers/invite.js";
import { getGameDefinition } from "./arcade/gameRegistry.js";
import NewConversationModal from "./NewConversationModal";

const ARCADE_VERSION_PREFIX = '{"version":"arcade/v1"';

function formatAddress(addr) {
  if (!addr) return "Unknown";
  return `${String(addr).slice(0, 6)}...${String(addr).slice(-4)}`;
}

function decodeMessageText(content) {
  if (typeof content === "string") return content;
  if (content instanceof Uint8Array) return new TextDecoder().decode(content);
  if (content?.content) {
    if (content.content instanceof Uint8Array)
      return new TextDecoder().decode(content.content);
    return String(content.content);
  }
  return null;
}

function isSystemMessage(content) {
  return (
    typeof content === "object" &&
    content !== null &&
    (content.addedInboxes || content.removedInboxes || content.initiatedByInboxId)
  );
}

function parseArcadeEnvelope(text) {
  if (!text || !text.startsWith(ARCADE_VERSION_PREFIX)) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function formatBoardCoord(x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    return "unknown square";
  }
  return `${String.fromCharCode(65 + x)}${y + 1}`;
}

function formatBlockPieceLabel(gameKey, pieceId) {
  if (!pieceId) return "piece";
  const gameDef = getGameDefinition(gameKey);
  const piece = gameDef?.pieces?.find((entry) => entry.id === pieceId);
  return piece?.label || pieceId;
}

function formatArcadeEvent(envelope) {
  const type = String(envelope.type || "").toUpperCase();
  const payload = envelope.payload || {};
  if (type === "SESSION_JOIN") return "Joined the session";
  if (type === "SESSION_READY") return "Session ready";
  if (type === "SESSION_JOIN_REJECTED") return "Join rejected";
  if (type.includes("GAME_OVER")) {
    const winner = payload.winner;
    const reason = payload.reason;
    if (reason === "resign") return `Resigned — Winner: ${formatAddress(winner)}`;
    return `Game Over — Winner: ${formatAddress(winner)}`;
  }
  if (type.includes("REVEAL")) {
    return envelope.gameKey === "block_clash"
      ? "Revealed pieces for verification"
      : "Revealed setup for verification";
  }
  if (type.includes("SHOT_RESULT")) {
    const square = formatBoardCoord(payload.x, payload.y);
    if (payload.sunkShipId) {
      return `Shot ${square} landed and sank a ship`;
    }
    return `Shot ${square} ${payload.hit ? "hit" : "missed"}`;
  }
  if (type.includes("BATTLESHIP_SHOT")) {
    return `Fired at ${formatBoardCoord(payload.x, payload.y)}`;
  }
  if (type.includes("BLOCK_MOVE")) {
    const pieceLabel = formatBlockPieceLabel(envelope.gameKey, payload.pieceId);
    const rotation = Number(payload.rotation || 0);
    const rotationLabel = rotation ? ` · ${rotation}°` : "";
    return `Placed ${pieceLabel} at ${formatBoardCoord(payload.x, payload.y)}${rotationLabel}`;
  }
  if (type.includes("MOVE_RESULT")) return "Move result received";
  if (type.includes("MOVE") || type.includes("SHOT")) return "Played a move";
  return type.replaceAll("_", " ").toLowerCase();
}

function tryParseInviteFromText(text) {
  if (!text || !text.includes("arcadeInvite=")) return null;
  try {
    const url = new URL(text.trim());
    const result = parseInviteFromSearch(url.search);
    return result.invite;
  } catch {
    return null;
  }
}

// --- Session List ---

function SessionItem({ session, selected, onClick }) {
  const isLobby = session.isLobby;
  return (
    <div
      className={`conversation-item${selected ? " active" : ""}${isLobby ? " lobby-item" : ""}`}
      onClick={onClick}
    >
      <div className={`conversation-avatar${isLobby ? " lobby-avatar" : ""}`}>
        {isLobby ? "LB" : session.opponentAddress
          ? String(session.opponentAddress).slice(2, 4).toUpperCase()
          : "GR"}
      </div>
      <div className="conversation-details">
        <div className="conversation-header">
          <span className="conversation-address">
            {isLobby
              ? "Arcade Lobby"
              : session.opponentAddress
                ? formatAddress(session.opponentAddress)
                : "Arcade Session"}
          </span>
          <span className="conversation-time">
            {session.createdAt
              ? new Date(session.createdAt).toLocaleDateString()
              : ""}
          </span>
        </div>
        <div className="conversation-preview">
          {session.lastPreview || "No messages yet"}
        </div>
      </div>
    </div>
  );
}

function sessionDedupeKey(session) {
  if (session.isLobby) {
    return `lobby:${session.id}`;
  }
  if (session.opponentAddress) {
    return `peer:${String(session.opponentAddress).toLowerCase()}`;
  }
  return `group:${session.id}`;
}

function InviteBanner({ inviteLink, lobby, onShareToLobby }) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  if (!inviteLink) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy invite link", err);
    }
  };

  const handleShare = async () => {
    if (!onShareToLobby) return;
    try {
      await onShareToLobby();
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch (err) {
      console.error("Failed to share to lobby", err);
    }
  };

  return (
    <div className="chatroom-invite-banner">
      <div className="chatroom-invite-banner-text">
        <strong>Active invite</strong>
        <span className="chatroom-invite-banner-hint">
          {lobby ? "Share to lobby or copy link" : "Play a game to create the lobby, or use + to add players"}
        </span>
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        {lobby && onShareToLobby && (
          <button className="primary-btn" onClick={handleShare}>
            {shared ? "Shared!" : "Share"}
          </button>
        )}
        <button className="primary-btn" onClick={handleCopy} style={{ background: "#666" }}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function SessionList({ sessions, lobby, selectedId, onSelect, onRefresh, loading, inviteLink, onNewSession, onShareToLobby }) {
  return (
    <div className="conversation-list">
      <div className="conversation-list-header">
        <h2>Arcade Sessions</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {onNewSession && (
            <button
              className="new-message-btn"
              onClick={onNewSession}
              title="Add player to lobby"
            >
              +
            </button>
          )}
          {onRefresh && (
            <button
              className="refresh-btn"
              onClick={onRefresh}
              disabled={loading}
              title="Refresh sessions"
            >
              ↻
            </button>
          )}
        </div>
      </div>
      <InviteBanner inviteLink={inviteLink} lobby={lobby} onShareToLobby={onShareToLobby} />
      <div className="conversation-items">
        {/* Lobby pinned at top */}
        {lobby && (
          <SessionItem
            session={lobby}
            selected={selectedId === lobby.id}
            onClick={() => onSelect(lobby)}
          />
        )}
        {loading && sessions.length === 0 && !lobby ? (
          <div className="empty-state">
            <p>Loading sessions...</p>
          </div>
        ) : sessions.length === 0 && !lobby ? (
          <div className="empty-state">
            <p>No arcade sessions yet</p>
            <p className="empty-hint">
              Use + to add players to the lobby, or start a game from Arcade
            </p>
          </div>
        ) : (
          sessions.map((s) => (
            <SessionItem
              key={s.id}
              session={s}
              selected={selectedId === s.id}
              onClick={() => onSelect(s)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// --- Message View ---

function SessionMessageArea({
  session,
  xmtpClient,
  inviteLink,
  onBack,
  onJoinInvite,
}) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const streamRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Load messages and start stream
  useEffect(() => {
    if (!session?.conversation) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        try {
          const isActive = await session.conversation.isActive();
          if (isActive) await session.conversation.sync();
        } catch {
          // ignore sync errors
        }
        const msgs = await session.conversation.messages();
        if (!cancelled) setMessages(msgs || []);
      } catch (err) {
        console.error("Failed to load session messages", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    // Stream new messages
    const startStream = async () => {
      try {
        streamRef.current = await session.conversation.stream({
          onValue: (msg) => {
            if (!cancelled) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === msg.id)) return prev;
                return [...prev, msg];
              });
            }
          },
        });
      } catch (err) {
        console.error("Failed to start session message stream", err);
      }
    };
    startStream();

    return () => {
      cancelled = true;
      streamRef.current?.end?.();
      streamRef.current = null;
    };
  }, [session?.conversation]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || !session?.conversation || sending) return;
    setSending(true);
    try {
      await session.conversation.sendText(inputValue);
      setInputValue("");
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      setSending(false);
    }
  }, [inputValue, session?.conversation, sending]);

  const handleShareInvite = useCallback(async () => {
    if (!inviteLink || !session?.conversation || sending) return;
    setSending(true);
    try {
      await session.conversation.sendText(inviteLink);
      setInviteSent(true);
      setTimeout(() => setInviteSent(false), 2000);
    } catch (err) {
      console.error("Failed to share invite link", err);
    } finally {
      setSending(false);
    }
  }, [inviteLink, session?.conversation, sending]);

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!session) {
    return (
      <div className="message-area">
        <div className="no-conversation">
          <div className="no-conversation-content">
            <h2>Select a session</h2>
            <p>Choose the lobby or an arcade session to chat</p>
          </div>
        </div>
      </div>
    );
  }

  const isLobby = session.isLobby;
  const avatarText = isLobby
    ? "LB"
    : session.opponentAddress
      ? String(session.opponentAddress).slice(2, 4).toUpperCase()
      : "GR";
  const headerLabel = isLobby
    ? "Arcade Lobby"
    : session.opponentAddress
      ? formatAddress(session.opponentAddress)
      : "Arcade Session";

  return (
    <div className="message-area">
      <div className="message-area-header">
        {onBack && (
          <button className="back-btn" onClick={onBack} aria-label="Back">
            &#8592;
          </button>
        )}
        <div className={`conversation-avatar-small${isLobby ? " lobby-avatar" : ""}`}>{avatarText}</div>
        <div className="header-info">
          <span className="header-address">{headerLabel}</span>
        </div>
      </div>

      {inviteLink && (
        <div className="share-invite-banner">
          <span>{isLobby ? "Share your invite to the lobby" : "Share your arcade invite with this player"}</span>
          <button
            className="primary-btn"
            onClick={handleShareInvite}
            disabled={sending}
          >
            {inviteSent ? "Sent!" : "Share Invite"}
          </button>
        </div>
      )}

      <div className="messages-container">
        {loading ? (
          <div className="no-messages">
            <p>Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="no-messages">
            <p>No messages yet</p>
            <p className="no-messages-hint">
              {isLobby
                ? "Share an invite or send a message to the lobby"
                : "Send a message or play a game to see activity here"}
            </p>
          </div>
        ) : (
          (() => {
            const seenGameOverSessions = new Set();

            return messages
            .filter((msg) => !isSystemMessage(msg.content))
            .map((msg) => {
              const text = decodeMessageText(msg.content);
              const arcadeEnvelope = parseArcadeEnvelope(text);
              const isSent = msg.senderInboxId === xmtpClient?.inboxId;
              const timestamp = new Date(Number(msg.sentAtNs) / 1_000_000);

              if (arcadeEnvelope) {
                const envelopeType = String(arcadeEnvelope.type || "").toUpperCase();
                if (
                  envelopeType.includes("REVEAL") &&
                  arcadeEnvelope.gameKey === "block_clash"
                ) {
                  return null;
                }
                if (envelopeType.includes("GAME_OVER")) {
                  const sessionKey = String(arcadeEnvelope.sessionId || "");
                  if (seenGameOverSessions.has(sessionKey)) {
                    return null;
                  }
                  seenGameOverSessions.add(sessionKey);
                }
                return (
                  <div key={msg.id} className="arcade-event">
                    <span className="arcade-event-text">
                      {formatArcadeEvent(arcadeEnvelope)}
                    </span>
                    <span className="arcade-event-time">
                      {timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                );
              }

              if (!text) return null;

              // Detect arcade invite links and render as clickable cards
              const inviteParsed = tryParseInviteFromText(text);
              if (inviteParsed) {
                const expired = isInviteExpired(inviteParsed);
                const gameDef = getGameDefinition(inviteParsed.gameKey);
                return (
                  <div
                    key={msg.id}
                    className={`message ${isSent ? "sent" : "received"}`}
                  >
                    <div className={`invite-card${expired ? " invite-card-expired" : ""}`}>
                      <div className="invite-card-header">
                        {expired ? "Invite Expired" : "Arcade Invite"}
                      </div>
                      <div className="invite-card-game">
                        {gameDef?.label || inviteParsed.gameKey}
                      </div>
                      <div className="invite-card-from">
                        From: {formatAddress(inviteParsed.creatorAddress)}
                      </div>
                      {!isSent && !expired && onJoinInvite && (
                        <button
                          className="primary-btn invite-card-btn"
                          onClick={() => onJoinInvite(inviteParsed)}
                        >
                          Join Game
                        </button>
                      )}
                      <div className="message-timestamp">
                        {timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={`message ${isSent ? "sent" : "received"}`}
                >
                  <div className="message-content">
                    <div className="message-text">{text}</div>
                    <div className="message-timestamp">
                      {timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          })()
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="message-input-container">
        <textarea
          className="message-input"
          placeholder="Type a message..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          rows="1"
          disabled={sending}
        />
        <button
          className="send-btn"
          onClick={handleSend}
          disabled={!inputValue.trim() || sending}
        >
          {sending ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}

// --- Main Component ---

export default function ChattingRoom({ xmtpClient, address, inviteLink, onJoinInvite }) {
  const [sessions, setSessions] = useState([]);
  const [lobby, setLobby] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);

  const handleAddToLobby = useCallback(async (recipientAddress) => {
    if (!xmtpClient) return;
    try {
      const inboxId = await xmtpClient.fetchInboxIdByIdentifier({
        identifier: recipientAddress,
        identifierKind: IdentifierKind.Ethereum,
      });
      if (!inboxId) {
        alert("This address is not registered on the XMTP network");
        return;
      }

      let lobbyGroup = lobby?.conversation;
      if (!lobbyGroup) {
        // Create the lobby with this first member
        lobbyGroup = await xmtpClient.conversations.createGroup(
          [inboxId],
          { groupName: "arcade-lobby" },
        );
      } else {
        // Add to existing lobby
        await lobbyGroup.addMembers([inboxId]);
      }

      const lobbySession = {
        id: lobbyGroup.id,
        conversation: lobbyGroup,
        opponentAddress: null,
        createdAt: Number(lobbyGroup.createdAtNs) / 1_000_000 || Date.now(),
        lastPreview: "Shared arcade lobby",
        isLobby: true,
      };
      setLobby(lobbySession);
      setSelectedSession(lobbySession);
    } catch (err) {
      console.error("Failed to add to lobby", err);
      alert(`Failed to add to lobby: ${err.message}`);
    }
  }, [xmtpClient, lobby]);

  const handleShareToLobby = useCallback(async () => {
    if (!inviteLink || !lobby?.conversation) return;
    await lobby.conversation.sendText(inviteLink);
    // Select the lobby to show the shared invite
    setSelectedSession(lobby);
  }, [inviteLink, lobby]);

  const loadSessions = useCallback(async () => {
    if (!xmtpClient) return;
    setLoading(true);
    try {
      await xmtpClient.conversations.sync();
      try {
        await xmtpClient.conversations.syncAll([
          ConsentState.Unknown,
          ConsentState.Allowed,
        ]);
      } catch {
        // syncAll may fail, continue
      }
      const groups = await xmtpClient.conversations.listGroups();
      const arcadeGroups = [];
      let foundLobby = null;

      for (const group of groups) {
        // Detect the lobby
        if (group.name === "arcade-lobby") {
          let lastPreview = "Shared arcade lobby";
          try {
            const lastMsg = await group.lastMessage();
            if (lastMsg) {
              const text = decodeMessageText(lastMsg.content);
              const invite = tryParseInviteFromText(text);
              if (invite) {
                const gameDef = getGameDefinition(invite.gameKey);
                lastPreview = `Invite: ${gameDef?.label || invite.gameKey}`;
              } else if (text) {
                lastPreview = text.length > 40 ? text.slice(0, 40) + "..." : text;
              }
            }
          } catch {
            // ignore
          }
          foundLobby = {
            id: group.id,
            conversation: group,
            opponentAddress: null,
            createdAt: Number(group.createdAtNs) / 1_000_000,
            lastPreview,
            isLobby: true,
          };
          continue;
        }

        if (group.name !== "arcade-session") continue;

        let opponentAddress = null;
        let createdAt = null;
        let lastActivityAt = null;
        let lastPreview = "No messages yet";

        try {
          createdAt = Number(group.createdAtNs) / 1_000_000;
          lastActivityAt = createdAt;
        } catch {
          // ignore
        }

        try {
          const members = await group.members();
          const myInboxId = xmtpClient.inboxId;
          const peer = members.find((m) => m.inboxId !== myInboxId);
          if (peer) {
            opponentAddress =
              peer.accountIdentifiers?.[0]?.identifier || null;
          }
        } catch {
          // ignore member resolution errors
        }

        try {
          const lastMsg = await group.lastMessage();
          if (lastMsg) {
            lastActivityAt = Number(lastMsg.sentAtNs) / 1_000_000 || lastActivityAt;
            const text = decodeMessageText(lastMsg.content);
            const envelope = parseArcadeEnvelope(text);
            if (envelope) {
              lastPreview = formatArcadeEvent(envelope);
            } else if (text) {
              lastPreview =
                text.length > 40 ? text.slice(0, 40) + "..." : text;
            }
          }
        } catch {
          // ignore
        }

        arcadeGroups.push({
          id: group.id,
          conversation: group,
          opponentAddress,
          createdAt,
          lastActivityAt,
          lastPreview,
        });
      }

      // Prefer the most recently active thread for each opponent.
      arcadeGroups.sort((a, b) => {
        const leftTime = a.lastActivityAt || a.createdAt || 0;
        const rightTime = b.lastActivityAt || b.createdAt || 0;
        return rightTime - leftTime;
      });
      const dedupedGroups = [];
      const seenSessionKeys = new Set();
      for (const session of arcadeGroups) {
        const key = sessionDedupeKey(session);
        if (seenSessionKeys.has(key)) {
          continue;
        }
        seenSessionKeys.add(key);
        dedupedGroups.push(session);
      }

      setSessions(dedupedGroups);
      setLobby(foundLobby);
      setSelectedSession((current) => {
        if (!current) {
          return current;
        }

        if (current.isLobby) {
          return foundLobby || null;
        }

        const currentKey = sessionDedupeKey(current);
        return dedupedGroups.find((session) => sessionDedupeKey(session) === currentKey) || null;
      });
    } catch (err) {
      console.error("Failed to load arcade sessions", err);
    } finally {
      setLoading(false);
    }
  }, [xmtpClient]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  if (!xmtpClient) {
    return (
      <div className="chatting-room-page">
        <div className="connect-prompt">
          <div className="connect-card">
            <h2>Chatting Room</h2>
            <p>Connect to XMTP to see your arcade sessions</p>
            <p className="connect-hint">
              Go to Account tab to connect your wallet and XMTP
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <SessionList
        sessions={sessions}
        lobby={lobby}
        selectedId={selectedSession?.id}
        onSelect={setSelectedSession}
        onRefresh={loadSessions}
        loading={loading}
        inviteLink={inviteLink}
        onNewSession={() => setShowNewSessionModal(true)}
        onShareToLobby={lobby ? handleShareToLobby : null}
        className={selectedSession ? "hidden-mobile" : ""}
      />
      <SessionMessageArea
        session={selectedSession}
        xmtpClient={xmtpClient}
        inviteLink={inviteLink}
        onBack={() => setSelectedSession(null)}
        onJoinInvite={onJoinInvite}
        className={!selectedSession ? "hidden-mobile" : ""}
      />
      <NewConversationModal
        isOpen={showNewSessionModal}
        onClose={() => setShowNewSessionModal(false)}
        onCreateConversation={handleAddToLobby}
      />
    </div>
  );
}
