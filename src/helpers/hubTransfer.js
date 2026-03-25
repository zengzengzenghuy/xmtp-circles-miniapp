import { parseAbiItem } from "viem";

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
 * Executes a CRC transfer via the Hub's safeBatchTransferFrom
 * @param {object} params
 * @param {object} params.walletClient  - wagmi walletClient
 * @param {string} params.source        - sender address
 * @param {string} params.sink          - receiver address
 * @param {string} params.amountCRC     - human-readable amount (e.g. "1.5")
 * @returns {Promise<string>} transaction hash
 */
export async function callHubTransfer({ walletClient, source, sink, amountCRC }) {
  if (!walletClient) throw new Error("Wallet client is required");
  if (!source || !sink) throw new Error("Source and sink addresses are required");

  // Convert human-readable CRC to raw 18-decimal BigInt string
  const [wholePart = "0", fracPart = ""] = amountCRC.toString().split(".");
  const fracPadded = fracPart.padEnd(18, "0").slice(0, 18);
  const targetFlowRaw = (
    BigInt(wholePart) * BigInt("1000000000000000000") +
    BigInt(fracPadded)
  ).toString();

  const transfers = await findTransferPath(source, sink, targetFlowRaw);

  const ids = transfers.map((t) => BigInt(t.tokenOwner));
  const values = transfers.map((t) => BigInt(t.value));

  const hash = await walletClient.writeContract({
    address: HUB_ADDRESS,
    abi: HUB_ABI,
    functionName: "safeBatchTransferFrom",
    args: [source, sink, ids, values, "0x"],
  });

  return hash;
}
