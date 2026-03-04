import React from 'react';
import Board from './Board.jsx';
import { FLEET, getRemainingShips } from '../helpers/board.js';

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
  const remainingIds = new Set(remainingShips.map((ship) => ship.id));

  return (
    <div className="ship-placer ship-placer-grid">
      <div className="battleship-setup-board-wrap">
        <Board
          board={board}
          showShips
          onCellClick={onCellClick}
          title="Your fleet"
          className="battleship-setup-board"
        />
      </div>

      <aside className="panel ship-placer-side-panel">
        <p className="eyebrow">
          {nextShip ? `Place ${nextShip.name}` : 'Fleet ready'}
        </p>
        <p className="muted">
          {nextShip
            ? `Length ${nextShip.length} · Placing ${placedShipsCount + 1} of ${totalShipsCount}`
            : `All ${totalShipsCount} ships placed. Commit when ready.`}
        </p>
        <div className="ship-list ship-list-vertical" aria-label="Fleet status">
          {FLEET.map((ship) => {
            const isNext = nextShip?.id === ship.id;
            const isPlaced = !remainingIds.has(ship.id);
            return (
              <div
                key={ship.id}
                className={`ship-list-item${isNext ? ' active' : ''}${isPlaced ? ' placed' : ''}`}
              >
                <span>{ship.name}</span>
              </div>
            );
          })}
        </div>
        <div className="ship-controls-row">
          <button type="button" className="secondary-btn" onClick={onRotate}>
            Rotate: {orientation}
          </button>
          <button type="button" className="ghost-btn" onClick={onReset}>
            Reset board
          </button>
        </div>
      </aside>
    </div>
  );
}
