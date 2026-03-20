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
  const handlePickGame = (gameKey) => {
    onSelectGame(gameKey);

    if (
      connected &&
      hasXmtp &&
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 768px)").matches
    ) {
      onContinue(gameKey);
    }
  };

  return (
    <div className="screen screen-stack-tight">
      {recoverySummary ? (
        <section className="panel section-intro">
          <p className="eyebrow">Saved session</p>
          <h2>Resume your last match?</h2>
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

      <GamePicker
        games={games}
        selectedGameKey={selectedGameKey}
        onSelectGame={handlePickGame}
      />

      {!connected || !hasXmtp ? (
        <div className="panel panel-muted">
          <p className="eyebrow">Setup needed</p>
          <p className="muted">
            Connect your wallet and XMTP inbox before starting a match.
          </p>
        </div>
      ) : null}

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
        Continue
      </button>
    </div>
  );
}
