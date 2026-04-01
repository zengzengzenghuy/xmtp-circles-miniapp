/**
 * Creates signers for XMTP
 * Based on xmtp.chat implementation
 */
import { IdentifierKind } from "@xmtp/browser-sdk";

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

export const createSCWSigner = (address, signMessage, chainId = 1) => {
  console.log("Creating SCW signer with chain ID:", chainId);
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
        const signature = await signMessage(message);
        console.log("Got signature:", signature);

        if (!signature || typeof signature !== "string") {
          throw new Error(
            `SCW signMessage returned invalid signature: ${JSON.stringify(signature)}`,
          );
        }

        // Convert hex signature to Uint8Array
        const hex = signature.startsWith("0x") ? signature.slice(2) : signature;

        if (hex.length === 0 || hex.length % 2 !== 0) {
          throw new Error(
            `SCW signature has invalid hex length (${hex.length}). Raw value: ${signature}`,
          );
        }

        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
          bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
        }
        console.log(
          `Converted SCW signature to ${bytes.length} bytes (expected ≥65 for ECDSA)`,
        );

        if (bytes.length < 65) {
          console.warn(
            `SCW signature is only ${bytes.length} bytes — Safe ERC-1271 signatures are typically ≥65 bytes. ` +
              `This may cause VerifySmartContractWalletSignatures to reject the request.`,
          );
        }

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
  };
};
