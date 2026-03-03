import React from "react";
import InviteLink from "../components/InviteLink.jsx";

export default function CreateInvite({
  selectedGame,
  session,
  summary = [],
  inviteLink,
  info,
  onReset,
}) {
  return (
    <div className="screen screen-stack-tight">
      <section className="panel section-intro">
        <p className="eyebrow">Invite ready</p>
        <h2>Share your {selectedGame?.label || "arcade"} session.</h2>
        <p className="muted">
          Send the invite link to your opponent. The game will start as soon as
          they join and complete the XMTP handshake.
        </p>
      </section>

      <div className="panel-grid inline-meta-grid">
        <div className="panel">
          <p className="eyebrow">Session ID</p>
          <code>{session.sessionId}</code>
        </div>
        <div className="panel">
          <p className="eyebrow">Status</p>
          <strong>{session.status.replaceAll("_", " ")}</strong>
        </div>
      </div>

      {summary.length ? (
        <div className="panel panel-muted">
          <p className="eyebrow">Setup summary</p>
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
        Cancel session
      </button>
    </div>
  );
}
