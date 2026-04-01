import { TransferBuilder } from "@aboutcircles/sdk-transfers";
import {
  circlesConfig,
  CirclesConverter,
  encodeCrcV2TransferData,
  hexToBytes,
} from "@aboutcircles/sdk-utils";

const CIRCLES_RPC_URL = "https://rpc.aboutcircles.com/";
export const MAX_FLOW_TARGET =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

const transferBuilder = new TransferBuilder(circlesConfig[100]);

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
 * Executes a CRC transfer via TransferBuilder.constructAdvancedTransfer, with
 * an XMTP message linked on-chain via the encoded messageId in txData.
 *
 * Flow:
 *  1. Send XMTP message optimistically → get messageId
 *  2. Encode messageId (type 0x0002) as txData bytes
 *  3. Publish XMTP message immediately (before wallet signing to avoid intent TTL expiry)
 *  4. Build transactions via constructAdvancedTransfer
 *  5. Send as a single tx (direct or Multicall3) → return one hash
 *
 * @param {object} params
 * @param {object} params.walletClient  - wagmi walletClient
 * @param {string} params.source        - sender address
 * @param {string} params.sink          - receiver address (must be raw address, not username)
 * @param {string} params.amountCRC     - human-readable amount (e.g. "1.5")
 * @param {string} params.note          - optional note text
 * @param {string} params.peerDisplay   - display name or address shown to receiver
 * @param {object} params.conversation  - raw XMTP conversation object
 * @returns {Promise<{ hash: string, messageId: string }>}
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
  if (!source || !sink)
    throw new Error("Source and sink addresses are required");
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

  // Step 2: Encode messageId as txData bytes (type 0x0002)
  let txData;
  try {
    txData = hexToBytes(encodeMessageId(messageId));
  } catch (e) {
    console.warn(
      "Could not encode messageId, proceeding without txData:",
      e.message,
    );
  }

  // Step 3: Publish the XMTP message immediately — pending intents have a short
  // TTL and the wallet signing step below can take 30+ seconds, causing
  // "Sync failed to wait for intent" if we defer until after sending.
  await conversation.publishMessages();

  // Step 4: Build transactions via TransferBuilder
  const amount = CirclesConverter.circlesToAttoCircles(Number(amountCRC));
  const txs = await transferBuilder.constructAdvancedTransfer(
    source,
    sink,
    amount,
    txData ? { txData } : undefined,
  );

  // Step 5: Execute transactions.
  // SCW (Safe) mode: batch all txs into one on-chain transaction via sendBatchTransactions.
  // EOA mode: send each tx sequentially, then pick the operateFlowMatrix hash.
  let hash;
  if (walletClient.sendBatchTransactions) {
    hash = await walletClient.sendBatchTransactions(txs);
  } else {
    const OPERATE_FLOW_MATRIX_SELECTOR = "0x0d22d9b5";
    const hashes = [];
    for (const tx of txs) {
      hashes.push(await walletClient.sendTransaction(tx));
    }
    const flowMatrixIndex = txs.findIndex((tx) =>
      tx.data?.startsWith(OPERATE_FLOW_MATRIX_SELECTOR),
    );
    hash = hashes[flowMatrixIndex] ?? hashes[hashes.length - 1];
  }

  return { hash, messageId };
}
