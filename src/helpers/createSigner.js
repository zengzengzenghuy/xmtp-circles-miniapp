/**
 * Creates signers for XMTP
 * Based on xmtp.chat implementation
 */
import { IdentifierKind } from "@xmtp/browser-sdk";
import { hashMessage } from "viem";

export const createEOASigner = (address, signMessage) => {
  return {
    type: "EOA",
    getIdentifier: () => {
      console.log("EOA Signer.getIdentifier() called");
      return {
        identifier: address.toLowerCase(),
        identifierKind: IdentifierKind.Ethereum,
      };
    },
    signMessage: async (message) => {
      console.log("EOA Signer.signMessage() called with message:", message);
      try {
        const signature = await signMessage(message);
        console.log("Got signature:", signature);
        // Convert hex signature to Uint8Array
        const hex = signature.startsWith("0x") ? signature.slice(2) : signature;
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
          bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
        }
        console.log("Converted signature to bytes:", bytes);
        return bytes;
      } catch (error) {
        console.error("Error in EOA signMessage:", error);
        throw error;
      }
    },
  };
};

const GNOSIS_RPC_URL = "https://rpc.gnosischain.com/";

const fetchGnosisBlockNumber = async () => {
  try {
    const res = await fetch(GNOSIS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_blockNumber",
        params: [],
      }),
    });
    const data = await res.json();
    if (data.result) return BigInt(data.result);
  } catch (_) {
    // Silent fail — XMTP falls back to "latest" if blockNumber is undefined
  }
  return undefined;
};

export const createSCWSigner = (address, signMessage, chainId = 1) => {
  console.log("Creating SCW signer with chain ID:", chainId);

  // Holds the block number fetched at signing time. The XMTP node uses this
  // as the anchor block for ERC-1271 verification so all concurrent
  // VerifySmartContractWalletSignatures requests use the same block,
  // preventing installation diff race conditions.
  let latestBlockNumber;

  return {
    type: "SCW",
    getIdentifier: () => {
      console.log("SCW Signer.getIdentifier() called");
      return {
        identifier: address.toLowerCase(),
        identifierKind: IdentifierKind.Ethereum,
      };
    },
    signMessage: async (message) => {
      console.log("SCW Signer.signMessage() called with message:", message);
      try {
        // XMTP node calls safe.isValidSignature(eip191Hash(message), sig).
        // Pre-compute the EIP-191 hash and pass it to the host so the Safe
        // signs over the exact bytes XMTP will later verify against.
        const eip191Hash = hashMessage(message);
        console.log("EIP-191 hash for SCW signing:", eip191Hash);
        const signature = await signMessage(eip191Hash, "erc1271");
        console.log("Got signature:", signature);
        // Fetch block number right after signing so getBlockNumber() returns
        // the block that was current at the moment the signature was produced.
        latestBlockNumber = await fetchGnosisBlockNumber();
        console.log("Block number at signing time:", latestBlockNumber);
        // Convert hex signature to Uint8Array
        const hex = signature.startsWith("0x") ? signature.slice(2) : signature;
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
          bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
        }
        console.log("Converted signature to bytes:", bytes);
        return bytes;
      } catch (error) {
        console.error("Error in SCW signMessage:", error);
        throw error;
      }
    },
    getChainId: () => {
      console.log("SCW Signer.getChainId() called, returning:", chainId);
      return BigInt(chainId);
    },
    // Called synchronously by the SDK right after signMessage resolves.
    // Returns the block number captured during signing.
    getBlockNumber: () => latestBlockNumber,
  };
};
