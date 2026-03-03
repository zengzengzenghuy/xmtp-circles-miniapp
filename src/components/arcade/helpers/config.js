const DEFAULT_CIRCLES_RPC_URL =
  typeof window !== "undefined" &&
  /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
    ? "/circles-rpc"
    : "https://rpc.aboutcircles.com/";
const DEFAULT_PAYMENT_POLL_INTERVAL_MS = 5000;
const DEFAULT_GNOSIS_TRANSFER_BASE_URL = "https://app.gnosis.io";
const DEFAULT_PAYMENT_RECIPIENT_ADDRESS =
  "0x8132139D4ec3f68Cd3eddE9baF9d2137edca5849";
const LOCAL_CIRCLES_RPC_PROXY_PATH = "/circles-rpc";

function isLocalhostRuntime() {
  if (typeof window === "undefined") {
    return false;
  }

  return /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
}

function resolveCirclesRpcUrl(value) {
  const configured = String(value || "").trim();

  if (!configured) {
    return DEFAULT_CIRCLES_RPC_URL;
  }

  if (
    isLocalhostRuntime() &&
    /(^https?:\/\/)?rpc\.aboutcircles\.com\/?$/i.test(configured)
  ) {
    return LOCAL_CIRCLES_RPC_PROXY_PATH;
  }

  return configured;
}

function getCurrentRuntimeUrl() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.href;
}

function isValidAbsoluteHttpUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function resolveInviteBaseUrl(value) {
  const configured = String(value || "").trim();

  if (configured && isValidAbsoluteHttpUrl(configured)) {
    return configured;
  }

  return getCurrentRuntimeUrl();
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function isValidAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || ""));
}

export function getArcadeConfig() {
  const freeMode = parseBoolean(import.meta.env.VITE_ARCADE_FREE_MODE, true);
  const paymentRecipientAddress = String(
    import.meta.env.VITE_ARCADE_PAYMENT_RECIPIENT_ADDRESS ||
      DEFAULT_PAYMENT_RECIPIENT_ADDRESS,
  );
  const circlesRpcUrl = resolveCirclesRpcUrl(
    import.meta.env.VITE_CIRCLES_RPC_URL,
  );
  const paymentTransferBaseUrl =
    String(import.meta.env.VITE_GNOSIS_TRANSFER_BASE_URL || "").trim() ||
    DEFAULT_GNOSIS_TRANSFER_BASE_URL;
  const inviteBaseUrl = resolveInviteBaseUrl(
    import.meta.env.VITE_ARCADE_INVITE_BASE_URL,
  );
  const paymentPollIntervalMs = parseInteger(
    import.meta.env.VITE_ARCADE_PAYMENT_POLL_INTERVAL_MS,
    DEFAULT_PAYMENT_POLL_INTERVAL_MS,
  );
  const paymentRecipientConfigured = isValidAddress(paymentRecipientAddress);

  return {
    freeMode,
    paidMode: !freeMode,
    paymentRecipientAddress,
    paymentRecipientConfigured,
    circlesRpcUrl,
    paymentTransferBaseUrl,
    inviteBaseUrl,
    paymentPollIntervalMs,
  };
}
