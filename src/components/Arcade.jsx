import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GAMES, getGameDefinition } from "./arcade/gameRegistry.js";
import { buildGenericCommitment } from "./arcade/protocol/commitment.js";
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
import {
  buildInviteLink,
  createInvitePayload,
} from "./arcade/helpers/invite.js";
import {
  PHASE,
  SESSION_STATUS,
} from "./arcade/helpers/constants.js";
import ArcadeHome from "./arcade/screens/ArcadeHome.jsx";
import SetupSession from "./arcade/screens/SetupSession.jsx";
import CreateInvite from "./arcade/screens/CreateInvite.jsx";
import JoinInvite from "./arcade/screens/JoinInvite.jsx";
import PlaySession from "./arcade/screens/PlaySession.jsx";
import SessionResult from "./arcade/screens/SessionResult.jsx";

function createSessionId(address) {
  const seed = crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${String(address || "arcade").slice(2, 8)}:${seed}`;
}

function buildCurrentInviteUrl(payload) {
  return buildInviteLink(window.location.href, payload);
}

function safeLower(value) {
  return String(value || "").toLowerCase();
}

function formatSummaryLabel(value) {
  const normalized = String(value || "").replaceAll("_", " ").toLowerCase();
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "";
}

export default function Arcade({
  address,
  connected,
  xmtpClient,
  onOpenAccount,
  initialInvite,
}) {
  const { state, actions } = useArcadeState({ address });
  const transport = useArcadeTransport({ xmtpClient, address });
  const [inviteLink, setInviteLink] = useState("");
  const [pendingInvite, setPendingInvite] = useState(initialInvite);
  const [conflictingInvite, setConflictingInvite] = useState(null);
  const [isResigning, setIsResigning] = useState(false);
  const stateRef = useRef(state);
  const streamCleanupRef = useRef(null);

  const hasXmtp = Boolean(xmtpClient);
  const selectedGame = useMemo(
    () => getGameDefinition(state.selectedGameKey || pendingInvite?.gameKey),
    [pendingInvite?.gameKey, state.selectedGameKey],
  );
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
      actions.setInfo("");
      actions.setError("");
      setInviteLink("");
    },
    [actions],
  );

  const clearStream = useCallback(async () => {
    if (streamCleanupRef.current) {
      await streamCleanupRef.current();
      streamCleanupRef.current = null;
    }
  }, []);

  useEffect(() => {
    void clearStream();
    return () => {
      void clearStream();
    };
  }, [clearStream]);

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
      initializeForGame(pendingInvite.gameKey, pendingInvite);
      setPendingInvite(null);
    }
  }, [
    initializeForGame,
    pendingInvite,
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
    });
    setInviteLink(buildCurrentInviteUrl(invitePayload));
  }, [
    selectedGame,
    state.phase,
    state.session.creatorAddress,
    state.session.creatorCommitment,
    state.session.publicConfig,
    state.session.sessionId,
    state.session.status,
  ]);

  const connectAndReplay = useCallback(
    async (peerAddress, sessionId, gameKey, onMessage) => {
      transport.resetSessionCache();
      await transport.connectToPeer(peerAddress);
      streamCleanupRef.current = await transport.startSessionStream({
        sessionId,
        gameKey,
        onMessage,
      });
      const history = await transport.loadConversationMessages({
        sessionId,
        gameKey,
      });
      for (const message of history) {
        await onMessage(message);
      }
    },
    [transport],
  );

  const applyProtocolResult = useCallback(
    (result) => {
      actions.applyProtocolResult(result);
    },
    [actions],
  );

  const onArcadeMessage = useCallback(
    async (message) => {
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

      if (message.type === "SESSION_JOIN") {
        if (
          localState.session.role !== "creator" ||
          localState.session.status !== SESSION_STATUS.WAITING_FOR_JOIN
        ) {
          return;
        }

        const opponentAddress = message.from;
        await transport.connectToPeer(opponentAddress);
        actions.activateSession({
          session: {
            role: "creator",
            status: SESSION_STATUS.ACTIVE,
            joinerAddress: opponentAddress,
            joinerCommitment: message.payload.commitment,
            selfReady: true,
            opponentReady: true,
            turn: "creator",
          },
          info: "Opponent joined. Session is live.",
        });
        await transport.sendEnvelope(
          makeReadyMessage(game, localState.session.sessionId, localState.address),
        );
        return;
      }

      if (message.type === "SESSION_READY") {
        if (
          localState.session.role !== "joiner" ||
          localState.session.status !== SESSION_STATUS.WAITING_FOR_READY ||
          safeLower(message.from) !== safeLower(localState.session.creatorAddress)
        ) {
          return;
        }
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

      if (!result.winner && result.gameState) {
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
    [actions, applyProtocolResult, transport],
  );

  useEffect(() => {
    if (!hasXmtp || !selectedGame) {
      return;
    }

    if (
      state.phase === PHASE.CREATE_INVITE &&
      state.session.sessionId &&
      state.session.status === SESSION_STATUS.WAITING_FOR_JOIN
    ) {
      let cancelled = false;
      void (async () => {
        try {
          transport.resetSessionCache();
          streamCleanupRef.current = await transport.startSessionStream({
            sessionId: state.session.sessionId,
            gameKey: selectedGame.key,
            onMessage: async (message) => {
              if (!cancelled) {
                await onArcadeMessage(message);
              }
            },
          });
        } catch (error) {
          actions.setError(error.message || "Failed to listen for join messages");
        }
      })();

      return () => {
        cancelled = true;
      };
    }

    if (
      state.phase === PHASE.PLAYING &&
      state.session.status === SESSION_STATUS.ACTIVE &&
      state.session.sessionId
    ) {
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
            async (message) => {
              if (!cancelled) {
                await onArcadeMessage(message);
              }
            },
          );
        } catch (error) {
          actions.setError(
            error.message || "Failed to connect arcade session messages",
          );
        }
      })();

      return () => {
        cancelled = true;
      };
    }
  }, [
    actions,
    connectAndReplay,
    hasXmtp,
    onArcadeMessage,
    selectedGame,
    state.phase,
    state.session.creatorAddress,
    state.session.joinerAddress,
    state.session.role,
    state.session.sessionId,
    state.session.status,
    transport,
  ]);

  const handleSelectGame = useCallback(
    (gameKey) => {
      actions.setError("");
      actions.setInfo("");
      actions.selectGame(gameKey);
    },
    [actions],
  );

  const handleContinueFromHome = useCallback(() => {
    if (state.selectedGameKey) {
      initializeForGame(state.selectedGameKey);
    }
  }, [initializeForGame, state.selectedGameKey]);

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

      if (state.invite) {
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
            publicConfig:
              selectedGame.loadInvitePublicConfig(state.invite.publicConfig),
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
          publicConfig: built.publicConfig,
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
    state.session.sessionId,
  ]);

  const handleJoinSession = useCallback(async () => {
    if (!selectedGame || !state.invite || !hasXmtp || !connected) {
      return;
    }

    try {
      await connectAndReplay(
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
      });
      actions.setPhase(PHASE.JOIN_INVITE);
      actions.setInfo("Waiting for the creator to confirm the session.");

      await transport.sendEnvelope(
        makeJoinMessage(selectedGame, state.session.sessionId, state.address, {
          commitment: state.commitment,
        }),
      );
    } catch (error) {
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
    await clearStream();
    transport.resetSessionCache();
    setPendingInvite(null);
    setConflictingInvite(null);
    setInviteLink("");
    setIsResigning(false);
    actions.resetSession();
  }, [actions, clearStream, transport]);

  const handleResumeRecovery = useCallback(() => {
    setPendingInvite(null);
    setConflictingInvite(null);
    actions.resumeRecovery();
  }, [actions]);

  const handleDiscardAndOpenInvite = useCallback(async () => {
    const inviteToOpen = conflictingInvite;
    await clearStream();
    transport.resetSessionCache();
    setConflictingInvite(null);
    setInviteLink("");
    setIsResigning(false);
    actions.resetSession();
    setPendingInvite(inviteToOpen);
  }, [actions, clearStream, conflictingInvite, transport]);

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
          onContinue={handleContinueFromHome}
          onResumeRecovery={handleResumeRecovery}
          onResetArcade={handleResetArcade}
          onOpenAccount={onOpenAccount}
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
          canJoin={connected && hasXmtp}
          info={state.info}
          onJoin={handleJoinSession}
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
          winner={state.session.winner}
          verification={state.verification}
          info={state.info}
          onPlayAgain={handlePlayAgain}
          onReset={actions.resetSession}
        />
      );
    }
  }

  return (
    <div className="arcade-page">
      <div className="arcade-shell">
        {state.error ? <div className="banner error">{state.error}</div> : null}
        {state.phase !== PHASE.HOME || state.recovery.available ? (
          <div className="arcade-shell-actions">
            <button
              type="button"
              className="ghost-btn"
              onClick={() => {
                void handleResetArcade();
              }}
            >
              Reset arcade
            </button>
          </div>
        ) : null}
        {content}
      </div>
    </div>
  );
}
