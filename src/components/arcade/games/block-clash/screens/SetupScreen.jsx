import React from 'react';
import PiecePicker from '../components/PiecePicker.jsx';
import { MAX_LOADOUT_SIZE, PIECE_CATALOG } from '../helpers/pieces.js';

export default function BlockClashSetupScreen({
  setupState,
  onAction,
  onCommit,
  onCancel,
  invite,
  error,
}) {
  return (
    <div className="screen">
      <section className="hero-card compact hero-card-compact">
        <p className="eyebrow">Block Clash setup</p>
        <h1>{invite ? 'Lock your private loadout to join the match.' : 'Choose your loadout to host a match.'}</h1>
        <p>Pick up to {MAX_LOADOUT_SIZE} unique pieces from the shared catalog. Your choices stay hidden until the end.</p>
      </section>

      <div className="panel">
        <p className="eyebrow">Selected pieces</p>
        <h2>{setupState.selectedPieceIds.length} / {MAX_LOADOUT_SIZE}</h2>
        <p className="muted">Both players choose from the same catalog, but keep their own loadout private during play.</p>
      </div>

      <PiecePicker
        pieces={PIECE_CATALOG}
        selectedPieceIds={setupState.selectedPieceIds}
        onTogglePiece={(pieceId) => onAction({ type: 'SETUP_TOGGLE_PIECE', pieceId })}
      />

      {error ? <div className="banner error">{error}</div> : null}

      <div className="action-stack">
        <button type="button" className="primary-btn large-btn full-width-mobile" onClick={onCommit}>
          Commit loadout and continue
        </button>
        <button type="button" className="ghost-btn full-width-mobile" onClick={onCancel}>
          Cancel session
        </button>
      </div>
    </div>
  );
}
