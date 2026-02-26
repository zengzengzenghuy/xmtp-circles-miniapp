import { http, createConfig } from "wagmi";
import { gnosis } from "wagmi/chains";
import { injected, metaMask, walletConnect } from "@wagmi/connectors";

// Replace with your WalletConnect project ID from https://cloud.walletconnect.com/
const projectId =
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID";

if (!projectId || projectId === "YOUR_PROJECT_ID") {
  console.warn(
    "⚠️ WalletConnect Project ID is not set. WalletConnect will not work properly.",
  );
  console.warn(
    "Set VITE_WALLETCONNECT_PROJECT_ID in your environment or .env file",
  );
}

export const config = createConfig({
  chains: [gnosis],
  connectors: [
    injected(),
    metaMask(),
    // Only include WalletConnect if projectId is valid
    ...(projectId && projectId !== "YOUR_PROJECT_ID"
      ? [
          walletConnect({
            projectId,
            showQrModal: true,
            metadata: {
              name: "XMTP Chat",
              description: "XMTP Chat",
              url:
                typeof window !== "undefined"
                  ? window.location.origin
                  : "https://circles-miniapps.example.com",
              icons: ["https://avatars.githubusercontent.com/u/82580170"],
            },
          }),
        ]
      : []),
  ],
  transports: {
    [gnosis.id]: http(),
  },
});
