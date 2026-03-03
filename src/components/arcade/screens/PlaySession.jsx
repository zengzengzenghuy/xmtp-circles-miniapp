import React from "react";

export default function PlaySession({
  selectedGame,
  gameState,
  secretState,
  role,
  isMyTurn,
  info,
  onAction,
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
    </div>
  );
}
