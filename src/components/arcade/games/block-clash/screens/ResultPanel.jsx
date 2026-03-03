import React from 'react';
import ClashBoard from '../components/ClashBoard.jsx';

export default function BlockClashResultPanel({ gameState, revealState }) {
  return (
    <div className="panel-grid">
      <ClashBoard
        board={gameState.occupiedBoard}
        title="Final board"
        subtitle="The full placement history is replayed on the shared board."
      />

      <div className="panel">
        <p className="eyebrow">Reveal status</p>
        <ul className="check-list">
          <li>{revealState?.mine ? 'Your loadout revealed' : 'Your reveal pending'}</li>
          <li>{revealState?.opponent ? 'Opponent loadout revealed' : 'Opponent reveal pending'}</li>
        </ul>
      </div>
    </div>
  );
}
