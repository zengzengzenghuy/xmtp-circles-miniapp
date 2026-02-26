import React, { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

function AccountPage({
  xmtpClient,
  isCreatingInbox,
  inboxError,
  onCreateInbox,
  circlesMode,
  onCirclesModeToggle,
  address: addressProp,
  isConnected: isConnectedProp,
  isMiniapp = false,
}) {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();

  // Use prop values when provided (miniapp mode), fall back to wagmi
  const address = addressProp !== undefined ? addressProp : wagmiAddress;
  const isConnected = isConnectedProp !== undefined ? isConnectedProp : wagmiConnected;
  const [showConnectors, setShowConnectors] = useState(false);
  const [activeTab, setActiveTab] = useState("connect");
  const [circlesProfile, setCirclesProfile] = useState(null);
  const [circlesLoading, setCirclesLoading] = useState(false);
  const [circlesError, setCirclesError] = useState(null);

  // Fetch Circles profile when Circles Mode is enabled
  useEffect(() => {
    const fetchCirclesProfile = async () => {
      if (!circlesMode || !address) {
        setCirclesProfile(null);
        setCirclesError(null);
        return;
      }

      setCirclesLoading(true);
      setCirclesError(null);

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
            params: [address],
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
        setCirclesError("Failed to fetch Circles profile");
      } finally {
        setCirclesLoading(false);
      }
    };

    fetchCirclesProfile();
  }, [circlesMode, address]);

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
                {isMiniapp ? (
                  <p>Waiting for host wallet connection...</p>
                ) : (
                  <>
                    <p>Choose a wallet to connect to XMTP Chat</p>
                    <div className="connector-list">
                      {availableConnectors.length === 0 ? (
                        <p style={{ color: "#999", textAlign: "center" }}>
                          No connectors available. Please check your configuration.
                        </p>
                      ) : (
                        availableConnectors.map((connector) => (
                          <button
                            key={connector.id}
                            onClick={() => {
                              console.log(
                                "Connecting to:",
                                connector.name,
                                connector,
                              );
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
                                },
                              );
                            }}
                            className="connector-button">
                            <span className="connector-name">{connector.name}</span>
                            <span className="connector-arrow">→</span>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
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
                        Connect to XMTP to start sending and receiving messages.
                        You'll be asked to sign a message to verify your wallet.
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

                  {circlesMode && (
                    <div className="circles-status-box">
                      <span className="circles-status-label">
                        Circles Status
                      </span>
                      {circlesLoading ? (
                        <span className="circles-loading">
                          Loading Circles profile...
                        </span>
                      ) : circlesError ? (
                        <span className="circles-error">{circlesError}</span>
                      ) : circlesProfile ? (
                        <div className="circles-profile">
                          <div className="circles-profile-content">
                            {circlesProfile.previewImageUrl && (
                              <img
                                src={circlesProfile.previewImageUrl}
                                alt={circlesProfile.name}
                                className="circles-avatar"
                              />
                            )}
                            <div className="circles-info">
                              <span className="circles-name">
                                Name: {circlesProfile.name}
                              </span>
                              {circlesProfile.description && (
                                <span className="circles-description">
                                  {circlesProfile.description}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="circles-not-found">
                          Your account is not registered on Circles. Go to
                          app.gnosis.io
                        </span>
                      )}
                    </div>
                  )}

                  {isMiniapp ? (
                    <p style={{ color: "#888", fontSize: "0.85em", margin: "8px 0 0" }}>
                      Connected via Circles host wallet
                    </p>
                  ) : (
                    <button
                      className="disconnect-button"
                      onClick={() => disconnect()}>
                      Disconnect
                    </button>
                  )}
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
                    onChange={onCirclesModeToggle}
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
