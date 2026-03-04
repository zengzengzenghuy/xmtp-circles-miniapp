import React from 'react';
import RevealedLoadout from '../components/RevealedLoadout.jsx';
import { getUsedPieceIds } from '../helpers/board.js';

export default function BlockClashResultPanel({ gameState, revealState, role }) {
  const myPieceIds = revealState?.mine?.selectedPieceIds || gameState?.mySelectedPieceIds || [];
  const opponentPieceIds = revealState?.opponent?.selectedPieceIds || gameState?.reveal?.opponent?.selectedPieceIds || [];
  const myPlayer = role === 'joiner' ? 'joiner' : 'creator';
  const opponentPlayer = myPlayer === 'creator' ? 'joiner' : 'creator';
  const myUsedPieceIds = getUsedPieceIds(gameState?.placements || [], myPlayer);
  const opponentUsedPieceIds = getUsedPieceIds(gameState?.placements || [], opponentPlayer);

  return (
    <div className="panel-grid block-clash-result-grid">
      <RevealedLoadout
        title="Your pieces"
        subtitle="Unused pieces are highlighted."
        pieceIds={myPieceIds}
        usedPieceIds={myUsedPieceIds}
      />
      <RevealedLoadout
        title="Opponent pieces"
        subtitle="Unused pieces are highlighted."
        pieceIds={opponentPieceIds}
        usedPieceIds={opponentUsedPieceIds}
      />
    </div>
  );
}
