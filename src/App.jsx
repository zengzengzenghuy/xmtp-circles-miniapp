import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { Client, IdentifierKind, LogLevel } from "@xmtp/browser-sdk";
import ConversationList from "./components/ConversationList";
import MessageArea from "./components/MessageArea";
import BottomTabs from "./components/BottomTabs";
import AccountPage from "./components/AccountPage";
// import CirclesGroup from "./components/CirclesGroup"; // Hidden: groups feature
import Arcade from "./components/Arcade";
import NewConversationModal from "./components/NewConversationModal";
import { parseInviteFromSearch } from "./components/arcade/helpers/invite";
import { createEOASigner, createSCWSigner } from "./helpers/createSigner";
import {
  isMiniappMode,
  onWalletChange,
  signMessage,
} from "@aboutcircles/miniapp-sdk";
import { useConversations } from "./hooks/useConversations";
import { useActions } from "./stores/inboxHooks";

function App() {
  const { address, isConnected, connector, chainId } = useAccount();
  const initialArcadeInviteResult = React.useMemo(
    () => parseInviteFromSearch(window.location.search),
    [],
  );
  const { signMessageAsync } = useSignMessage();

  // Miniapp mode: running inside newCore iframe host
  const isMiniapp = isMiniappMode();
  const [miniappAddress, setMiniappAddress] = useState(null);

  const [selectedConversation, setSelectedConversation] = useState(null);
  const [activeTab, setActiveTab] = useState(() =>
    initialArcadeInviteResult.invite ? "arcade" : "chat",
  );
  const [isNewConversationModalOpen, setIsNewConversationModalOpen] =
    useState(false);
  const [xmtpClient, setXmtpClient] = useState(null);
  const [isCreatingInbox, setIsCreatingInbox] = useState(false);
  const [inboxError, setInboxError] = useState(null);
  const [circlesMode, setCirclesMode] = useState(() => {
    // Load circles mode from localStorage, default to true if not set
    const saved = localStorage.getItem("circles-mode");
    return saved === null ? true : saved === "true";
  });

  // Save circles mode to localStorage when it changes
  const handleCirclesModeToggle = () => {
    const newValue = !circlesMode;
    setCirclesMode(newValue);
    localStorage.setItem("circles-mode", String(newValue));
  };

  // Derived effective wallet state (miniapp or wagmi)
  const effectiveAddress = isMiniapp ? miniappAddress : address;
  const effectiveConnected = isMiniapp ? !!miniappAddress : isConnected;

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("arcadeInvite")) {
      return;
    }
    url.searchParams.delete("arcadeInvite");
    window.history.replaceState({}, "", url);
  }, []);

  // When running inside the newCore iframe host, subscribe to host wallet events
  useEffect(() => {
    if (!isMiniapp) return;
    const unsubscribe = onWalletChange((addr) => {
      setMiniappAddress(addr);
      if (!addr) {
        // Host wallet disconnected — clear XMTP client
        setXmtpClient(null);
        reset();
      }
    });
    return unsubscribe;
  }, [isMiniapp]); // eslint-disable-line react-hooks/exhaustive-deps

  // Use hooks for conversations management
  const {
    conversations,
    sync,
    syncAll,
    loading: isLoadingConversations,
    syncing,
    stream,
    streamAllMessages,
    createDmWithAddress,
  } = useConversations(xmtpClient);

  const { reset } = useActions();

  // Refs for stream cleanup
  const stopConversationStreamRef = useRef(null);
  const stopAllMessagesStreamRef = useRef(null);

  // Create or load XMTP inbox
  const handleCreateInbox = async () => {
    const activeAddress = effectiveAddress;
    const activeConnected = effectiveConnected;

    console.log("handleCreateInbox called", {
      address: activeAddress,
      isConnected: activeConnected,
      isMiniapp,
      connector: connector?.name,
      chainId,
    });

    if (!activeAddress || !activeConnected) {
      console.log("Missing address or not connected");
      return;
    }

    setIsCreatingInbox(true);
    setInboxError(null);

    try {
      // Check if there's an existing stored inbox ID
      const storedInboxId = localStorage.getItem(
        `xmtp-inbox-${activeAddress.toLowerCase()}`,
      );

      let signer;

      if (isMiniapp) {
        // Running inside newCore host — use Safe SCW signer via postMessage
        // The host's Safe wallet produces ERC-1271-compatible EIP-712 SafeMessage signatures
        console.log(
          "Creating SCW signer for miniapp mode (Gnosis chainId=100)",
        );
        signer = createSCWSigner(
          activeAddress,
          async (message) => {
            console.log("Miniapp SCW Sign message requested:", message);
            const { signature } = await signMessage(message, "erc1271");
            return signature;
          },
          100, // Gnosis Chain
        );
      } else {
        // Standalone mode — use wagmi connectors
        const isWalletConnect = connector?.name === "WalletConnect";
        const useChainId = chainId || 1;

        console.log("Creating signer...", {
          isWalletConnect,
          useChainId,
          hasStoredInbox: !!storedInboxId,
        });

        signer = isWalletConnect
          ? createSCWSigner(
              activeAddress,
              (message) => {
                console.log("SCW Sign message requested:", message);
                return signMessageAsync({ message });
              },
              useChainId,
            )
          : createEOASigner(activeAddress, (message) => {
              console.log("EOA Sign message requested:", message);
              return signMessageAsync({ message });
            });
      }

      if (storedInboxId) {
        console.log("Loading existing XMTP client...");
      } else {
        console.log("Creating new XMTP inbox...");
      }

      const client = await Client.create(signer, {
        env: "dev",
        dbEncryptionKey: undefined,
        appVersion: "xmtp-miniapp/0",
        loggingLevel: LogLevel.Debug,
      });

      console.log("Client created:", client);

      await client.sendSyncRequest();

      // Store inbox ID in localStorage if it's a new inbox
      if (!storedInboxId) {
        localStorage.setItem(
          `xmtp-inbox-${activeAddress.toLowerCase()}`,
          client.inboxId,
        );
        console.log("New inbox ID stored");
      } else {
        console.log("Existing inbox loaded");
      }

      setXmtpClient(client);
      console.log("XMTP connection successful");
    } catch (error) {
      console.error("Error connecting to XMTP:", error);
      console.error("Error stack:", error.stack);

      let errorMessage = error.message || "Failed to connect to XMTP";

      // Add helpful guidance for common issues
      if (
        errorMessage.includes("timeout") ||
        errorMessage.includes("timed out")
      ) {
        errorMessage +=
          "\n\nIf using Brave browser:\n" +
          "1. Click the Brave Shields icon (lion) in the address bar\n" +
          "2. Click 'Advanced View'\n" +
          "3. Turn OFF 'Block fingerprinting'\n" +
          "4. Refresh the page and try again\n\n" +
          "Or try Chrome/Firefox which have better compatibility.";
      }

      setInboxError(errorMessage);
    } finally {
      setIsCreatingInbox(false);
    }
  };

  // Handle wallet disconnection (wagmi standalone mode only;
  // miniapp disconnection is handled in the onMiniappWalletChange effect)
  useEffect(() => {
    if (isMiniapp) return;
    if (!isConnected || !address) {
      console.log("Wallet disconnected, clearing XMTP client");
      setXmtpClient(null);
      reset();
    }
  }, [isMiniapp, isConnected, address, reset]);

  // Start streams callback
  const startStreams = useCallback(async () => {
    if (!xmtpClient) return;

    try {
      stopConversationStreamRef.current = await stream();
      stopAllMessagesStreamRef.current = await streamAllMessages();
    } catch (error) {
      console.error("Error starting streams:", error);
    }
  }, [xmtpClient, stream, streamAllMessages]);

  // Stop streams callback
  const stopStreams = useCallback(() => {
    if (stopConversationStreamRef.current) {
      stopConversationStreamRef.current();
      stopConversationStreamRef.current = null;
    }
    if (stopAllMessagesStreamRef.current) {
      stopAllMessagesStreamRef.current();
      stopAllMessagesStreamRef.current = null;
    }
  }, []);

  // Sync conversations with optional network refresh
  const syncConversations = useCallback(
    async (fromNetwork = false) => {
      stopStreams();
      await sync(fromNetwork);
      await startStreams();
    },
    [sync, startStreams, stopStreams],
  );

  // Initial sync and stream setup when client is loaded
  useEffect(() => {
    if (!xmtpClient) return;

    const loadConversations = async () => {
      await sync(true);
      await startStreams();
    };

    loadConversations();

    // Cleanup streams on unmount or client change
    return () => {
      stopStreams();
    };
  }, [xmtpClient, sync, startStreams, stopStreams]);

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
  };

  const handleCreateConversation = async (recipientAddress) => {
    if (!xmtpClient) {
      console.error("XMTP client not available");
      throw new Error("XMTP client not available");
    }

    const normalizedAddress = recipientAddress.trim();

    // Check if the recipient address is valid (basic validation)
    if (!normalizedAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      console.error("Invalid Ethereum address");
      throw new Error("Please enter a valid Ethereum address");
    }

    if (
      effectiveAddress &&
      normalizedAddress.toLowerCase() === effectiveAddress.toLowerCase()
    ) {
      throw new Error("You cannot start a chat with your own wallet");
    }

    console.log("Creating DM with:", normalizedAddress);

    // Use the hook to create DM with address
    const dm = await createDmWithAddress(normalizedAddress);

    if (!dm) {
      throw new Error("This address is not registered on the XMTP network");
    }

    console.log("DM created/retrieved:", dm);

    // Select the new conversation
    setSelectedConversation(dm);

    console.log("Conversation selected:", dm);
  };

  // Format address for display
  const formatAddress = (addr) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="app">
      <div className="app-content">
        {activeTab === "chat" ? (
          !effectiveConnected ? (
            <div className="connect-prompt">
              <div className="connect-card">
                <h2>Welcome to XMTP Chat</h2>
                <p>Secure, wallet-to-wallet messaging</p>
                <button
                  className="connect-btn-large"
                  onClick={() => setActiveTab("account")}>
                  Connect Wallet
                </button>
                {isMiniapp && (
                  <p className="connect-hint">
                    Waiting for host wallet connection...
                  </p>
                )}
              </div>
            </div>
          ) : !xmtpClient ? (
            <div className="connect-prompt">
              <div className="connect-card">
                <h2>Almost there!</h2>
                <p>Sign a message to activate your XMTP inbox</p>
                <button
                  className="connect-btn-large"
                  onClick={handleCreateInbox}
                  disabled={isCreatingInbox}>
                  {isCreatingInbox ? "Connecting..." : "Activate Inbox"}
                </button>
                {inboxError && (
                  <p
                    className="connect-hint"
                    style={{
                      color: "var(--error-ink)",
                      marginTop: "1rem",
                      fontSize: "0.85rem",
                    }}>
                    {inboxError}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="chat-container">
              <ConversationList
                conversations={conversations}
                selectedConversation={selectedConversation}
                onSelectConversation={handleSelectConversation}
                onNewConversation={() => setIsNewConversationModalOpen(true)}
                isLoading={isLoadingConversations}
                onRefresh={syncConversations}
                circlesMode={circlesMode}
                className={selectedConversation ? "hidden-mobile" : ""}
              />
              <MessageArea
                conversation={selectedConversation}
                xmtpClient={xmtpClient}
                onBack={() => setSelectedConversation(null)}
                className={!selectedConversation ? "hidden-mobile" : ""}
                connectedAddress={effectiveAddress}
              />
            </div>
          )
        ) : activeTab === "arcade" ? (
          <Arcade
            address={effectiveAddress}
            connected={effectiveConnected}
            xmtpClient={xmtpClient}
            onOpenAccount={() => setActiveTab("account")}
            initialInvite={initialArcadeInviteResult.invite}
            isMiniapp={isMiniapp}
          />
        ) : (
          <AccountPage
            xmtpClient={xmtpClient}
            isCreatingInbox={isCreatingInbox}
            inboxError={inboxError}
            onCreateInbox={handleCreateInbox}
            circlesMode={circlesMode}
            onCirclesModeToggle={handleCirclesModeToggle}
            address={effectiveAddress}
            isConnected={effectiveConnected}
            isMiniapp={isMiniapp}
          />
        )}
      </div>

      <BottomTabs activeTab={activeTab} onTabChange={setActiveTab} />

      <NewConversationModal
        isOpen={isNewConversationModalOpen}
        onClose={() => setIsNewConversationModalOpen(false)}
        onCreateConversation={handleCreateConversation}
      />
    </div>
  );
}

export default App;
