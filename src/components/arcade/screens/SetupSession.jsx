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
      <div className="panel section-intro">
        <p className="eyebrow">Game setup</p>
        <h2>{selectedGame.label}</h2>
        <p className="muted">
          {invite
            ? "Commit your hidden setup before joining the session."
            : "Commit your hidden setup before sharing the invite."}
        </p>
      </div>

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
