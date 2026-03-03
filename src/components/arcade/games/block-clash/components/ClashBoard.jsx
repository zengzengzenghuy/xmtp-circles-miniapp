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
  const boardSize = Math.max(1, Math.round(Math.sqrt(board.length || 0)));

  return (
    <section className={`board-card ${highlighted ? 'board-card-highlighted' : ''} ${placementActive ? 'board-card-placement-active' : ''} ${className}`.trim()}>
      {title ? <h3>{title}</h3> : null}
      {subtitle ? <p className="board-subtitle">{subtitle}</p> : null}
      <div
        className="board-grid clash-board-grid"
        role="grid"
        style={{ gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))` }}
      >
        {board.map((value, index) => {
          const x = index % boardSize;
          const y = Math.floor(index / boardSize);
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
