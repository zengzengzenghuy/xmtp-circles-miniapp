function normalizeOrigin(origin) {
  const value = String(origin || "").trim();
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function buildPaymentTransferUrl({
  transferBaseUrl = "https://app.gnosis.io",
  recipientAddress,
  amountCrc,
  marker,
}) {
  const url = new URL(
    `/transfer/${recipientAddress}/crc`,
    normalizeOrigin(transferBaseUrl),
  );
  url.searchParams.set("data", marker.hex);
  url.searchParams.set("amount", String(amountCrc));
  return url.toString();
}
