import React from 'react';
import Cell from './Cell.jsx';

export default function Board({
  board,
  shots = [],
  showShips = false,
  disabled = false,
  onCellClick,
  title,
  subtitle,
  highlighted = false,
  className = '',
}) {
  const shotMap = new Map(shots.map((shot) => [`${shot.x}:${shot.y}`, shot]));

  return (
    <section className={`board-card ${highlighted ? 'board-card-highlighted' : ''} ${className}`.trim()}>
      {title ? <h3>{title}</h3> : null}
      {subtitle ? <p className="board-subtitle">{subtitle}</p> : null}
      <div className="board-grid" role="grid">
        {board.map((value, index) => {
          const x = index % 10;
          const y = Math.floor(index / 10);
          const shot = shotMap.get(`${x}:${y}`) || null;
          return (
            <Cell
              key={`${x}-${y}`}
              value={value}
              shot={shot}
              showShips={showShips}
              disabled={disabled}
              onClick={onCellClick ? () => onCellClick(x, y) : undefined}
              label={`${title || 'Board'} ${x + 1},${y + 1}`}
            />
          );
        })}
      </div>
    </section>
  );
}
