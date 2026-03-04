import { GAME_KEYS } from "../../helpers/constants.js";
import {
  BOARD_SIZE,
  FLEET,
  boardToBytes,
  createEmptyBoard,
  evaluateShot,
  getRemainingShips,
  placeShip,
  validateBoard,
  verifyBoardCommitment,
  verifyShotHistoryAgainstBoard,
} from './helpers/board.js';
import { buildBattleshipCommitment } from './helpers/commitment.js';
import SetupScreen from './screens/SetupScreen.jsx';
import PlayScreen from './screens/PlayScreen.jsx';
import ResultPanel from './screens/ResultPanel.jsx';

function hasResolvedReveal(reveal) {
  return Boolean(reveal?.myBoardVerified && reveal?.opponentBoardVerified && reveal?.shotsVerified);
}

function buildRevealState(gameState, secretState, opponentReveal, match, role) {
  const myExpectedCommitment =
    role === 'creator' ? match.creatorCommitment : match.opponentCommitment;
  const opponentExpectedCommitment =
    role === 'creator' ? match.opponentCommitment : match.creatorCommitment;
  const myBoardVerified = verifyBoardCommitment(secretState.board, secretState.salt, myExpectedCommitment);
  const incomingVerification = verifyShotHistoryAgainstBoard(secretState.board, gameState.opponentShots);
  const opponentCommitmentOk = verifyBoardCommitment(
    opponentReveal.board,
    opponentReveal.salt,
    opponentExpectedCommitment
  );
  const outgoingVerification = opponentCommitmentOk
    ? verifyShotHistoryAgainstBoard(
        opponentReveal.board,
        gameState.myShots.filter((shot) => shot.hit !== undefined)
      )
    : { valid: false, error: 'Opponent board reveal failed commitment verification' };

  const contested = !myBoardVerified || !incomingVerification.valid || !opponentCommitmentOk || !outgoingVerification.valid;
  return {
    myBoardVerified: myBoardVerified && incomingVerification.valid,
    opponentBoardVerified: opponentCommitmentOk,
    shotsVerified: myBoardVerified && incomingVerification.valid && outgoingVerification.valid,
    opponentBoard: opponentReveal.board,
    opponentSalt: opponentReveal.salt,
    reason: contested
      ? outgoingVerification.error || incomingVerification.error || 'Board verification failed'
      : 'Boards and shot history verified.',
    contested,
  };
}

export const gameDefinition = {
  key: GAME_KEYS.BATTLESHIP,
  label: 'Battleship',
  icon: '\u{1F6A2}',
  shortDescription: 'Hide your fleet and fire shots',
  description: 'Place a hidden fleet, trade shots over XMTP, and reveal both boards at the end.',
  moveStyle: 'request-response',
  moveType: 'BATTLESHIP_SHOT',
  moveResultType: 'BATTLESHIP_SHOT_RESULT',

  createInitialState() {
    return {
      board: createEmptyBoard(),
      myShots: [],
      opponentShots: [],
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
    };
  },

  createInitialSetupState() {
    return {
      board: createEmptyBoard(),
      orientation: 'horizontal',
    };
  },

  validateSetup(setupState) {
    return validateBoard(setupState?.board || []);
  },

  serializeSecret(setupState) {
    const validation = validateBoard(setupState?.board || []);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    return {
      secretState: { board: setupState.board },
      secretBytes: boardToBytes(setupState.board),
      gameState: {
        board: setupState.board,
        myShots: [],
        opponentShots: [],
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
      publicConfig: {},
    };
  },

  deserializeReveal(payload) {
    return boardToBytes(payload.board);
  },

  buildRevealPayload(secretState) {
    return {
      board: secretState.board,
      salt: secretState.salt,
    };
  },

  createPreviewState(mode, address, opponentAddress = '0x000000000000000000000000000000000000b0b0') {
    let setupState = this.createInitialSetupState();
    for (const [ship, x, y, orientation] of [
      [FLEET[0], 0, 0, 'horizontal'],
      [FLEET[1], 6, 0, 'vertical'],
      [FLEET[2], 1, 4, 'horizontal'],
      [FLEET[3], 8, 5, 'vertical'],
      [FLEET[4], 7, 9, 'horizontal'],
    ]) {
      setupState = {
        ...setupState,
        board: placeShip(setupState.board, ship, x, y, orientation).board,
      };
    }
    const commitment = buildBattleshipCommitment(setupState);

    const opponentSetup = this.createInitialSetupState();
    let opponentBoard = opponentSetup.board;
    for (const [ship, x, y, orientation] of [
      [FLEET[0], 1, 1, 'vertical'],
      [FLEET[1], 4, 2, 'horizontal'],
      [FLEET[2], 8, 1, 'vertical'],
      [FLEET[3], 1, 7, 'horizontal'],
      [FLEET[4], 6, 8, 'horizontal'],
    ]) {
      opponentBoard = placeShip(opponentBoard, ship, x, y, orientation).board;
    }
    const opponentCommitment = buildBattleshipCommitment({ board: opponentBoard });

    const base = {
      setupState,
      commitment: commitment.commitment,
      publicConfig: {},
      secretState: commitment.secretState,
      gameState: commitment.gameState,
      summary: [`${FLEET.length} ships placed`, '17 total ship cells'],
    };

    if (mode === 'playing') {
      base.gameState = {
        ...base.gameState,
        myShots: [
          { seq: 1, x: 1, y: 1, hit: true, sunkShipId: null, gameOver: false },
          { seq: 2, x: 5, y: 5, hit: false, sunkShipId: null, gameOver: false },
        ],
        opponentShots: [
          { seq: 1, x: 0, y: 0, hit: true, sunkShipId: null, gameOver: false },
          { seq: 2, x: 9, y: 9, hit: false, sunkShipId: null, gameOver: false },
        ],
      };
    }

    if (mode === 'result') {
      base.gameState = {
        ...base.gameState,
        myShots: [
          { seq: 1, x: 1, y: 1, hit: true, sunkShipId: null, gameOver: false },
          { seq: 2, x: 4, y: 2, hit: true, sunkShipId: null, gameOver: false },
          { seq: 3, x: 5, y: 2, hit: true, sunkShipId: null, gameOver: false },
          { seq: 4, x: 6, y: 2, hit: true, sunkShipId: null, gameOver: false },
          { seq: 5, x: 7, y: 2, hit: true, sunkShipId: 2, gameOver: false },
        ],
        opponentShots: [
          { seq: 1, x: 0, y: 0, hit: true, sunkShipId: null, gameOver: false },
          { seq: 2, x: 1, y: 0, hit: true, sunkShipId: null, gameOver: false },
          { seq: 3, x: 2, y: 0, hit: true, sunkShipId: null, gameOver: false },
        ],
        winner: address,
        reveal: buildRevealState(
          {
            ...commitment.gameState,
            myShots: [
              { seq: 1, x: 1, y: 1, hit: true, sunkShipId: null, gameOver: false },
              { seq: 2, x: 4, y: 2, hit: true, sunkShipId: null, gameOver: false },
              { seq: 3, x: 5, y: 2, hit: true, sunkShipId: null, gameOver: false },
              { seq: 4, x: 6, y: 2, hit: true, sunkShipId: null, gameOver: false },
              { seq: 5, x: 7, y: 2, hit: true, sunkShipId: 2, gameOver: false },
            ],
            opponentShots: [
              { seq: 1, x: 0, y: 0, hit: true, sunkShipId: null, gameOver: false },
              { seq: 2, x: 1, y: 0, hit: true, sunkShipId: null, gameOver: false },
              { seq: 3, x: 2, y: 0, hit: true, sunkShipId: null, gameOver: false },
            ],
          },
          commitment.secretState,
          opponentCommitment.secretState,
          {
            creatorCommitment: commitment.commitment,
            opponentCommitment: opponentCommitment.commitment,
          },
          'creator'
        ),
      };
      base.verification = {
        canConfirm: true,
        contested: false,
        reason: 'Boards and shot history verified.',
        details: [],
      };
    }

    return {
      ...base,
      opponentAddress,
      opponentSecretState: { board: opponentBoard, salt: opponentCommitment.secretState.salt },
    };
  },

  getSetupSummary(secretState) {
    if (!secretState?.board) return [];
    return [
      `${getRemainingShips(secretState.board).length === 0 ? 'Fleet ready' : 'Fleet incomplete'}`,
      `${secretState.board.filter((cell) => cell > 0).length} occupied cells`,
    ];
  },

  getInvitePublicConfig() {
    return {};
  },

  loadInvitePublicConfig(publicConfig) {
    return publicConfig || {};
  },

  reduce(gameState, action) {
    switch (action.type) {
      case 'SETUP_PLACE': {
        const ship = getRemainingShips(action.setupState.board)[0];
        if (!ship) {
          return { setupState: action.setupState, error: '' };
        }
        const result = placeShip(action.setupState.board, ship, action.x, action.y, action.setupState.orientation);
        if (!result.placed) {
          return { setupState: action.setupState, error: `Cannot place ${ship.name} there.` };
        }
        return {
          setupState: {
            ...action.setupState,
            board: result.board,
          },
          error: '',
        };
      }
      case 'SETUP_ROTATE':
        return {
          setupState: {
            ...action.setupState,
            orientation: action.setupState.orientation === 'horizontal' ? 'vertical' : 'horizontal',
          },
          error: '',
        };
      case 'SETUP_RESET':
        return {
          setupState: this.createInitialSetupState(),
          error: '',
        };
      default:
        return { gameState };
    }
  },

  handleOpponentMove(gameState, movePayload, context) {
    const { secretState } = context;

    const shot = evaluateShot(secretState.board, movePayload.x, movePayload.y, gameState.opponentShots);
    const nextShot = {
      seq: Number(context.incomingSeq),
      x: movePayload.x,
      y: movePayload.y,
      hit: shot.hit,
      sunkShipId: shot.sunkShipId,
      gameOver: shot.gameOver,
    };

    const nextGameState = {
      ...gameState,
      opponentShots: [...gameState.opponentShots, nextShot],
    };

    if (shot.gameOver) {
      return {
        gameState: { ...nextGameState, winner: context.opponentAddress },
        response: nextShot,
        winner: context.opponentAddress,
        info: 'Your fleet has been revealed to settle the match.',
      };
    }

    return {
      gameState: nextGameState,
      response: nextShot,
    };
  },

  handleMoveResult(gameState, resultPayload, context) {
    const lastShot = gameState.myShots[gameState.myShots.length - 1];
    if (!lastShot || Number(resultPayload.seq) !== Number(lastShot.seq)) {
      return { gameState };
    }

    const updatedShots = [...gameState.myShots];
    updatedShots[updatedShots.length - 1] = {
      ...updatedShots[updatedShots.length - 1],
      ...resultPayload,
    };

    const winner = resultPayload.gameOver ? context.address : '';

    return {
      gameState: {
        ...gameState,
        myShots: updatedShots,
        winner: winner || gameState.winner,
      },
      winner,
      info: resultPayload.gameOver ? 'Opponent fleet is sunk. Waiting for board reveal.' : '',
    };
  },

  applyLocalMove(gameState, action, context) {
    if (action.type !== 'FIRE_SHOT') {
      return { gameState };
    }
    if (gameState.myShots.some((shot) => shot.x === action.x && shot.y === action.y)) {
      return { gameState, error: 'That square has already been targeted.' };
    }

    const shot = {
      seq: context.mySeq,
      x: action.x,
      y: action.y,
    };

    return {
      gameState: {
        ...gameState,
        myShots: [...gameState.myShots, shot],
      },
      movePayload: {
        x: action.x,
        y: action.y,
      },
    };
  },

  verifyGameRules({ mySecretState, opponentReveal, gameState, role }) {
    const myBoardOk = verifyShotHistoryAgainstBoard(mySecretState.board, gameState.opponentShots);
    if (!myBoardOk.valid) {
      return { valid: false, error: myBoardOk.error };
    }

    const outgoingCheck = verifyShotHistoryAgainstBoard(
      opponentReveal.board,
      gameState.myShots.filter((shot) => shot.hit !== undefined)
    );
    if (!outgoingCheck.valid) {
      return { valid: false, error: outgoingCheck.error };
    }

    return { valid: true, error: '' };
  },

  simulateOpponentResponse(gameState, context) {
    const { opponentSecretState, secretState, address, opponentAddress } = context;
    if (!opponentSecretState?.board) return { gameState };

    // 1. Resolve the player's pending shot against the opponent's hidden board
    const pendingShot = gameState.myShots[gameState.myShots.length - 1];
    let nextState = gameState;
    if (pendingShot && pendingShot.hit === undefined) {
      const result = evaluateShot(
        opponentSecretState.board,
        pendingShot.x,
        pendingShot.y,
        gameState.myShots.slice(0, -1)
      );
      const resolved = { ...pendingShot, ...result };
      const updatedShots = [...gameState.myShots];
      updatedShots[updatedShots.length - 1] = resolved;
      nextState = { ...gameState, myShots: updatedShots };
      if (result.gameOver) {
        return {
          gameState: { ...nextState, winner: address },
          winner: address,
          info: 'You sunk the entire enemy fleet!',
        };
      }
    }

    // 2. Opponent fires a random shot at the player's board
    const targeted = new Set(nextState.opponentShots.map((s) => `${s.x},${s.y}`));
    const candidates = [];
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (!targeted.has(`${x},${y}`)) candidates.push({ x, y });
      }
    }
    if (candidates.length === 0) return { gameState: nextState };

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const opShot = evaluateShot(secretState.board, pick.x, pick.y, nextState.opponentShots);
    const opShotEntry = {
      seq: nextState.opponentShots.length + 1,
      x: pick.x,
      y: pick.y,
      ...opShot,
    };
    nextState = {
      ...nextState,
      opponentShots: [...nextState.opponentShots, opShotEntry],
    };

    if (opShot.gameOver) {
      return {
        gameState: { ...nextState, winner: opponentAddress },
        winner: opponentAddress,
        info: 'The opponent sunk your fleet!',
      };
    }

    return { gameState: nextState };
  },

  components: {
    SetupScreen,
    PlayScreen,
    ResultPanel,
  },
};
