import {
  BLOCK_CLASH_BOARD_SIZE,
  TOTAL_BUDGET,
  getRotatedPieceCells,
  getLoadoutCost,
  PIECE_CATALOG,
} from './pieces.js';

export function createEmptyBoard() {
  return Array(BLOCK_CLASH_BOARD_SIZE * BLOCK_CLASH_BOARD_SIZE).fill(0);
}

export function indexFromCoord(x, y) {
  return y * BLOCK_CLASH_BOARD_SIZE + x;
}

export function coordKey(x, y) {
  return `${x}:${y}`;
}

export function getPlacementCells(pieceId, rotation, x, y) {
  return getRotatedPieceCells(pieceId, rotation).map(([dx, dy]) => [x + dx, y + dy]);
}

export function deriveOccupiedBoard(placements = []) {
  const board = createEmptyBoard();
  for (const placement of placements) {
    for (const [x, y] of getPlacementCells(placement.pieceId, placement.rotation, placement.x, placement.y)) {
      board[indexFromCoord(x, y)] = placement.player === 'creator' ? 1 : 2;
    }
  }
  return board;
}

export function canPlacePiece({ placements = [], pieceId, rotation, x, y }) {
  const occupied = new Set();
  for (const placement of placements) {
    for (const [cellX, cellY] of getPlacementCells(placement.pieceId, placement.rotation, placement.x, placement.y)) {
      occupied.add(coordKey(cellX, cellY));
    }
  }

  const cells = getPlacementCells(pieceId, rotation, x, y);
  for (const [cellX, cellY] of cells) {
    if (cellX < 0 || cellX >= BLOCK_CLASH_BOARD_SIZE || cellY < 0 || cellY >= BLOCK_CLASH_BOARD_SIZE) {
      return false;
    }
    if (occupied.has(coordKey(cellX, cellY))) {
      return false;
    }
  }
  return true;
}

export function hasUsedPiece(placements, player, pieceId) {
  return placements.some((placement) => placement.player === player && placement.pieceId === pieceId);
}

export function getRemainingPieceIds(selectedPieceIds = [], placements = [], player) {
  const used = new Set(
    placements.filter((placement) => placement.player === player).map((placement) => placement.pieceId)
  );
  return selectedPieceIds.filter((pieceId) => !used.has(pieceId));
}

export function getUsedPieceIds(placements = [], player) {
  return placements
    .filter((placement) => placement.player === player)
    .map((placement) => placement.pieceId);
}

export function hasAnyValidMove(selectedPieceIds = [], placements = []) {
  for (const pieceId of selectedPieceIds) {
    for (const rotation of [0, 90, 180, 270]) {
      for (let y = 0; y < BLOCK_CLASH_BOARD_SIZE; y += 1) {
        for (let x = 0; x < BLOCK_CLASH_BOARD_SIZE; x += 1) {
          if (canPlacePiece({ placements, pieceId, rotation, x, y })) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

export function validateLoadout(pieceIds = []) {
  if (!Array.isArray(pieceIds)) {
    return { valid: false, error: 'Loadout must be an array' };
  }
  if (pieceIds.length === 0) {
    return { valid: false, error: 'Choose at least one piece' };
  }
  const seen = new Set();
  for (const pieceId of pieceIds) {
    if (!PIECE_CATALOG.some((piece) => piece.id === pieceId)) {
      return { valid: false, error: `Unknown piece: ${pieceId}` };
    }
    if (seen.has(pieceId)) {
      return { valid: false, error: 'Each piece can only be selected once' };
    }
    seen.add(pieceId);
  }
  const cost = getLoadoutCost(pieceIds);
  if (cost !== TOTAL_BUDGET) {
    return { valid: false, error: `Loadout cost must equal ${TOTAL_BUDGET} (current: ${cost})` };
  }
  return { valid: true, error: '' };
}

export function applyPlacement({ gameState, player, pieceId, rotation, x, y }) {
  if (player !== gameState.turn) {
    return { ok: false, error: 'Wait for your turn' };
  }
  const selected = player === gameState.role ? gameState.mySelectedPieceIds : gameState.opponentSelectedPieceIdsRevealed;
  if (selected?.length && !selected.includes(pieceId)) {
    return { ok: false, error: 'Piece is not available in this loadout' };
  }
  if (hasUsedPiece(gameState.placements, player, pieceId)) {
    return { ok: false, error: 'That piece has already been used' };
  }
  if (!canPlacePiece({ placements: gameState.placements, pieceId, rotation, x, y })) {
    return { ok: false, error: 'Piece does not fit there' };
  }

  const placement = {
    seq: gameState.nextOutgoingSeq,
    player,
    pieceId,
    rotation,
    x,
    y,
  };
  const placements = [...gameState.placements, placement];
  return {
    ok: true,
    placement,
    gameState: {
      ...gameState,
      placements,
      occupiedBoard: deriveOccupiedBoard(placements),
    },
  };
}

export function getWinnerAfterMove({ gameState, moverRole, moverSelectedPieceIds, defenderSelectedPieceIds }) {
  const moverRemaining = getRemainingPieceIds(moverSelectedPieceIds, gameState.placements, moverRole);
  // Placing all pieces wins immediately.
  if (moverRemaining.length === 0) {
    return moverRole;
  }

  if (!Array.isArray(defenderSelectedPieceIds) || defenderSelectedPieceIds.length === 0) {
    return '';
  }

  const nextTurn = moverRole === 'creator' ? 'joiner' : 'creator';
  const defenderRemaining = getRemainingPieceIds(defenderSelectedPieceIds, gameState.placements, nextTurn);
  if (!hasAnyValidMove(defenderRemaining, gameState.placements)) {
    return moverRole;
  }
  return '';
}

export function verifyRevealedGame({
  creatorCommitmentMatches,
  opponentCommitmentMatches,
  creatorLoadout = [],
  opponentLoadout = [],
  placements = [],
  declaredWinner,
}) {
  if (!creatorCommitmentMatches || !opponentCommitmentMatches) {
    return { valid: false, error: 'Loadout reveal does not match commitment' };
  }

  const seenByPlayer = {
    creator: new Set(),
    joiner: new Set(),
  };
  const available = {
    creator: new Set(creatorLoadout),
    joiner: new Set(opponentLoadout),
  };

  const appliedPlacements = [];
  for (const placement of placements) {
    if (!available[placement.player]?.has(placement.pieceId)) {
      return { valid: false, error: 'A move used a piece outside the player loadout' };
    }
    if (seenByPlayer[placement.player].has(placement.pieceId)) {
      return { valid: false, error: 'A piece was used more than once' };
    }
    if (!canPlacePiece({
      placements: appliedPlacements,
      pieceId: placement.pieceId,
      rotation: placement.rotation,
      x: placement.x,
      y: placement.y,
    })) {
      return { valid: false, error: 'A recorded placement is invalid' };
    }
    seenByPlayer[placement.player].add(placement.pieceId);
    appliedPlacements.push(placement);
  }

  const creatorRemaining = creatorLoadout.filter((pieceId) => !seenByPlayer.creator.has(pieceId));
  const joinerRemaining = opponentLoadout.filter((pieceId) => !seenByPlayer.joiner.has(pieceId));

  let expectedWinner = '';
  // Using all pieces wins immediately.
  if (creatorRemaining.length === 0) {
    expectedWinner = 'creator';
  } else if (joinerRemaining.length === 0) {
    expectedWinner = 'joiner';
  } else {
    const creatorCanMove = hasAnyValidMove(creatorRemaining, appliedPlacements);
    const joinerCanMove = hasAnyValidMove(joinerRemaining, appliedPlacements);
    if (!creatorCanMove && joinerCanMove) {
      expectedWinner = 'joiner';
    } else if (!joinerCanMove && creatorCanMove) {
      expectedWinner = 'creator';
    } else if (!creatorCanMove && !joinerCanMove) {
      // Both stuck: the player whose turn it is next loses — they can't move.
      // Last player to place wins (the other player's turn comes next).
      if (placements.length > 0) {
        expectedWinner = placements[placements.length - 1].player;
      }
    }
  }

  if (!expectedWinner || expectedWinner !== declaredWinner) {
    return { valid: false, error: 'Winner does not match the terminal board state' };
  }

  return { valid: true, error: '' };
}
