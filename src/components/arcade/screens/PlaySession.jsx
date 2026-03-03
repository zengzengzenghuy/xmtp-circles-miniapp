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
  isResigning = false,
}) {
  if (!selectedGame) {
    return null;
  }

  const PlayScreen = selectedGame.components.PlayScreen;

  return (
    <div className="arcade-stage">
      {info ? <div className="banner info">{info}</div> : null}
      <div className="play-session-actions">
        <button
          type="button"
          className="ghost-btn"
          onClick={onResign}
          disabled={isResigning}
        >
          {isResigning ? "Resigning..." : "Resign session"}
        </button>
      </div>
      <PlayScreen
        gameState={gameState}
        role={role}
        isMyTurn={isMyTurn}
        secretState={secretState}
        onAction={onAction}
      />
    </div>
  );
}
