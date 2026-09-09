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
} from '../engine';

interface UIState {
  game: GameState;
  message: string | null;
  messageId: number;
}

type Action =
  | { type: 'launch'; heistId: string; crewId: string; now: number }
  | { type: 'collect'; id: string; now: number }
  | { type: 'buySafehouse' }
  | { type: 'upgradeSafehouse'; safehouseId: string }
  | { type: 'formCrew'; safehouseId: string }
  | { type: 'recruit'; crewId: string; roleId: string }
  | { type: 'buyGear'; memberId: string; gearId: string }
  | { type: 'upgradeSkill'; memberId: string }
  | { type: 'buyUpgrade'; upgradeId: string }
  | { type: 'refreshHeat'; now: number }
  | { type: 'replace'; game: GameState; message?: string };

function applyResult(ui: UIState, result: ActionResult): UIState {
  if (result.ok) {
    return {
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
      return applyResult(ui, launchHeist(ui.game, action.heistId, action.crewId, action.now));
    case 'collect':
      return applyResult(ui, collectHeist(ui.game, action.id, action.now));
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
    return { game: loaded.state, message: msg, messageId: 0 };
  }
  return { game: createInitialState(now), message: null, messageId: 0 };
}

interface GameContextValue {
  game: GameState;
  now: number;
  message: string | null;
  messageId: number;
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
    save: () => void;
    reset: () => void;
  };
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [ui, dispatch] = useReducer(reducer, undefined, init);
  const [now, setNow] = useState(() => Date.now());

  // Keep a ref to the latest game for event handlers (save on blur/close).
  const gameRef = useRef(ui.game);
  useEffect(() => {
    gameRef.current = ui.game;
  }, [ui.game]);

  // UI clock: drives countdowns/progress bars only. Not a source of truth.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), CONFIG.uiTickMs);
    return () => window.clearInterval(id);
  }, []);

  // Periodic autosave.
  useEffect(() => {
    const id = window.setInterval(() => {
      saveGame(gameRef.current, Date.now());
    }, CONFIG.autosaveIntervalMs);
    return () => window.clearInterval(id);
  }, []);

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
    const saved = saveGame(gameRef.current, Date.now());
    dispatch({ type: 'replace', game: saved, message: 'Saved.' });
  }, []);

  const reset = useCallback(() => {
    if (!window.confirm('Reset the game? This clears your save permanently.')) return;
    clearSave();
    dispatch({ type: 'replace', game: createInitialState(Date.now()), message: 'Game reset.' });
  }, []);

  const actions = useMemo<GameContextValue['actions']>(
    () => ({
      launch: (heistId, crewId) => dispatch({ type: 'launch', heistId, crewId, now: Date.now() }),
      collect: (id) => dispatch({ type: 'collect', id, now: Date.now() }),
      buySafehouse: () => dispatch({ type: 'buySafehouse' }),
      upgradeSafehouse: (safehouseId) => dispatch({ type: 'upgradeSafehouse', safehouseId }),
      formCrew: (safehouseId) => dispatch({ type: 'formCrew', safehouseId }),
      recruit: (crewId, roleId) => dispatch({ type: 'recruit', crewId, roleId }),
      buyGear: (memberId, gearId) => dispatch({ type: 'buyGear', memberId, gearId }),
      upgradeSkill: (memberId) => dispatch({ type: 'upgradeSkill', memberId }),
      buyUpgrade: (upgradeId) => dispatch({ type: 'buyUpgrade', upgradeId }),
      save,
      reset,
    }),
    [save, reset],
  );

  const value: GameContextValue = {
    game: ui.game,
    now,
    message: ui.message,
    messageId: ui.messageId,
    actions,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within a GameProvider');
  return ctx;
}
