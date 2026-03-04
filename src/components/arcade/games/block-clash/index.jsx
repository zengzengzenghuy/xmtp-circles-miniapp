import React from 'react';
import { GAME_KEYS } from "../../helpers/constants.js";
import {
  applyPlacement,
  canPlacePiece,
  createEmptyBoard,
  deriveOccupiedBoard,
  getRemainingPieceIds,
  getWinnerAfterMove,
  hasAnyValidMove,
  validateLoadout,
  verifyRevealedGame,
} from './helpers/board.js';
import { buildBlockClashCommitment } from './helpers/commitment.js';
import { BLOCK_CLASH_BOARD_SIZE, TOTAL_BUDGET, PIECE_CATALOG, PIECE_INDEX, getLoadoutCost } from './helpers/pieces.js';
import SetupScreen from './screens/SetupScreen.jsx';
import PlayScreen from './screens/PlayScreen.jsx';
import ResultPanel from './screens/ResultPanel.jsx';

export const gameDefinition = {
  key: GAME_KEYS.BLOCK_CLASH,
  label: 'Block Clash',
  icon: (
    <svg viewBox="0 0 64 64" width="48" height="48" fill="none" aria-hidden="true">
      <rect x="5" y="18" width="14" height="14" rx="3" fill="currentColor" opacity="0.16" />
      <rect x="19" y="18" width="14" height="14" rx="3" fill="currentColor" opacity="0.24" />
      <rect x="5" y="32" width="14" height="14" rx="3" fill="currentColor" opacity="0.24" />
      <rect x="45" y="18" width="14" height="14" rx="3" fill="currentColor" opacity="0.24" />
      <rect x="45" y="32" width="14" height="14" rx="3" fill="currentColor" opacity="0.16" />
    </svg>
  ),
  shortDescription: 'Place blocks and trap your opponent',
  description: 'Choose a hidden piece loadout, take turns placing tetromino-like shapes, and trap the other side.',
  moveStyle: 'fire-and-forget',
  moveType: 'BLOCK_MOVE',

  createInitialState() {
    return {
      boardSize: BLOCK_CLASH_BOARD_SIZE,
      placements: [],
      occupiedBoard: createEmptyBoard(),
      mySelectedPieceIds: [],
      opponentSelectedPieceIdsRevealed: [],
      selectedPieceId: '',
      selectedRotation: 0,
      winner: '',
      reveal: {
        mine: null,
        opponent: null,
      },
      info: '',
      error: '',
    };
  },

  createInitialSetupState() {
    return {
      selectedPieceIds: [],
    };
  },

  validateSetup(setupState) {
    return validateLoadout(setupState?.selectedPieceIds || []);
  },

  serializeSecret(setupState) {
    const sorted = [...setupState.selectedPieceIds].sort();
    const indices = Uint8Array.from(sorted.map((pieceId) => PIECE_INDEX[pieceId]));
    return {
      secretState: { selectedPieceIds: sorted },
      secretBytes: indices,
      gameState: {
        boardSize: BLOCK_CLASH_BOARD_SIZE,
        placements: [],
        occupiedBoard: Array(BLOCK_CLASH_BOARD_SIZE * BLOCK_CLASH_BOARD_SIZE).fill(0),
        mySelectedPieceIds: sorted,
        opponentSelectedPieceIdsRevealed: [],
        selectedPieceId: sorted[0] || '',
        selectedRotation: 0,
        winner: '',
        reveal: { mine: null, opponent: null },
        info: '',
        error: '',
      },
      publicConfig: {
        boardSize: BLOCK_CLASH_BOARD_SIZE,
        catalogId: 'block-clash-v2',
      },
    };
  },

  deserializeReveal(payload) {
    const sorted = [...payload.selectedPieceIds].sort();
    return Uint8Array.from(sorted.map((pieceId) => PIECE_INDEX[pieceId]));
  },

  buildRevealPayload(secretState) {
    return {
      selectedPieceIds: secretState.selectedPieceIds,
      salt: secretState.salt,
    };
  },

  createPreviewState(mode, address, opponentAddress = '0x000000000000000000000000000000000000b0b0') {
    const setupState = {
      selectedPieceIds: ['domino', 'tri_l', 'square_o', 'tet_l', 'tet_t', 'tet_s', 'tet_j', 'tri_i'],
    };
    const commitment = buildBlockClashCommitment(setupState);
    const opponentSetup = {
      selectedPieceIds: ['domino', 'tri_i', 'tet_t', 'tet_s', 'square_o', 'tet_l', 'tet_j', 'tet_z'],
    };
    const opponentCommitment = buildBlockClashCommitment(opponentSetup);

    const baseGameState = {
      ...commitment.gameState,
      mySelectedPieceIds: [...setupState.selectedPieceIds],
    };

    if (mode === 'playing' || mode === 'result') {
      const placements = [
        { seq: 1, player: 'creator', pieceId: 'domino', rotation: 0, x: 0, y: 0 },
        { seq: 2, player: 'joiner', pieceId: 'tri_i', rotation: 90, x: 5, y: 0 },
        { seq: 3, player: 'creator', pieceId: 'tri_l', rotation: 0, x: 2, y: 2 },
      ];
      baseGameState.placements = placements;
      baseGameState.occupiedBoard = deriveOccupiedBoard(placements);
      baseGameState.selectedPieceId = 'square_o';
    }

    const verification = mode === 'result'
      ? { canConfirm: true, contested: false, reason: 'Loadouts and placement history verified.', details: [] }
      : { canConfirm: false, contested: false, reason: '', details: [] };

    return {
      setupState,
      commitment: commitment.commitment,
      publicConfig: commitment.publicConfig,
      secretState: commitment.secretState,
      gameState: {
        ...baseGameState,
        winner: mode === 'result' ? address : '',
        reveal: mode === 'result'
          ? { mine: commitment.secretState, opponent: opponentCommitment.secretState }
          : { mine: null, opponent: null },
      },
      summary: [
        `${getLoadoutCost(setupState.selectedPieceIds)} / ${TOTAL_BUDGET} budget used (${setupState.selectedPieceIds.length} pieces)`,
        `${BLOCK_CLASH_BOARD_SIZE}x${BLOCK_CLASH_BOARD_SIZE} shared board`,
      ],
      opponentAddress,
      opponentSecretState: opponentCommitment.secretState,
      verification,
    };
  },

  getSetupSummary(secretState) {
    const ids = secretState?.selectedPieceIds || [];
    const cost = getLoadoutCost(ids);
    return [
      `${cost} / ${TOTAL_BUDGET} budget (${ids.length} pieces)`,
      `${BLOCK_CLASH_BOARD_SIZE}x${BLOCK_CLASH_BOARD_SIZE} shared board`,
    ];
  },

  getInvitePublicConfig() {
    return {
      boardSize: BLOCK_CLASH_BOARD_SIZE,
      catalogId: 'block-clash-v1',
    };
  },

  loadInvitePublicConfig(publicConfig) {
    return publicConfig || {};
  },

  reduce(gameState, action) {
    if (action.type === 'SETUP_TOGGLE_PIECE') {
      const selected = new Set(action.setupState.selectedPieceIds);
      if (selected.has(action.pieceId)) {
        selected.delete(action.pieceId);
      } else if (getLoadoutCost([...selected, action.pieceId]) <= TOTAL_BUDGET) {
        selected.add(action.pieceId);
      }
      return {
        setupState: {
          ...action.setupState,
          selectedPieceIds: [...selected],
        },
      };
    }
    return { gameState };
  },

  isLocalAction(action) {
    return action.type === 'SELECT_PIECE' || action.type === 'ROTATE_SELECTED';
  },

  reduceLocalAction(gameState, action) {
    if (action.type === 'SELECT_PIECE') {
      return {
        gameState: {
          ...gameState,
          selectedPieceId: action.pieceId,
          error: '',
        },
      };
    }
    if (action.type === 'ROTATE_SELECTED') {
      return {
        gameState: {
          ...gameState,
          selectedRotation: (gameState.selectedRotation + 90) % 360,
          error: '',
        },
      };
    }
    return { gameState };
  },

  handleOpponentMove(gameState, movePayload, context) {
    const { role, incomingSeq } = context;
    const moverRole = role === 'creator' ? 'joiner' : 'creator';

    const applied = applyPlacement({
      gameState: {
        ...gameState,
        turn: moverRole,
        role,
        nextOutgoingSeq: Number(incomingSeq) + 1,
      },
      player: moverRole,
      pieceId: movePayload.pieceId,
      rotation: movePayload.rotation,
      x: movePayload.x,
      y: movePayload.y,
    });

    if (!applied.ok) {
      return { gameState: { ...gameState, error: applied.error } };
    }

    return { gameState: applied.gameState };
  },

  applyLocalMove(gameState, action, context) {
    if (action.type !== 'PLACE_SELECTED_PIECE') {
      return { gameState };
    }
    if (!gameState.selectedPieceId) {
      return { gameState, error: 'Choose a piece first.' };
    }

    const applied = applyPlacement({
      gameState: {
        ...gameState,
        turn: context.role,
        role: context.role,
        nextOutgoingSeq: context.mySeq,
      },
      player: context.role,
      pieceId: gameState.selectedPieceId,
      rotation: gameState.selectedRotation,
      x: action.x,
      y: action.y,
    });

    if (!applied.ok) {
      return {
        gameState: { ...gameState, error: applied.error },
        error: applied.error,
      };
    }

    const myRemainingPieceIds = getRemainingPieceIds(
      gameState.mySelectedPieceIds,
      applied.gameState.placements,
      context.role
    );

    const winnerRole = getWinnerAfterMove({
      gameState: applied.gameState,
      moverRole: context.role,
      moverSelectedPieceIds: gameState.mySelectedPieceIds,
      defenderSelectedPieceIds: gameState.opponentSelectedPieceIdsRevealed || [],
    });

    let winner = '';
    if (winnerRole === context.role) {
      winner = context.address;
    } else if (winnerRole) {
      winner = context.opponentAddress;
    }

    return {
      gameState: {
        ...applied.gameState,
        selectedPieceId: myRemainingPieceIds[0] || '',
        error: '',
        winner,
        reveal: winner
          ? { ...(applied.gameState.reveal || {}), mine: context.secretState }
          : (applied.gameState.reveal || { mine: null, opponent: null }),
      },
      movePayload: {
        pieceId: gameState.selectedPieceId,
        rotation: gameState.selectedRotation,
        x: action.x,
        y: action.y,
      },
      winner,
    };
  },

  checkAutoLoss(gameState, context) {
    const remaining = getRemainingPieceIds(
      context.secretState?.selectedPieceIds || gameState.mySelectedPieceIds,
      gameState.placements,
      context.role
    );

    if (!hasAnyValidMove(remaining, gameState.placements)) {
      return { lost: true, winner: context.opponentAddress };
    }

    return { lost: false };
  },

  verifyGameRules({ mySecretState, opponentReveal, gameState, role, declaredWinner }) {
    const creatorReveal = role === 'creator' ? mySecretState : opponentReveal;
    const joinerReveal = role === 'creator' ? opponentReveal : mySecretState;

    const result = verifyRevealedGame({
      creatorCommitmentMatches: true,
      opponentCommitmentMatches: true,
      creatorLoadout: creatorReveal.selectedPieceIds,
      opponentLoadout: joinerReveal.selectedPieceIds,
      placements: gameState.placements,
      declaredWinner,
    });

    return { valid: result.valid, error: result.error };
  },

  simulateOpponentResponse(gameState, context) {
    const { opponentSecretState, role, opponentAddress, address } = context;
    if (!opponentSecretState?.selectedPieceIds) return { gameState };

    const opponentRole = role === 'creator' ? 'joiner' : 'creator';
    const opponentRemaining = getRemainingPieceIds(
      opponentSecretState.selectedPieceIds,
      gameState.placements,
      opponentRole
    );

    // Opponent used all pieces = opponent wins.
    if (opponentRemaining.length === 0) {
      return {
        gameState: { ...gameState, winner: opponentAddress },
        winner: opponentAddress,
        info: 'Opponent used all pieces.',
      };
    }

    // Try random placements for each remaining piece
    const rotations = [0, 90, 180, 270];
    const shuffled = [...opponentRemaining].sort(() => Math.random() - 0.5);

    for (const pieceId of shuffled) {
      const rot = rotations[Math.floor(Math.random() * rotations.length)];
      const positions = [];
      for (let y = 0; y < BLOCK_CLASH_BOARD_SIZE; y++) {
        for (let x = 0; x < BLOCK_CLASH_BOARD_SIZE; x++) {
          if (canPlacePiece({ placements: gameState.placements, pieceId, rotation: rot, x, y })) {
            positions.push({ x, y });
          }
        }
      }
      if (positions.length > 0) {
        const pick = positions[Math.floor(Math.random() * positions.length)];
        const applied = applyPlacement({
          gameState: {
            ...gameState,
            turn: opponentRole,
            role,
            nextOutgoingSeq: (gameState.placements?.length || 0) + 2,
          },
          player: opponentRole,
          pieceId,
          rotation: rot,
          x: pick.x,
          y: pick.y,
        });
        if (applied.ok) {
          const winnerRole = getWinnerAfterMove({
            gameState: applied.gameState,
            moverRole: opponentRole,
            moverSelectedPieceIds: opponentSecretState.selectedPieceIds,
            defenderSelectedPieceIds: gameState.mySelectedPieceIds,
          });
          const winner = winnerRole === opponentRole ? opponentAddress : winnerRole === role ? address : '';
          return {
            gameState: { ...applied.gameState, winner },
            winner: winner || undefined,
          };
        }
      }
    }

    // Opponent has no valid moves — opponent loses
    return {
      gameState: { ...gameState, winner: address },
      winner: address,
      info: 'Opponent has no valid moves.',
    };
  },

  components: {
    SetupScreen,
    PlayScreen,
    ResultPanel,
  },

  pieces: PIECE_CATALOG,
};
