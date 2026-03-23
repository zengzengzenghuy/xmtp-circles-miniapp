import React from "react";

export default function JoinInvite({
  invite,
  selectedGame,
  summary = [],
  canJoin,
  info,
  onJoin,
  onOpenAccount,
}) {
  const creatorLabel = invite?.creatorAddress
    ? `${invite.creatorAddress.slice(0, 6)}...${invite.creatorAddress.slice(-4)}`
    : "Unknown";

  return (
    <div className="screen screen-stack-tight">
      <section className="panel section-intro">
        <p className="eyebrow">Join session</p>
        <h2>Join {selectedGame?.label || "arcade game"}.</h2>
        <p className="muted">Match created by {creatorLabel}.</p>
      </section>

      {summary.length ? (
        <div className="panel panel-muted">
          <p className="eyebrow">Your setup</p>
          <ul className="check-list">
            {summary.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {info ? <div className="banner info">{info}</div> : null}

      {!canJoin ? (
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
        disabled={!canJoin}
        onClick={onJoin}
      >
        Join
      </button>
    </div>
  );
}
