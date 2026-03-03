import React from 'react';
import PieceShape from './PieceShape.jsx';

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
