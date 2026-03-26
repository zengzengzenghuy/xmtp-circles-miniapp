import { parseAbiItem } from "viem";
import { encodeCrcV2TransferData } from "@aboutcircles/sdk-utils";

const HUB_ADDRESS = "0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8";
const CIRCLES_RPC_URL = "https://rpc.aboutcircles.com/";
const MAX_FLOW_TARGET =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

const HUB_ABI = [
  parseAbiItem(
    "function safeBatchTransferFrom(address _from, address _to, uint256[] memory _ids, uint256[] memory _values, bytes _data) public",
  ),
];

/**
 * Encodes a 32-byte XMTP messageId as type 0x0002 per the Circles SDK spec,
 * using @aboutcircles/sdk-utils encodeCrcV2TransferData.
 */
export function encodeMessageId(messageId) {
  return encodeCrcV2TransferData([messageId], 0x0002);
}

/**
 * Fetches the optimal transfer path for a given amount
 */
async function findTransferPath(source, sink, targetFlowRaw) {
  const response = await fetch(CIRCLES_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "circlesV2_findPath",
      params: [
        {
          source,
          sink,
          targetFlow: targetFlowRaw,
          withWrap: false,
          quantizedMode: false,
        },
      ],
    }),
  });
  const data = await response.json();
  if (!data?.result?.transfers?.length) {
    throw new Error("No transfer path found");
  }
  return data.result.transfers;
}

/**
 * Executes a CRC transfer via the Hub's safeBatchTransferFrom, with an
 * XMTP message linked on-chain via the encoded messageId in _data.
 *
 * Flow:
 *  1. Send XMTP message optimistically → get messageId
 *  2. Encode messageId (type 0x0002) as _data
 *  3. Find transfer path and call safeBatchTransferFrom on-chain
 *  4. On success, publish the XMTP message
 *
 * @param {object} params
 * @param {object} params.walletClient  - wagmi walletClient
 * @param {string} params.source        - sender address
 * @param {string} params.sink          - receiver address (must be raw address, not username)
 * @param {string} params.amountCRC     - human-readable amount (e.g. "1.5")
 * @param {string} params.note          - optional note text
 * @param {string} params.peerDisplay   - display name or address shown to receiver
 * @param {object} params.conversation  - raw XMTP conversation object
 * @returns {Promise<string>} transaction hash
 */
export async function callHubTransfer({
  walletClient,
  source,
  sink,
  amountCRC,
  note,
  peerDisplay,
  conversation,
}) {
  if (!walletClient) throw new Error("Wallet client is required");
  if (!source || !sink) throw new Error("Source and sink addresses are required");
  if (!conversation) throw new Error("Conversation is required");

  // Encode transfer metadata into the XMTP message so both sides can render it
  const payload = JSON.stringify({
    value: amountCRC,
    to: peerDisplay || sink,
    note: note || "",
  });
  const xmtpMessage = `crc_transfer# ${payload}`;

  // Step 1: Send optimistically to get the messageId before publishing
  const messageId = await conversation.sendText(xmtpMessage, true);

  // Step 2: Encode messageId as _data (type 0x0002)
  let encodedData = "0x";
  try {
    encodedData = encodeMessageId(messageId);
  } catch (e) {
    console.warn("Could not encode messageId, proceeding with empty _data:", e.message);
  }

  // Step 3: Publish the XMTP message immediately — pending intents have a short
  // TTL and the wallet signing step below can take 30+ seconds, causing
  // "Sync failed to wait for intent" if we defer until after writeContract.
  await conversation.publishMessages();

  // Convert human-readable CRC to raw 18-decimal BigInt string
  const [wholePart = "0", fracPart = ""] = amountCRC.toString().split(".");
  const fracPadded = fracPart.padEnd(18, "0").slice(0, 18);
  const targetFlowRaw = (
    BigInt(wholePart) * BigInt("1000000000000000000") +
    BigInt(fracPadded)
  ).toString();

  // Step 4: Find path and execute on-chain
  const transfers = await findTransferPath(source, sink, targetFlowRaw);
  const ids = transfers.map((t) => BigInt(t.tokenOwner));
  const values = transfers.map((t) => BigInt(t.value));

  const hash = await walletClient.writeContract({
    address: HUB_ADDRESS,
    abi: HUB_ABI,
    functionName: "safeBatchTransferFrom",
    args: [source, sink, ids, values, encodedData],
  });

  return { hash, messageId };
}
