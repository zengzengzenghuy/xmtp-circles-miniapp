import { create } from "zustand";

// Helper functions
const sortConversations = (conversationsMap, lastMessagesMap) => {
  const conversationsArray = Array.from(conversationsMap.values());
  return conversationsArray.sort((a, b) => {
    const lastMessageA = lastMessagesMap.get(a.id);
    const lastMessageB = lastMessagesMap.get(b.id);

    // Sort by last message timestamp, or creation time if no messages
    const timeA = lastMessageA?.sentAtNs || a.createdAtNs || 0n;
    const timeB = lastMessageB?.sentAtNs || b.createdAtNs || 0n;

    return timeB > timeA ? 1 : timeB < timeA ? -1 : 0;
  });
};

const sortMessages = (messagesMap) => {
  const messagesArray = Array.from(messagesMap.values());
  return messagesArray.sort((a, b) => {
    const timeA = a.sentAtNs || 0n;
    const timeB = b.sentAtNs || 0n;
    return timeA > timeB ? 1 : timeA < timeB ? -1 : 0;
  });
};

const getLastCreatedAt = (conversation, currentLastCreatedAt) => {
  const createdAt = conversation.createdAtNs;
  if (!currentLastCreatedAt) return createdAt;
  return createdAt > currentLastCreatedAt ? createdAt : currentLastCreatedAt;
};

const isLastSentAt = (message, currentLastSentAt) => {
  if (!currentLastSentAt) return true;
  return message.sentAtNs > currentLastSentAt;
};

export const useInboxStore = create((set, get) => ({
  // State
  conversations: new Map(),
  lastMessages: new Map(),
  lastSentAt: new Map(),
  members: new Map(),
  messages: new Map(),
  metadata: new Map(),
  sortedConversations: [],
  sortedMessages: new Map(),
  lastCreatedAt: undefined,
  lastSyncedAt: undefined,

  // Actions
  addConversation: async (conversation) => {
    const state = get();

    // Update conversations state
    const newConversations = new Map(state.conversations);
    newConversations.set(conversation.id, conversation);

    // Update members state
    const members = await conversation.members();
    const newMembers = new Map(state.members);
    newMembers.set(
      conversation.id,
      new Map(members.map((m) => [m.inboxId, m]))
    );

    const newMetadata = new Map(state.metadata);

    // Get peer inbox ID for reference
    const peerInboxId = conversation.isDm ? await conversation.peerInboxId() : null;

    // For DMs and 2-person conversations, get peer identifier
    if (conversation.isDm || members.length === 2) {
      const peerMember = members.find(
        (m) => m.inboxId !== conversation.addedByInboxId
      );
      if (peerMember) {
        // Get peer identifier (Ethereum address)
        const identifier = peerMember.accountIdentifiers?.[0]?.identifier;
        if (identifier) {
          newMetadata.set(conversation.id, {
            name: identifier.toLowerCase(),
            peerInboxId: peerInboxId || peerMember.inboxId,
            identifier: identifier.toLowerCase(),
          });
        } else {
          // Fallback to inbox ID if no identifier found
          newMetadata.set(conversation.id, {
            name: peerInboxId || peerMember.inboxId,
            peerInboxId: peerInboxId || peerMember.inboxId,
          });
        }
      } else {
        // No peer member found
        newMetadata.set(conversation.id, {
          name: conversation.name || "Group",
        });
      }
    } else {
      // For groups, use conversation name
      newMetadata.set(conversation.id, {
        name: conversation.name || "Group",
      });
    }

    // Update last message state
    const lastMessage = await conversation.lastMessage();
    const newLastMessages = new Map(state.lastMessages);
    newLastMessages.set(conversation.id, lastMessage);

    set({
      conversations: newConversations,
      lastCreatedAt: getLastCreatedAt(conversation, state.lastCreatedAt),
      lastMessages: newLastMessages,
      members: newMembers,
      metadata: newMetadata,
      sortedConversations: sortConversations(newConversations, newLastMessages),
    });
  },

  addConversations: async (conversations) => {
    if (conversations.length === 0) return;

    const state = get();

    // Get conversation members in parallel
    const allMembers = new Map(
      await Promise.all(
        conversations.map(async (conversation) => [
          conversation.id,
          await conversation.members(),
        ])
      )
    );

    // Get conversation last messages in parallel
    const allLastMessages = new Map(
      await Promise.all(
        conversations.map(async (conversation) => [
          conversation.id,
          await conversation.lastMessage(),
        ])
      )
    );

    // Get peer inbox IDs for DMs and 2-person conversations in parallel
    const allPeerInboxIds = new Map(
      await Promise.all(
        conversations
          .filter((c) => {
            const members = allMembers.get(c.id) || [];
            return c.isDm || members.length === 2;
          })
          .map(async (conversation) => [
            conversation.id,
            await conversation.peerInboxId(),
          ])
      )
    );

    // Update conversations, members, and last message states
    const newConversations = new Map(state.conversations);
    const newMembers = new Map(state.members);
    const newMetadata = new Map(state.metadata);
    const newLastMessages = new Map(state.lastMessages);
    let lastCreatedAt = state.lastCreatedAt;

    for (const conversation of conversations) {
      newConversations.set(conversation.id, conversation);
      lastCreatedAt = getLastCreatedAt(conversation, lastCreatedAt);

      const members = allMembers.get(conversation.id) || [];
      newMembers.set(
        conversation.id,
        new Map(members.map((m) => [m.inboxId, m]))
      );

      const peerInboxId = allPeerInboxIds.get(conversation.id);

      // For DMs and 2-person conversations, get peer identifier
      if (conversation.isDm || members.length === 2) {
        const peerMember = members.find(
          (m) => m.inboxId !== conversation.addedByInboxId
        );
        if (peerMember) {
          // Get peer identifier (Ethereum address)
          const identifier = peerMember.accountIdentifiers?.[0]?.identifier;
          if (identifier) {
            newMetadata.set(conversation.id, {
              name: identifier.toLowerCase(),
              peerInboxId: peerInboxId || peerMember.inboxId,
              identifier: identifier.toLowerCase(),
            });
          } else {
            // Fallback to inbox ID if no identifier found
            newMetadata.set(conversation.id, {
              name: peerInboxId || peerMember.inboxId,
              peerInboxId: peerInboxId || peerMember.inboxId,
            });
          }
        } else {
          // No peer member found
          newMetadata.set(conversation.id, {
            name: conversation.name || "Group",
          });
        }
      } else {
        // For groups, use conversation name
        newMetadata.set(conversation.id, {
          name: conversation.name || "Group",
        });
      }

      const lastMessage = allLastMessages.get(conversation.id);
      newLastMessages.set(conversation.id, lastMessage);
    }

    set({
      conversations: newConversations,
      lastCreatedAt,
      lastMessages: newLastMessages,
      members: newMembers,
      metadata: newMetadata,
      sortedConversations: sortConversations(newConversations, newLastMessages),
    });
  },

  getConversation: (id) => {
    return get().conversations.get(id);
  },

  hasConversation: (id) => {
    return get().conversations.has(id);
  },

  addMessage: async (conversationId, message) => {
    const state = get();

    // Update messages state
    const newMessagesState = new Map(state.messages);
    const conversationMessages =
      newMessagesState.get(conversationId) || new Map();
    const newMessages = new Map(conversationMessages);
    newMessages.set(message.id, message);
    newMessagesState.set(conversationId, newMessages);

    // Update last sent at and last message states
    const newLastSentAt = new Map(state.lastSentAt);
    const newLastMessages = new Map(state.lastMessages);
    if (isLastSentAt(message, state.lastSentAt.get(conversationId))) {
      newLastSentAt.set(conversationId, message.sentAtNs);
      newLastMessages.set(conversationId, message);
    }

    // Update sorted messages state
    const newSortedMessages = new Map(state.sortedMessages);
    newSortedMessages.set(conversationId, sortMessages(newMessages));

    set({
      lastMessages: newLastMessages,
      lastSentAt: newLastSentAt,
      messages: newMessagesState,
      sortedConversations: sortConversations(
        state.conversations,
        newLastMessages
      ),
      sortedMessages: newSortedMessages,
    });
  },

  addMessages: async (conversationId, messages) => {
    const state = get();
    const newMessagesByConversation = new Map(state.messages);
    const conversationMessages =
      newMessagesByConversation.get(conversationId) || new Map();
    const newMessages = new Map(conversationMessages);
    let lastSentAt = state.lastSentAt.get(conversationId);
    let lastMessage = state.lastMessages.get(conversationId);

    for (const message of messages) {
      newMessages.set(message.id, message);
      if (isLastSentAt(message, lastSentAt)) {
        lastSentAt = message.sentAtNs;
        lastMessage = message;
      }
    }

    // Update messages state
    newMessagesByConversation.set(conversationId, newMessages);

    // Update last sent at state
    const newLastSentAt = new Map(state.lastSentAt);
    newLastSentAt.set(conversationId, lastSentAt);

    // Update last message state
    const newLastMessages = new Map(state.lastMessages);
    newLastMessages.set(conversationId, lastMessage);

    // Update sorted messages state
    const newSortedMessages = new Map(state.sortedMessages);
    newSortedMessages.set(conversationId, sortMessages(newMessages));

    set({
      lastMessages: newLastMessages,
      lastSentAt: newLastSentAt,
      messages: newMessagesByConversation,
      sortedConversations: sortConversations(
        state.conversations,
        newLastMessages
      ),
      sortedMessages: newSortedMessages,
    });
  },

  getMessage: (conversationId, messageId) => {
    const messages = get().messages.get(conversationId);
    return messages?.get(messageId);
  },

  getMessages: (conversationId) => {
    const messages = get().messages.get(conversationId);
    return messages ? Array.from(messages.values()) : [];
  },

  hasMessage: (conversationId, messageId) => {
    const conversationMessages = get().messages.get(conversationId);
    return conversationMessages?.has(messageId) ?? false;
  },

  setLastSyncedAt: (timestamp) => {
    set({ lastSyncedAt: timestamp });
  },

  reset: () => {
    set({
      conversations: new Map(),
      lastMessages: new Map(),
      lastSentAt: new Map(),
      members: new Map(),
      messages: new Map(),
      metadata: new Map(),
      sortedConversations: [],
      sortedMessages: new Map(),
      lastCreatedAt: undefined,
      lastSyncedAt: undefined,
    });
  },
}));
