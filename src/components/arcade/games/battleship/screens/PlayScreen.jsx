import React, { useEffect, useMemo, useState } from 'react';
import Board from '../components/Board.jsx';
import StatusBar from "../../../components/StatusBar.jsx";
import SegmentedTabs from "../../../components/SegmentedTabs.jsx";
import CollapsiblePanel from "../../../components/CollapsiblePanel.jsx";

export default function GameBoard({
  gameState,
  role,
  isMyTurn,
  secretState,
  onAction,
}) {
  const board = secretState?.board || gameState?.board || [];
  const opponentAddress = gameState?.opponentAddress || '';
  const [activeBoardTab, setActiveBoardTab] = useState('tracking');
  const [seenIncomingShotCount, setSeenIncomingShotCount] = useState(0);
  const [boardSwitcherOpen, setBoardSwitcherOpen] = useState(false);

  useEffect(() => {
    if (isMyTurn) {
      setActiveBoardTab('tracking');
    }
  }, [isMyTurn]);

  useEffect(() => {
    if (activeBoardTab === 'fleet') {
      setSeenIncomingShotCount(gameState.opponentShots.length);
    }
  }, [activeBoardTab, gameState.opponentShots.length]);

  const hasUnseenIncomingShots = gameState.opponentShots.length > seenIncomingShotCount;
  const ownBoard = (
    <Board
      board={board}
      shots={gameState.opponentShots}
      showShips
      title="Your board"
      subtitle={isMyTurn ? 'Watch for incoming shots while you line up the next move.' : 'Opponent is firing. Your fleet status updates here.'}
      highlighted={!isMyTurn}
    />
  );
  const trackingBoard = (
    <Board
      board={Array(100).fill(0)}
      shots={gameState.myShots}
      title="Tracking board"
      subtitle={isMyTurn ? 'Your turn. Tap any untouched square to fire.' : 'Your previous shots stay visible while you wait.'}
      onCellClick={isMyTurn ? (x, y) => onAction({ type: 'FIRE_SHOT', x, y }) : undefined}
      disabled={!isMyTurn}
      highlighted={isMyTurn}
    />
  );
  const boardTabs = useMemo(
    () => [
      { id: 'tracking', label: 'Enemy Waters' },
      { id: 'fleet', label: 'My Fleet', hasDot: hasUnseenIncomingShots },
    ],
    [hasUnseenIncomingShots]
  );
  const activeBoardLabel = activeBoardTab === 'tracking' ? 'Enemy Waters' : 'My Fleet';

  return (
    <div className="screen">
      <StatusBar
        role={role}
        turn={isMyTurn ? role : (role === 'creator' ? 'joiner' : 'creator')}
        myShots={gameState.myShots}
        opponentShots={gameState.opponentShots}
        opponentAddress={opponentAddress}
        compact
        variant="compact-inline"
      />

      <div className="board-switcher-mobile">
        <CollapsiblePanel
          title="Board"
          summary={activeBoardLabel}
          compact
          open={boardSwitcherOpen}
          onToggle={setBoardSwitcherOpen}
          hasDot={hasUnseenIncomingShots && activeBoardTab !== 'fleet'}
          className="board-switcher"
        >
          <SegmentedTabs
            items={boardTabs}
            value={activeBoardTab}
            onChange={(tabId) => {
              setActiveBoardTab(tabId);
              setBoardSwitcherOpen(false);
            }}
            size="sm"
            tone="soft"
          />
        </CollapsiblePanel>
      </div>

      <div className="panel-grid boards-grid gameplay-grid battleship-boards">
        <div className={`battleship-board-panel ${activeBoardTab === 'tracking' ? 'battleship-board-panel-active' : ''}`}>
          {trackingBoard}
        </div>
        <div className={`battleship-board-panel ${activeBoardTab === 'fleet' ? 'battleship-board-panel-active' : ''}`}>
          {ownBoard}
        </div>
      </div>

      <CollapsiblePanel
        title="Tips"
        summary="3 quick rules"
        compact
        className="tips-panel"
      >
        <ul className="check-list muted">
          <li>Fire on the enemy board when it is your turn.</li>
          <li>Switch to My Fleet to review incoming shots.</li>
          <li>Creator fires first and results resolve over XMTP.</li>
        </ul>
      </CollapsiblePanel>
    </div>
  );
}
