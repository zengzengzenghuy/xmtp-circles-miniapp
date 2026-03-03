import { keccak256 } from "viem";
import { bytesToHex, hexToBytes, normalizeHex } from '../../battleship/helpers/board.js';
import { PIECE_INDEX } from './pieces.js';
import { validateLoadout } from './board.js';

export function generateSalt() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function computeLoadoutCommitment(selectedPieceIds, salt) {
  const validation = validateLoadout(selectedPieceIds);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const indices = Uint8Array.from(
    [...selectedPieceIds]
      .sort()
      .map((pieceId) => PIECE_INDEX[pieceId])
  );
  const saltBytes = hexToBytes(normalizeHex(salt, 32));
  const payload = new Uint8Array(indices.length + saltBytes.length);
  payload.set(indices, 0);
  payload.set(saltBytes, indices.length);
  return keccak256(payload);
}

export function buildBlockClashCommitment(setupState) {
  const salt = generateSalt();
  const commitment = computeLoadoutCommitment(setupState.selectedPieceIds, salt);
  return {
    commitment,
    secretState: {
      selectedPieceIds: [...setupState.selectedPieceIds].sort(),
      salt,
    },
    publicConfig: {
      boardSize: 8,
      catalogId: 'block-clash-v1',
    },
    gameState: {
      boardSize: 8,
      placements: [],
      occupiedBoard: Array(64).fill(0),
      mySelectedPieceIds: [...setupState.selectedPieceIds].sort(),
      opponentSelectedPieceIdsRevealed: [],
      turn: 'creator',
      selectedPieceId: setupState.selectedPieceIds[0] || '',
      selectedRotation: 0,
      nextOutgoingSeq: 1,
      winner: '',
      reveal: {
        mine: null,
        opponent: null,
      },
    },
  };
}
