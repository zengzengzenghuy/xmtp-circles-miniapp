import React from "react";
import InviteLink from "../components/InviteLink.jsx";

export default function CreateInvite({
  selectedGame,
  summary = [],
  inviteLink,
  info,
  onReset,
}) {
  return (
    <div className="screen screen-stack-tight">
      <section className="panel section-intro">
        <p className="eyebrow">Invite ready</p>
        <h2>Share your {selectedGame?.label || "arcade"} link.</h2>
        <p className="muted">The match starts once your opponent joins.</p>
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

      <InviteLink inviteLink={inviteLink} />

      <button
        type="button"
        className="ghost-btn full-width-mobile"
        onClick={onReset}
      >
        Cancel
      </button>
    </div>
  );
}
