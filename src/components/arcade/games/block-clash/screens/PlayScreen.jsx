import React from 'react';
import ClashBoard from '../components/ClashBoard.jsx';
import PiecePreview from '../components/PiecePreview.jsx';
import PieceTray from '../components/PieceTray.jsx';
import CollapsiblePanel from "../../../components/CollapsiblePanel.jsx";
import { getRemainingPieceIds } from '../helpers/board.js';
import { getPieceById } from '../helpers/pieces.js';

export default function BlockClashPlayScreen({
  gameState,
  role,
  isMyTurn,
  secretState,
  onAction,
}) {
  const myRemainingPieceIds = getRemainingPieceIds(
    secretState?.selectedPieceIds || gameState.mySelectedPieceIds,
    gameState.placements,
    role
  );
  const opponentRemainingCount = gameState.opponentSelectedPieceIdsRevealed?.length || 0;
  const selectedPiece = getPieceById(gameState.selectedPieceId);
  const selectedPieceLabel = selectedPiece?.label || 'No piece selected';

  return (
    <div className="screen">
      <div className="play-hud play-hud-clash">
        <div className="play-hud-card play-hud-primary">
          <span className="eyebrow">Turn</span>
          <strong>{isMyTurn ? 'Your move' : 'Opponent move'}</strong>
        </div>
        <div className="play-hud-card">
          <span className="eyebrow">My pieces</span>
          <strong>{myRemainingPieceIds.length}</strong>
        </div>
        <div className="play-hud-card">
          <span className="eyebrow">Opponent pieces</span>
          <strong>{opponentRemainingCount}</strong>
        </div>
      </div>

      <div className="block-clash-play-layout">
        <ClashBoard
          board={gameState.occupiedBoard}
          title="Shared board"
          subtitle={isMyTurn ? 'Tap a cell to place the selected piece.' : 'Waiting for the opponent move.'}
          onCellClick={isMyTurn ? (x, y) => onAction({ type: 'PLACE_SELECTED_PIECE', x, y }) : undefined}
          disabled={!isMyTurn}
          highlighted
          placementActive={Boolean(gameState.selectedPieceId)}
          className="block-clash-board"
        />

        <aside className="panel block-clash-side-panel">
          <PiecePreview
            pieceId={gameState.selectedPieceId}
            rotation={gameState.selectedRotation}
            onRotate={() => onAction({ type: 'ROTATE_SELECTED' })}
            compact
          />
          <div className="controls-inline-summary">
            {gameState.selectedPieceId
              ? `Tap preview to rotate. Then tap the board to place ${selectedPieceLabel}.`
              : 'Choose a piece below to start your move.'}
          </div>
          <PieceTray
            pieceIds={myRemainingPieceIds}
            selectedPieceId={gameState.selectedPieceId}
            disabledPieceIds={[]}
            onSelectPiece={(pieceId) => onAction({ type: 'SELECT_PIECE', pieceId })}
            layout="vertical"
            compact
          />
        </aside>
      </div>

      <CollapsiblePanel title="Tips" summary="3 quick rules" compact className="tips-panel">
        <ul className="check-list muted">
          <li>Choose a piece from your remaining set.</li>
          <li>Tap the preview to rotate it.</li>
          <li>Tap the board to place the selected piece.</li>
        </ul>
      </CollapsiblePanel>
    </div>
  );
}
