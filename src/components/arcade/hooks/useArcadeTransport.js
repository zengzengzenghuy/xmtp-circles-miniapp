import { IdentifierKind, ConsentState } from "@xmtp/browser-sdk";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ARCADE_PROTOCOL_VERSION,
  LIFECYCLE_TYPES,
} from "../helpers/constants.js";

const ARCADE_DISCOVERY_CONSENT_STATES = [
  ConsentState.Unknown,
  ConsentState.Allowed,
];

async function manageLobbyMembership(client, peerInboxId) {
  try {
    const groups = await client.conversations.listGroups();
    let lobby = groups.find((g) => g.name === "arcade-lobby");
    if (!lobby) {
      lobby = await client.conversations.createGroup(
        [peerInboxId],
        { groupName: "arcade-lobby" },
      );
      await lobby.updateConsentState(ConsentState.Allowed);
      return;
    }
    const members = await lobby.members();
    if (!members.some((m) => m.inboxId === peerInboxId)) {
      await lobby.addMembers([peerInboxId]);
    }
  } catch (err) {
    console.warn("Lobby auto-add failed (non-critical)", err);
  }
}

async function syncArcadeDiscovery(client) {
  try {
    await client.conversations.sync();
  } catch (error) {
    if (!isIgnorableSyncError(error)) {
      console.warn("Arcade sync failed during discovery", error);
    }
  }

  try {
    await client.conversations.syncAll(ARCADE_DISCOVERY_CONSENT_STATES);
  } catch (error) {
    if (!isIgnorableSyncError(error)) {
      console.warn("Arcade syncAll failed during discovery", error);
    }
  }
}

function decodeTextContent(content) {
  if (typeof content === "string") {
    return content;
  }
  if (content instanceof Uint8Array) {
    return new TextDecoder().decode(content);
  }
  if (content?.content instanceof Uint8Array) {
    return new TextDecoder().decode(content.content);
  }
  if (content?.content) {
    return String(content.content);
  }
  return "";
}

function decodeIncomingText(incoming) {
  const primary = decodeTextContent(incoming?.content);
  if (primary) {
    return primary;
  }

  if (typeof incoming?.fallback === "string") {
    return incoming.fallback;
  }

  return "";
}

function envelopeKey(message) {
  return [
    message.sessionId || "none",
    message.type || "unknown",
    message.seq ?? "none",
    String(message.from || "").toLowerCase(),
  ].join(":");
}

function incomingMessageKey(incoming, parsed) {
  return incoming?.id || incoming?.messageId || envelopeKey(parsed);
}

function isOwnEnvelope(message, address) {
  return (
    message?.from &&
    address &&
    String(message.from).toLowerCase() === String(address).toLowerCase()
  );
}

function isIgnorableSyncError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("group is inactive") ||
    message.includes("errors occurred during sync")
  );
}

async function getConversationActivityNs(conversation) {
  const createdAtNs = Number(conversation?.createdAtNs || 0);

  try {
    const lastMessage = await conversation.lastMessage();
    return Number(lastMessage?.sentAtNs || 0) || createdAtNs;
  } catch {
    return createdAtNs;
  }
}

async function resolveInboxId(client, address) {
  const inboxId = await client.fetchInboxIdByIdentifier({
    identifier: address,
    identifierKind: IdentifierKind.Ethereum,
  });

  if (!inboxId) {
    throw new Error("The opponent is not registered on XMTP");
  }

  return inboxId;
}

export function useArcadeTransport({ xmtpClient, address }) {
  const conversationRef = useRef(null);
  const streamRef = useRef(null);
  const waitingStreamRef = useRef(null);
  const sweepIntervalRef = useRef(null);
  const seenMessageKeysRef = useRef(new Set());
  const inactiveConversationIdsRef = useRef(new Set());

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        void streamRef.current.end();
        streamRef.current = null;
      }
      if (waitingStreamRef.current) {
        void waitingStreamRef.current.end();
        waitingStreamRef.current = null;
      }
      if (sweepIntervalRef.current) {
        clearInterval(sweepIntervalRef.current);
        sweepIntervalRef.current = null;
      }
      inactiveConversationIdsRef.current.clear();
    };
  }, []);

  const resetSessionCache = useCallback(() => {
    seenMessageKeysRef.current = new Set();
    inactiveConversationIdsRef.current.clear();
  }, []);

  const parseIncomingEnvelope = useCallback((incoming) => {
    const raw = decodeIncomingText(incoming);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw);
      if (parsed.version !== ARCADE_PROTOCOL_VERSION) {
        return null;
      }

      const key = incomingMessageKey(incoming, parsed);
      if (seenMessageKeysRef.current.has(key)) {
        return null;
      }

      seenMessageKeysRef.current.add(key);
      return parsed;
    } catch (error) {
      console.error("Failed to parse arcade message", error);
      return null;
    }
  }, []);

  const parseEnvelopeForScan = useCallback((incoming) => {
    const raw = decodeIncomingText(incoming);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw);
      if (parsed.version !== ARCADE_PROTOCOL_VERSION) {
        return null;
      }

      return parsed;
    } catch (error) {
      console.error("Failed to parse arcade message during scan", error);
      return null;
    }
  }, []);

  const resolveExistingSessionConversation = useCallback(
    async ({ peerAddress, sessionId, gameKey }) => {
      if (!xmtpClient) {
        return null;
      }

      let peerInboxId = "";

      await syncArcadeDiscovery(xmtpClient);

      try {
        peerInboxId = await resolveInboxId(xmtpClient, peerAddress);
      } catch (error) {
        return null;
      }

      const findMatch = async (conversations = []) => {
        for (const conversation of conversations) {
          try {
            if (!(await conversation.isActive())) {
              continue;
            }

            const members = await conversation.members();
            if (
              peerInboxId &&
              !members.some((member) => member.inboxId === peerInboxId)
            ) {
              continue;
            }

            try {
              await conversation.sync();
            } catch (error) {
              if (!isIgnorableSyncError(error)) {
                console.warn(
                  "Arcade resolveExistingSessionConversation sync failed",
                  error,
                );
              }
            }

            const history = await conversation.messages();
            const sortedHistory = [...history].sort((left, right) => {
              if (left.sentAtNs === right.sentAtNs) {
                return 0;
              }
              return left.sentAtNs > right.sentAtNs ? -1 : 1;
            });

            for (const incoming of sortedHistory) {
              const parsed = parseEnvelopeForScan(incoming);
              if (!parsed || isOwnEnvelope(parsed, address)) {
                continue;
              }

              if (
                String(parsed.sessionId) === String(sessionId) &&
                String(parsed.gameKey) === String(gameKey)
              ) {
                conversationRef.current = conversation;
                return conversation;
              }
            }
          } catch (error) {
            console.warn(
              "Arcade resolveExistingSessionConversation scan failed",
              error,
            );
          }
        }

        return null;
      };

      try {
        const groups = await xmtpClient.conversations.listGroups({
          consentStates: ARCADE_DISCOVERY_CONSENT_STATES,
        });
        const groupMatch = await findMatch(groups);
        if (groupMatch) {
          return groupMatch;
        }
      } catch (error) {
        console.warn(
          "Arcade resolveExistingSessionConversation failed to list groups",
          error,
        );
      }

      try {
        const dms = await xmtpClient.conversations.listDms({
          consentStates: ARCADE_DISCOVERY_CONSENT_STATES,
        });
        return await findMatch(dms);
      } catch (error) {
        console.warn(
          "Arcade resolveExistingSessionConversation failed to list dms",
          error,
        );
      }

      return null;
    },
    [address, parseEnvelopeForScan, xmtpClient],
  );

  const resolveReusableSessionConversation = useCallback(
    async ({ peerAddress }) => {
      if (!xmtpClient || !peerAddress) {
        return null;
      }

      await syncArcadeDiscovery(xmtpClient);

      let peerInboxId = "";
      try {
        peerInboxId = await resolveInboxId(xmtpClient, peerAddress);
      } catch {
        return null;
      }

      let groups = [];
      try {
        groups = await xmtpClient.conversations.listGroups({
          consentStates: ARCADE_DISCOVERY_CONSENT_STATES,
        });
      } catch (error) {
        console.warn("Arcade failed to list groups for reuse", error);
        return null;
      }

      const matches = [];
      for (const group of groups) {
        if (group.name !== "arcade-session") {
          continue;
        }

        try {
          if (!(await group.isActive())) {
            continue;
          }
        } catch {
          continue;
        }

        try {
          const members = await group.members();
          if (!members.some((member) => member.inboxId === peerInboxId)) {
            continue;
          }
        } catch {
          continue;
        }

        matches.push(group);
      }

      if (!matches.length) {
        return null;
      }

      const rankedMatches = [];
      for (const conversation of matches) {
        rankedMatches.push({
          conversation,
          activityNs: await getConversationActivityNs(conversation),
        });
      }

      rankedMatches.sort((left, right) => right.activityNs - left.activityNs);

      const conversation = rankedMatches[0]?.conversation || matches[0];
      conversationRef.current = conversation;

      try {
        await conversation.sync();
      } catch (error) {
        if (!isIgnorableSyncError(error)) {
          console.warn("Arcade failed to sync reusable session group", error);
        }
      }

      try {
        await conversation.updateConsentState(ConsentState.Allowed);
      } catch (error) {
        console.warn("Arcade failed to allow reusable session group", error);
      }

      return conversation;
    },
    [xmtpClient],
  );

  const connectToPeer = useCallback(
    async (peerAddress) => {
      if (!xmtpClient) {
        throw new Error("Connect to XMTP before starting an arcade session.");
      }

      await syncArcadeDiscovery(xmtpClient);

      const peerInboxId = await resolveInboxId(xmtpClient, peerAddress);
      const reusableConversation = await resolveReusableSessionConversation({
        peerAddress,
      });

      if (reusableConversation) {
        manageLobbyMembership(xmtpClient, peerInboxId);
        return reusableConversation;
      }

      // Create a dedicated group for this game session instead of reusing a DM.
      // Tag with groupName so the chat UI can filter out arcade groups.
      const conversation = await xmtpClient.conversations.createGroup(
        [peerInboxId],
        { groupName: "arcade-session" },
      );
      
      try {
        await conversation.sync();
      } catch (error) {
        if (!isIgnorableSyncError(error)) {
          throw error;
        }
      }

      try {
        await conversation.updateConsentState(ConsentState.Allowed);
      } catch (error) {
        console.warn("Arcade failed to allow newly created session group", error);
      }

      conversationRef.current = conversation;

      // Fire-and-forget: auto-add opponent to shared lobby
      manageLobbyMembership(xmtpClient, peerInboxId);

      return conversation;
    },
    [resolveReusableSessionConversation, xmtpClient],
  );

  const bindConversation = useCallback(
    async (conversationId) => {
      if (!xmtpClient || !conversationId) {
        return null;
      }

      const conversation =
        await xmtpClient.conversations.getConversationById(conversationId);
      if (conversation) {
        conversationRef.current = conversation;
      }
      return conversation || null;
    },
    [xmtpClient],
  );

  const sendEnvelope = useCallback(async (message) => {
    if (!conversationRef.current) {
      throw new Error("Conversation not connected");
    }

    await conversationRef.current.sendText(JSON.stringify(message));
  }, []);

  const sendEnvelopeToConversation = useCallback(async (conversation, message) => {
    if (!conversation) {
      throw new Error("Conversation not connected");
    }

    await conversation.sendText(JSON.stringify(message));
  }, []);

  const sendMany = useCallback(
    async (messages = []) => {
      for (const message of messages) {
        await sendEnvelope(message);
      }
    },
    [sendEnvelope],
  );

  const loadConversationMessages = useCallback(
    async ({ sessionId, gameKey }) => {
      if (!conversationRef.current) {
        return [];
      }

      try {
        await conversationRef.current.sync();
      } catch (error) {
        if (!isIgnorableSyncError(error)) {
          throw error;
        }
      }
      const messages = await conversationRef.current.messages();

      return messages
        .map((incoming) => ({
          incoming,
          message: parseIncomingEnvelope(incoming),
        }))
        .filter((entry) => Boolean(entry.message))
        .filter((entry) => !isOwnEnvelope(entry.message, address))
        .filter(
          (entry) =>
            String(entry.message.sessionId) === String(sessionId) &&
            String(entry.message.gameKey) === String(gameKey),
        );
    },
    [address, parseIncomingEnvelope],
  );

  const stopSessionStream = useCallback(async () => {
    if (streamRef.current) {
      await streamRef.current.end();
      streamRef.current = null;
    }
  }, []);

  const stopWaitingStream = useCallback(async () => {
    if (waitingStreamRef.current) {
      await waitingStreamRef.current.end();
      waitingStreamRef.current = null;
    }
    if (sweepIntervalRef.current) {
      clearInterval(sweepIntervalRef.current);
      sweepIntervalRef.current = null;
    }
    inactiveConversationIdsRef.current.clear();
  }, []);

  const startSessionStream = useCallback(
    async ({ sessionId, gameKey, onMessage }) => {
      if (!xmtpClient) {
        throw new Error("Connect to XMTP before starting an arcade session.");
      }
      if (!conversationRef.current) {
        throw new Error("Conversation not connected");
      }

      await stopSessionStream();

      streamRef.current = await conversationRef.current.stream({
        onValue: (incoming) => {
          const parsed = parseIncomingEnvelope(incoming);
          if (!parsed) {
            return;
          }
          if (isOwnEnvelope(parsed, address)) {
            return;
          }
          if (
            String(parsed.sessionId) !== String(sessionId) ||
            String(parsed.gameKey) !== String(gameKey)
          ) {
            return;
          }
          Promise.resolve(onMessage(parsed, incoming)).catch((error) => {
            console.error("Arcade session message handler failed", error);
          });
        },
      });

      return async () => {
        await stopSessionStream();
      };
    },
    [address, parseIncomingEnvelope, stopSessionStream, xmtpClient],
  );

  const startWaitingForJoin = useCallback(
    async ({ sessionId, gameKey, onMessage, onDebugEvent }) => {
      if (!xmtpClient) {
        throw new Error("Connect to XMTP before waiting for arcade joins.");
      }

      await stopWaitingStream();
      let isSweeping = false;
      let foundJoin = false;

      waitingStreamRef.current = await xmtpClient.conversations.streamAllMessages({
        consentStates: ARCADE_DISCOVERY_CONSENT_STATES,
        onValue: (message) => {
          Promise.resolve((async () => {
            const parsed = parseIncomingEnvelope(message);
            if (!parsed) {
              return;
            }
            if (isOwnEnvelope(parsed, address)) {
              return;
            }
            if (
              String(parsed.sessionId) !== String(sessionId) ||
              String(parsed.gameKey) !== String(gameKey) ||
              parsed.type !== LIFECYCLE_TYPES.SESSION_JOIN
            ) {
              return;
            }

            console.log("[arcade] wait stream candidate", {
              sessionId,
              gameKey,
              conversationId: message.conversationId,
              messageId: message.id,
              type: parsed.type,
              from: parsed.from,
            });

            let conversation = null;
            if (message.conversationId) {
              try {
                conversation = await xmtpClient.conversations.getConversationById(
                  message.conversationId,
                );
              } catch (error) {
                console.warn(
                  "Failed to resolve arcade join conversation from waiting stream",
                  error,
                );
              }
            }

            await onMessage(parsed, {
              conversationId: message.conversationId,
              conversation,
              incoming: message,
            });
          })()).catch((error) => {
            console.error("Arcade waiting-for-join handler failed", error);
          });
        },
      });

      const runSweep = async () => {
        if (isSweeping || foundJoin || !xmtpClient) {
          return;
        }

        isSweeping = true;
        try {
          try {
            await xmtpClient.conversations.sync();
          } catch (error) {
            if (!isIgnorableSyncError(error)) {
              console.warn("Arcade sweep sync failed", error);
            }
          }

          try {
            await xmtpClient.conversations.syncAll(ARCADE_DISCOVERY_CONSENT_STATES);
          } catch (error) {
            if (!isIgnorableSyncError(error)) {
              throw error;
            }
          }

          let groups = [];
          let groupListingFailed = false;
          try {
            groups = await xmtpClient.conversations.listGroups({
              consentStates: ARCADE_DISCOVERY_CONSENT_STATES,
            });
          } catch (error) {
            groupListingFailed = true;
            console.warn("Arcade wait failed to list groups", error);
            console.log("[arcade] wait group listing failed", {
              sessionId,
              gameKey,
              error: String(error?.message || error || ""),
            });
            onDebugEvent?.("creator_wait_group_listing_failed", {
              sessionId,
              gameKey,
              reason: String(error?.message || error || ""),
            });
          }

          let foundActiveGroup = false;
          for (const group of groups) {
            if (foundJoin) {
              break;
            }

            if (inactiveConversationIdsRef.current.has(group.id)) {
              continue;
            }

            let isActive = false;
            try {
              isActive = await group.isActive();
            } catch (error) {
              console.warn("Arcade wait failed to determine group activity", error);
              continue;
            }

            if (!isActive) {
              inactiveConversationIdsRef.current.add(group.id);
              continue;
            }

            foundActiveGroup = true;

            try {
              await group.sync();
            } catch (error) {
              if (!isIgnorableSyncError(error)) {
                console.warn("Arcade sweep group sync failed", error);
              }
            }

            let history = [];
            try {
              history = await group.messages();
            } catch (error) {
              console.warn("Failed to load arcade group history", error);
              continue;
            }

            const sortedHistory = [...history].sort((left, right) => {
              if (left.sentAtNs === right.sentAtNs) {
                return 0;
              }
              return left.sentAtNs > right.sentAtNs ? -1 : 1;
            });

            for (const incoming of sortedHistory) {
              const parsed = parseIncomingEnvelope(incoming);
              if (!parsed || isOwnEnvelope(parsed, address)) {
                continue;
              }

              if (parsed.type !== LIFECYCLE_TYPES.SESSION_JOIN) {
                continue;
              }

              const isMatchSession = String(parsed.sessionId) === String(sessionId);
              const isMatchGame = String(parsed.gameKey) === String(gameKey);

              if (!isMatchSession || !isMatchGame) {
                console.log("[arcade] Found JOIN but mismatched metadata:", {
                  incomingSessionId: parsed.sessionId,
                  expectedSessionId: sessionId,
                  incomingGameKey: parsed.gameKey,
                  expectedGameKey: gameKey,
                });
                continue;
              }

              console.log("[arcade] wait group candidate", {
                sessionId,
                gameKey,
                conversationId: incoming.conversationId,
                messageId: incoming.id,
                type: parsed.type,
                from: parsed.from,
              });
              foundJoin = true;
              await onMessage(parsed, {
                conversationId: incoming.conversationId,
                conversation: group,
                incoming,
              });

              if (conversationRef.current) {
                await stopWaitingStream();
              }
              break;
            }
          }

          if (!foundJoin && !groupListingFailed) {
            if (groups.length > 0 && !foundActiveGroup) {
              console.log("[arcade] wait sweep found only inactive groups", {
                count: groups.length,
              });
              onDebugEvent?.("creator_wait_only_inactive_groups", {
                count: groups.length,
              });
            } else if (groups.length === 0) {
              console.log("[arcade] wait sweep found no groups", {
                sessionId,
                gameKey,
              });
              onDebugEvent?.("creator_wait_no_groups", {
                sessionId,
                gameKey,
              });
            }
          }

          if (!foundJoin) {
            console.log("[arcade] wait sweep falling back to dm scan", {
              sessionId,
              gameKey,
            });
          }

          let dms = [];
          try {
            dms = await xmtpClient.conversations.listDms({
              consentStates: ARCADE_DISCOVERY_CONSENT_STATES,
            });
          } catch (error) {
            console.warn("Arcade wait failed to list dms", error);
          }

          for (const dm of dms) {
            if (foundJoin) {
              break;
            }

            if (inactiveConversationIdsRef.current.has(dm.id)) {
              continue;
            }

            let isActive = false;
            try {
              isActive = await dm.isActive();
            } catch (error) {
              console.warn("Arcade wait failed to determine dm activity", error);
              continue;
            }

            if (!isActive) {
              inactiveConversationIdsRef.current.add(dm.id);
              continue;
            }

            try {
              await dm.sync();
            } catch (error) {
              if (!isIgnorableSyncError(error)) {
                console.warn("Arcade sweep dm sync failed", error);
              }
            }

            let history = [];
            try {
              history = await dm.messages();
            } catch (error) {
              console.warn("Failed to load arcade dm history", error);
              continue;
            }

            const sortedHistory = [...history].sort((left, right) => {
              if (left.sentAtNs === right.sentAtNs) {
                return 0;
              }
              return left.sentAtNs > right.sentAtNs ? -1 : 1;
            });

            for (const incoming of sortedHistory) {
              const parsed = parseIncomingEnvelope(incoming);
              if (!parsed || isOwnEnvelope(parsed, address)) {
                continue;
              }

              if (parsed.type !== LIFECYCLE_TYPES.SESSION_JOIN) {
                continue;
              }

              const isMatchSession = String(parsed.sessionId) === String(sessionId);
              const isMatchGame = String(parsed.gameKey) === String(gameKey);

              if (!isMatchSession || !isMatchGame) {
                console.log("[arcade] Found JOIN but mismatched metadata:", {
                  incomingSessionId: parsed.sessionId,
                  expectedSessionId: sessionId,
                  incomingGameKey: parsed.gameKey,
                  expectedGameKey: gameKey,
                });
                continue;
              }

              console.log("[arcade] wait dm candidate", {
                sessionId,
                gameKey,
                conversationId: incoming.conversationId,
                messageId: incoming.id,
                type: parsed.type,
                from: parsed.from,
              });
              foundJoin = true;
              await onMessage(parsed, {
                conversationId: incoming.conversationId,
                conversation: dm,
                incoming,
              });

              if (conversationRef.current) {
                await stopWaitingStream();
              }
              break;
            }
          }
        } finally {
          isSweeping = false;
        }
      };

      await runSweep();
      if (!foundJoin) {
        sweepIntervalRef.current = setInterval(() => {
          void runSweep();
        }, 3000);
      }

      return async () => {
        await stopWaitingStream();
      };
    },
    [
      address,
      parseIncomingEnvelope,
      stopWaitingStream,
      xmtpClient,
    ],
  );

  return useMemo(
    () => ({
      address,
      bindConversation,
      connectToPeer,
      resolveReusableSessionConversation,
      resolveExistingSessionConversation,
      sendEnvelope,
      sendEnvelopeToConversation,
      sendMany,
      loadConversationMessages,
      startWaitingForJoin,
      startSessionStream,
      resetSessionCache,
      stopWaitingStream,
      stopSessionStream,
    }),
    [
      address,
      bindConversation,
      connectToPeer,
      resolveReusableSessionConversation,
      resolveExistingSessionConversation,
      loadConversationMessages,
      resetSessionCache,
      sendEnvelope,
      sendEnvelopeToConversation,
      sendMany,
      startWaitingForJoin,
      startSessionStream,
      stopWaitingStream,
      stopSessionStream,
    ],
  );
}
