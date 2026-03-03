import { useCallback, useEffect, useMemo, useReducer } from "react";
import {
  EMPTY_COMMITMENT,
  PHASE,
  SESSION_STATUS,
} from "../helpers/constants.js";
import {
  clearActiveSessionRef,
  clearPersistedState,
  clearSecretState,
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
    info: "",
    error: "",
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

export function arcadeStateReducer(state, action) {
  switch (action.type) {
    case "HYDRATE":
      return {
        ...createInitialArcadeState(),
        ...action.payload,
        address: action.address || state.address,
        hydrated: true,
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
    dispatch({ type: "SET_ADDRESS", address });
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
      dispatch({
        type: "HYDRATE",
        payload: {
          ...persisted,
          secretState: secret ?? persisted.secretState ?? null,
        },
        address,
      });
      return;
    }

    dispatch({ type: "SET_HYDRATED" });
  }, [address]);

  useEffect(() => {
    if (!state.hydrated || !state.address) {
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
    if (state.address && state.selectedGameKey) {
      clearPersistedState(
        state.address,
        state.selectedGameKey,
        state.session.sessionId || "draft",
      );
      clearPersistedState(state.address, state.selectedGameKey, "draft");
      clearSecretState(
        state.address,
        state.selectedGameKey,
        state.session.sessionId || "draft",
      );
      clearSecretState(state.address, state.selectedGameKey, "draft");
    }
    if (state.address) {
      clearActiveSessionRef(state.address);
    }
    dispatch({ type: "RESET_SESSION" });
  }, [state.address, state.selectedGameKey, state.session.sessionId]);

  const actions = useMemo(
    () => ({
      startGame: (gameKey) => dispatch({ type: "START_GAME", gameKey }),
      selectGame: (gameKey) => dispatch({ type: "SELECT_GAME", gameKey }),
      startInvite: (invite) => dispatch({ type: "START_INVITE", invite }),
      setInvite: (invite) => dispatch({ type: "SET_INVITE", invite }),
      setPhase: (phase) => dispatch({ type: "SET_PHASE", phase }),
      setSetupState: (gameSetupState) =>
        dispatch({ type: "SET_SETUP_STATE", gameSetupState }),
      setGameState: (gameState) =>
        dispatch({ type: "SET_GAME_STATE", gameState }),
      setError: (error) => dispatch({ type: "SET_ERROR", error }),
      setInfo: (info) => dispatch({ type: "SET_INFO", info }),
      setVerification: (verification) =>
        dispatch({ type: "SET_VERIFICATION", verification }),
      setCommittedSetup: (payload) =>
        dispatch({ type: "SET_COMMITTED_SETUP", ...payload }),
      setReady: (payload) => dispatch({ type: "SET_READY", ...payload }),
      updateSession: (session) => dispatch({ type: "UPDATE_SESSION", session }),
      activateSession: (payload) => dispatch({ type: "ACTIVATE_SESSION", ...payload }),
      applyProtocolResult: (result) =>
        dispatch({ type: "APPLY_PROTOCOL_RESULT", ...result }),
      resetSession,
    }),
    [resetSession],
  );

  return { state, actions, dispatch };
}
