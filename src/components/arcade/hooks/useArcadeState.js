import { useCallback, useEffect, useMemo, useReducer } from "react";
import { getGameDefinition } from "../gameRegistry.js";
import {
  EMPTY_COMMITMENT,
  PHASE,
  PAYMENT_WATCH_STATUS,
  SESSION_STATUS,
} from "../helpers/constants.js";
import {
  clearAllArcadeStateForAddress,
  clearActiveSessionRef,
  loadActiveSessionRef,
  loadPersistedState,
  loadSecretState,
  saveActiveSessionRef,
  savePersistedState,
  saveSecretState,
} from "../helpers/storage.js";

function createInitialSession(gameKey = "") {
  return {
    sessionId: "",
    gameKey,
    role: "",
    status: SESSION_STATUS.DRAFT,
    creatorAddress: "",
    creatorCommitment: EMPTY_COMMITMENT,
    joinerAddress: "",
    joinerCommitment: EMPTY_COMMITMENT,
    publicConfig: {},
    turn: "creator",
    mySeq: 1,
    expectedOpponentSeq: 1,
    winner: "",
    selfReady: false,
    opponentReady: false,
  };
}

function createInitialRecovery() {
  return {
    available: false,
    snapshot: null,
    source: null,
  };
}

function createInitialPayment() {
  return {
    mode: "free",
    actor: "",
    selection: "",
    amountCrc: 0,
    marker: "",
    txHashes: [],
    watchStatus: PAYMENT_WATCH_STATUS.IDLE,
    confirmedPayment: null,
    error: "",
  };
}

export function createInitialArcadeState() {
  return {
    hydrated: false,
    address: "",
    phase: PHASE.HOME,
    selectedGameKey: "",
    invite: null,
    session: createInitialSession(),
    gameSetupState: null,
    gameState: null,
    secretState: null,
    commitment: "",
    payment: createInitialPayment(),
    info: "",
    error: "",
    recovery: createInitialRecovery(),
    verification: {
      canConfirm: false,
      contested: false,
      reason: "",
      details: [],
    },
  };
}

function mergeSession(current, next = {}) {
  return {
    ...current,
    ...next,
    publicConfig: next.publicConfig ?? current.publicConfig ?? {},
  };
}

function mergePayment(current, next = {}) {
  return {
    ...current,
    ...next,
    txHashes: next.txHashes ?? current.txHashes ?? [],
    confirmedPayment:
      next.confirmedPayment ?? current.confirmedPayment ?? null,
  };
}

function isKnownPhase(phase) {
  return Object.values(PHASE).includes(phase);
}

function isValidRecoverySnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return false;
  }

  if (!snapshot.selectedGameKey || !getGameDefinition(snapshot.selectedGameKey)) {
    return false;
  }

  if (!isKnownPhase(snapshot.phase) || snapshot.phase === PHASE.HOME) {
    return false;
  }

  const session = snapshot.session || {};
  if (session.gameKey && session.gameKey !== snapshot.selectedGameKey) {
    return false;
  }

  switch (snapshot.phase) {
    case PHASE.PAYMENT_SELECT:
      return Boolean(
        session.sessionId &&
          snapshot.payment?.actor &&
          snapshot.payment?.mode === "paid",
      );
    case PHASE.PAYMENT_WAIT:
      return Boolean(
        session.sessionId &&
          snapshot.payment?.actor &&
          snapshot.payment?.mode === "paid" &&
          snapshot.payment?.marker &&
          snapshot.payment?.amountCrc > 0,
      );
    case PHASE.SETUP:
      return Boolean(snapshot.gameSetupState);
    case PHASE.CREATE_INVITE:
    case PHASE.JOIN_INVITE:
      return Boolean(
        session.sessionId &&
          snapshot.gameState &&
          snapshot.secretState &&
          snapshot.commitment,
      );
    case PHASE.PLAYING:
    case PHASE.RESULT:
      return Boolean(
        session.sessionId &&
          session.role &&
          snapshot.gameState &&
          snapshot.secretState,
      );
    default:
      return false;
  }
}

export function arcadeStateReducer(state, action) {
  switch (action.type) {
    case "BOOTSTRAP_ADDRESS":
      return {
        ...createInitialArcadeState(),
        address: action.address || "",
      };
    case "HYDRATE":
      return {
        ...createInitialArcadeState(),
        ...action.payload,
        address: action.address || state.address,
        hydrated: true,
      };
    case "SET_RECOVERY":
      return {
        ...createInitialArcadeState(),
        hydrated: true,
        address: action.address || state.address,
        recovery: {
          available: true,
          snapshot: action.snapshot,
          source: action.source,
        },
      };
    case "CLEAR_RECOVERY":
      return {
        ...state,
        recovery: createInitialRecovery(),
      };
    case "RESUME_RECOVERY":
      if (!state.recovery.snapshot) {
        return state;
      }
      return {
        ...createInitialArcadeState(),
        ...state.recovery.snapshot,
        address: state.address,
        hydrated: true,
        recovery: createInitialRecovery(),
      };
    case "SET_HYDRATED":
      return {
        ...state,
        hydrated: true,
      };
    case "SET_ADDRESS":
      return {
        ...state,
        address: action.address || "",
      };
    case "START_GAME":
      return {
        ...createInitialArcadeState(),
        hydrated: state.hydrated,
        address: state.address,
        phase: PHASE.SETUP,
        selectedGameKey: action.gameKey,
        session: createInitialSession(action.gameKey),
      };
    case "START_PAYMENT_SELECT":
      return {
        ...state,
        phase: PHASE.PAYMENT_SELECT,
        selectedGameKey: action.gameKey || state.selectedGameKey,
        invite: action.invite ?? state.invite,
        session: mergeSession(state.session, {
          ...action.session,
          gameKey:
            action.gameKey ||
            state.selectedGameKey ||
            state.session.gameKey,
        }),
        payment: mergePayment(createInitialPayment(), {
          mode: "paid",
          actor: action.actor || "",
          selection: action.selection || "",
          amountCrc: action.amountCrc || 0,
          marker: action.marker || "",
          txHashes: action.txHashes || [],
          watchStatus: action.watchStatus || PAYMENT_WATCH_STATUS.IDLE,
          confirmedPayment: action.confirmedPayment || null,
          error: action.paymentError || "",
        }),
        info: action.info ?? state.info,
        error: action.error || "",
      };
    case "SELECT_GAME":
      return {
        ...state,
        selectedGameKey: action.gameKey,
      };
    case "START_INVITE":
      return {
        ...createInitialArcadeState(),
        hydrated: state.hydrated,
        address: state.address,
        phase: PHASE.SETUP,
        selectedGameKey: action.invite.gameKey,
        invite: action.invite,
        session: {
          ...createInitialSession(action.invite.gameKey),
          sessionId: action.invite.sessionId,
          gameKey: action.invite.gameKey,
          role: "joiner",
          creatorAddress: action.invite.creatorAddress,
          creatorCommitment: action.invite.creatorCommitment,
          publicConfig: action.invite.publicConfig || {},
        },
      };
    case "SET_INVITE":
      return {
        ...state,
        invite: action.invite,
      };
    case "SET_PHASE":
      return {
        ...state,
        phase: action.phase,
      };
    case "SET_SETUP_STATE":
      return {
        ...state,
        gameSetupState: action.gameSetupState,
      };
    case "SET_GAME_STATE":
      return {
        ...state,
        gameState: action.gameState,
      };
    case "SET_ERROR":
      return {
        ...state,
        error: action.error || "",
      };
    case "SET_PAYMENT":
      return {
        ...state,
        payment: mergePayment(state.payment, action.payment),
      };
    case "SET_INFO":
      return {
        ...state,
        info: action.info || "",
      };
    case "SET_VERIFICATION":
      return {
        ...state,
        verification: {
          ...state.verification,
          ...action.verification,
        },
      };
    case "SET_COMMITTED_SETUP":
      return {
        ...state,
        commitment: action.commitment,
        secretState: action.secretState,
        gameState: action.gameState ?? state.gameState,
        session: mergeSession(state.session, action.session),
        phase: action.phase,
        info: action.info || "",
        error: "",
      };
    case "SET_PAYMENT_WAITING":
      return {
        ...state,
        phase: PHASE.PAYMENT_WAIT,
        session: mergeSession(state.session, action.session),
        payment: mergePayment(state.payment, {
          ...action.payment,
          watchStatus: PAYMENT_WATCH_STATUS.WAITING,
          error: "",
        }),
        info: action.info ?? state.info,
        error: "",
      };
    case "SET_PAYMENT_CONFIRMED":
      return {
        ...state,
        phase: action.phase ?? state.phase,
        payment: mergePayment(state.payment, {
          ...action.payment,
          watchStatus: PAYMENT_WATCH_STATUS.CONFIRMED,
          error: "",
        }),
        info: action.info ?? state.info,
        error: "",
      };
    case "SET_PAYMENT_ERROR":
      return {
        ...state,
        payment: mergePayment(state.payment, {
          ...action.payment,
          watchStatus: PAYMENT_WATCH_STATUS.ERROR,
          error: action.paymentError || "",
        }),
        error: action.error ?? state.error,
      };
    case "CLEAR_PAYMENT":
      return {
        ...state,
        payment: createInitialPayment(),
      };
    case "SET_READY":
      return {
        ...state,
        session: mergeSession(state.session, {
          selfReady: action.selfReady ?? state.session.selfReady,
          opponentReady: action.opponentReady ?? state.session.opponentReady,
        }),
      };
    case "UPDATE_SESSION":
      return {
        ...state,
        session: mergeSession(state.session, action.session),
      };
    case "ACTIVATE_SESSION":
      return {
        ...state,
        phase: PHASE.PLAYING,
        session: mergeSession(state.session, {
          status: SESSION_STATUS.ACTIVE,
          ...action.session,
        }),
        info: action.info ?? state.info,
        error: "",
      };
    case "APPLY_PROTOCOL_RESULT": {
      const nextSession = { ...state.session };
      if (action.turnDelta) {
        nextSession.turn = action.turnDelta.turn;
      }
      if (action.seqDelta) {
        if (action.seqDelta.mySeq !== undefined) {
          nextSession.mySeq = action.seqDelta.mySeq;
        }
        if (action.seqDelta.expectedOpponentSeq !== undefined) {
          nextSession.expectedOpponentSeq =
            action.seqDelta.expectedOpponentSeq;
        }
      }
      if (action.winner) {
        nextSession.winner = action.winner;
        nextSession.status = SESSION_STATUS.RESULT;
      }
      return {
        ...state,
        phase: action.winner ? PHASE.RESULT : state.phase,
        session: nextSession,
        gameState:
          action.gameState !== undefined ? action.gameState : state.gameState,
        verification: action.verification
          ? { ...state.verification, ...action.verification }
          : state.verification,
        info: action.info ?? state.info,
        error: action.error ?? state.error,
      };
    }
    case "RESET_SESSION":
      return {
        ...createInitialArcadeState(),
        hydrated: state.hydrated,
        address: state.address,
      };
    default:
      return state;
  }
}

export function useArcadeState({ address }) {
  const [state, dispatch] = useReducer(
    arcadeStateReducer,
    undefined,
    createInitialArcadeState,
  );

  useEffect(() => {
    dispatch({ type: "BOOTSTRAP_ADDRESS", address });
    if (!address) {
      dispatch({ type: "SET_HYDRATED" });
      return;
    }

    const activeRef = loadActiveSessionRef(address);
    if (!activeRef?.gameKey || !activeRef?.sessionId) {
      dispatch({ type: "SET_HYDRATED" });
      return;
    }

    const persisted = loadPersistedState(
      address,
      activeRef.gameKey,
      activeRef.sessionId,
    );
    const secret = loadSecretState(
      address,
      activeRef.gameKey,
      activeRef.sessionId,
    );

    if (persisted) {
      const snapshot = {
        ...persisted,
        secretState: secret ?? persisted.secretState ?? null,
      };

      if (isValidRecoverySnapshot(snapshot)) {
        dispatch({
          type: "SET_RECOVERY",
          snapshot,
          source: {
            gameKey: activeRef.gameKey,
            sessionId: activeRef.sessionId,
          },
          address,
        });
        return;
      }

      clearAllArcadeStateForAddress(address);
    }

    dispatch({ type: "SET_HYDRATED" });
  }, [address]);

  useEffect(() => {
    if (!state.hydrated || !state.address) {
      return;
    }

    if (state.recovery.available && state.recovery.source) {
      saveActiveSessionRef(
        state.address,
        state.recovery.source.gameKey,
        state.recovery.source.sessionId,
      );
      return;
    }

    const storageSessionId = state.session.sessionId || "draft";
    const shouldPersist = Boolean(
      state.selectedGameKey &&
        (state.phase !== PHASE.HOME ||
          state.gameSetupState ||
          state.gameState ||
          state.secretState),
    );

    if (!shouldPersist) {
      clearActiveSessionRef(state.address);
      return;
    }

    savePersistedState(
      state.address,
      state.selectedGameKey,
      storageSessionId,
      state,
    );
    if (state.secretState) {
      saveSecretState(
        state.address,
        state.selectedGameKey,
        storageSessionId,
        state.secretState,
      );
    }
    saveActiveSessionRef(state.address, state.selectedGameKey, storageSessionId);
  }, [state]);

  const resetSession = useCallback(() => {
    if (state.address) {
      clearAllArcadeStateForAddress(state.address);
    }
    dispatch({ type: "RESET_SESSION" });
  }, [state.address]);

  const actions = useMemo(
    () => ({
      startGame: (gameKey) => dispatch({ type: "START_GAME", gameKey }),
      startPaymentSelect: (payload) =>
        dispatch({ type: "START_PAYMENT_SELECT", ...payload }),
      selectGame: (gameKey) => dispatch({ type: "SELECT_GAME", gameKey }),
      startInvite: (invite) => dispatch({ type: "START_INVITE", invite }),
      setInvite: (invite) => dispatch({ type: "SET_INVITE", invite }),
      setPhase: (phase) => dispatch({ type: "SET_PHASE", phase }),
      setSetupState: (gameSetupState) =>
        dispatch({ type: "SET_SETUP_STATE", gameSetupState }),
      setGameState: (gameState) =>
        dispatch({ type: "SET_GAME_STATE", gameState }),
      setError: (error) => dispatch({ type: "SET_ERROR", error }),
      setPayment: (payment) => dispatch({ type: "SET_PAYMENT", payment }),
      setInfo: (info) => dispatch({ type: "SET_INFO", info }),
      setVerification: (verification) =>
        dispatch({ type: "SET_VERIFICATION", verification }),
      setCommittedSetup: (payload) =>
        dispatch({ type: "SET_COMMITTED_SETUP", ...payload }),
      setPaymentWaiting: (payload) =>
        dispatch({ type: "SET_PAYMENT_WAITING", ...payload }),
      setPaymentConfirmed: (payload) =>
        dispatch({ type: "SET_PAYMENT_CONFIRMED", ...payload }),
      setPaymentError: (payload) =>
        dispatch({ type: "SET_PAYMENT_ERROR", ...payload }),
      clearPayment: () => dispatch({ type: "CLEAR_PAYMENT" }),
      setReady: (payload) => dispatch({ type: "SET_READY", ...payload }),
      updateSession: (session) => dispatch({ type: "UPDATE_SESSION", session }),
      activateSession: (payload) => dispatch({ type: "ACTIVATE_SESSION", ...payload }),
      applyProtocolResult: (result) =>
        dispatch({ type: "APPLY_PROTOCOL_RESULT", ...result }),
      clearRecovery: () => dispatch({ type: "CLEAR_RECOVERY" }),
      resumeRecovery: () => dispatch({ type: "RESUME_RECOVERY" }),
      resetSession,
    }),
    [resetSession],
  );

  return { state, actions, dispatch };
}
