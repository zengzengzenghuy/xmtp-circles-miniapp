import React from "react";

export default function JoinInvite({
  invite,
  selectedGame,
  summary = [],
  canJoin,
  needsAccountSetup,
  inviteStatus,
  info,
  onJoin,
  onResetArcade,
  onOpenAccount,
}) {
  const isExpired = inviteStatus?.state === "expired";
  const expiredMessage =
    inviteStatus?.reason === "session_result"
      ? "This session has already ended."
      : "This session has already been claimed by another player.";

  return (
    <div className="screen screen-stack-tight">
      <section className="panel section-intro">
        <p className="eyebrow">Join session</p>
        <h2>Join {selectedGame?.label || "arcade game"}.</h2>
        <p className="muted">
          Your setup is committed locally. Joining now sends the session
          handshake to the creator over XMTP.
        </p>
      </section>

      <div className="panel-grid inline-meta-grid">
        <div className="panel">
          <p className="eyebrow">Creator</p>
          <code>{invite.creatorAddress}</code>
        </div>
        <div className="panel">
          <p className="eyebrow">Session ID</p>
          <code>{invite.sessionId}</code>
        </div>
      </div>

      {summary.length ? (
        <div className="panel panel-muted">
          <p className="eyebrow">Your setup summary</p>
          <ul className="check-list">
            {summary.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {info ? <div className="banner info">{info}</div> : null}

      {isExpired ? (
        <section className="panel panel-muted screen-stack-tight">
          <div>
            <p className="eyebrow">Invite expired</p>
            <h3>This invite has expired.</h3>
            <p className="muted">{expiredMessage}</p>
          </div>
          <div className="section-actions">
            {onResetArcade ? (
              <button
                type="button"
                className="secondary-btn full-width-mobile"
                onClick={onResetArcade}
              >
                Back to Arcade
              </button>
            ) : null}
          </div>
        </section>
      ) : (
        <>
          {needsAccountSetup ? (
            <button
              type="button"
              className="secondary-btn full-width-mobile"
              onClick={onOpenAccount}
            >
              Open account setup
            </button>
          ) : null}

          <button
            type="button"
            className="primary-btn large-btn full-width-mobile"
            disabled={!canJoin || needsAccountSetup}
            onClick={onJoin}
          >
            Join session
          </button>
        </>
      )}
    </div>
  );
}
