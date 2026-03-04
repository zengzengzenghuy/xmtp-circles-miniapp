import {
  ARCADE_PROTOCOL_VERSION,
  LIFECYCLE_TYPES,
} from "../helpers/constants.js";

export function makeEnvelope({
  gameKey,
  sessionId,
  from,
  type,
  seq = 0,
  payload = {},
}) {
  return {
    version: ARCADE_PROTOCOL_VERSION,
    gameKey,
    sessionId: String(sessionId),
    type,
    seq,
    from,
    payload,
  };
}

export function isLifecycleMessage(type) {
  return (
    type === LIFECYCLE_TYPES.SESSION_JOIN ||
    type === LIFECYCLE_TYPES.SESSION_READY ||
    type === LIFECYCLE_TYPES.SESSION_JOIN_REJECTED ||
    type.endsWith('_GAME_OVER') ||
    type.endsWith('_REVEAL')
  );
}

export function gameOverType(gameKey) {
  return `${gameKey.toUpperCase()}_GAME_OVER`;
}

export function revealType(gameKey) {
  return `${gameKey.toUpperCase()}_REVEAL`;
}
