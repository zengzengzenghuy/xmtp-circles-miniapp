import React from 'react';
import Board from './Board.jsx';
import { getRemainingShips } from '../helpers/board.js';

export default function ShipPlacer({
  board,
  orientation,
  onRotate,
  onReset,
  onCellClick,
}) {
  const remainingShips = getRemainingShips(board);
  const nextShip = remainingShips[0] || null;
  const totalShipsCount = 5;
  const placedShipsCount = totalShipsCount - remainingShips.length;

  return (
    <div className="ship-placer">
      <div className="battleship-setup-board-wrap">
        <Board
          board={board}
          showShips
          onCellClick={onCellClick}
          title="Your fleet"
          className="battleship-setup-board"
        />
      </div>

      <div className="panel">
        <p className="eyebrow">
          {nextShip ? `Place ${nextShip.name}` : 'Fleet ready'}
        </p>
        <p className="muted">
          {nextShip
            ? `Length ${nextShip.length} · Placing ${placedShipsCount + 1} of ${totalShipsCount}`
            : `All ${totalShipsCount} ships placed. Commit when ready.`}
        </p>
        <div className="ship-progress-inline" style={{ marginTop: '0.5rem' }}>
          <span className={`ship-pill ${nextShip ? 'active' : 'ready'}`}>
            {nextShip ? `${remainingShips.length} ships left` : 'Fleet ready'}
          </span>
          {remainingShips
            .filter((ship) => ship !== nextShip)
            .map((ship) => (
              <span key={ship.id} className="ship-pill">
                {ship.name}
              </span>
            ))}
        </div>
      </div>

      <div className="action-stack" style={{ flexDirection: 'row', gap: '0.5rem' }}>
        <button type="button" className="secondary-btn" onClick={onRotate}>
          Rotate: {orientation}
        </button>
        <button type="button" className="ghost-btn" onClick={onReset}>
          Reset board
        </button>
      </div>
    </div>
  );
}
