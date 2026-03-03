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
          <div className="game-card-top">
            <p className="eyebrow">Arcade game</p>
            <h2>{game.label}</h2>
          </div>
          <p className="muted">{game.description}</p>
        </button>
      ))}
    </div>
  );
}
