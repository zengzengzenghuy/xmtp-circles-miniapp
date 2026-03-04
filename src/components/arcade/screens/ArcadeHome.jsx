import React from "react";
import GamePicker from "../components/GamePicker.jsx";

export default function ArcadeHome({
  connected,
  hasXmtp,
  games,
  selectedGameKey,
  recoverySummary,
  onSelectGame,
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
        <h2>Pick a game</h2>
      </section>

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
    </div>
  );
}
