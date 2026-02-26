import React, { useState, useEffect } from "react";
import { useMetadata } from "../stores/inboxHooks";

// Component to display conversation with metadata
function ConversationItem({
  conversation,
  selectedConversation,
  onSelectConversation,
  circlesMode,
}) {
  const metadata = useMetadata(conversation.id);
  const [circlesProfile, setCirclesProfile] = useState(null);
  const [circlesLoading, setCirclesLoading] = useState(false);

  // Helper to get full peer address (not truncated)
  const getFullPeerAddress = () => {
    if (metadata.identifier || (metadata.name && metadata.name.startsWith('0x'))) {
      return metadata.identifier || metadata.name;
    }
    return null;
  };

  // Helper to get peer address from metadata
  const getPeerAddress = () => {
    // Prefer identifier (Ethereum address) which is now in metadata.name
    if (metadata.identifier || (metadata.name && metadata.name.startsWith('0x'))) {
      const addr = metadata.identifier || metadata.name;
      // Format as 0x1234...5678
      return String(addr).slice(0, 6) + "..." + String(addr).slice(-4);
    }
    if (metadata.name) {
      return String(metadata.name);
    }
    if (metadata.peerInboxId) {
      return String(metadata.peerInboxId).slice(0, 8) + "...";
    }
    // Fallback to conversation ID
    return conversation.id
      ? String(conversation.id).slice(0, 8) + "..."
      : "Unknown";
  };

  const peerAddress = getPeerAddress();
  const isGroup = conversation.metadata?.conversationType === "group";

  // Fetch Circles profile when Circles Mode is enabled
  useEffect(() => {
    const fetchCirclesProfile = async () => {
      if (!circlesMode) {
        setCirclesProfile(null);
        return;
      }

      const fullAddress = getFullPeerAddress();
      if (!fullAddress) {
        setCirclesProfile(null);
        return;
      }

      setCirclesLoading(true);

      try {
        const response = await fetch("https://rpc.aboutcircles.com/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "circles_getProfileByAddress",
            params: [fullAddress],
          }),
        });

        const data = await response.json();

        if (data.result && Object.keys(data.result).length > 0) {
          setCirclesProfile(data.result);
        } else {
          setCirclesProfile(null);
        }
      } catch (error) {
        console.error("Error fetching Circles profile:", error);
        setCirclesProfile(null);
      } finally {
        setCirclesLoading(false);
      }
    };

    fetchCirclesProfile();
  }, [circlesMode, metadata.identifier, metadata.name]);

  // Get avatar initials safely - for addresses, skip the "0x" prefix
  const getAvatarText = () => {
    if (peerAddress.startsWith('0x')) {
      return peerAddress.slice(2, 4).toUpperCase();
    }
    return peerAddress && peerAddress.length >= 2
      ? peerAddress.slice(0, 2).toUpperCase()
      : "??";
  };
  const avatarText = getAvatarText();

  return (
    <div
      className={`conversation-item ${
        selectedConversation?.id === conversation.id ? "active" : ""
      }`}
      onClick={() => onSelectConversation(conversation)}>
      {circlesProfile && circlesProfile.previewImageUrl ? (
        <img
          src={circlesProfile.previewImageUrl}
          alt={circlesProfile.name}
          className="conversation-avatar-image"
        />
      ) : (
        <div className="conversation-avatar">{avatarText}</div>
      )}
      <div className="conversation-details">
        <div className="conversation-header">
          <span className="conversation-address">
            {circlesProfile && circlesProfile.name
              ? circlesProfile.name
              : isGroup
                ? `Group: ${peerAddress}`
                : peerAddress}
          </span>
          <span className="conversation-time">
            {new Date(
              Number(conversation.createdAtNs) / 1_000_000
            ).toLocaleDateString()}
          </span>
        </div>
        <div className="conversation-preview">
          {conversation.lastMessage?.content || "No messages yet"}
        </div>
      </div>
    </div>
  );
}

function ConversationList({
  conversations,
  selectedConversation,
  onSelectConversation,
  onNewConversation,
  isLoading,
  onRefresh,
  circlesMode,
}) {

  return (
    <div className="conversation-list">
      <div className="conversation-list-header">
        <h2>Messages</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {onRefresh && (
            <button
              className="refresh-btn"
              onClick={onRefresh}
              disabled={isLoading}
              title="Sync conversations">
              ↻
            </button>
          )}
          <button className="new-message-btn" onClick={onNewConversation}>
            +
          </button>
        </div>
      </div>

      <div className="conversation-items">
        {isLoading ? (
          <div className="empty-state">
            <p>Loading conversations...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="empty-state">
            <p>No conversations yet</p>
            <p className="empty-hint">Click + to start a new conversation</p>
          </div>
        ) : (
          conversations.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              selectedConversation={selectedConversation}
              onSelectConversation={onSelectConversation}
              circlesMode={circlesMode}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default ConversationList;
