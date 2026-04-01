import React, { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { getProfileByAddress } from "../helpers/circlesRpcCall";

function AccountPage({
  xmtpClient,
  isCreatingInbox,
  inboxError,
  onCreateInbox,
  circlesMode,
  onCirclesModeToggle,
  xmtpEnv = "dev",
  onXmtpEnvChange,
  address: addressProp,
  isConnected: isConnectedProp,
  isMiniapp = false,
}) {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();

  // Use prop values when provided (miniapp mode), fall back to wagmi
  const address = addressProp !== undefined ? addressProp : wagmiAddress;
  const isConnected =
    isConnectedProp !== undefined ? isConnectedProp : wagmiConnected;
  const [activeTab, setActiveTab] = useState("connect");
  const [circlesProfile, setCirclesProfile] = useState(null);
  const [circlesLoading, setCirclesLoading] = useState(false);
  const [circlesError, setCirclesError] = useState(null);
  const [connectError, setConnectError] = useState(null);

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
        const profile = await getProfileByAddress(address);
        setCirclesProfile(profile);
      } catch (error) {
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

  const accountStatus = !isConnected
    ? "Wallet disconnected"
    : xmtpClient
      ? "Messaging ready"
      : "Wallet connected";
  const accountStatusTone = !isConnected
    ? "muted"
    : xmtpClient
      ? "success"
      : "warning";

  return (
    <div className="account-page">
      <div className="account-content">
        <div className="account-shell">
          <div className="account-hero">
            <div className="account-hero-copy">
              <span className="account-eyebrow">Account</span>
              <h1>Wallet, profile, and messaging</h1>
              <p>
                Keep your wallet connection, XMTP inbox, and Circles identity
                aligned with the rest of the app.
              </p>
            </div>
            <div className={`account-status-pill ${accountStatusTone}`}>
              {accountStatus}
            </div>
          </div>

          <div className="account-tabs">
            <button
              className={`account-tab ${activeTab === "connect" ? "active" : ""}`}
              onClick={() => setActiveTab("connect")}>
              Overview
            </button>
            <button
              className={`account-tab ${activeTab === "settings" ? "active" : ""}`}
              onClick={() => setActiveTab("settings")}>
              Settings
            </button>
          </div>

          {activeTab === "connect" && (
            <div className="account-section">
              {!isConnected ? (
                <div className="account-panel">
                  <div className="account-panel-header">
                    <div>
                      <span className="account-panel-kicker">Wallet</span>
                      <h2>Connect your account</h2>
                      <p>
                        Use the wallet you want to message from. Once connected,
                        you can activate XMTP and start chatting immediately.
                      </p>
                    </div>
                  </div>

                  {isMiniapp ? (
                    <div className="account-inline-note">
                      Waiting for the host wallet connection from Circles.
                    </div>
                  ) : (
                    <>
                      {availableConnectors.length === 0 ? (
                        <div className="account-empty-state">
                          No supported wallet connectors are available in the
                          current configuration.
                        </div>
                      ) : (
                        <div className="connector-list">
                          {availableConnectors.map((connector) => (
                            <button
                              key={connector.id}
                              onClick={() => {
                                setConnectError(null);
                                connect(
                                  { connector },
                                  {
                                    onError: (error) => {
                                      console.error("Connection error:", error);
                                      setConnectError(
                                        error.message ||
                                          "Failed to connect wallet",
                                      );
                                    },
                                  },
                                );
                              }}
                              className="connector-button">
                              <div className="connector-button-copy">
                                <span className="connector-name">
                                  {connector.name}
                                </span>
                                <span className="connector-description">
                                  Connect and approve signatures for chat.
                                </span>
                              </div>
                              <span className="connector-arrow">{"->"}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {connectError && (
                        <div className="account-inline-error">{connectError}</div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <>
                  {circlesMode && (
                    <div className="account-panel">
                      <div className="account-panel-header">
                        <div>
                          <span className="account-panel-kicker">Profile</span>
                          <h2>Circles identity</h2>
                        </div>
                      </div>
                      <div className="circles-profile-box">
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
                                  {circlesProfile.name}
                                </span>
                                <span className="circles-wallet-address">
                                  {address}
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
                            No Circles profile found for this wallet yet.
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="account-panel">
                    <div className="account-panel-header">
                      <div>
                        <span className="account-panel-kicker">Messaging</span>
                        <h2>XMTP inbox</h2>
                        <p>
                          This inbox powers wallet-to-wallet messages across the
                          chat section.
                        </p>
                      </div>
                    </div>

                    {xmtpClient ? (
                      <div className="inbox-status-box">
                        <span className="inbox-status-label">XMTP Inbox ID</span>
                        <span className="inbox-status-connected">
                          Active and synced
                        </span>
                        <span className="inbox-id">{xmtpClient.inboxId}</span>
                      </div>
                    ) : (
                      <div className="inbox-create-box">
                        <span className="inbox-label">XMTP Inbox</span>
                        <p className="inbox-description">
                          Activate messaging for this wallet. You&apos;ll be
                          asked to sign a message once.
                        </p>
                        {navigator.userAgent.includes("Brave") && (
                          <div className="inbox-warning">
                            Brave can block the signature flow. If activation
                            fails, disable Brave Shields fingerprinting
                            protection for this site and try again.
                          </div>
                        )}
                        <button
                          className="create-inbox-button"
                          onClick={onCreateInbox}
                          disabled={isCreatingInbox}>
                          {isCreatingInbox
                            ? "Connecting to XMTP..."
                            : "Activate XMTP Inbox"}
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
                  </div>

                  <div className="account-panel">
                    <div className="account-panel-header">
                      <div>
                        <span className="account-panel-kicker">Connection</span>
                        <h2>Disconnect wallet</h2>
                        <p>
                          Disconnect your wallet from this app. You can reconnect
                          at any time.
                        </p>
                      </div>
                    </div>
                    <button
                      className="disconnect-button"
                      onClick={() => disconnect()}>
                      Disconnect Wallet
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "settings" && (
            <div className="account-section">
              <div className="account-panel">
                <div className="account-panel-header">
                  <div>
                    <span className="account-panel-kicker">Preferences</span>
                    <h2>Chat display settings</h2>
                    <p>
                      Keep name resolution and profile details consistent across
                      the chat UI.
                    </p>
                  </div>
                </div>
                <div className="settings-item">
                  <div className="settings-item-info">
                    <span className="settings-item-label">Circles Profiles</span>
                    <span className="settings-item-description">
                      Show Circles names and avatars in conversations
                    </span>
                  </div>
                  <button
                    className={`settings-toggle ${circlesMode ? "active" : ""}`}
                    onClick={onCirclesModeToggle}
                    aria-label="Toggle Circles mode">
                    <span className="settings-toggle-knob" />
                  </button>
                </div>
                <div className="settings-item">
                  <div className="settings-item-info">
                    <span className="settings-item-label">XMTP Environment</span>
                    <span className="settings-item-description">
                      Network used when activating your XMTP inbox
                    </span>
                  </div>
                  <select
                    className="settings-select"
                    value={xmtpEnv}
                    onChange={(e) => onXmtpEnvChange(e.target.value)}>
                    <option value="dev">dev</option>
                    <option value="production">production</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AccountPage;
