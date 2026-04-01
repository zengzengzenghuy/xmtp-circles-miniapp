/**
 * Circles RPC helper functions
 * Centralized functions for making RPC calls to the Circles API
 */

const CIRCLES_RPC_URL = "https://rpc.aboutcircles.com/";

const MAX_FLOW_TARGET =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

/**
 * Finds the max transferable CRC flow between two addresses
 * @param {string} source - The sender's Ethereum address
 * @param {string} sink - The receiver's Ethereum address
 * @returns {Promise<string>} The maxFlow in human-readable CRC (18 decimals)
 */
export async function getCirclesMaxFlow(source, sink) {
  if (!source || !sink) return "0";

  const response = await fetch(CIRCLES_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "circlesV2_findPath",
      params: [
        {
          source: source,
          sink: sink,
          targetFlow: MAX_FLOW_TARGET,
          withWrap: false,
          quantizedMode: false,
        },
      ],
    }),
  });

  const data = await response.json();
  const rawFlow = data?.result?.maxFlow;
  if (!rawFlow) return "0";

  const whole = BigInt(rawFlow) / BigInt("1000000000000000000");
  const remainder = BigInt(rawFlow) % BigInt("1000000000000000000");
  if (remainder === 0n) return whole.toString();

  const decimals = remainder.toString().padStart(18, "0").replace(/0+$/, "");
  return `${whole}.${decimals}`;
}

/**
 * Fetches transfer data for a given address from the Circles RPC.
 * Returns an array of { transactionHash, from, to, data } objects.
 * @param {string} address - The connected account's Ethereum address
 * @returns {Promise<Array>}
 */
export async function circlesGetTransferData(address) {
  if (!address) return [];

  const response = await fetch(CIRCLES_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "circles_getTransferData",
      params: [address],
    }),
  });

  const data = await response.json();
  return data?.result?.results ?? [];
}

/**
 * Fetches a Circles profile by Ethereum address
 * @param {string} address - The Ethereum address to fetch the profile for
 * @returns {Promise<Object|null>} The profile object or null if not found
 * @throws {Error} If the RPC call fails
 */
export async function getProfileByAddress(address) {
  if (!address) {
    return null;
  }

  try {
    const response = await fetch(CIRCLES_RPC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "circles_getProfileByAddress",
        params: [address],
      }),
    });

    const data = await response.json();

    if (data.result && Object.keys(data.result).length > 0) {
      return data.result;
    }

    return null;
  } catch (error) {
    console.error("Error fetching Circles profile:", error);
    throw error;
  }
}
