import {
  ARCADE_INVITE_PARAM,
  ARCADE_PROTOCOL_VERSION,
} from "./constants.js";

export function createInvitePayload({
  sessionId,
  gameKey,
  creatorAddress,
  creatorCommitment,
  publicConfig = {},
  createdAt,
}) {
  const now = Number(createdAt || Date.now());
  return {
    version: ARCADE_PROTOCOL_VERSION,
    sessionId: String(sessionId),
    gameKey: String(gameKey),
    creatorAddress: String(creatorAddress),
    creatorCommitment: String(creatorCommitment),
    publicConfig,
    createdAt: now,
    expiresAt: now + 30 * 60 * 1000, // 30 minutes
  };
}

function toBase64Url(value) {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return atob(`${normalized}${padding}`);
}

export function encodeInvitePayload(payload) {
  return toBase64Url(JSON.stringify(payload));
}

export function buildInviteLink(baseUrl, payload) {
  const url = new URL(baseUrl, window.location.origin);
  url.searchParams.delete(ARCADE_INVITE_PARAM);
  url.searchParams.set(ARCADE_INVITE_PARAM, encodeInvitePayload(payload));
  return url.toString();
}

export function decodeInvitePayload(raw) {
  if (!raw) {
    return { invite: null, error: "" };
  }

  try {
    const decoded = typeof raw === "string" ? JSON.parse(fromBase64Url(raw)) : raw;
    return validateInvitePayload(decoded);
  } catch (error) {
    return {
      invite: null,
      error: `Invalid invite payload: ${error.message}`,
    };
  }
}

export function isInviteExpired(invite) {
  if (!invite?.expiresAt) return false; // old invites without expiresAt stay valid
  return Date.now() > invite.expiresAt;
}

export function parseInviteFromSearch(search) {
  const params = new URLSearchParams(search);
  return decodeInvitePayload(params.get(ARCADE_INVITE_PARAM));
}

export function validateInvitePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { invite: null, error: "Invite payload must be an object" };
  }

  const invite = {
    version: String(payload.version || ""),
    sessionId: String(payload.sessionId || ""),
    gameKey: String(payload.gameKey || ""),
    creatorAddress: String(payload.creatorAddress || ""),
    creatorCommitment: String(payload.creatorCommitment || ""),
    publicConfig:
      payload.publicConfig && typeof payload.publicConfig === "object"
        ? payload.publicConfig
        : {},
    createdAt: Number(payload.createdAt || 0),
  };

  if (invite.version !== ARCADE_PROTOCOL_VERSION) {
    return { invite: null, error: "Unsupported invite version" };
  }
  if (!/^[a-z_]+$/.test(invite.gameKey)) {
    return { invite: null, error: "Invite gameKey must be a supported slug" };
  }
  if (!/^[A-Za-z0-9:_-]+$/.test(invite.sessionId)) {
    return { invite: null, error: "Invite sessionId is malformed" };
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(invite.creatorAddress)) {
    return { invite: null, error: "Invite creatorAddress must be a valid address" };
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(invite.creatorCommitment)) {
    return {
      invite: null,
      error: "Invite creatorCommitment must be a 32-byte hex string",
    };
  }
  if (!Number.isFinite(invite.createdAt) || invite.createdAt <= 0) {
    return { invite: null, error: "Invite createdAt must be a timestamp" };
  }

  invite.expiresAt = Number(payload.expiresAt || 0);

  return { invite, error: "" };
}
