import React from 'react';
import PiecePicker from '../components/PiecePicker.jsx';
import { TOTAL_BUDGET, PIECE_CATALOG, getLoadoutCost } from '../helpers/pieces.js';

export default function BlockClashSetupScreen({
  setupState,
  onAction,
  onCommit,
  onCancel,
  invite,
  error,
}) {
  const currentCost = getLoadoutCost(setupState.selectedPieceIds);
  const budgetReached = currentCost === TOTAL_BUDGET;

  return (
    <div className="screen">
      <section className="hero-card compact hero-card-compact">
        <p className="eyebrow">Block Clash setup</p>
        <h1>{invite ? 'Lock your private loadout to join the match.' : 'Choose your loadout to host a match.'}</h1>
        <p>Pick pieces totaling {TOTAL_BUDGET} cost points. Small (2-4 blocks) = 1 pt, medium (6) = 2 pts, large (8) = 4 pts.</p>
      </section>

      <div className="panel">
        <p className="eyebrow">Budget</p>
        <h2>{currentCost} / {TOTAL_BUDGET}</h2>
        <p className="muted">{setupState.selectedPieceIds.length} pieces selected. Your loadout stays private during play.</p>
      </div>

      <PiecePicker
        pieces={PIECE_CATALOG}
        selectedPieceIds={setupState.selectedPieceIds}
        onTogglePiece={(pieceId) => onAction({ type: 'SETUP_TOGGLE_PIECE', pieceId })}
      />

      {error ? <div className="banner error">{error}</div> : null}

      <div className="action-stack" style={{ flexDirection: 'row', gap: '0.75rem' }}>
        <button type="button" className="primary-btn large-btn full-width-mobile" onClick={onCommit} disabled={!budgetReached}>
          Commit loadout and continue
        </button>
        <button type="button" className="ghost-btn full-width-mobile" onClick={onCancel}>
          Cancel session
        </button>
      </div>
    </div>
  );
}
