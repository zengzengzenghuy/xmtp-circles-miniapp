import React from "react";

function BottomTabs({ activeTab, onTabChange }) {
  return (
    <div className="bottom-tabs">
      <button
        className={`tab-button ${activeTab === "chat" ? "active" : ""}`}
        onClick={() => onTabChange("chat")}>
        <span className="tab-icon">💬</span>
        <span className="tab-label">Chat</span>
      </button>
      <button
        className={`tab-button ${activeTab === "chatting-room" ? "active" : ""}`}
        onClick={() => onTabChange("chatting-room")}>
        <span className="tab-icon">🏠</span>
        <span className="tab-label">Circles group</span>
      </button>
      <button
        className={`tab-button ${activeTab === "arcade" ? "active" : ""}`}
        onClick={() => onTabChange("arcade")}>
        <span className="tab-icon">🎮</span>
        <span className="tab-label">Arcade</span>
      </button>
      <button
        className={`tab-button ${activeTab === "account" ? "active" : ""}`}
        onClick={() => onTabChange("account")}>
        <span className="tab-icon">👤</span>
        <span className="tab-label">Account</span>
      </button>
    </div>
  );
}

export default BottomTabs;
