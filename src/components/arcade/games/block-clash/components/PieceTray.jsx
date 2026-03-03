import React from 'react';

export default function PieceTray({
  pieceIds = [],
  selectedPieceId,
  disabledPieceIds = [],
  onSelectPiece,
  compact = false,
}) {
  return (
    <div className={`scroll-row piece-tray ${compact ? 'piece-tray-compact' : ''}`.trim()}>
      {pieceIds.map((pieceId) => {
        const disabled = disabledPieceIds.includes(pieceId);
        return (
          <button
            key={pieceId}
            type="button"
            className={`ship-pill piece-chip ${compact ? 'piece-chip-compact' : ''} ${selectedPieceId === pieceId ? 'active' : ''} ${disabled ? 'piece-chip-disabled' : ''}`.trim()}
            disabled={disabled}
            onClick={() => onSelectPiece(pieceId)}
          >
            <span className="piece-chip-label">{pieceId.replace(/_/g, ' ')}</span>
          </button>
        );
      })}
    </div>
  );
}
