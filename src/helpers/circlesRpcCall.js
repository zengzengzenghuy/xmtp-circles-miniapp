/**
 * Circles RPC helper functions
 * Centralized functions for making RPC calls to the Circles API
 */

const CIRCLES_RPC_URL = "https://staging.circlesubi.network/";

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
