import React, { useState, useEffect } from "react";
import { useLastMessage, useMetadata } from "../stores/inboxHooks";
import { getProfileByAddress } from "../helpers/circlesRpcCall";
import {
  formatConversationTimestamp,
  getMessageText,
} from "../helpers/messageContent";

// Component to display conversation with metadata
function ConversationItem({
  conversation,
  selectedConversation,
  onSelectConversation,
  circlesMode,
}) {
  const metadata = useMetadata(conversation.id);
  const [circlesProfile, setCirclesProfile] = useState(null);
  const lastMessage = useLastMessage(conversation.id);

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

      try {
        const profile = await getProfileByAddress(fullAddress);
        setCirclesProfile(profile);
      } catch (error) {
        console.error("Error fetching Circles profile:", error);
        setCirclesProfile(null);
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
  const lastActivityNs = lastMessage?.sentAtNs || conversation.createdAtNs;
  const previewText = getMessageText(lastMessage?.content) || "No messages yet";

  return (
    <div
      className={`conversation-item ${selectedConversation?.id === conversation.id ? "active" : ""
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
            {formatConversationTimestamp(lastActivityNs)}
          </span>
        </div>
        <div className="conversation-preview">{previewText}</div>
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
  className,
}) {

  return (
    <div className={`conversation-list${className ? ` ${className}` : ''}`}>
      <div className="conversation-list-header">
        <h2>Circles Messages</h2>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {onRefresh && (
            <button
              className="refresh-btn"
              onClick={() => onRefresh(true)}
              disabled={isLoading}
              title="Sync conversations">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6" />
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M3 22v-6h6" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
            </button>
          )}
          <button className="new-message-btn" onClick={onNewConversation} aria-label="New message">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
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
            <button
              className="empty-state-action"
              onClick={onNewConversation}>
              Start a conversation
            </button>
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
