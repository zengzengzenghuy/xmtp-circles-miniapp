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

// Factory contract address on Gnosis chain
export const BASE_GROUP_FACTORY_ADDRESS =
  "0xD0B5Bd9962197BEaC4cbA24244ec3587f19Bd06d";

// ABI for the Factory contract
export const BASE_GROUP_FACTORY_ABI = [
  { inputs: [], name: "MaxNameLength19", type: "error" },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "group",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "mintHandler",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "treasury",
        type: "address",
      },
    ],
    name: "BaseGroupCreated",
    type: "event",
  },
  {
    inputs: [
      { internalType: "address", name: "_owner", type: "address" },
      { internalType: "address", name: "_service", type: "address" },
      { internalType: "address", name: "_feeCollection", type: "address" },
      {
        internalType: "address[]",
        name: "_initialConditions",
        type: "address[]",
      },
      { internalType: "string", name: "_name", type: "string" },
      { internalType: "string", name: "_symbol", type: "string" },
      { internalType: "bytes32", name: "_metadataDigest", type: "bytes32" },
    ],
    name: "createBaseGroup",
    outputs: [
      { internalType: "address", name: "group", type: "address" },
      { internalType: "address", name: "mintHandler", type: "address" },
      { internalType: "address", name: "treasury", type: "address" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "group", type: "address" }],
    name: "deployedByFactory",
    outputs: [{ internalType: "bool", name: "deployed", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
];

export async function createBaseGroup({
  walletClient,
  owner,
  service,
  feeCollection,
  initialConditions,
  name,
  symbol,
  metadataDigest,
}) {
  if (!walletClient) {
    throw new Error("Wallet client is required");
  }

  if (
    !owner ||
    !service ||
    !feeCollection ||
    !initialConditions ||
    !name ||
    !symbol ||
    !metadataDigest
  ) {
    throw new Error("All parameters are required");
  }

  try {
    const hash = await walletClient.writeContract({
      address: BASE_GROUP_FACTORY_ADDRESS,
      abi: BASE_GROUP_FACTORY_ABI,
      functionName: "createBaseGroup",
      args: [
        owner,
        service,
        feeCollection,
        initialConditions,
        name,
        symbol,
        metadataDigest,
      ],
    });

    // Create a public client for Gnosis chain
    const publicClient = createPublicClient({
      chain: gnosis,
      transport: http(),
    });

    // Wait for transaction receipt
    console.log("Waiting for transaction receipt...");
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
    });

    console.log("Transaction receipt received:", receipt);

    // Event signature for BaseGroupCreated event
    const BASE_GROUP_CREATED_EVENT_SIGNATURE =
      "0xee2d13e80f5f1abdc1590049ea7b859791ca98f79c1aa0b19ae0647c9bb81a96";

    // Find the BaseGroupCreated event log
    const baseGroupCreatedLog = receipt.logs.find(
      (log) =>
        log.address.toLowerCase() ===
          BASE_GROUP_FACTORY_ADDRESS.toLowerCase() &&
        log.topics[0] === BASE_GROUP_CREATED_EVENT_SIGNATURE,
    );

    if (!baseGroupCreatedLog) {
      throw new Error(
        "BaseGroupCreated event not found in transaction receipt",
      );
    }

    // Extract group address from topics[1]
    // Topics are indexed event parameters, topics[1] is the group address
    const groupAddress = baseGroupCreatedLog.topics[1];

    // Convert from bytes32 to address format (0x + last 40 characters)
    const formattedGroupAddress = "0x" + groupAddress.slice(-40);

    console.log("Group created successfully!");
    console.log("Group Address:", formattedGroupAddress);
    console.log("Transaction Hash:", hash);
    return {
      groupAddress: formattedGroupAddress,
      transactionHash: hash,
      receipt,
    };
  } catch (error) {
    console.error("Error calling createBaseGroup:", error);
    throw error;
  }
}
