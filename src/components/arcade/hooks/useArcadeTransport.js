import { IdentifierKind } from "@xmtp/browser-sdk";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { ARCADE_PROTOCOL_VERSION } from "../helpers/constants.js";

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

function envelopeKey(message) {
  return [
    message.sessionId || "none",
    message.type || "unknown",
    message.seq ?? "none",
    String(message.from || "").toLowerCase(),
  ].join(":");
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
  const seenMessageKeysRef = useRef(new Set());

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        void streamRef.current.end();
        streamRef.current = null;
      }
    };
  }, []);

  const resetSessionCache = useCallback(() => {
    seenMessageKeysRef.current = new Set();
  }, []);

  const parseEnvelope = useCallback((raw) => {
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw);
      if (parsed.version !== ARCADE_PROTOCOL_VERSION) {
        return null;
      }

      const key = envelopeKey(parsed);
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

  const connectToPeer = useCallback(
    async (peerAddress) => {
      if (!xmtpClient) {
        throw new Error("Connect to XMTP before starting an arcade session.");
      }

      const inboxId = await resolveInboxId(xmtpClient, peerAddress);
      const conversation = await xmtpClient.conversations.createDm(inboxId);
      await xmtpClient.conversations.sync();
      conversationRef.current = conversation;
      return conversation;
    },
    [xmtpClient],
  );

  const sendEnvelope = useCallback(async (message) => {
    if (!conversationRef.current) {
      throw new Error("Conversation not connected");
    }

    await conversationRef.current.sendText(JSON.stringify(message));
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

      await conversationRef.current.sync();
      const messages = await conversationRef.current.messages();

      return messages
        .map((message) => parseEnvelope(decodeTextContent(message.content)))
        .filter(Boolean)
        .filter(
          (message) =>
            String(message.sessionId) === String(sessionId) &&
            String(message.gameKey) === String(gameKey),
        );
    },
    [parseEnvelope],
  );

  const startSessionStream = useCallback(
    async ({ sessionId, gameKey, onMessage }) => {
      if (!xmtpClient) {
        throw new Error("Connect to XMTP before starting an arcade session.");
      }

      if (streamRef.current) {
        await streamRef.current.end();
        streamRef.current = null;
      }

      streamRef.current = await xmtpClient.conversations.streamAllMessages({
        onValue: (incoming) => {
          const parsed = parseEnvelope(decodeTextContent(incoming.content));
          if (!parsed) {
            return;
          }
          if (
            String(parsed.sessionId) !== String(sessionId) ||
            String(parsed.gameKey) !== String(gameKey)
          ) {
            return;
          }
          onMessage(parsed, incoming);
        },
      });

      return async () => {
        if (streamRef.current) {
          await streamRef.current.end();
          streamRef.current = null;
        }
      };
    },
    [parseEnvelope, xmtpClient],
  );

  return useMemo(
    () => ({
      address,
      connectToPeer,
      sendEnvelope,
      sendMany,
      loadConversationMessages,
      startSessionStream,
      resetSessionCache,
    }),
    [
      address,
      connectToPeer,
      loadConversationMessages,
      resetSessionCache,
      sendEnvelope,
      sendMany,
      startSessionStream,
    ],
  );
}
