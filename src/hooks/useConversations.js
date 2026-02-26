import { useState, useCallback } from "react";
import { IdentifierKind, ConversationType } from "@xmtp/browser-sdk";
import {
  useActions,
  useConversations as useConversationsState,
  useLastCreatedAt,
} from "../stores/inboxHooks";

const dateToNs = (date) => {
  return BigInt(date.getTime()) * 1_000_000n;
};

export const useConversations = (client) => {
  const { addConversations, addConversation, addMessage, setLastSyncedAt } =
    useActions();
  const conversations = useConversationsState();
  const lastCreatedAt = useLastCreatedAt();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const refreshConversationsList = useCallback(async () => {
    if (!client) return [];

    setLoading(true);
    try {
      const convos = await client.conversations.listDms({
        createdAfterNs: lastCreatedAt,
      });
      await addConversations(convos);
      setLastSyncedAt(dateToNs(new Date()));
      return convos;
    } finally {
      setLoading(false);
    }
  }, [client, lastCreatedAt, addConversations, setLastSyncedAt]);

  const sync = useCallback(
    async (fromNetwork = false) => {
      if (!client) return;

      if (fromNetwork) {
        setSyncing(true);
        try {
          await client.conversations.sync();
        } finally {
          setSyncing(false);
        }
      }

      await refreshConversationsList();
    },
    [client, refreshConversationsList]
  );

  const syncAll = useCallback(async () => {
    if (!client) return;

    setSyncing(true);
    try {
      await client.conversations.syncAll();
    } finally {
      setSyncing(false);
    }

    await refreshConversationsList();
  }, [client, refreshConversationsList]);

  const getConversationById = useCallback(
    async (conversationId) => {
      if (!client) return null;

      setLoading(true);
      try {
        const conversation =
          await client.conversations.getConversationById(conversationId);
        return conversation;
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  const getDmByInboxId = useCallback(
    async (inboxId) => {
      if (!client) return null;

      setLoading(true);
      try {
        const dm = await client.conversations.getDmByInboxId(inboxId);
        return dm;
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  const createDm = useCallback(
    async (inboxId) => {
      if (!client) return null;

      setLoading(true);
      try {
        const conversation = await client.conversations.createDm(inboxId);
        await addConversation(conversation);
        return conversation;
      } finally {
        setLoading(false);
      }
    },
    [client, addConversation]
  );

  const createDmWithAddress = useCallback(
    async (address) => {
      if (!client) return null;

      setLoading(true);
      try {
        // Fetch inbox ID from address
        const inboxId = await client.fetchInboxIdByIdentifier({
          identifier: address,
          identifierKind: IdentifierKind.Ethereum,
        });

        if (!inboxId) {
          throw new Error("Address not registered on XMTP network");
        }

        const conversation = await client.conversations.createDm(inboxId);
        await addConversation(conversation);
        return conversation;
      } finally {
        setLoading(false);
      }
    },
    [client, addConversation]
  );

  const stream = useCallback(async () => {
    if (!client) return () => {};

    const onValue = (conversation) => {
      const shouldAdd =
        conversation.metadata?.conversationType === ConversationType.Dm ||
        conversation.metadata?.conversationType === ConversationType.Group;
      if (shouldAdd) {
        void addConversation(conversation);
      }
    };

    const stream = await client.conversations.stream({
      onValue,
    });

    return () => {
      void stream.end();
    };
  }, [client, addConversation]);

  const streamAllMessages = useCallback(async () => {
    if (!client) return () => {};

    const onValue = (message) => {
      // Filter out non-text messages if needed
      void addMessage(message.conversationId, message);
    };

    const stream = await client.conversations.streamAllMessages({
      onValue,
    });

    return () => {
      void stream.end();
    };
  }, [client, addMessage]);

  return {
    conversations,
    getConversationById,
    getDmByInboxId,
    loading,
    createDm,
    createDmWithAddress,
    stream,
    streamAllMessages,
    sync,
    syncAll,
    syncing,
  };
};
