import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { Client, IdentifierKind } from "@xmtp/browser-sdk";
import ConversationList from "./components/ConversationList";
import MessageArea from "./components/MessageArea";
import BottomTabs from "./components/BottomTabs";
import AccountPage from "./components/AccountPage";
import NewConversationModal from "./components/NewConversationModal";
import { createEOASigner } from "./helpers/createSigner";
import { useConversations } from "./hooks/useConversations";
import { useActions } from "./stores/inboxHooks";

function App() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [activeTab, setActiveTab] = useState("chat");
  const [isNewConversationModalOpen, setIsNewConversationModalOpen] =
    useState(false);
  const [xmtpClient, setXmtpClient] = useState(null);

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

  // Load XMTP client on mount
  useEffect(() => {
    const loadClient = async () => {
      if (isConnected && address) {
        try {
          const storedInboxId = localStorage.getItem(
            `xmtp-inbox-${address.toLowerCase()}`,
          );
          if (storedInboxId) {
            // Create client from stored inbox
            const signer = createEOASigner(address, (message) =>
              signMessageAsync({ message }),
            );
            const client = await Client.create(signer, {
              env: "dev",
              appVersion: "xmtp-miniapp/0",
            });
            setXmtpClient(client);
          }
        } catch (error) {
          console.error("Error loading XMTP client:", error);
        }
      } else {
        setXmtpClient(null);
        reset();
      }
    };
    loadClient();
  }, [isConnected, address, signMessageAsync, reset]);

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
    [sync, startStreams, stopStreams]
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

      if (!dm) {
        alert("This address is not registered on the XMTP network");
        return;
      }

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
                <p>Create your XMTP inbox to start messaging</p>
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
              />
              <MessageArea
                conversation={selectedConversation}
                xmtpClient={xmtpClient}
              />
            </div>
          )
        ) : (
          <AccountPage />
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
