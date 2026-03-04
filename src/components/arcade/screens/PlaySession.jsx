import React from "react";

export default function PlaySession({
  selectedGame,
  gameState,
  secretState,
  role,
  isMyTurn,
  info,
  onAction,
  onResign,
  onResetArcade,
  isResigning = false,
}) {
  if (!selectedGame) {
    return null;
  }

  const PlayScreen = selectedGame.components.PlayScreen;

  return (
    <div className="arcade-stage">
      {info ? <div className="banner info">{info}</div> : null}
      <PlayScreen
        gameState={gameState}
        role={role}
        isMyTurn={isMyTurn}
        secretState={secretState}
        onAction={onAction}
      />
      <div className="panel play-session-footer">
        <div className="play-session-footer-copy">
          <p className="eyebrow">Session actions</p>
          <p className="muted">
            Resign session ends the match and gives the opponent the win. Reset arcade just clears this local flow and returns home.
          </p>
        </div>
        <div className="play-session-footer-actions">
          <button
            type="button"
            className="primary-btn"
            onClick={onResign}
            disabled={isResigning}
          >
            {isResigning ? "Resigning..." : "Resign session"}
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={onResetArcade}
          >
            Reset arcade
          </button>
        </div>
      </div>
    </div>
  );
}
