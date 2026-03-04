import React from 'react';
import PieceShape from './PieceShape.jsx';
import { getPieceById } from '../helpers/pieces.js';

export default function RevealedLoadout({
  title,
  subtitle,
  pieceIds = [],
  usedPieceIds = [],
}) {
  const usedSet = new Set(usedPieceIds);

  return (
    <section className="panel revealed-loadout">
      <div className="revealed-loadout-copy">
        <h3>{title}</h3>
        {subtitle ? <p className="board-subtitle">{subtitle}</p> : null}
      </div>
      {!pieceIds.length ? <p className="muted">Reveal pending.</p> : null}
      <div className="revealed-loadout-grid">
        {pieceIds.map((pieceId) => {
          const piece = getPieceById(pieceId);
          const isUsed = usedSet.has(pieceId);

          return (
            <div
              key={pieceId}
              className={`revealed-piece${isUsed ? ' revealed-piece-used' : ' revealed-piece-unused'}`}
            >
              <div className="revealed-piece-shape">
                <PieceShape
                  piece={piece}
                  gridClassName="revealed-piece-grid"
                  cellClassName="revealed-piece-cell"
                  filledCellClassName="revealed-piece-cell-filled"
                />
              </div>
              <div className="revealed-piece-meta">
                <strong>{piece?.label || pieceId}</strong>
                <span>{isUsed ? 'Used' : 'Unused'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
