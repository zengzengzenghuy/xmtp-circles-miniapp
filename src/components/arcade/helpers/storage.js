const STATE_PREFIX = "arcade-state/";
const SECRET_PREFIX = "arcade-secret/";
const ACTIVE_PREFIX = "arcade-active/";

function key(prefix, address, gameKey, sessionId = "draft") {
  return `${prefix}${String(address || "").toLowerCase()}/${String(gameKey || "none")}/${String(sessionId || "draft")}`;
}

export function loadPersistedState(address, gameKey, sessionId = "draft") {
  if (!address || !gameKey) return null;
  const raw = localStorage.getItem(key(STATE_PREFIX, address, gameKey, sessionId));
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error("Failed to parse stored arcade state", error);
    return null;
  }
}

export function savePersistedState(address, gameKey, sessionId, state) {
  if (!address || !gameKey) return;
  localStorage.setItem(
    key(STATE_PREFIX, address, gameKey, sessionId),
    JSON.stringify(state),
  );
}

export function clearPersistedState(address, gameKey, sessionId = "draft") {
  if (!address || !gameKey) return;
  localStorage.removeItem(key(STATE_PREFIX, address, gameKey, sessionId));
}

export function loadSecretState(address, gameKey, sessionId = "draft") {
  if (!address || !gameKey) return null;
  const raw = localStorage.getItem(key(SECRET_PREFIX, address, gameKey, sessionId));
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error("Failed to parse stored arcade secret state", error);
    return null;
  }
}

export function saveSecretState(address, gameKey, sessionId, secretState) {
  if (!address || !gameKey) return;
  localStorage.setItem(
    key(SECRET_PREFIX, address, gameKey, sessionId),
    JSON.stringify(secretState),
  );
}

export function clearSecretState(address, gameKey, sessionId = "draft") {
  if (!address || !gameKey) return;
  localStorage.removeItem(key(SECRET_PREFIX, address, gameKey, sessionId));
}

export function loadActiveSessionRef(address) {
  if (!address) return null;
  const raw = localStorage.getItem(
    `${ACTIVE_PREFIX}${String(address).toLowerCase()}`,
  );
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error("Failed to parse active arcade session ref", error);
    return null;
  }
}

export function saveActiveSessionRef(address, gameKey, sessionId) {
  if (!address || !gameKey || !sessionId) return;
  localStorage.setItem(
    `${ACTIVE_PREFIX}${String(address).toLowerCase()}`,
    JSON.stringify({ gameKey, sessionId }),
  );
}

export function clearActiveSessionRef(address) {
  if (!address) return;
  localStorage.removeItem(`${ACTIVE_PREFIX}${String(address).toLowerCase()}`);
}

export function clearAllArcadeStateForAddress(address) {
  if (!address) return;

  const normalizedAddress = String(address).toLowerCase();
  const prefixes = [
    `${STATE_PREFIX}${normalizedAddress}/`,
    `${SECRET_PREFIX}${normalizedAddress}/`,
    `${ACTIVE_PREFIX}${normalizedAddress}`,
  ];

  const keysToRemove = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const currentKey = localStorage.key(index);
    if (!currentKey) {
      continue;
    }
    if (prefixes.some((prefix) => currentKey.startsWith(prefix))) {
      keysToRemove.push(currentKey);
    }
  }

  keysToRemove.forEach((currentKey) => {
    localStorage.removeItem(currentKey);
  });
}
