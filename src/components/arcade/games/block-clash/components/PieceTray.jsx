import React from 'react';
import PieceShape from './PieceShape.jsx';
import { getPieceById } from '../helpers/pieces.js';

export default function PieceTray({
  pieceIds = [],
  selectedPieceId,
  disabledPieceIds = [],
  onSelectPiece,
  layout = 'horizontal',
  compact = false,
}) {
  const isVertical = layout === 'vertical';

  return (
    <div
      className={`piece-tray ${isVertical ? 'piece-tray-vertical' : 'scroll-row'} ${compact ? 'piece-tray-compact' : ''}`.trim()}
    >
      {pieceIds.map((pieceId) => {
        const disabled = disabledPieceIds.includes(pieceId);
        const piece = getPieceById(pieceId);
        return (
          <button
            key={pieceId}
            type="button"
            className={`piece-chip ${compact ? 'piece-chip-compact' : ''} ${isVertical ? 'piece-chip-vertical' : ''} ${selectedPieceId === pieceId ? 'active' : ''} ${disabled ? 'piece-chip-disabled' : ''}`.trim()}
            disabled={disabled}
            onClick={() => onSelectPiece(pieceId)}
            aria-label={piece?.label || pieceId}
          >
            <div className="piece-chip-shape">
              <PieceShape
                piece={piece}
                gridClassName="piece-chip-shape-grid"
                cellClassName="piece-chip-shape-cell"
                filledCellClassName="piece-chip-shape-cell-filled"
              />
            </div>
            <div className="piece-chip-meta">
              <strong>{piece?.label || pieceId}</strong>
            </div>
          </button>
        );
      })}
    </div>
  );
}
