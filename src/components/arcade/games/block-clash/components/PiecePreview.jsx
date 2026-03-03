import React from 'react';
import { getRotatedPieceCells } from '../helpers/pieces.js';

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

  const cells = getRotatedPieceCells(pieceId, rotation);
  const width = Math.max(...cells.map(([x]) => x)) + 1;
  const height = Math.max(...cells.map(([, y]) => y)) + 1;
  const filled = new Set(cells.map(([x, y]) => `${x}:${y}`));

  return (
    <button
      type="button"
      className={classes}
      onClick={interactive ? onRotate : undefined}
      disabled={!interactive}
    >
      <div className="piece-preview-copy">
        <p className="eyebrow">Piece preview</p>
        <h2>{pieceId}</h2>
        <p className="muted">{interactive ? `Tap to rotate · ${rotation}°` : `Rotation ${rotation}°`}</p>
      </div>
      <div className="piece-preview-grid" style={{ gridTemplateColumns: `repeat(${width}, 1fr)` }}>
        {Array.from({ length: width * height }, (_, index) => {
          const x = index % width;
          const y = Math.floor(index / width);
          return (
            <span
              key={`${x}-${y}`}
              className={`piece-preview-cell ${filled.has(`${x}:${y}`) ? 'piece-preview-cell-filled' : ''}`}
            />
          );
        })}
      </div>
    </button>
  );
}
