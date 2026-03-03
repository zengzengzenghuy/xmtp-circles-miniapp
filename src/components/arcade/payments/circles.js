function normalizeString(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeAddress(value) {
  const trimmed = normalizeString(value);
  if (!trimmed) {
    return null;
  }

  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}

function normalizeHex(value) {
  const trimmed = normalizeString(value);
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("\\x")) {
    return `0x${trimmed.slice(2)}`;
  }

  if (trimmed.startsWith("0x")) {
    return trimmed;
  }

  if (/^[0-9a-f]+$/i.test(trimmed)) {
    return `0x${trimmed}`;
  }

  return null;
}

function addressesMatch(left, right) {
  const normalizedLeft = normalizeAddress(left);
  const normalizedRight = normalizeAddress(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

function utf8ToHex(value) {
  const encoder = new TextEncoder();
  return Array.from(encoder.encode(String(value || "")))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hexToUtf8(hexValue) {
  try {
    const hex = String(hexValue || "").startsWith("0x")
      ? String(hexValue).slice(2)
      : String(hexValue || "");

    if (!hex || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
      return null;
    }

    const bytes = new Uint8Array(
      hex.match(/.{1,2}/g).map((byte) => Number.parseInt(byte, 16)),
    );
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function eventMatchesData(dataField, dataValue) {
  const target = normalizeString(dataValue);
  if (!target) {
    return false;
  }

  const targetHex = utf8ToHex(target);
  const targetCandidates = new Set([target, targetHex, `0x${targetHex}`]);

  if (target.startsWith("0x")) {
    targetCandidates.add(target.slice(2));
  }

  const eventRaw = normalizeString(dataField);
  if (targetCandidates.has(eventRaw)) {
    return true;
  }

  const eventHex = normalizeHex(eventRaw);
  if (!eventHex) {
    return false;
  }

  if (targetCandidates.has(eventHex) || targetCandidates.has(eventHex.slice(2))) {
    return true;
  }

  const eventUtf8 = hexToUtf8(eventHex);
  return Boolean(eventUtf8 && targetCandidates.has(normalizeString(eventUtf8)));
}

async function callCirclesRpc(rpcUrl, method, params) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });

  if (!response.ok) {
    const error = new Error(
      `Circles RPC request failed with HTTP ${response.status}`,
    );
    error.status = response.status;
    error.details = await response.text().catch(() => "");
    throw error;
  }

  const body = await response.json();
  if (body.error) {
    throw new Error(body.error.message || "Circles RPC returned an error");
  }

  return body.result || {};
}

function mapTransferEvents(events = []) {
  return events.map((item) => {
    const values = item?.values || {};

    return {
      transactionHash: String(values.transactionHash ?? ""),
      from: String(values.from ?? ""),
      to: String(values.to ?? ""),
      data: String(values.data ?? ""),
      crc: 0,
      blockNumber: String(values.blockNumber ?? ""),
      timestamp: String(values.timestamp ?? ""),
      transactionIndex: String(values.transactionIndex ?? ""),
      logIndex: String(values.logIndex ?? ""),
    };
  });
}

async function circlesEventsQuery(rpcUrl, options = {}) {
  const recipientAddress = normalizeAddress(options.recipientAddress ?? "");
  const body = [
    recipientAddress ?? options.cursor ?? null,
    null,
    null,
    ["CrcV2_TransferData"],
  ];

  const result = await callCirclesRpc(rpcUrl, "circles_events", body);

  return {
    events: mapTransferEvents(result.events),
    hasMore: Boolean(result.hasMore),
    nextCursor: result.nextCursor ?? null,
  };
}

export async function fetchTransferDataEvents(
  rpcUrl,
  limit = 100,
  recipientAddress,
) {
  const normalizedRecipient = normalizeAddress(recipientAddress ?? "");

  if (normalizedRecipient) {
    const response = await circlesEventsQuery(rpcUrl, {
      recipientAddress: normalizedRecipient,
    });
    return response.events.slice(0, limit);
  }

  const events = [];
  let cursor = null;
  let hasMore = true;

  while (hasMore && events.length < limit) {
    const response = await circlesEventsQuery(rpcUrl, { cursor });
    events.push(...response.events);
    hasMore = response.hasMore;
    cursor = response.nextCursor;

    if (!cursor) {
      break;
    }
  }

  return events.slice(0, limit);
}

export async function checkPaymentReceived(
  rpcUrl,
  dataValue,
  minAmountCRC,
  recipientAddress,
) {
  if (!rpcUrl || !dataValue || minAmountCRC <= 0) {
    return null;
  }

  const normalizedRecipient = normalizeAddress(recipientAddress ?? "");
  const events = await fetchTransferDataEvents(
    rpcUrl,
    200,
    normalizedRecipient,
  );

  for (const event of events) {
    if (!event.data) {
      continue;
    }

    if (normalizedRecipient && !addressesMatch(event.to, normalizedRecipient)) {
      continue;
    }

    if (eventMatchesData(event.data, dataValue)) {
      return event;
    }
  }

  return null;
}
