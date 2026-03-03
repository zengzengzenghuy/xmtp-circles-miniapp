import React from 'react';

export default function ClashBoard({
  board = [],
  title,
  subtitle,
  onCellClick,
  disabled = false,
  highlighted = false,
  placementActive = false,
  className = "",
}) {
  return (
    <section className={`board-card ${highlighted ? 'board-card-highlighted' : ''} ${placementActive ? 'board-card-placement-active' : ''} ${className}`.trim()}>
      {title ? <h3>{title}</h3> : null}
      {subtitle ? <p className="board-subtitle">{subtitle}</p> : null}
      <div className="board-grid clash-board-grid" role="grid">
        {board.map((value, index) => {
          const x = index % 8;
          const y = Math.floor(index / 8);
          return (
            <button
              key={`${x}-${y}`}
              type="button"
              className={`cell clash-cell ${value === 1 ? 'clash-cell-me' : value === 2 ? 'clash-cell-opponent' : ''} ${placementActive && !disabled ? 'clash-cell-placement' : ''}`}
              disabled={disabled}
              onClick={onCellClick ? () => onCellClick(x, y) : undefined}
              aria-label={`${title || 'Board'} ${x + 1},${y + 1}`}
            >
              {value === 1 ? '■' : value === 2 ? '□' : ''}
            </button>
          );
        })}
      </div>
    </section>
  );
}
