import React from "react";

const MessagesIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const ArcadeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <circle cx="8" cy="12" r="2" />
    <path d="M16 10v4" />
    <path d="M14 12h4" />
  </svg>
);

const AccountIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M20 21a8 8 0 0 0-16 0" />
  </svg>
);

function BottomTabs({ activeTab, onTabChange }) {
  return (
    <div className="bottom-tabs">
      <button
        className={`tab-button ${activeTab === "chat" ? "active" : ""}`}
        onClick={() => onTabChange("chat")}>
        <span className="tab-icon"><MessagesIcon /></span>
        <span className="tab-label">Messages</span>
      </button>
      {/* Circles group tab hidden for now
      <button
        className={`tab-button ${activeTab === "chatting-room" ? "active" : ""}`}
        onClick={() => onTabChange("chatting-room")}>
        <span className="tab-icon">🏠</span>
        <span className="tab-label">Circles group</span>
      </button>
      */}
      <button
        className={`tab-button ${activeTab === "arcade" ? "active" : ""}`}
        onClick={() => onTabChange("arcade")}>
        <span className="tab-icon"><ArcadeIcon /></span>
        <span className="tab-label">Arcade</span>
      </button>
      <button
        className={`tab-button ${activeTab === "account" ? "active" : ""}`}
        onClick={() => onTabChange("account")}>
        <span className="tab-icon"><AccountIcon /></span>
        <span className="tab-label">Account</span>
      </button>
    </div>
  );
}

export default BottomTabs;
