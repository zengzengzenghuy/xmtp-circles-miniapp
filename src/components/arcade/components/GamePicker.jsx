import React from 'react';
import SegmentedTabs from './SegmentedTabs.jsx';

export default function GamePicker({ games, selectedGameKey, onSelectGame, variant = 'cards' }) {
  if (variant === 'tabs') {
    return (
      <SegmentedTabs
        items={games.map((game) => ({ id: game.key, label: game.label }))}
        value={selectedGameKey}
        onChange={onSelectGame}
        size="sm"
        tone="soft"
      />
    );
  }

  return (
    <div className="game-picker">
      {games.map((game) => (
        <button
          key={game.key}
          type="button"
          className={`game-card ${selectedGameKey === game.key ? 'game-card-active' : ''}`}
          onClick={() => onSelectGame(game.key)}
        >
          <div className="game-card-icon">{game.icon || '🎮'}</div>
          <div className="game-card-info">
            <h3>{game.label}</h3>
            <p className="muted">{game.shortDescription || game.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
