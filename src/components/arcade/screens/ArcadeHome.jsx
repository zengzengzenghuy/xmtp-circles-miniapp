import React from "react";
import GamePicker from "../components/GamePicker.jsx";

export default function ArcadeHome({
  connected,
  hasXmtp,
  games,
  selectedGameKey,
  recoverySummary,
  onSelectGame,
  onContinue,
  onResumeRecovery,
  onResetArcade,
  onOpenAccount,
}) {
  return (
    <div className="screen screen-stack-tight">
      {recoverySummary ? (
        <section className="panel section-intro">
          <p className="eyebrow">Saved session</p>
          <h2>Resume your last arcade session?</h2>
          <p className="muted">
            {recoverySummary.gameLabel} · {recoverySummary.phaseLabel}
            {recoverySummary.statusLabel ? ` · ${recoverySummary.statusLabel}` : ""}
          </p>
          <div className="action-stack arcade-recovery-actions">
            <button
              type="button"
              className="primary-btn full-width-mobile"
              onClick={onResumeRecovery}
            >
              Resume session
            </button>
            <button
              type="button"
              className="ghost-btn full-width-mobile"
              onClick={onResetArcade}
            >
              Start over
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel section-intro">
        <p className="eyebrow">Arcade</p>
        <h2>Pick a game and start a private XMTP match.</h2>
        <p className="muted">
          This arcade flow is fully offchain. Setup, invitation, gameplay, and
          results all happen through direct XMTP messages.
        </p>
      </section>

      <div className="panel-grid arcade-status-grid">
        <div className="panel summary-card">
          <p className="eyebrow">Wallet</p>
          <h2>{connected ? "Connected" : "Not connected"}</h2>
          <p className="muted">
            {connected
              ? "Wallet is ready for arcade sessions."
              : "Connect your wallet first."}
          </p>
        </div>

        <div className="panel summary-card">
          <p className="eyebrow">XMTP</p>
          <h2>{hasXmtp ? "Ready" : "Inbox required"}</h2>
          <p className="muted">
            {hasXmtp
              ? "Your XMTP inbox is ready to send game messages."
              : "Create or connect your XMTP inbox before playing."}
          </p>
        </div>
      </div>

      <GamePicker
        games={games}
        selectedGameKey={selectedGameKey}
        onSelectGame={onSelectGame}
      />

      {!connected || !hasXmtp ? (
        <button
          type="button"
          className="secondary-btn large-btn full-width-mobile"
          onClick={onOpenAccount}
        >
          Open account setup
        </button>
      ) : null}

      <button
        type="button"
        className="primary-btn large-btn full-width-mobile"
        disabled={!selectedGameKey || !connected || !hasXmtp}
        onClick={onContinue}
      >
        Continue to setup
      </button>
    </div>
  );
}
