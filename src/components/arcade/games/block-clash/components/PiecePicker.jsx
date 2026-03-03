import React from 'react';
import { normalizeCells } from '../helpers/pieces.js';

function PieceShape({ piece }) {
  const cells = normalizeCells(piece.cells);
  const width = Math.max(...cells.map(([x]) => x)) + 1;
  const height = Math.max(...cells.map(([, y]) => y)) + 1;
  const filled = new Set(cells.map(([x, y]) => `${x}:${y}`));

  return (
    <div
      className="piece-card-shape-grid"
      style={{ gridTemplateColumns: `repeat(${width}, 1fr)` }}
      aria-hidden="true"
    >
      {Array.from({ length: width * height }, (_, index) => {
        const x = index % width;
        const y = Math.floor(index / width);
        return (
          <span
            key={`${piece.id}-${x}-${y}`}
            className={`piece-card-shape-cell ${filled.has(`${x}:${y}`) ? 'piece-card-shape-cell-filled' : ''}`}
          />
        );
      })}
    </div>
  );
}

export default function PiecePicker({ pieces, selectedPieceIds, onTogglePiece }) {
  return (
    <div className="piece-picker">
      {pieces.map((piece) => {
        const active = selectedPieceIds.includes(piece.id);
        return (
          <button
            key={piece.id}
            type="button"
            className={`piece-card ${active ? 'piece-card-active' : ''}`}
            onClick={() => onTogglePiece(piece.id)}
            aria-label={piece.label}
          >
            <div className="piece-card-shape">
              <PieceShape piece={piece} />
            </div>
            <div className="piece-card-meta">
              <strong>{piece.label}</strong>
            </div>
          </button>
        );
      })}
    </div>
  );
}
