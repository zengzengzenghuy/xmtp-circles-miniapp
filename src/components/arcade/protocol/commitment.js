import { keccak256 } from "viem";

export function generateSalt() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function saltToHex(saltBytes) {
  return bytesToHex(saltBytes);
}

export function bytesToHex(bytes) {
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export function hexToBytes(value) {
  const hex = String(value || '').replace(/^0x/, '');
  if (hex.length % 2 !== 0) {
    throw new Error('Hex string must have an even length');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = parseInt(hex.slice(index, index + 2), 16);
  }
  return bytes;
}

export function normalizeHex(value, byteCount) {
  const stripped = String(value || '').replace(/^0x/, '');
  return `0x${stripped.padStart(byteCount * 2, '0')}`;
}

export function computeCommitment(secretBytes, saltBytes) {
  const payload = new Uint8Array(secretBytes.length + saltBytes.length);
  payload.set(secretBytes, 0);
  payload.set(saltBytes, secretBytes.length);
  return keccak256(payload);
}

export function verifyCommitment(secretBytes, saltBytes, expectedHash) {
  try {
    return computeCommitment(secretBytes, saltBytes).toLowerCase() === String(expectedHash).toLowerCase();
  } catch {
    return false;
  }
}

export function buildGenericCommitment(serializeResult) {
  const salt = generateSalt();
  const saltHex = saltToHex(salt);
  const commitment = computeCommitment(serializeResult.secretBytes, salt);
  return {
    commitment,
    secretState: {
      ...serializeResult.secretState,
      salt: saltHex,
    },
    gameState: serializeResult.gameState,
    publicConfig: serializeResult.publicConfig || {},
  };
}
