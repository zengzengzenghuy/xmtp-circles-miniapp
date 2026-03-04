import React from "react";

export default function SetupSession({
  selectedGame,
  setupState,
  invite,
  error,
  onAction,
  onCommit,
  onCancel,
}) {
  if (!selectedGame) {
    return null;
  }

  const SetupScreen = selectedGame.components.SetupScreen;

  return (
    <div className="arcade-stage">
      <SetupScreen
        setupState={setupState || selectedGame.createInitialSetupState()}
        onAction={onAction}
        onCommit={onCommit}
        onCancel={onCancel}
        invite={invite}
        error={error}
      />
    </div>
  );
}
