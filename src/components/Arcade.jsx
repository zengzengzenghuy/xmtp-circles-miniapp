import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConsentState } from "@xmtp/browser-sdk";
import { GAMES, getGameDefinition } from "./arcade/gameRegistry.js";
import { buildGenericCommitment } from "./arcade/protocol/commitment.js";
import { makeEnvelope } from "./arcade/protocol/envelope.js";
import {
  applyLocalMove,
  buildResignResult,
  checkAutoLoss,
  handleIncomingMessage,
  makeJoinMessage,
  makeReadyMessage,
} from "./arcade/protocol/shellProtocol.js";
import { useArcadeState } from "./arcade/hooks/useArcadeState.js";
import { useArcadeTransport } from "./arcade/hooks/useArcadeTransport.js";
import { usePaymentWatcher } from "./arcade/hooks/usePaymentWatcher.js";
import {
  buildInviteLink,
  createInvitePayload,
} from "./arcade/helpers/invite.js";
import {
  LIFECYCLE_TYPES,
  PHASE,
  PAYMENT_WATCH_STATUS,
  SESSION_STATUS,
} from "./arcade/helpers/constants.js";
import { getArcadeConfig } from "./arcade/helpers/config.js";
import { buildPaymentMarker } from "./arcade/payments/marker.js";
import { buildPaymentTransferUrl } from "./arcade/payments/transactions.js";
import ArcadeHome from "./arcade/screens/ArcadeHome.jsx";
import SetupSession from "./arcade/screens/SetupSession.jsx";
import CreateInvite from "./arcade/screens/CreateInvite.jsx";
import JoinInvite from "./arcade/screens/JoinInvite.jsx";
import PaymentSelect from "./arcade/screens/PaymentSelect.jsx";
import PaymentWait from "./arcade/screens/PaymentWait.jsx";
import PlaySession from "./arcade/screens/PlaySession.jsx";
import SessionResult from "./arcade/screens/SessionResult.jsx";

function createSessionId(address) {
  const seed = crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${String(address || "arcade").slice(2, 8)}:${seed}`;
}

function buildCurrentInviteUrl(baseUrl, payload) {
  return buildInviteLink(baseUrl || window.location.href, payload);
}

function makeJoinRejectedMessage(gameDef, sessionId, from, payload) {
  return makeEnvelope({
    gameKey: gameDef.key,
    sessionId,
    from,
    type: LIFECYCLE_TYPES.SESSION_JOIN_REJECTED,
    payload,
  });
}

function safeLower(value) {
  return String(value || "").toLowerCase();
}

function createDebugEvent(role, label, details = {}) {
  return {
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    at: Date.now(),
    role,
    label,
    details,
  };
}

function formatSummaryLabel(value) {
  const normalized = String(value || "").replaceAll("_", " ").toLowerCase();
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "";
}

function getBillingFromInvite(invite) {
  if (invite?.publicConfig?.billing?.mode === "paid") {
    return invite.publicConfig.billing;
  }
  return { mode: "free" };
}

function getCreatorInviteStatus(localState) {
  if (
    localState.phase === PHASE.RESULT ||
    localState.session.status === SESSION_STATUS.RESULT
  ) {
    return { status: "terminated", reason: "session_result" };
  }

  if (localState.session.status === SESSION_STATUS.WAITING_FOR_JOIN) {
    return { status: "available", reason: "waiting_for_join" };
  }

  if (localState.session.joinerAddress) {
    return {
      status: "used",
      reason:
        localState.session.status === SESSION_STATUS.ACTIVE
          ? "session_active"
          : "already_joined",
    };
  }

  return { status: "used", reason: "already_joined" };
}

export default function Arcade({
  address,
  connected,
  xmtpClient,
  onOpenAccount,
  initialInvite,
  isMiniapp,
  onInviteLinkChange,
}) {
  const { state, actions } = useArcadeState({ address });
  const transport = useArcadeTransport({ xmtpClient, address });
  const arcadeConfig = useMemo(() => getArcadeConfig(), []);
  const [inviteLink, setInviteLink] = useState("");
  const [pendingInvite, setPendingInvite] = useState(initialInvite);
  const [conflictingInvite, setConflictingInvite] = useState(null);
  const [isResigning, setIsResigning] = useState(false);
  const stateRef = useRef(state);
  const sessionStreamCleanupRef = useRef(null);

  // Notify parent when invite link changes (for Chatting Room sharing)
  useEffect(() => {
    onInviteLinkChange?.(inviteLink);
  }, [inviteLink, onInviteLinkChange]);

  const hasXmtp = Boolean(xmtpClient);
  const selectedGame = useMemo(
    () => getGameDefinition(state.selectedGameKey || pendingInvite?.gameKey),
    [pendingInvite?.gameKey, state.selectedGameKey],
  );
  const activeBilling = useMemo(
    () =>
      state.invite?.publicConfig?.billing ||
      pendingInvite?.publicConfig?.billing ||
      state.session.publicConfig?.billing ||
      null,
    [
      pendingInvite?.publicConfig?.billing,
      state.invite?.publicConfig?.billing,
      state.session.publicConfig?.billing,
    ],
  );
  const paymentConfigError = useMemo(() => {
    if (
      (arcadeConfig.paidMode || activeBilling?.mode === "paid") &&
      !arcadeConfig.paymentRecipientConfigured
    ) {
      return "Payment recipient address is not configured correctly.";
    }
    return "";
  }, [
    activeBilling?.mode,
    arcadeConfig.paidMode,
    arcadeConfig.paymentRecipientConfigured,
  ]);
  const paymentUrl = useMemo(() => {
    if (!state.payment.marker || !state.payment.amountCrc) {
      return "";
    }

    return buildPaymentTransferUrl({
      transferBaseUrl: arcadeConfig.paymentTransferBaseUrl,
      recipientAddress: arcadeConfig.paymentRecipientAddress,
      amountCrc: state.payment.amountCrc,
      marker: { hex: state.payment.marker },
    });
  }, [
    arcadeConfig.paymentRecipientAddress,
    arcadeConfig.paymentTransferBaseUrl,
    state.payment.amountCrc,
    state.payment.marker,
  ]);
  const recoverySummary = useMemo(() => {
    if (!state.recovery.available || !state.recovery.snapshot) {
      return null;
    }

    const recoveryGame = getGameDefinition(state.recovery.snapshot.selectedGameKey);
    return {
      gameLabel: recoveryGame?.label || "Arcade session",
      phaseLabel: formatSummaryLabel(state.recovery.snapshot.phase),
      statusLabel: formatSummaryLabel(state.recovery.snapshot.session?.status),
    };
  }, [state.recovery.available, state.recovery.snapshot]);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const paymentWatcherEnabled =
    state.phase === PHASE.PAYMENT_WAIT &&
    state.payment.watchStatus !== PAYMENT_WATCH_STATUS.ERROR &&
    Boolean(state.payment.marker) &&
    state.payment.amountCrc > 0;
  const paymentWatcher = usePaymentWatcher({
    enabled: paymentWatcherEnabled,
    rpcUrl: arcadeConfig.circlesRpcUrl,
    dataValue: state.payment.marker,
    minAmountCRC: state.payment.amountCrc,
    recipientAddress: arcadeConfig.paymentRecipientAddress,
    intervalMs: arcadeConfig.paymentPollIntervalMs,
  });

  const initializeForGame = useCallback(
    (gameKey, invite = null) => {
      const game = getGameDefinition(gameKey);
      if (!game) {
        actions.setError("Selected game is not available.");
        return;
      }

      if (invite) {
        actions.startInvite(invite);
      } else {
        actions.startGame(gameKey);
      }

      actions.setSetupState(game.createInitialSetupState());
      actions.setGameState(game.createInitialState());
      actions.clearInviteStatus();
      actions.setInfo("");
      actions.setError("");
      setInviteLink("");
    },
    [actions],
  );

  const preparePaidFlow = useCallback(
    (gameKey, actor, invite = null) => {
      const game = getGameDefinition(gameKey);
      if (!game) {
        actions.setError("Selected game is not available.");
        return;
      }

      if (invite) {
        actions.startInvite(invite);
      } else {
        actions.startGame(gameKey);
      }

      actions.setSetupState(game.createInitialSetupState());
      actions.setGameState(game.createInitialState());
      actions.clearInviteStatus();
      actions.clearPayment();
      actions.startPaymentSelect({
        actor,
        gameKey,
        invite,
        session: invite
          ? {
              sessionId: invite.sessionId,
              gameKey: invite.gameKey,
              role: "joiner",
              creatorAddress: invite.creatorAddress,
              creatorCommitment: invite.creatorCommitment,
              publicConfig: invite.publicConfig || {},
            }
          : {
              sessionId: createSessionId(address),
              gameKey,
              role: "creator",
              creatorAddress: address,
            },
        info: invite
          ? "Choose how you want to join this paid session."
          : `Complete payment before ${game.label} setup unlocks.`,
      });
      actions.setError("");
      setInviteLink("");
    },
    [actions, address],
  );

  const clearSessionStream = useCallback(async () => {
    if (sessionStreamCleanupRef.current) {
      await sessionStreamCleanupRef.current();
      sessionStreamCleanupRef.current = null;
    }
  }, []);

  const clearStreams = useCallback(async () => {
    await clearSessionStream();
    await transport.stopWaitingStream();
  }, [clearSessionStream, transport]);

  const pushDebugEvent = useCallback(
    (role, label, details = {}) => {
      actions.pushDebugEvent(createDebugEvent(role, label, details));
    },
    [actions],
  );

  useEffect(() => {
    void clearStreams();
    return () => {
      void clearStreams();
    };
  }, [clearStreams]);

  useEffect(() => {
    if (!state.hydrated) {
      return;
    }

    if (!pendingInvite) {
      return;
    }

    if (state.recovery.available) {
      setConflictingInvite(pendingInvite);
      return;
    }

    if (
      state.phase !== PHASE.HOME &&
      state.session.sessionId &&
      state.session.sessionId !== pendingInvite.sessionId
    ) {
      setConflictingInvite(pendingInvite);
      return;
    }

    if (state.phase !== PHASE.HOME) {
      setPendingInvite(null);
      return;
    }

    if (state.phase === PHASE.HOME) {
      const inviteBilling = getBillingFromInvite(pendingInvite);
      if (inviteBilling.mode === "paid") {
        preparePaidFlow(pendingInvite.gameKey, "joiner", pendingInvite);
      } else {
        initializeForGame(pendingInvite.gameKey, pendingInvite);
      }
      setPendingInvite(null);
    }
  }, [
    initializeForGame,
    pendingInvite,
    preparePaidFlow,
    state.hydrated,
    state.phase,
    state.recovery.available,
    state.session.sessionId,
  ]);

  useEffect(() => {
    if (
      !selectedGame ||
      state.phase !== PHASE.CREATE_INVITE ||
      state.session.status !== SESSION_STATUS.WAITING_FOR_JOIN
    ) {
      return;
    }

    const invitePayload = createInvitePayload({
      sessionId: state.session.sessionId,
      gameKey: selectedGame.key,
      creatorAddress: state.session.creatorAddress,
      creatorCommitment: state.session.creatorCommitment,
      publicConfig: state.session.publicConfig,
      createdAt: state.session.publicConfig?.inviteMeta?.createdAt,
    });
    setInviteLink(buildCurrentInviteUrl(arcadeConfig.inviteBaseUrl, invitePayload));
  }, [
    arcadeConfig.inviteBaseUrl,
    selectedGame,
    state.phase,
    state.session.creatorAddress,
    state.session.creatorCommitment,
    state.session.publicConfig,
    state.session.sessionId,
    state.session.status,
  ]);

  useEffect(() => {
    if (state.phase !== PHASE.PAYMENT_WAIT) {
      return;
    }

    if (paymentWatcher.status === PAYMENT_WATCH_STATUS.CONFIRMED && paymentWatcher.payment) {
      actions.setPaymentConfirmed({
        phase: PHASE.SETUP,
        payment: {
          confirmedPayment: paymentWatcher.payment,
        },
        info: "Payment confirmed. Setup is unlocked.",
      });
      return;
    }

    if (paymentWatcher.status === PAYMENT_WATCH_STATUS.ERROR && paymentWatcher.error) {
      actions.setPaymentError({
        payment: {},
        paymentError: paymentWatcher.error,
      });
    }
  }, [
    actions,
    paymentWatcher.error,
    paymentWatcher.payment,
    paymentWatcher.status,
    state.phase,
  ]);

  const connectAndReplay = useCallback(
    async (peerAddress, sessionId, gameKey, onMessage, existingConversationId) => {
      transport.resetSessionCache();
      await clearSessionStream();
      let conversation = null;
      if (existingConversationId) {
        conversation = await transport.bindConversation(existingConversationId);
      }
      if (!conversation) {
        conversation = await transport.connectToPeer(peerAddress);
      }
      sessionStreamCleanupRef.current = await transport.startSessionStream({
        sessionId,
        gameKey,
        onMessage,
      });
      const history = await transport.loadConversationMessages({
        sessionId,
        gameKey,
      });
      for (const entry of history) {
        await onMessage(entry.message, entry.incoming);
      }
      return conversation?.id || existingConversationId || "";
    },
    [clearSessionStream, transport],
  );

  const applyProtocolResult = useCallback(
    (result) => {
      actions.applyProtocolResult(result);
    },
    [actions],
  );

  const onArcadeMessage = useCallback(
    async (message, incoming) => {
      const localState = stateRef.current;
      const game = getGameDefinition(localState.selectedGameKey);
      if (!game) {
        return;
      }

      if (String(message.sessionId) !== String(localState.session.sessionId)) {
        return;
      }

      if (safeLower(message.from) === safeLower(localState.address)) {
        return;
      }

      if (message.type === LIFECYCLE_TYPES.SESSION_JOIN_REJECTED) {
        if (localState.session.role !== "joiner") {
          return;
        }
        pushDebugEvent("joiner", "joiner_received_rejection", {
          sessionId: message.sessionId,
          gameKey: game.key,
          from: message.from,
          conversationId: incoming?.conversationId || "",
          reason: message.payload.reason || "",
          status: message.payload.status || "",
        });
        actions.setInviteStatus({
          state: "expired",
          reason: message.payload.reason || "",
        });
        actions.setInfo(
          message.payload.status === "terminated"
            ? "This session has already ended."
            : "This session has already been claimed by another player.",
        );
        return;
      }

      if (message.type === "SESSION_JOIN") {
        if (localState.session.role !== "creator") {
          return;
        }

        console.log("[arcade] creator received join", {
          sessionId: message.sessionId,
          from: message.from,
          conversationId: incoming?.conversationId,
          messageId: incoming?.id || incoming?.messageId,
        });
        pushDebugEvent("creator", "creator_received_join", {
          sessionId: message.sessionId,
          gameKey: game.key,
          from: message.from,
          conversationId: incoming?.conversationId || "",
          messageId: incoming?.id || incoming?.messageId || "",
        });

        const inviteStatus = getCreatorInviteStatus(localState);
        if (inviteStatus.status !== "available") {
          console.log("[arcade] creator rejected join", {
            sessionId: message.sessionId,
            from: message.from,
            status: inviteStatus.status,
            reason: inviteStatus.reason,
          });
          pushDebugEvent("creator", "creator_rejected_join", {
            sessionId: message.sessionId,
            gameKey: game.key,
            from: message.from,
            status: inviteStatus.status,
            reason: inviteStatus.reason,
          });
          const rejection = makeJoinRejectedMessage(
            game,
            localState.session.sessionId,
            localState.address,
            inviteStatus,
          );
          let rejectionConversation = incoming?.conversation || null;
          if (incoming?.conversationId) {
            rejectionConversation =
              (await transport.bindConversation(incoming.conversationId)) ||
              rejectionConversation;
          }
          if (!rejectionConversation) {
            rejectionConversation =
              await transport.resolveExistingSessionConversation({
                peerAddress: message.from,
                sessionId: localState.session.sessionId,
                gameKey: game.key,
              });
          }
          if (!rejectionConversation) {
            pushDebugEvent("creator", "creator_rejection_conversation_missing", {
              sessionId: message.sessionId,
              gameKey: game.key,
              from: message.from,
            });
            actions.setInfo("Failed to resolve the join conversation for rejection.");
            return;
          }
          await transport.sendEnvelopeToConversation(
            rejectionConversation,
            rejection,
          );
          try {
            await rejectionConversation.updateConsentState(ConsentState.Denied);
          } catch (error) {
            console.warn("Arcade failed to deny rejected session conversation", error);
          }
          return;
        }

        console.log("[arcade] creator accepted join", {
          sessionId: message.sessionId,
          from: message.from,
          conversationId: incoming?.conversationId,
        });
        pushDebugEvent("creator", "creator_accepted_join", {
          sessionId: message.sessionId,
          gameKey: game.key,
          from: message.from,
          conversationId: incoming?.conversationId || "",
        });
        const opponentAddress = message.from;
        let boundConversation = incoming?.conversation || null;
        if (incoming?.conversationId) {
          boundConversation =
            (await transport.bindConversation(incoming.conversationId)) ||
            boundConversation;
        }
        if (!boundConversation) {
          boundConversation =
            await transport.resolveExistingSessionConversation({
              peerAddress: opponentAddress,
              sessionId: localState.session.sessionId,
              gameKey: game.key,
            });
        }
        if (!boundConversation) {
          pushDebugEvent("creator", "creator_accept_conversation_missing", {
            sessionId: message.sessionId,
            gameKey: game.key,
            from: message.from,
          });
          actions.setError(
            "Join was received, but the session conversation could not be resolved.",
          );
          return;
        }
        try {
          await boundConversation.updateConsentState(ConsentState.Allowed);
        } catch (error) {
          console.warn("Arcade failed to allow accepted session conversation", error);
        }
        await transport.stopWaitingStream();
        await clearSessionStream();
        actions.activateSession({
          session: {
            role: "creator",
            status: SESSION_STATUS.ACTIVE,
            joinerAddress: opponentAddress,
            joinerCommitment: message.payload.commitment,
            selfReady: true,
            opponentReady: true,
            turn: "creator",
            conversationId: boundConversation?.id || incoming?.conversationId || "",
          },
          info: "Opponent joined. Session is live.",
        });
        const readyMessage = makeReadyMessage(
          game,
          localState.session.sessionId,
          localState.address,
        );
        console.log("[arcade] creator sending ready", {
          sessionId: localState.session.sessionId,
          to: opponentAddress,
          conversationId:
            boundConversation?.id || incoming?.conversationId || null,
        });
        pushDebugEvent("creator", "creator_sending_ready", {
          sessionId: localState.session.sessionId,
          gameKey: game.key,
          to: opponentAddress,
          conversationId: boundConversation.id,
        });
        await transport.sendEnvelopeToConversation(boundConversation, readyMessage);
        sessionStreamCleanupRef.current = await transport.startSessionStream({
          sessionId: localState.session.sessionId,
          gameKey: game.key,
          onMessage: async (nextMessage, nextIncoming) => {
            await onArcadeMessage(nextMessage, nextIncoming);
          },
        });
        return;
      }

      if (message.type === "SESSION_READY") {
        const readyEligible =
          localState.session.role === "joiner" &&
          safeLower(message.from) ===
            safeLower(localState.session.creatorAddress) &&
          (
            localState.session.status === SESSION_STATUS.WAITING_FOR_READY ||
            localState.session.status === SESSION_STATUS.DRAFT
          );

        if (!readyEligible) {
          return;
        }
        console.log("[arcade] joiner received ready", {
          sessionId: message.sessionId,
          from: message.from,
          conversationId: incoming?.conversationId,
          messageId: incoming?.id || incoming?.messageId,
        });
        pushDebugEvent("joiner", "joiner_received_ready", {
          sessionId: message.sessionId,
          gameKey: game.key,
          from: message.from,
          conversationId: incoming?.conversationId || "",
          messageId: incoming?.id || incoming?.messageId || "",
        });
        actions.activateSession({
          session: {
            role: "joiner",
            status: SESSION_STATUS.ACTIVE,
            selfReady: true,
            opponentReady: true,
            turn: "creator",
          },
          info: "Creator is ready. Your session is live.",
        });
        actions.setInviteStatus({
          state: "expired",
          reason: "already_joined",
        });
        return;
      }

      const peerAddress =
        localState.session.role === "creator"
          ? localState.session.joinerAddress
          : localState.session.creatorAddress;

      if (peerAddress && safeLower(message.from) !== safeLower(peerAddress)) {
        return;
      }

      const result = handleIncomingMessage(game, message, {
        address: localState.address,
        role: localState.session.role,
        opponentAddress: peerAddress,
        sessionId: localState.session.sessionId,
        session: localState.session,
        gameState: localState.gameState,
        secretState: localState.secretState,
        turn: localState.session.turn,
        mySeq: localState.session.mySeq,
        expectedOpponentSeq: localState.session.expectedOpponentSeq,
      });

      applyProtocolResult(result);
      if (result.outgoingMessages?.length) {
        await transport.sendMany(result.outgoingMessages);
      }

      if (!result.winner && result.gameState && !result.gameState.winner) {
        const autoLoss = checkAutoLoss(game, result.gameState, {
          address: localState.address,
          role: localState.session.role,
          opponentAddress: peerAddress,
          sessionId: localState.session.sessionId,
          secretState: localState.secretState,
          mySeq: localState.session.mySeq,
        });
        if (autoLoss.lost) {
          applyProtocolResult(autoLoss);
          if (autoLoss.outgoingMessages?.length) {
            await transport.sendMany(autoLoss.outgoingMessages);
          }
        }
      }
    },
    [actions, applyProtocolResult, clearSessionStream, pushDebugEvent, transport],
  );

  useEffect(() => {
    if (
      !hasXmtp ||
      !selectedGame ||
      state.session.role !== "creator" ||
      state.phase !== PHASE.CREATE_INVITE ||
      state.session.status !== SESSION_STATUS.WAITING_FOR_JOIN ||
      !state.session.sessionId
    ) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        pushDebugEvent("creator", "creator_wait_started", {
          sessionId: state.session.sessionId,
          gameKey: selectedGame.key,
        });
        await clearSessionStream();
        transport.resetSessionCache();
        await transport.stopWaitingStream();
        await transport.startWaitingForJoin({
          sessionId: state.session.sessionId,
          gameKey: selectedGame.key,
          onMessage: async (message, incoming) => {
            if (!cancelled) {
              await onArcadeMessage(message, incoming);
            }
          },
          onDebugEvent: (label, details) => {
            if (!cancelled) {
              pushDebugEvent("creator", label, details);
            }
          },
        });
      } catch (error) {
        if (!cancelled) {
          pushDebugEvent("transport", "creator_wait_failed", {
            sessionId: state.session.sessionId,
            gameKey: selectedGame.key,
            reason: error.message || "Failed to listen for join messages",
          });
          actions.setError(error.message || "Failed to listen for join messages");
        }
      }
    })();

    return () => {
      cancelled = true;
      void transport.stopWaitingStream();
    };
  }, [
    actions,
    clearSessionStream,
    hasXmtp,
    onArcadeMessage,
    selectedGame,
    state.phase,
    state.session.role,
    state.session.sessionId,
    state.session.status,
    pushDebugEvent,
    transport,
  ]);

  useEffect(() => {
    if (
      !hasXmtp ||
      !selectedGame ||
      (state.phase !== PHASE.PLAYING && state.phase !== PHASE.RESULT) ||
      (
        state.session.status !== SESSION_STATUS.ACTIVE &&
        state.session.status !== SESSION_STATUS.RESULT
      ) ||
      !state.session.sessionId
    ) {
      return;
    }

    const peerAddress =
      state.session.role === "creator"
        ? state.session.joinerAddress
        : state.session.creatorAddress;

    if (!peerAddress) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        await connectAndReplay(
          peerAddress,
          state.session.sessionId,
          selectedGame.key,
          async (message, incoming) => {
            if (!cancelled) {
              await onArcadeMessage(message, incoming);
            }
          },
          state.session.conversationId,
        );
      } catch (error) {
        if (!cancelled) {
          pushDebugEvent("transport", "session_stream_failed", {
            sessionId: state.session.sessionId,
            gameKey: selectedGame.key,
            reason: error.message || "Failed to connect arcade session messages",
          });
          actions.setError(
            error.message || "Failed to connect arcade session messages",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    actions,
    connectAndReplay,
    hasXmtp,
    onArcadeMessage,
    selectedGame,
    state.session.creatorAddress,
    state.session.joinerAddress,
    state.session.role,
    state.session.sessionId,
    pushDebugEvent,
  ]);

  const handleSelectGame = useCallback(
    (gameKey) => {
      actions.setError("");
      actions.setInfo("");
      if (!connected || !hasXmtp) {
        actions.selectGame(gameKey);
        return;
      }
      if (arcadeConfig.paidMode) {
        preparePaidFlow(gameKey, "creator");
      } else {
        initializeForGame(gameKey);
      }
    },
    [actions, connected, hasXmtp, arcadeConfig.paidMode, initializeForGame, preparePaidFlow],
  );

  const openPaymentUrl = useCallback(
    (nextUrl = paymentUrl) => {
      if (!nextUrl) {
        actions.setPaymentError({
          paymentError: "Payment URL could not be created.",
        });
        return;
      }

      window.requestAnimationFrame(() => {
        window.location.assign(nextUrl);
      });
    },
    [actions, paymentUrl],
  );

  const beginPayment = useCallback(
    (actor, amountCrc, selection) => {
      if (!state.session.sessionId) {
        actions.setPaymentError({
          paymentError: "Session is not ready for payment.",
        });
        return;
      }

      if (paymentConfigError) {
        actions.setPaymentError({
          paymentError: paymentConfigError,
        });
        return;
      }

      const marker = buildPaymentMarker({
        sessionId: state.session.sessionId,
        payerRole: actor,
        payerAddress: state.address,
        amountCrc,
      });
      const nextUrl = buildPaymentTransferUrl({
        transferBaseUrl: arcadeConfig.paymentTransferBaseUrl,
        recipientAddress: arcadeConfig.paymentRecipientAddress,
        amountCrc,
        marker,
      });

      actions.setPaymentWaiting({
        session:
          actor === "creator"
            ? {
                role: "creator",
                creatorAddress: state.address,
              }
            : {
                role: "joiner",
                joinerAddress: state.address,
              },
        payment: {
          mode: "paid",
          actor,
          selection,
          amountCrc,
          marker: marker.hex,
          txHashes: [],
          confirmedPayment: null,
        },
        info: "Finish the transfer in Gnosis and return here. Payment confirmation will unlock the session.",
      });
      openPaymentUrl(nextUrl);
    },
    [
      actions,
      arcadeConfig.paymentRecipientAddress,
      arcadeConfig.paymentTransferBaseUrl,
      openPaymentUrl,
      paymentConfigError,
      state.address,
      state.session.sessionId,
    ],
  );

  const handleBeginCreatorHalfPayment = useCallback(() => {
    beginPayment("creator", 1, "creator_half");
  }, [beginPayment]);

  const handleBeginCreatorFullPayment = useCallback(() => {
    beginPayment("creator", 2, "creator_full");
  }, [beginPayment]);

  const handleBeginJoinerPayment = useCallback(() => {
    beginPayment("joiner", 1, "joiner_pay");
  }, [beginPayment]);

  const handlePaymentFreeJoin = useCallback(() => {
    actions.setPayment({
      mode: "paid",
      actor: "joiner",
      selection: "joiner_free",
      amountCrc: 0,
      marker: "",
      watchStatus: PAYMENT_WATCH_STATUS.IDLE,
      confirmedPayment: null,
      error: "",
    });
    actions.setPhase(PHASE.SETUP);
    actions.setInfo("You chose to join without a payment.");
  }, [actions]);

  const handleRetryPaymentWatch = useCallback(() => {
    actions.setPayment({
      watchStatus: PAYMENT_WATCH_STATUS.WAITING,
      error: "",
    });
    actions.setError("");
  }, [actions]);

  const handleBackFromPayment = useCallback(() => {
    if (state.invite) {
      actions.resetSession();
      setPendingInvite(state.invite);
      return;
    }

    actions.resetSession();
  }, [actions, state.invite]);

  const handleSetupAction = useCallback(
    (action) => {
      if (!selectedGame) {
        return;
      }
      const result = selectedGame.reduce(state.gameState, {
        ...action,
        setupState: state.gameSetupState,
      });

      if (result.setupState) {
        actions.setSetupState(result.setupState);
      }
      if (result.error) {
        actions.setError(result.error);
      }
    },
    [actions, selectedGame, state.gameSetupState, state.gameState],
  );

  const handleCommitSetup = useCallback(() => {
    if (!selectedGame) {
      return;
    }

    try {
      const built = buildGenericCommitment(
        selectedGame.serializeSecret(state.gameSetupState),
      );
      const inviteCreatedAt =
        state.session.publicConfig?.inviteMeta?.createdAt || Date.now();

      if (state.invite) {
        actions.clearDebugEvents();
        actions.setInviteStatus({ state: "idle", reason: "" });
        actions.setCommittedSetup({
          commitment: built.commitment,
          secretState: built.secretState,
          gameState: built.gameState,
          phase: PHASE.JOIN_INVITE,
          info: `Setup committed for ${selectedGame.label}. Ready to join the session.`,
          session: {
            sessionId: state.invite.sessionId,
            gameKey: state.invite.gameKey,
            role: "joiner",
            status: SESSION_STATUS.DRAFT,
            creatorAddress: state.invite.creatorAddress,
            creatorCommitment: state.invite.creatorCommitment,
            joinerAddress: state.address,
            joinerCommitment: built.commitment,
            publicConfig: {
              ...selectedGame.loadInvitePublicConfig(state.invite.publicConfig),
              inviteMeta: {
                createdAt:
                  state.invite.publicConfig?.inviteMeta?.createdAt ||
                  inviteCreatedAt,
              },
            },
            turn: "creator",
            mySeq: 1,
            expectedOpponentSeq: 1,
            winner: "",
            selfReady: false,
            opponentReady: false,
          },
        });
        return;
      }

      const sessionId = state.session.sessionId || createSessionId(state.address);
      const billing =
        state.payment.mode === "paid"
          ? {
              mode: "paid",
              creatorFeeCrc: state.payment.amountCrc,
              inviteeFeeCrc: 1,
              inviteeCanPlayFree: true,
            }
          : {
              mode: "free",
            };
      actions.clearDebugEvents();
      actions.clearInviteStatus();
      actions.setCommittedSetup({
        commitment: built.commitment,
        secretState: built.secretState,
        gameState: built.gameState,
        phase: PHASE.CREATE_INVITE,
        info: `Setup committed for ${selectedGame.label}. Share the invite when ready.`,
        session: {
          sessionId,
          gameKey: selectedGame.key,
          role: "creator",
          status: SESSION_STATUS.WAITING_FOR_JOIN,
          creatorAddress: state.address,
          creatorCommitment: built.commitment,
          publicConfig: {
            ...built.publicConfig,
            inviteMeta: {
              createdAt: inviteCreatedAt,
            },
            billing,
          },
          turn: "creator",
          mySeq: 1,
          expectedOpponentSeq: 1,
          winner: "",
          selfReady: false,
          opponentReady: false,
        },
      });
    } catch (error) {
      actions.setError(error.message || "Failed to commit setup");
    }
  }, [
    actions,
    selectedGame,
    state.address,
    state.gameSetupState,
    state.invite,
    state.payment.amountCrc,
    state.payment.mode,
    state.session.publicConfig,
    state.session.sessionId,
  ]);

  const handleJoinSession = useCallback(async () => {
    if (
      !selectedGame ||
      !state.invite ||
      !hasXmtp ||
      !connected ||
      !state.session.sessionId
    ) {
      return;
    }

    try {
      pushDebugEvent("joiner", "joiner_clicked_join", {
        sessionId: state.session.sessionId,
        gameKey: selectedGame.key,
        creatorAddress: state.invite.creatorAddress,
      });
      const conversationId = await connectAndReplay(
        state.invite.creatorAddress,
        state.session.sessionId,
        selectedGame.key,
        onArcadeMessage,
      );

      actions.updateSession({
        status: SESSION_STATUS.WAITING_FOR_READY,
        role: "joiner",
        selfReady: true,
        joinerAddress: state.address,
        joinerCommitment: state.commitment,
        conversationId,
      });
      actions.setPhase(PHASE.JOIN_INVITE);
      actions.setInfo("Waiting for the creator to confirm the session.");
      stateRef.current = {
        ...stateRef.current,
        phase: PHASE.JOIN_INVITE,
        info: "Waiting for the creator to confirm the session.",
        session: {
          ...stateRef.current.session,
          status: SESSION_STATUS.WAITING_FOR_READY,
          role: "joiner",
          selfReady: true,
          joinerAddress: state.address,
          joinerCommitment: state.commitment,
          conversationId,
        },
      };

      await transport.sendEnvelope(
        makeJoinMessage(selectedGame, state.session.sessionId, state.address, {
          commitment: state.commitment,
        }),
      );
      pushDebugEvent("joiner", "joiner_join_sent", {
        sessionId: state.session.sessionId,
        gameKey: selectedGame.key,
        creatorAddress: state.invite.creatorAddress,
      });
    } catch (error) {
      pushDebugEvent("joiner", "join_failed", {
        sessionId: state.session.sessionId,
        gameKey: selectedGame.key,
        reason: error.message || "Failed to join arcade session",
      });
      actions.setError(error.message || "Failed to join arcade session");
    }
  }, [
    actions,
    connected,
    connectAndReplay,
    hasXmtp,
    onArcadeMessage,
    selectedGame,
    state.address,
    state.commitment,
    state.invite,
    state.session.sessionId,
    pushDebugEvent,
    transport,
  ]);

  const handlePlayAction = useCallback(
    async (action) => {
      if (!selectedGame || !state.gameState) {
        return;
      }

      if (selectedGame.isLocalAction?.(action)) {
        const localResult = selectedGame.reduceLocalAction(state.gameState, action);
        if (localResult.gameState) {
          actions.setGameState(localResult.gameState);
        }
        if (localResult.error) {
          actions.setError(localResult.error);
        }
        return;
      }

      if (state.session.turn !== state.session.role) {
        return;
      }

      try {
        const result = applyLocalMove(selectedGame, state.gameState, action, {
          address: state.address,
          role: state.session.role,
          opponentAddress:
            state.session.role === "creator"
              ? state.session.joinerAddress
              : state.session.creatorAddress,
          sessionId: state.session.sessionId,
          secretState: state.secretState,
          turn: state.session.turn,
          mySeq: state.session.mySeq,
          expectedOpponentSeq: state.session.expectedOpponentSeq,
        });

        applyProtocolResult(result);
        if (result.outgoingMessages?.length) {
          await transport.sendMany(result.outgoingMessages);
        }
      } catch (error) {
        actions.setError(error.message || "Failed to send move");
      }
    },
    [
      actions,
      applyProtocolResult,
      selectedGame,
      state.address,
      state.gameState,
      state.secretState,
      state.session.creatorAddress,
      state.session.expectedOpponentSeq,
      state.session.joinerAddress,
      state.session.mySeq,
      state.session.role,
      state.session.sessionId,
      state.session.turn,
      transport,
    ],
  );

  const handleResignSession = useCallback(async () => {
    if (
      isResigning ||
      state.phase !== PHASE.PLAYING ||
      !selectedGame ||
      !state.gameState
    ) {
      return;
    }

    const opponentAddress =
      state.session.role === "creator"
        ? state.session.joinerAddress
        : state.session.creatorAddress;

    if (!opponentAddress || !state.secretState) {
      actions.setError("Session is not ready to resign.");
      return;
    }

    setIsResigning(true);
    actions.setError("");

    try {
      const result = buildResignResult(selectedGame, state.gameState, {
        address: state.address,
        opponentAddress,
        sessionId: state.session.sessionId,
        secretState: state.secretState,
        mySeq: state.session.mySeq,
      });

      await transport.sendMany(result.outgoingMessages || []);
      applyProtocolResult(result);
    } catch (error) {
      actions.setError(error.message || "Failed to resign the session");
    } finally {
      setIsResigning(false);
    }
  }, [
    actions,
    applyProtocolResult,
    isResigning,
    selectedGame,
    state.address,
    state.gameState,
    state.phase,
    state.secretState,
    state.session.creatorAddress,
    state.session.joinerAddress,
    state.session.mySeq,
    state.session.role,
    state.session.sessionId,
    transport,
  ]);

  const handleResetArcade = useCallback(async () => {
    await clearStreams();
    transport.resetSessionCache();
    setPendingInvite(null);
    setConflictingInvite(null);
    setInviteLink("");
    setIsResigning(false);
    actions.resetSession();
  }, [actions, clearStreams, transport]);

  const handleResumeRecovery = useCallback(() => {
    setPendingInvite(null);
    setConflictingInvite(null);
    actions.resumeRecovery();
  }, [actions]);

  const handleDiscardAndOpenInvite = useCallback(async () => {
    const inviteToOpen = conflictingInvite;
    await clearStreams();
    transport.resetSessionCache();
    setConflictingInvite(null);
    setInviteLink("");
    setIsResigning(false);
    actions.resetSession();
    setPendingInvite(inviteToOpen);
  }, [actions, clearStreams, conflictingInvite, transport]);

  const handlePlayAgain = useCallback(() => {
    if (!selectedGame) {
      actions.resetSession();
      return;
    }
    initializeForGame(selectedGame.key);
  }, [actions, initializeForGame, selectedGame]);

  const conflictPanel = conflictingInvite ? (
    <div className="screen screen-stack-tight">
      <section className="panel section-intro">
        <p className="eyebrow">Invite conflict</p>
        <h2>You already have a saved arcade session.</h2>
        <p className="muted">
          Choose whether to resume the current session or discard it and open the
          incoming invite.
        </p>
      </section>
      <div className="panel action-stack">
        <button
          type="button"
          className="primary-btn full-width-mobile"
          onClick={handleResumeRecovery}
        >
          Resume current session
        </button>
        <button
          type="button"
          className="secondary-btn full-width-mobile"
          onClick={handleDiscardAndOpenInvite}
        >
          Open invite instead
        </button>
      </div>
    </div>
  ) : null;

  let content = conflictPanel;
  if (!content) {
    if (state.phase === PHASE.HOME) {
      content = (
        <ArcadeHome
          connected={connected}
          hasXmtp={hasXmtp}
          games={GAMES}
          selectedGameKey={state.selectedGameKey}
          recoverySummary={recoverySummary}
          onSelectGame={handleSelectGame}
          onResumeRecovery={handleResumeRecovery}
          onResetArcade={handleResetArcade}
          onOpenAccount={onOpenAccount}
        />
      );
    } else if (state.phase === PHASE.PAYMENT_SELECT) {
      content = (
        <PaymentSelect
          actor={state.payment.actor}
          selectedGame={selectedGame}
          billing={activeBilling}
          recipientAddress={arcadeConfig.paymentRecipientAddress}
          configError={paymentConfigError}
          onCreatorHalf={handleBeginCreatorHalfPayment}
          onCreatorFull={handleBeginCreatorFullPayment}
          onJoinerPay={handleBeginJoinerPayment}
          onJoinerFree={handlePaymentFreeJoin}
          onBack={state.invite ? handleBackFromPayment : null}
        />
      );
    } else if (state.phase === PHASE.PAYMENT_WAIT) {
      content = (
        <PaymentWait
          selectedGame={selectedGame}
          payment={state.payment}
          recipientAddress={arcadeConfig.paymentRecipientAddress}
          paymentUrl={paymentUrl}
          status={formatSummaryLabel(paymentWatcher.status || state.payment.watchStatus)}
          info={state.info}
          error={state.payment.error || state.error}
          onOpenPayment={() => openPaymentUrl()}
          onRetry={handleRetryPaymentWatch}
        />
      );
    } else if (state.phase === PHASE.SETUP) {
      content = (
        <SetupSession
          selectedGame={selectedGame}
          setupState={state.gameSetupState}
          invite={state.invite}
          error={state.error}
          onAction={handleSetupAction}
          onCommit={handleCommitSetup}
          onCancel={actions.resetSession}
        />
      );
    } else if (state.phase === PHASE.CREATE_INVITE) {
      content = (
        <CreateInvite
          selectedGame={selectedGame}
          session={state.session}
          summary={selectedGame?.getSetupSummary(state.secretState) || []}
          inviteLink={inviteLink}
          debugEvents={state.debugEvents}
          info={state.info}
          onReset={actions.resetSession}
        />
      );
    } else if (state.phase === PHASE.JOIN_INVITE) {
      content = (
        <JoinInvite
          invite={state.invite}
          selectedGame={selectedGame}
          summary={selectedGame?.getSetupSummary(state.secretState) || []}
          canJoin={
            connected &&
            hasXmtp &&
            state.inviteStatus.state !== "expired"
          }
          debugEvents={state.debugEvents}
          needsAccountSetup={!connected || !hasXmtp}
          inviteStatus={state.inviteStatus}
          info={state.info}
          onJoin={handleJoinSession}
          onResetArcade={handleResetArcade}
          onOpenAccount={onOpenAccount}
        />
      );
    } else if (state.phase === PHASE.PLAYING) {
      content = (
        <PlaySession
          selectedGame={selectedGame}
          gameState={state.gameState}
          secretState={state.secretState}
          role={state.session.role}
          isMyTurn={state.session.turn === state.session.role}
          info={state.info}
          onAction={handlePlayAction}
          onResign={handleResignSession}
          onResetArcade={handleResetArcade}
          isResigning={isResigning}
        />
      );
    } else if (state.phase === PHASE.RESULT) {
      content = (
        <SessionResult
          address={state.address}
          selectedGame={selectedGame}
          gameState={state.gameState}
          secretState={state.secretState}
          role={state.session.role}
          winner={state.session.winner}
          verification={state.verification}
          info={state.info}
          onPlayAgain={handlePlayAgain}
          onReset={handleResetArcade}
        />
      );
    }
  }

  return (
    <div className="arcade-page">
      <div className="arcade-shell">
        {state.error ? <div className="banner error">{state.error}</div> : null}
        {content}
      </div>
    </div>
  );
}
