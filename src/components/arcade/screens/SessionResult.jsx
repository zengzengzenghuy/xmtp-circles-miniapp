import React from "react";

export default function SessionResult({
  address,
  selectedGame,
  gameState,
  secretState,
  winner,
  verification,
  info,
  onPlayAgain,
  onReset,
}) {
  if (!selectedGame) {
    return null;
  }

  const ResultPanel = selectedGame.components.ResultPanel;
  const didWin =
    winner && address && String(winner).toLowerCase() === String(address).toLowerCase();

  return (
    <div className="screen screen-stack-tight">
      <section className="panel section-intro result-hero">
        <p className="eyebrow">Result</p>
        <h2>
          {winner ? (didWin ? "You won the session." : "You lost the session.") : "Result pending"}
        </h2>
        <div className="value-block">
          <span className="eyebrow">Winner</span>
          <code>{winner || "Unknown"}</code>
        </div>
      </section>

      {info ? <div className="banner info">{info}</div> : null}

      {verification.reason ? (
        <div className={`banner ${verification.contested ? "error" : "info"}`}>
          {verification.reason}
        </div>
      ) : null}

      <ResultPanel
        gameState={gameState}
        revealState={{
          mine: secretState,
          opponent: gameState?.reveal?.opponent || null,
        }}
      />

      <div className="panel action-stack">
        <button
          type="button"
          className="primary-btn full-width-mobile"
          onClick={onPlayAgain}
        >
          Play again
        </button>
        <button
          type="button"
          className="ghost-btn full-width-mobile"
          onClick={onReset}
        >
          Back to arcade
        </button>
      </div>
    </div>
  );
}
