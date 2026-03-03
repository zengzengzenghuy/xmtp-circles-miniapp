import { makeEnvelope, gameOverType, revealType } from "./envelope.js";
import { LIFECYCLE_TYPES } from "../helpers/constants.js";
import { verifyCommitment, hexToBytes } from "./commitment.js";

function safeLower(value) {
  return String(value || '').toLowerCase();
}

export function makeJoinMessage(gameDef, sessionId, from, payload = {}) {
  return makeEnvelope({
    gameKey: gameDef.key,
    sessionId,
    from,
    type: LIFECYCLE_TYPES.SESSION_JOIN,
    payload,
  });
}

export function makeReadyMessage(gameDef, sessionId, from) {
  return makeEnvelope({
    gameKey: gameDef.key,
    sessionId,
    from,
    type: LIFECYCLE_TYPES.SESSION_READY,
  });
}

export function handleIncomingMessage(gameDef, message, context) {
  const {
    gameState,
    address,
    role,
    opponentAddress,
    secretState,
    session,
    sessionId,
    turn,
    mySeq,
    expectedOpponentSeq,
  } = context;

  if (message.type === LIFECYCLE_TYPES.SESSION_READY) {
    return { gameState, info: 'Opponent XMTP session is ready.' };
  }

  if (message.type === gameOverType(gameDef.key)) {
    const winner = message.payload.winner;
    const outgoingMessages = [];

    if (safeLower(winner) === safeLower(address)) {
      outgoingMessages.push(
        makeEnvelope({
          gameKey: gameDef.key,
          sessionId,
          from: address,
          type: revealType(gameDef.key),
          seq: mySeq,
          payload: gameDef.buildRevealPayload(secretState),
        })
      );
    }

    if (message.payload.board || message.payload.salt || message.payload.selectedPieceIds) {
      const verification = runVerification(gameDef, {
        gameState, secretState, opponentReveal: message.payload, session, role,
        declaredWinner: winner, address,
      });
      return {
        gameState: { ...gameState, winner, reveal: { ...gameState.reveal, opponent: message.payload } },
        winner,
        verification,
        outgoingMessages: outgoingMessages.length > 0 ? outgoingMessages : undefined,
        seqDelta: outgoingMessages.length > 0 ? { mySeq: mySeq + 1 } : undefined,
      };
    }

    return {
      gameState: { ...gameState, winner },
      winner,
      outgoingMessages: outgoingMessages.length > 0 ? outgoingMessages : undefined,
      seqDelta: outgoingMessages.length > 0 ? { mySeq: mySeq + 1 } : undefined,
    };
  }

  if (message.type === revealType(gameDef.key)) {
    const verification = runVerification(gameDef, {
      gameState, secretState, opponentReveal: message.payload, session, role,
      declaredWinner: gameState.winner, address,
    });
    return {
      gameState: {
        ...gameState,
        reveal: { ...gameState.reveal, opponent: message.payload },
      },
      verification,
    };
  }

  if (message.type === gameDef.moveType) {
    const expectedTurn = role === 'creator' ? 'joiner' : 'creator';
    if (turn !== expectedTurn) {
      return { gameState };
    }
    if (Number(message.seq) !== Number(expectedOpponentSeq)) {
      return { gameState };
    }

    const result = gameDef.handleOpponentMove(gameState, message.payload, {
      ...context,
      incomingSeq: message.seq,
    });

    const outgoingMessages = [];

    if (gameDef.moveStyle === 'request-response' && result.response) {
      outgoingMessages.push(
        makeEnvelope({
          gameKey: gameDef.key,
          sessionId,
          from: address,
          type: gameDef.moveResultType,
          seq: Number(message.seq),
          payload: result.response,
        })
      );
    }

    if (result.winner) {
      outgoingMessages.push(
        makeEnvelope({
          gameKey: gameDef.key,
          sessionId,
          from: address,
          type: gameOverType(gameDef.key),
          seq: mySeq,
          payload: { winner: result.winner },
        }),
        makeEnvelope({
          gameKey: gameDef.key,
          sessionId,
          from: address,
          type: revealType(gameDef.key),
          seq: mySeq,
          payload: gameDef.buildRevealPayload(secretState),
        })
      );
    }

    return {
      gameState: result.gameState,
      outgoingMessages: outgoingMessages.length > 0 ? outgoingMessages : undefined,
      winner: result.winner || '',
      info: result.info || '',
      turnDelta: { turn: role },
      seqDelta: { expectedOpponentSeq: expectedOpponentSeq + 1 },
    };
  }

  if (gameDef.moveResultType && message.type === gameDef.moveResultType) {
    const result = gameDef.handleMoveResult(gameState, message.payload, context);

    const outgoingMessages = [];
    if (result.winner) {
      outgoingMessages.push(
        makeEnvelope({
          gameKey: gameDef.key,
          sessionId,
          from: address,
          type: gameOverType(gameDef.key),
          seq: mySeq,
          payload: { winner: result.winner },
        }),
        makeEnvelope({
          gameKey: gameDef.key,
          sessionId,
          from: address,
          type: revealType(gameDef.key),
          seq: mySeq,
          payload: gameDef.buildRevealPayload(secretState),
        })
      );
    }

    return {
      gameState: result.gameState,
      winner: result.winner || '',
      info: result.info || '',
      turnDelta: { turn: role },
      outgoingMessages: outgoingMessages.length > 0 ? outgoingMessages : undefined,
    };
  }

  return { gameState };
}

export function applyLocalMove(gameDef, gameState, action, context) {
  const { sessionId, address, role, secretState, mySeq } = context;

  const result = gameDef.applyLocalMove(gameState, action, context);
  if (result.error) {
    return result;
  }

  const outgoingMessages = [
    makeEnvelope({
      gameKey: gameDef.key,
      sessionId,
      from: address,
      type: gameDef.moveType,
      seq: mySeq,
      payload: result.movePayload,
    }),
  ];

  if (result.winner) {
    outgoingMessages.push(
      makeEnvelope({
        gameKey: gameDef.key,
        sessionId,
        from: address,
        type: gameOverType(gameDef.key),
        seq: mySeq,
        payload: { winner: result.winner },
      }),
      makeEnvelope({
        gameKey: gameDef.key,
        sessionId,
        from: address,
        type: revealType(gameDef.key),
        seq: mySeq,
        payload: gameDef.buildRevealPayload(secretState),
      })
    );
  }

  const nextTurn = role === 'creator' ? 'joiner' : 'creator';
  return {
    gameState: result.gameState,
    outgoingMessages,
    winner: result.winner || '',
    info: result.info || '',
    turnDelta: { turn: result.winner ? context.turn : nextTurn },
    seqDelta: { mySeq: mySeq + 1 },
  };
}

export function checkAutoLoss(gameDef, gameState, context) {
  if (typeof gameDef.checkAutoLoss !== 'function') {
    return { lost: false };
  }

  const result = gameDef.checkAutoLoss(gameState, context);
  if (!result.lost) {
    return { lost: false };
  }

  const { sessionId, address, secretState, mySeq } = context;

  const outgoingMessages = [
    makeEnvelope({
      gameKey: gameDef.key,
      sessionId,
      from: address,
      type: gameOverType(gameDef.key),
      seq: mySeq,
      payload: { winner: result.winner },
    }),
    makeEnvelope({
      gameKey: gameDef.key,
      sessionId,
      from: address,
      type: revealType(gameDef.key),
      seq: mySeq,
      payload: gameDef.buildRevealPayload(secretState),
    }),
  ];

  return {
    lost: true,
    winner: result.winner,
    gameState: {
      ...gameState,
      winner: result.winner,
      reveal: {
        ...(gameState.reveal || {}),
        mine: secretState,
      },
    },
    outgoingMessages,
    seqDelta: { mySeq: mySeq + 1 },
  };
}

function runVerification(gameDef, { gameState, secretState, opponentReveal, session, role, declaredWinner, address }) {
  const opponentSecretBytes = gameDef.deserializeReveal(opponentReveal);
  const opponentSalt = hexToBytes(normalizeRevealSalt(opponentReveal.salt));
  const expectedCommitment = role === 'creator'
    ? session.joinerCommitment
    : session.creatorCommitment;

  const commitmentOk = verifyCommitment(opponentSecretBytes, opponentSalt, expectedCommitment);

  if (!commitmentOk) {
    return {
      canConfirm: false,
      contested: true,
      reason: 'Opponent reveal does not match the committed setup.',
      details: [],
    };
  }

  const winnerRole = safeLower(declaredWinner) === safeLower(address)
    ? role
    : (role === 'creator' ? 'joiner' : 'creator');

  const ruleCheck = gameDef.verifyGameRules({
    mySecretState: secretState,
    opponentReveal,
    gameState,
    role,
    declaredWinner: winnerRole,
  });

  return {
    canConfirm: ruleCheck.valid,
    contested: !ruleCheck.valid,
    reason: ruleCheck.valid ? 'Game verified successfully.' : ruleCheck.error,
    details: [],
  };
}

function normalizeRevealSalt(salt) {
  const stripped = String(salt || '').replace(/^0x/, '');
  return `0x${stripped.padStart(64, '0')}`;
}
