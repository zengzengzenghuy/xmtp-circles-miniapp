export const ARCADE_PROTOCOL_VERSION = "arcade/v1";
export const ARCADE_INVITE_PARAM = "arcadeInvite";

export const GAME_KEYS = {
  BATTLESHIP: "battleship",
  BLOCK_CLASH: "block_clash",
};

export const PHASE = {
  HOME: "HOME",
  PAYMENT_SELECT: "PAYMENT_SELECT",
  PAYMENT_WAIT: "PAYMENT_WAIT",
  SETUP: "SETUP",
  CREATE_INVITE: "CREATE_INVITE",
  JOIN_INVITE: "JOIN_INVITE",
  PLAYING: "PLAYING",
  RESULT: "RESULT",
};

export const SESSION_STATUS = {
  DRAFT: "draft",
  WAITING_FOR_JOIN: "waiting_for_join",
  WAITING_FOR_READY: "waiting_for_ready",
  ACTIVE: "active",
  RESULT: "result",
};

export const LIFECYCLE_TYPES = {
  SESSION_JOIN: "SESSION_JOIN",
  SESSION_READY: "SESSION_READY",
  SESSION_JOIN_REJECTED: "SESSION_JOIN_REJECTED",
};

export const EMPTY_COMMITMENT = `0x${"00".repeat(32)}`;

export const PAYMENT_WATCH_STATUS = {
  IDLE: "idle",
  WAITING: "waiting",
  CONFIRMED: "confirmed",
  ERROR: "error",
};
