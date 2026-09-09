// -----------------------------------------------------------------------------
// GAME STORE (React glue around the pure engine)
// -----------------------------------------------------------------------------
// The engine is framework-free and pure; this bridges it to React. The reducer
// only calls engine functions and injects the current time / RNG. A separate
// `now` clock drives UI countdowns and is NEVER used to mutate authoritative
// state - timestamps stored in GameState are the source of truth.
// -----------------------------------------------------------------------------

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CONFIG } from '../data/config';
import {
  buyGear,
  buySafehouse,
  buyUpgrade,
  clearSave,
  collectHeist,
  createInitialState,
  formCrew,
  launchHeist,
  loadGame,
  recruitMember,
  refreshHeat,
  saveGame,
  upgradeSafehouse,
  upgradeSkill,
  type ActionResult,
  type GameState,
  type HeistReport,
} from '../engine';

interface UIState {
  game: GameState;
  message: string | null;
  messageId: number;
  report: HeistReport | null;
}

type Action =
  | { type: 'launch'; heistId: string; crewId: string; now: number; seed: number }
  | { type: 'collect'; id: string; now: number }
  | { type: 'buySafehouse' }
  | { type: 'upgradeSafehouse'; safehouseId: string }
  | { type: 'formCrew'; safehouseId: string }
  | { type: 'recruit'; crewId: string; roleId: string }
  | { type: 'buyGear'; memberId: string; gearId: string }
  | { type: 'upgradeSkill'; memberId: string }
  | { type: 'buyUpgrade'; upgradeId: string }
  | { type: 'refreshHeat'; now: number }
  | { type: 'dismissReport' }
  | { type: 'replace'; game: GameState; message?: string };

function applyResult(ui: UIState, result: ActionResult): UIState {
  if (result.ok) {
    return {
      ...ui,
      game: result.state,
      message: result.message ?? ui.message,
      messageId: ui.messageId + 1,
    };
  }
  return { ...ui, message: result.error, messageId: ui.messageId + 1 };
}

function reducer(ui: UIState, action: Action): UIState {
  switch (action.type) {
    case 'launch':
      return applyResult(
        ui,
        launchHeist(ui.game, action.heistId, action.crewId, action.now, action.seed),
      );
    case 'collect': {
      const res = collectHeist(ui.game, action.id, action.now);
      const nextUi = applyResult(ui, res);
      return { ...nextUi, report: res.ok && res.report ? res.report : ui.report };
    }
    case 'dismissReport':
      return { ...ui, report: null };
    case 'buySafehouse':
      return applyResult(ui, buySafehouse(ui.game));
    case 'upgradeSafehouse':
      return applyResult(ui, upgradeSafehouse(ui.game, action.safehouseId));
    case 'formCrew':
      return applyResult(ui, formCrew(ui.game, action.safehouseId));
    case 'recruit':
      return applyResult(ui, recruitMember(ui.game, action.crewId, action.roleId));
    case 'buyGear':
      return applyResult(ui, buyGear(ui.game, action.memberId, action.gearId));
    case 'upgradeSkill':
      return applyResult(ui, upgradeSkill(ui.game, action.memberId));
    case 'buyUpgrade':
      return applyResult(ui, buyUpgrade(ui.game, action.upgradeId));
    case 'refreshHeat':
      return { ...ui, game: refreshHeat(ui.game, action.now) };
    case 'replace':
      return {
        ...ui,
        game: action.game,
        message: action.message ?? ui.message,
        messageId: ui.messageId + 1,
      };
    default:
      return ui;
  }
}

function init(): UIState {
  const now = Date.now();
  const loaded = loadGame(now);
  if (loaded) {
    const msg =
      loaded.readyCount > 0
        ? `Welcome back. ${loaded.readyCount} heist${loaded.readyCount > 1 ? 's' : ''} ready to collect.`
        : null;
    return { game: loaded.state, message: msg, messageId: 0, report: null };
  }
  return { game: createInitialState(now), message: null, messageId: 0, report: null };
}

interface GameContextValue {
  game: GameState;
  message: string | null;
  messageId: number;
  report: HeistReport | null;
  actions: {
    launch: (heistId: string, crewId: string) => void;
    collect: (id: string) => void;
    buySafehouse: () => void;
    upgradeSafehouse: (safehouseId: string) => void;
    formCrew: (safehouseId: string) => void;
    recruit: (crewId: string, roleId: string) => void;
    buyGear: (memberId: string, gearId: string) => void;
    upgradeSkill: (memberId: string) => void;
    buyUpgrade: (upgradeId: string) => void;
    dismissReport: () => void;
    save: () => void;
    reset: () => void;
  };
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [ui, dispatch] = useReducer(reducer, undefined, init);

  // Keep a ref to the latest game for event handlers (save on blur/close).
  const gameRef = useRef(ui.game);
  useEffect(() => {
    gameRef.current = ui.game;
  }, [ui.game]);

  // Persist immediately after every state change, so a crash between a collect
  // and the next save can't double-collect a heist or lose an earned take. This
  // also commits the collect roll the moment it is shown to the player.
  useEffect(() => {
    saveGame(ui.game, Date.now());
  }, [ui.game]);

  // Save on tab close/hide; settle heat when the tab becomes visible again.
  useEffect(() => {
    const save = () => saveGame(gameRef.current, Date.now());
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        save();
      } else {
        dispatch({ type: 'refreshHeat', now: Date.now() });
      }
    };
    window.addEventListener('beforeunload', save);
    window.addEventListener('blur', save);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', save);
      window.removeEventListener('blur', save);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const save = useCallback(() => {
    const { state: saved, ok } = saveGame(gameRef.current, Date.now());
    dispatch({
      type: 'replace',
      game: saved,
      message: ok ? 'Saved.' : 'Save failed — storage is full or blocked.',
    });
  }, []);

  const reset = useCallback(() => {
    if (!window.confirm('Reset the game? This clears your save permanently.')) return;
    clearSave();
    dispatch({ type: 'replace', game: createInitialState(Date.now()), message: 'Game reset.' });
  }, []);

  const actions = useMemo<GameContextValue['actions']>(
    () => ({
      launch: (heistId, crewId) =>
        dispatch({
          type: 'launch',
          heistId,
          crewId,
          now: Date.now(),
          seed: Math.floor(Math.random() * 0x100000000),
        }),
      collect: (id) => dispatch({ type: 'collect', id, now: Date.now() }),
      buySafehouse: () => dispatch({ type: 'buySafehouse' }),
      upgradeSafehouse: (safehouseId) => dispatch({ type: 'upgradeSafehouse', safehouseId }),
      formCrew: (safehouseId) => dispatch({ type: 'formCrew', safehouseId }),
      recruit: (crewId, roleId) => dispatch({ type: 'recruit', crewId, roleId }),
      buyGear: (memberId, gearId) => dispatch({ type: 'buyGear', memberId, gearId }),
      upgradeSkill: (memberId) => dispatch({ type: 'upgradeSkill', memberId }),
      buyUpgrade: (upgradeId) => dispatch({ type: 'buyUpgrade', upgradeId }),
      dismissReport: () => dispatch({ type: 'dismissReport' }),
      save,
      reset,
    }),
    [save, reset],
  );

  const value = useMemo<GameContextValue>(
    () => ({
      game: ui.game,
      message: ui.message,
      messageId: ui.messageId,
      report: ui.report,
      actions,
    }),
    [ui.game, ui.message, ui.messageId, ui.report, actions],
  );

  return (
    <GameContext.Provider value={value}>
      <NowProvider>{children}</NowProvider>
    </GameContext.Provider>
  );
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within a GameProvider');
  return ctx;
}

// -----------------------------------------------------------------------------
// Clock context: the 250ms tick lives here, isolated from game state. Only
// components that render countdowns/progress (via useNow) re-render on tick;
// everything else re-renders only when the game actually changes.
// -----------------------------------------------------------------------------

const NowContext = createContext<number>(Date.now());

function NowProvider({ children }: { children: ReactNode }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), CONFIG.uiTickMs);
    return () => window.clearInterval(id);
  }, []);
  return <NowContext.Provider value={now}>{children}</NowContext.Provider>;
}

/** Current wall-clock time (ms), updated on the UI tick. Display only. */
export function useNow(): number {
  return useContext(NowContext);
}
