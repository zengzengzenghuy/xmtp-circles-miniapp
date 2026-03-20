import React from 'react';
import SegmentedTabs from './SegmentedTabs.jsx';
import { GAME_KEYS } from '../helpers/constants.js';

const BattleshipIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M5 13h14l-1.8 3.2a2 2 0 0 1-1.75 1.03H8.55A2 2 0 0 1 6.8 16.2L5 13Z"
      fill="currentColor"
      opacity="0.22"
    />
    <path
      d="M7 13V9.5A2.5 2.5 0 0 1 9.5 7H11V5.5A1.5 1.5 0 0 1 12.5 4h1"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M4.5 13h15"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M5.5 18.5c.7.55 1.4.82 2.1.82 1.05 0 1.58-.6 2.36-.6.78 0 1.3.6 2.35.6 1.05 0 1.58-.6 2.36-.6.78 0 1.31.6 2.36.6.78 0 1.47-.27 2.07-.82"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const BlockClashIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="4" y="5" width="5" height="5" rx="1.2" fill="currentColor" opacity="0.22" />
    <rect x="10" y="5" width="5" height="5" rx="1.2" fill="currentColor" opacity="0.34" />
    <rect x="10" y="11" width="5" height="5" rx="1.2" fill="currentColor" opacity="0.46" />
    <rect x="15.5" y="11" width="4.5" height="4.5" rx="1.1" fill="currentColor" opacity="0.18" />
    <path
      d="M4.9 5.9h3.2v3.2H4.9zM10.9 5.9h3.2v3.2h-3.2zM10.9 11.9h3.2v3.2h-3.2z"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
);

function GameIcon({ gameKey }) {
  if (gameKey === GAME_KEYS.BATTLESHIP) {
    return <BattleshipIcon />;
  }

  if (gameKey === GAME_KEYS.BLOCK_CLASH) {
    return <BlockClashIcon />;
  }

  return null;
}

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
            <p className="eyebrow">Game</p>
            <div className="game-card-title-row">
              <div className="game-card-icon">
                <GameIcon gameKey={game.key} />
              </div>
              <h2>{game.label}</h2>
            </div>
          </div>
          <p className="muted">{game.description}</p>
        </button>
      ))}
    </div>
  );
}
