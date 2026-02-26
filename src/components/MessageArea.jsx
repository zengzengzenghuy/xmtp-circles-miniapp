import React, { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { useConversation } from "../hooks/useConversation";

function MessageArea({ conversation, xmtpClient }) {
  const { address } = useAccount();
  const [inputValue, setInputValue] = useState("");

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

  // Load messages when conversation changes
  useEffect(() => {
    if (!conversation) return;

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

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || !conversation || isSending) return;

    try {
      // Send text message using the hook's sendText method
      await sendText(inputValue);
      setInputValue("");
    } catch (error) {
      console.error("Error sending message:", error);
      alert(`Failed to send message: ${error.message}`);
    }
  }, [inputValue, conversation, isSending, sendText]);

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!conversation) {
    return (
      <div className="message-area">
        <div className="no-conversation">
          <div className="no-conversation-content">
            <h2>Select a conversation</h2>
            <p>Choose a conversation from the list to start messaging</p>
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
    <div className="message-area">
      <div className="message-area-header">
        <div className="conversation-avatar-small">{avatarText}</div>
        <div className="header-info">
          <span className="header-address">{peerAddress}</span>
        </div>
      </div>

      <div className="messages-container">
        {isLoadingMessages ? (
          <div className="no-messages">
            <p>Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="no-messages">
            <p>No messages yet</p>
            <p className="no-messages-hint">
              Send a message to start the conversation
            </p>
          </div>
        ) : (
          messages
            .filter((message) => {
              // Filter out system messages (membership updates, etc.)
              // System messages typically have structured objects with fields like
              // addedInboxes, removedInboxes, etc.
              if (typeof message.content === "object" && message.content !== null) {
                // Check if it's a membership/system message by looking for specific fields
                if (
                  message.content.addedInboxes ||
                  message.content.removedInboxes ||
                  message.content.initiatedByInboxId
                ) {
                  return false; // Skip system messages
                }
              }
              return true; // Show all other messages
            })
            .map((message) => {
              const isSent = message.senderInboxId === xmtpClient?.inboxId;
              const timestamp = new Date(Number(message.sentAtNs) / 1_000_000);

              // Decode message content
              let messageText = "";
              if (typeof message.content === "string") {
                messageText = message.content;
              } else if (message.content instanceof Uint8Array) {
                messageText = new TextDecoder().decode(message.content);
              } else if (message.content?.content) {
                // If content is an object with a content property
                if (message.content.content instanceof Uint8Array) {
                  messageText = new TextDecoder().decode(message.content.content);
                } else {
                  messageText = String(message.content.content);
                }
              } else {
                messageText = JSON.stringify(message.content);
              }

              return (
                <div
                  key={message.id}
                  className={`message ${isSent ? "sent" : "received"}`}>
                  <div className="message-content">
                    <div className="message-text">{messageText}</div>
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
        )}
      </div>

      <div className="message-input-container">
        <textarea
          className="message-input"
          placeholder="Type a message..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          rows="1"
          disabled={isSending}
        />
        <button
          className="send-btn"
          onClick={handleSend}
          disabled={!inputValue.trim() || isSending}>
          {isSending ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}

export default MessageArea;
