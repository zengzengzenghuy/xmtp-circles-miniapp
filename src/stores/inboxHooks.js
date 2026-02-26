import { useMemo } from "react";
import { useInboxStore } from "./inboxStore";

const EMPTY_METADATA = {};
const EMPTY_MEMBERS = new Map();
const EMPTY_MESSAGES = [];

export const useConversation = (conversationId) => {
  return useInboxStore((state) => state.getConversation(conversationId));
};

export const useMetadata = (conversationId) => {
  return useInboxStore(
    (state) => state.metadata.get(conversationId) ?? EMPTY_METADATA
  );
};

export const useMembers = (conversationId) => {
  return useInboxStore(
    (state) => state.members.get(conversationId) ?? EMPTY_MEMBERS
  );
};

export const useConversations = () => {
  return useInboxStore((state) => state.sortedConversations);
};

export const useLastCreatedAt = () => {
  return useInboxStore((state) => state.lastCreatedAt);
};

export const useMessage = (conversationId, messageId) => {
  return useInboxStore((state) => state.getMessage(conversationId, messageId));
};

export const useMessageCount = () => {
  const messages = useInboxStore((state) => state.sortedMessages);
  return useMemo(() => {
    const count = Array.from(messages.keys()).reduce((acc, conversationId) => {
      const count = messages.get(conversationId)?.length ?? 0;
      return acc + count;
    }, 0);
    return count;
  }, [messages]);
};

export const useMessages = (conversationId) => {
  return useInboxStore(
    (state) => state.sortedMessages.get(conversationId) ?? EMPTY_MESSAGES
  );
};

export const useLastSentAt = (conversationId) => {
  return useInboxStore((state) => state.lastSentAt.get(conversationId));
};

export const useLastSyncedAt = () => {
  return useInboxStore((state) => state.lastSyncedAt);
};

export const useActions = () => {
  const addConversation = useInboxStore((state) => state.addConversation);
  const addConversations = useInboxStore((state) => state.addConversations);
  const getConversation = useInboxStore((state) => state.getConversation);
  const hasConversation = useInboxStore((state) => state.hasConversation);
  const addMessage = useInboxStore((state) => state.addMessage);
  const addMessages = useInboxStore((state) => state.addMessages);
  const getMessage = useInboxStore((state) => state.getMessage);
  const getMessages = useInboxStore((state) => state.getMessages);
  const hasMessage = useInboxStore((state) => state.hasMessage);
  const setLastSyncedAt = useInboxStore((state) => state.setLastSyncedAt);
  const reset = useInboxStore((state) => state.reset);

  return {
    addConversation,
    addConversations,
    getConversation,
    hasConversation,
    addMessage,
    addMessages,
    getMessage,
    getMessages,
    hasMessage,
    setLastSyncedAt,
    reset,
  };
};
