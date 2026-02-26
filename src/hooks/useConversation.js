import { useState, useCallback } from "react";
import {
  useActions,
  useConversation as useConversationState,
  useLastSentAt,
  useMembers,
  useMessages,
  useMetadata,
} from "../stores/inboxHooks";

export const useConversation = (conversationId) => {
  const { addMessages } = useActions();
  const conversation = useConversationState(conversationId);
  const members = useMembers(conversationId);
  const { name, peerInboxId } = useMetadata(conversationId);
  const messages = useMessages(conversationId);
  const lastSentAt = useLastSentAt(conversationId);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);

  const sync = useCallback(
    async (fromNetwork = false) => {
      if (!conversation) return [];

      if (fromNetwork) {
        setSyncing(true);
        try {
          const isActive = await conversation.isActive();
          // Ensure conversation is active before syncing
          if (isActive) {
            await conversation.sync();
          }
        } finally {
          setSyncing(false);
        }
      }

      setLoading(true);
      try {
        const msgs = await conversation.messages({
          sentAfterNs: lastSentAt,
        });
        await addMessages(conversation.id, msgs);
        return msgs;
      } finally {
        setLoading(false);
      }
    },
    [conversation, lastSentAt, addMessages]
  );

  const sendText = useCallback(
    async (text) => {
      if (!conversation) return;

      setSending(true);
      try {
        await conversation.sendText(text);
      } finally {
        setSending(false);
      }
    },
    [conversation]
  );

  return {
    conversation,
    name,
    peerInboxId,
    loading,
    members,
    messages,
    sendText,
    sending,
    sync,
    syncing,
  };
};
