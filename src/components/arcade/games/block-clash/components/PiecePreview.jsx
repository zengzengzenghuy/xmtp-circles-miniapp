import React from 'react';
import PieceShape from './PieceShape.jsx';
import { getPieceById } from '../helpers/pieces.js';

export default function PiecePreview({ pieceId, rotation, onRotate, compact = false }) {
  const interactive = Boolean(pieceId && onRotate);
  const classes = `panel piece-preview ${compact ? 'piece-preview-compact' : ''} ${interactive ? 'piece-preview-interactive' : ''}`.trim();

  if (!pieceId) {
    return (
      <div className={`panel panel-muted piece-preview ${compact ? 'piece-preview-compact' : ''}`.trim()}>
        <p className="eyebrow">Piece preview</p>
        <p className="muted">Choose a piece to preview its footprint.</p>
      </div>
    );
  }

  const piece = getPieceById(pieceId);

  return (
    <button
      type="button"
      className={classes}
      onClick={interactive ? onRotate : undefined}
      disabled={!interactive}
    >
      <div className="piece-preview-copy">
        <p className="eyebrow">Piece preview</p>
        <h2>{piece?.label || pieceId}</h2>
        <p className="muted">{interactive ? `Tap to rotate · ${rotation}°` : `Rotation ${rotation}°`}</p>
      </div>
      <div className="piece-preview-shape-wrap">
        <PieceShape
          pieceId={pieceId}
          rotation={rotation}
          gridClassName="piece-preview-grid"
          cellClassName="piece-preview-cell"
          filledCellClassName="piece-preview-cell-filled"
        />
      </div>
    </button>
  );
}
