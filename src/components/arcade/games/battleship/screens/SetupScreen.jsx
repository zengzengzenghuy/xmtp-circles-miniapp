import React from 'react';
import ShipPlacer from '../components/ShipPlacer.jsx';
import { validateBoard } from '../helpers/board.js';

export default function SetupBoard({
  setupState,
  onAction,
  onCommit,
  onCancel,
  invite,
  error,
}) {
  const board = setupState?.board || [];
  const orientation = setupState?.orientation || 'horizontal';
  const isBoardValid = validateBoard(board).valid;

  return (
    <div className="screen">
      <section className="hero-card compact hero-card-compact">
        <p className="eyebrow">Setup</p>
        <h1>{invite ? 'Prepare your fleet to join the match.' : 'Prepare your fleet to host a match.'}</h1>
        <p>Place all five ships. Your board is committed locally before it is hashed for the game.</p>
      </section>

      <ShipPlacer
        board={board}
        orientation={orientation}
        onRotate={() => onAction({ type: 'SETUP_ROTATE' })}
        onReset={() => onAction({ type: 'SETUP_RESET' })}
        onCellClick={(x, y) => onAction({ type: 'SETUP_PLACE', x, y })}
      />

      {error ? <div className="banner error">{error}</div> : null}

      <div className="ship-setup-commit">
        <div className="action-stack">
          <button type="button" className="primary-btn large-btn full-width-mobile" onClick={onCommit} disabled={!isBoardValid}>
            Commit board and continue
          </button>
          <button type="button" className="ghost-btn full-width-mobile" onClick={onCancel}>
            Cancel session
          </button>
        </div>
      </div>
    </div>
  );
}
