import { http, createConfig } from "wagmi";
import { gnosis } from "wagmi/chains";
import { injected, metaMask, walletConnect } from "@wagmi/connectors";
import { isMiniappMode } from "@aboutcircles/miniapp-sdk";

const isInMiniapp = isMiniappMode();

// Replace with your WalletConnect project ID from https://cloud.walletconnect.com/
const projectId =
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID";

if (!isInMiniapp && (!projectId || projectId === "YOUR_PROJECT_ID")) {
  console.warn(
    "⚠️ WalletConnect Project ID is not set. WalletConnect will not work properly.",
  );
  console.warn(
    "Set VITE_WALLETCONNECT_PROJECT_ID in your environment or .env file",
  );
}

// In miniapp mode the host iframe handles all wallet interactions via postMessage,
// so we skip connector initialization to avoid MetaMask SDK and WalletConnect
// crashing when they detect the iframe context.
const connectors = isInMiniapp
  ? []
  : [
      injected(),
      metaMask(),
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
    ];

export const config = createConfig({
  chains: [gnosis],
  connectors,
  transports: {
    [gnosis.id]: http(),
  },
});
