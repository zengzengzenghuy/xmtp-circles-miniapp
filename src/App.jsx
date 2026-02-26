import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { Client, IdentifierKind, LogLevel } from "@xmtp/browser-sdk";
import ConversationList from "./components/ConversationList";
import MessageArea from "./components/MessageArea";
import BottomTabs from "./components/BottomTabs";
import AccountPage from "./components/AccountPage";
import NewConversationModal from "./components/NewConversationModal";
import { createEOASigner, createSCWSigner } from "./helpers/createSigner";
import { useConversations } from "./hooks/useConversations";
import { useActions } from "./stores/inboxHooks";

function App() {
  const { address, isConnected, connector, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [activeTab, setActiveTab] = useState("chat");
  const [isNewConversationModalOpen, setIsNewConversationModalOpen] =
    useState(false);
  const [xmtpClient, setXmtpClient] = useState(null);
  const [isCreatingInbox, setIsCreatingInbox] = useState(false);
  const [inboxError, setInboxError] = useState(null);
  const [circlesMode, setCirclesMode] = useState(() => {
    // Load circles mode from localStorage
    const saved = localStorage.getItem("circles-mode");
    return saved === "true";
  });

  // Save circles mode to localStorage when it changes
  const handleCirclesModeToggle = () => {
    const newValue = !circlesMode;
    setCirclesMode(newValue);
    localStorage.setItem("circles-mode", String(newValue));
  };

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
    console.log("handleCreateInbox called", {
      address,
      isConnected,
      connector: connector?.name,
      chainId,
    });

    if (!address || !isConnected) {
      console.log("Missing address or not connected");
      return;
    }

    setIsCreatingInbox(true);
    setInboxError(null);

    try {
      // Check if there's an existing stored inbox ID
      const storedInboxId = localStorage.getItem(
        `xmtp-inbox-${address.toLowerCase()}`,
      );

      // Determine if we should use SCW signer (for WalletConnect)
      const isWalletConnect = connector?.name === "WalletConnect";
      const useChainId = chainId || 1; // Default to mainnet if chainId is not available

      console.log("Creating signer...", {
        isWalletConnect,
        useChainId,
        hasStoredInbox: !!storedInboxId,
      });

      const signer = isWalletConnect
        ? createSCWSigner(
            address,
            (message) => {
              console.log("SCW Sign message requested:", message);
              return signMessageAsync({ message });
            },
            useChainId,
          )
        : createEOASigner(address, (message) => {
            console.log("EOA Sign message requested:", message);
            return signMessageAsync({ message });
          });

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

      // Store inbox ID in localStorage if it's a new inbox
      if (!storedInboxId) {
        localStorage.setItem(
          `xmtp-inbox-${address.toLowerCase()}`,
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

  // Handle wallet disconnection
  useEffect(() => {
    // Only clear client when wallet is disconnected
    if (!isConnected || !address) {
      console.log("Wallet disconnected, clearing XMTP client");
      setXmtpClient(null);
      reset();
    }
  }, [isConnected, address, reset]);

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
      return;
    }

    try {
      // Check if the recipient address is valid (basic validation)
      if (!recipientAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        console.error("Invalid Ethereum address");
        alert("Please enter a valid Ethereum address");
        return;
      }

      console.log("Creating DM with:", recipientAddress);

      // Use the hook to create DM with address
      const dm = await createDmWithAddress(recipientAddress);

      // if (!dm) {
      //   alert("This address is not registered on the XMTP network");
      //   return;
      // }

      console.log("DM created/retrieved:", dm);

      // Select the new conversation
      setSelectedConversation(dm);

      console.log("Conversation selected:", dm);
    } catch (error) {
      console.error("Error creating conversation:", error);
      alert(`Failed to create conversation: ${error.message}`);
    }
  };

  // Format address for display
  const formatAddress = (addr) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <h1>XMTP Chat</h1>
            {isConnected && address && (
              <div className="connected-address">
                <span className="address-value">{formatAddress(address)}</span>
              </div>
            )}
          </div>
          <div className="header-right">
            <div className="header-toggle-container">
              <span className="header-toggle-label">Circles Mode</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={circlesMode}
                  onChange={handleCirclesModeToggle}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
      </header>

      <div className="app-content">
        {activeTab === "chat" ? (
          !isConnected ? (
            <div className="connect-prompt">
              <div className="connect-card">
                <h2>Welcome to XMTP Chat</h2>
                <p>Connect your wallet to start messaging</p>
                <p className="connect-hint">
                  Go to Account tab to connect your wallet
                </p>
              </div>
            </div>
          ) : !xmtpClient ? (
            <div className="connect-prompt">
              <div className="connect-card">
                <h2>Connect to XMTP</h2>
                <p>Create your XMTP inbox ID to start messaging</p>
                <p className="connect-hint">
                  Go to Account tab to connect to XMTP
                </p>
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
              />
              <MessageArea
                conversation={selectedConversation}
                xmtpClient={xmtpClient}
              />
            </div>
          )
        ) : (
          <AccountPage
            xmtpClient={xmtpClient}
            isCreatingInbox={isCreatingInbox}
            inboxError={inboxError}
            onCreateInbox={handleCreateInbox}
            circlesMode={circlesMode}
            onCirclesModeToggle={handleCirclesModeToggle}
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
