import React, { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

function AccountPage({
  xmtpClient,
  isCreatingInbox,
  inboxError,
  onCreateInbox,
}) {
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const [showConnectors, setShowConnectors] = useState(false);
  const [activeTab, setActiveTab] = useState("connect");
  const [circlesMode, setCirclesMode] = useState(() => {
    // Load circles mode from localStorage
    const saved = localStorage.getItem("circles-mode");
    return saved === "true";
  });

  // Save circles mode to localStorage when it changes
  const handleCirclesModeToggle = () => {
    const newValue = !circlesMode;
    setCirclesMode(newValue);
    localStorage.setItem("circles-mode", String(newValue));
  };

  // Format address for display
  const formatAddress = (addr) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Filter connectors to only show MetaMask and WalletConnect
  const availableConnectors = connectors.filter(
    (connector) =>
      connector.name === "MetaMask" || connector.name === "WalletConnect",
  );

  // Debug: Log available connectors
  console.log("All connectors:", connectors);
  console.log("Available connectors:", availableConnectors);

  return (
    <div className="account-page">
      <div className="account-tabs">
        <button
          className={`account-tab ${activeTab === "connect" ? "active" : ""}`}
          onClick={() => setActiveTab("connect")}>
          Connect
        </button>
        <button
          className={`account-tab ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => setActiveTab("settings")}>
          Settings
        </button>
      </div>

      <div className="account-content">
        {activeTab === "connect" && (
          <div className="connect-section">
            {!isConnected ? (
              <div className="connect-container">
                <h2>Connect Wallet</h2>
                <p>Choose a wallet to connect to XMTP Chat</p>

                <div className="connector-list">
                  {availableConnectors.map((connector) => (
                    <button
                      key={connector.id}
                      onClick={() => {
                        console.log("Connecting to:", connector.name, connector);
                        connect(
                          { connector },
                          {
                            onSuccess: (data) => {
                              console.log("Connection successful:", data);
                            },
                            onError: (error) => {
                              console.error("Connection error:", error);
                              alert(`Connection failed: ${error.message}`);
                            },
                          }
                        );
                      }}
                      className="connector-button">
                      <span className="connector-name">{connector.name}</span>
                      <span className="connector-arrow">→</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="connected-container">
                <h2>Wallet & XMTP Inbox</h2>
                <div className="connected-info">
                  <div className="connected-address-box">
                    <span className="connected-label">Wallet Address</span>
                    <span className="connected-address-full">{address}</span>
                    <span className="connected-address-short">
                      {formatAddress(address)}
                    </span>
                  </div>

                  {xmtpClient ? (
                    <div className="inbox-status-box">
                      <span className="inbox-status-label">XMTP Inbox ID</span>
                      <span className="inbox-status-connected">
                        ✓ Connected
                      </span>
                      <span className="inbox-id">{xmtpClient.inboxId}</span>
                    </div>
                  ) : (
                    <div className="inbox-create-box">
                      <span className="inbox-label">XMTP Inbox ID</span>
                      <p className="inbox-description">
                        Create your XMTP inbox ID to start sending and receiving
                        messages. You'll be asked to sign a message to verify
                        your wallet.
                      </p>
                      {navigator.userAgent.includes("Brave") && (
                        <div
                          className="inbox-warning"
                          style={{
                            padding: "10px",
                            marginBottom: "10px",
                            backgroundColor: "#fff3cd",
                            border: "1px solid #ffc107",
                            borderRadius: "4px",
                            fontSize: "0.9em",
                          }}>
                          <strong>⚠️ Brave Browser Detected</strong>
                          <br />
                          If connection fails, disable Brave Shields
                          fingerprinting protection for this site.
                        </div>
                      )}
                      <button
                        className="create-inbox-button"
                        onClick={onCreateInbox}
                        disabled={isCreatingInbox}>
                        {isCreatingInbox
                          ? "Connecting to XMTP..."
                          : "Connect to XMTP"}
                      </button>
                      {inboxError && (
                        <div
                          className="inbox-error"
                          style={{ whiteSpace: "pre-wrap" }}>
                          {inboxError}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    className="disconnect-button"
                    onClick={() => disconnect()}>
                    Disconnect
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="settings-section">
            <h2>Settings</h2>
            <div className="settings-list">
              <div className="setting-item">
                <div className="setting-info">
                  <span className="setting-label">Circles mode(WIP)</span>
                  <span className="setting-description">
                    Enabled functionalities powered by Circles
                  </span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={circlesMode}
                    onChange={handleCirclesModeToggle}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AccountPage;
