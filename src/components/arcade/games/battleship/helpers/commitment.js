import { createCommittedBoard, validateBoard } from './board.js';

export function buildBattleshipCommitment(setupState) {
  const validation = validateBoard(setupState?.board || []);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const committed = createCommittedBoard(setupState.board);
  return {
    commitment: committed.hash,
    secretState: {
      board: committed.board,
      salt: committed.salt,
    },
    publicConfig: {},
    gameState: {
      board: committed.board,
      myShots: [],
      opponentShots: [],
      turn: 'creator',
      nextOutgoingSeq: 1,
      expectedIncomingSeq: 1,
      winner: '',
      reveal: {
        myBoardVerified: false,
        opponentBoardVerified: false,
        shotsVerified: false,
        opponentBoard: null,
        opponentSalt: '',
        reason: '',
        contested: false,
      },
    },
  };
}

