import { createPublicClient, http } from "viem";
import { gnosis } from "viem/chains";

// Contract address on Gnosis chain
const GROUP_INFO_GETTER_ADDRESS = "0x3cd1c2be7ce9fc45b4c9a97ac9ef534fa85fc19d";

// ABI for the GroupInfoGetter contract
const GROUP_INFO_GETTER_ABI = [
  {
    inputs: [],
    name: "CIRCLES_HUB",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "LIFT_ADDRESS",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address[]", name: "groupAddresses", type: "address[]" },
    ],
    name: "getGroupsInfo",
    outputs: [
      {
        components: [
          { internalType: "address", name: "owner", type: "address" },
          { internalType: "address", name: "service", type: "address" },
          { internalType: "address", name: "feeCollection", type: "address" },
          {
            internalType: "address[]",
            name: "membershipConditions",
            type: "address[]",
          },
          { internalType: "address", name: "baseMintHandler", type: "address" },
          { internalType: "address", name: "baseMintPolicy", type: "address" },
          { internalType: "address", name: "baseTreasury", type: "address" },
          { internalType: "address", name: "hub", type: "address" },
          { internalType: "address", name: "staticERC20", type: "address" },
          { internalType: "address", name: "demurragedERC20", type: "address" },
          { internalType: "address", name: "nameRegistry", type: "address" },
          { internalType: "uint256", name: "maxConditions", type: "uint256" },
          {
            internalType: "uint256",
            name: "erc1155TotalSupply",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "staticERC20TotalSupply",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "demurragedERC20TotalSupply",
            type: "uint256",
          },
          { internalType: "uint256", name: "balance", type: "uint256" },
        ],
        internalType: "struct GroupInfoGetter.GroupInfo[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

// Create a public client for Gnosis chain
const publicClient = createPublicClient({
  chain: gnosis,
  transport: http(),
});

/**
 * Fetches group information from the GroupInfoGetter contract on Gnosis chain
 * @param {string[]} groupAddresses - Array of group addresses to query
 * @returns {Promise<Array>} Array of GroupInfo structs containing group details
 * @throws {Error} If the contract call fails
 */
export async function getGroupsInfo(groupAddresses) {
  if (!groupAddresses || !Array.isArray(groupAddresses)) {
    throw new Error("groupAddresses must be an array");
  }

  if (groupAddresses.length === 0) {
    return [];
  }

  try {
    const result = await publicClient.readContract({
      address: GROUP_INFO_GETTER_ADDRESS,
      abi: GROUP_INFO_GETTER_ABI,
      functionName: "getGroupsInfo",
      args: [groupAddresses],
    });

    return result;
  } catch (error) {
    console.error("Error calling getGroupsInfo:", error);
    throw error;
  }
}
