import React from 'react';

export default function Cell({
  value = 0,
  shot = null,
  showShips = false,
  disabled = false,
  onClick,
  label = '',
}) {
  const status = shot?.hit ? (shot.sunkShipId ? 'sunk' : 'hit') : shot ? 'miss' : 'idle';
  const hasShip = value > 0;

  return (
    <button
      type="button"
      className={`cell cell-${status} ${showShips && hasShip ? 'cell-ship' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      {shot ? (shot.hit ? 'X' : '•') : showShips && hasShip ? value : ''}
    </button>
  );
}
