import React, { useState } from 'react';

export default function InviteLink({ inviteLink }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error('Failed to copy invite link', error);
    }
  }

  if (!inviteLink) {
    return null;
  }

  return (
    <div className="panel invite-panel">
      <div className="card-header">
        <p className="eyebrow">Invite</p>
        <h2>Share the link.</h2>
      </div>
      <div className="value-block">
        <code className="invite-link-code">{inviteLink}</code>
      </div>
      <button type="button" className="primary-btn full-width-mobile" onClick={handleCopy}>
        {copied ? 'Copied' : 'Copy invite link'}
      </button>
    </div>
  );
}
