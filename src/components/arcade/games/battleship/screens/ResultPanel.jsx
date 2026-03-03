import React from 'react';
import Board from '../components/Board.jsx';

export default function BattleshipResultPanel({ gameState, revealState }) {
  const board = revealState?.mine?.board || gameState?.board || [];
  const opponentReveal = revealState?.opponent || gameState?.reveal || {};

  return (
    <div className="panel-grid boards-grid">
      <Board
        board={board}
        shots={gameState.opponentShots}
        showShips
        title="Your revealed board"
        subtitle="Checked against your original commitment and incoming shot history."
      />
      <Board
        board={opponentReveal.board?.length === 100 ? opponentReveal.board : (gameState.reveal?.opponentBoard?.length === 100 ? gameState.reveal.opponentBoard : Array(100).fill(0))}
        shots={gameState.myShots}
        showShips={Boolean(opponentReveal.board?.length === 100 || gameState.reveal?.opponentBoard?.length === 100)}
        title="Opponent revealed board"
        subtitle="Opponent reveal stays hidden until the board and salt are received."
      />

      <div className="panel">
        <p className="eyebrow">Verification</p>
        <ul className="check-list">
          <li>{gameState.reveal?.myBoardVerified ? 'Your board proof verified' : 'Your board proof pending'}</li>
          <li>{gameState.reveal?.opponentBoardVerified ? 'Opponent board proof verified' : 'Opponent board proof pending'}</li>
          <li>{gameState.reveal?.shotsVerified ? 'Shot history verified' : 'Shot history pending'}</li>
        </ul>
      </div>
    </div>
  );
}
