import { bytesToHex, stringToBytes } from "viem";

function normalizeAddress(address) {
  return String(address || "").toLowerCase();
}

export function buildPaymentMarker({
  sessionId,
  payerRole,
  payerAddress,
  amountCrc,
}) {
  const raw = [
    "arcade/v1",
    String(sessionId || ""),
    String(payerRole || ""),
    normalizeAddress(payerAddress),
    String(amountCrc || 0),
  ].join("|");
  const bytes = stringToBytes(raw);

  return {
    raw,
    bytes,
    hex: bytesToHex(bytes),
  };
}
