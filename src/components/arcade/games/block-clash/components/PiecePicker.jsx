import React from 'react';
import PieceShape from './PieceShape.jsx';
import { getLoadoutCost, TOTAL_BUDGET } from '../helpers/pieces.js';

export default function PiecePicker({ pieces, selectedPieceIds, onTogglePiece }) {
  const currentCost = getLoadoutCost(selectedPieceIds);

  return (
    <div className="piece-picker">
      {pieces.map((piece) => {
        const active = selectedPieceIds.includes(piece.id);
        const wouldExceed = !active && (currentCost + piece.cost) > TOTAL_BUDGET;
        return (
          <button
            key={piece.id}
            type="button"
            className={`piece-card ${active ? 'piece-card-active' : ''} ${wouldExceed ? 'piece-card-disabled' : ''}`}
            onClick={() => !wouldExceed && onTogglePiece(piece.id)}
            disabled={wouldExceed}
            aria-label={piece.label}
          >
            <div className="piece-card-shape">
              <PieceShape piece={piece} />
            </div>
            <div className="piece-card-meta">
              <strong>{piece.label}</strong>
              <span className="piece-card-cost">{piece.cost} pt{piece.cost > 1 ? 's' : ''}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
