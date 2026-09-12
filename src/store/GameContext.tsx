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
  awardMilestones,
  buyGear,
  buyPerk,
  buySafehouse,
  buyUpgrade,
  claimDaily,
  clearSave,
  collectAllReady,
  collectHeist,
  createInitialState,
  finishAllNow,
  formCrew,
  grantMarks,
  launchHeist,
  loadGame,
  prestige,
  recruitMember,
  refreshHeat,
  resolveOffline,
  rewardBonusCash,
  saveGame,
  skipCooldown,
  upgradeSafehouse,
  upgradeSkill,
  type ActionResult,
  type GameState,
  type HeistReport,
} from '../engine';
import { formatCash } from '../engine/format';

/** A one-shot signal for the juice/sound layer. `eventId` makes each one unique. */
export type GameEvent =
  | { kind: 'launch' }
  | { kind: 'collect'; payout: number; success: boolean; flawless: boolean }
  | { kind: 'purchase' }
  | { kind: 'prestige' }
  | { kind: 'error' };

/** What happened while the player was away, shown once on return. */
export interface AwaySummary {
  awayMs: number;
  readyCount: number;
  autoCollected: number;
  autoEarned: number;
}

interface UIState {
  game: GameState;
  message: string | null;
  messageId: number;
  report: HeistReport | null;
  event: GameEvent | null;
  eventId: number;
  away: AwaySummary | null;
}

type Action =
  | { type: 'launch'; heistId: string; crewId: string; now: number; seed: number }
  | { type: 'collect'; id: string; now: number }
  | { type: 'collectAll'; now: number }
  | { type: 'buySafehouse' }
  | { type: 'upgradeSafehouse'; safehouseId: string }
  | { type: 'formCrew'; safehouseId: string }
  | { type: 'recruit'; crewId: string; roleId: string }
  | { type: 'buyGear'; memberId: string; gearId: string }
  | { type: 'upgradeSkill'; memberId: string }
  | { type: 'buyUpgrade'; upgradeId: string }
  | { type: 'prestige'; now: number }
  | { type: 'claimDaily'; now: number }
  | { type: 'buyPerk'; perkId: string }
  | { type: 'grantMarks'; amount: number }
  | { type: 'rewardBonusCash'; amount: number }
  | { type: 'skipCooldown'; id: string; now: number }
  | { type: 'finishAll'; now: number }
  | { type: 'dev'; op: 'cash' | 'notoriety' | 'finish' | 'ff'; amount?: number; now: number }
  | { type: 'refreshHeat'; now: number }
  | { type: 'dismissReport' }
  | { type: 'dismissAway' }
  | { type: 'replace'; game: GameState; message?: string };

function applyResult(ui: UIState, result: ActionResult, okEvent?: GameEvent): UIState {
  if (result.ok) {
    const { state, earned } = awardMilestones(result.state);
    // Keep the action's own message (e.g. the "+$ collected" toast) and append
    // any milestone that fired on the same tick, rather than clobbering it.
    const milestoneMsg = earned.length
      ? `Milestone: ${earned.map((m) => m.name).join(', ')}`
      : null;
    const message = milestoneMsg
      ? result.message
        ? `${result.message} · ${milestoneMsg}`
        : milestoneMsg
      : (result.message ?? ui.message);
    const event = okEvent ?? null;
    return {
      ...ui,
      game: state,
      message,
      messageId: ui.messageId + 1,
      event,
      eventId: event ? ui.eventId + 1 : ui.eventId,
    };
  }
  return {
    ...ui,
    message: result.error,
    messageId: ui.messageId + 1,
    event: { kind: 'error' },
    eventId: ui.eventId + 1,
  };
}

function reducer(ui: UIState, action: Action): UIState {
  switch (action.type) {
    case 'launch':
      return applyResult(
        ui,
        launchHeist(ui.game, action.heistId, action.crewId, action.now, action.seed),
        { kind: 'launch' },
      );
    case 'collect': {
      const res = collectHeist(ui.game, action.id, action.now);
      const event: GameEvent | undefined =
        res.ok && res.report
          ? {
              kind: 'collect',
              payout: res.report.payout,
              success: res.report.success,
              flawless: res.report.perfect,
            }
          : undefined;
      const nextUi = applyResult(ui, res, event);
      return { ...nextUi, report: res.ok && res.report ? res.report : ui.report };
    }
    case 'collectAll': {
      const { state, collected, earned } = collectAllReady(ui.game, action.now);
      if (collected === 0) {
        return { ...ui, message: 'Nothing ready to collect.', messageId: ui.messageId + 1 };
      }
      return applyResult(
        ui,
        {
          ok: true,
          state,
          message: `Collected ${collected} job${collected > 1 ? 's' : ''} · +${formatCash(earned)}`,
        },
        { kind: 'collect', payout: earned, success: true, flawless: false },
      );
    }
    case 'grantMarks':
      return applyResult(ui, grantMarks(ui.game, action.amount), { kind: 'purchase' });
    case 'rewardBonusCash':
      return applyResult(ui, rewardBonusCash(ui.game, action.amount), {
        kind: 'collect',
        payout: action.amount,
        success: true,
        flawless: false,
      });
    case 'skipCooldown':
      return applyResult(ui, skipCooldown(ui.game, action.id, action.now), { kind: 'purchase' });
    case 'finishAll':
      return applyResult(ui, finishAllNow(ui.game, action.now), { kind: 'purchase' });
    case 'dismissReport':
      return { ...ui, report: null };
    case 'dismissAway':
      return { ...ui, away: null };
    case 'buySafehouse':
      return applyResult(ui, buySafehouse(ui.game), { kind: 'purchase' });
    case 'upgradeSafehouse':
      return applyResult(ui, upgradeSafehouse(ui.game, action.safehouseId), { kind: 'purchase' });
    case 'formCrew':
      return applyResult(ui, formCrew(ui.game, action.safehouseId), { kind: 'purchase' });
    case 'recruit':
      return applyResult(ui, recruitMember(ui.game, action.crewId, action.roleId), { kind: 'purchase' });
    case 'buyGear':
      return applyResult(ui, buyGear(ui.game, action.memberId, action.gearId), { kind: 'purchase' });
    case 'upgradeSkill':
      return applyResult(ui, upgradeSkill(ui.game, action.memberId), { kind: 'purchase' });
    case 'buyUpgrade':
      return applyResult(ui, buyUpgrade(ui.game, action.upgradeId), { kind: 'purchase' });
    case 'prestige':
      return applyResult(ui, prestige(ui.game, action.now), { kind: 'prestige' });
    case 'buyPerk':
      return applyResult(ui, buyPerk(ui.game, action.perkId), { kind: 'purchase' });
    case 'claimDaily': {
      const res = claimDaily(ui.game, action.now);
      if (!res.ok) {
        return {
          ...ui,
          message: res.error,
          messageId: ui.messageId + 1,
          event: { kind: 'error' },
          eventId: ui.eventId + 1,
        };
      }
      return applyResult(
        ui,
        {
          ok: true,
          state: res.state,
          message: `Daily reward · +${formatCash(res.reward)} (day ${res.streak} streak)`,
        },
        { kind: 'collect', payout: res.reward, success: true, flawless: false },
      );
    }
    case 'dev': {
      // Dev/test helpers (only reachable from the ?dev=1 panel).
      const g = ui.game;
      const amt = action.amount ?? 0;
      let state = g;
      let message = 'dev';
      switch (action.op) {
        case 'cash':
          state = { ...g, cash: g.cash + amt, lifetimeCash: g.lifetimeCash + amt, careerCash: g.careerCash + amt };
          message = `+${formatCash(amt)} (dev)`;
          break;
        case 'notoriety':
          state = { ...g, notoriety: g.notoriety + amt };
          message = `+${amt} Notoriety (dev)`;
          break;
        case 'finish':
          state = { ...g, activeHeists: g.activeHeists.map((a) => ({ ...a, endsAt: action.now })) };
          message = 'Active jobs finished (dev)';
          break;
        case 'ff': {
          // Simulate having been away `amt` ms: shift timestamps back, then run
          // the real offline resolution (so heat cools and the Fixer fires).
          const shifted: GameState = {
            ...g,
            heatUpdatedAt: g.heatUpdatedAt - amt,
            lastSaved: g.lastSaved - amt,
            activeHeists: g.activeHeists.map((a) => ({
              ...a,
              startedAt: a.startedAt - amt,
              endsAt: a.endsAt - amt,
            })),
          };
          const summary = resolveOffline(shifted, action.now);
          state = summary.state;
          message =
            summary.autoCollected > 0
              ? `Fixer ran ${summary.autoCollected} job(s) (dev)`
              : 'Fast-forwarded (dev)';
          break;
        }
      }
      return applyResult(ui, { ok: true, state, message });
    }
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
    // Show a "while you were away" summary whenever something actually happened
    // (a heist finished, or the Fixer collected) — for everyone, not just Fixer
    // owners. A quick reload with nothing pending shows nothing.
    const away: AwaySummary | null =
      loaded.autoCollected > 0 || loaded.readyCount > 0
        ? {
            awayMs: loaded.awayMs,
            readyCount: loaded.readyCount,
            autoCollected: loaded.autoCollected,
            autoEarned: loaded.autoEarned,
          }
        : null;
    return { game: loaded.state, message: null, messageId: 0, report: null, event: null, eventId: 0, away };
  }
  return { game: createInitialState(now), message: null, messageId: 0, report: null, event: null, eventId: 0, away: null };
}

interface GameContextValue {
  game: GameState;
  message: string | null;
  messageId: number;
  report: HeistReport | null;
  event: GameEvent | null;
  eventId: number;
  away: AwaySummary | null;
  actions: {
    launch: (heistId: string, crewId: string) => void;
    collect: (id: string) => void;
    collectAll: () => void;
    buySafehouse: () => void;
    upgradeSafehouse: (safehouseId: string) => void;
    formCrew: (safehouseId: string) => void;
    recruit: (crewId: string, roleId: string) => void;
    buyGear: (memberId: string, gearId: string) => void;
    upgradeSkill: (memberId: string) => void;
    buyUpgrade: (upgradeId: string) => void;
    prestige: () => void;
    claimDaily: () => void;
    buyPerk: (perkId: string) => void;
    grantMarks: (amount: number) => void;
    rewardBonusCash: (amount: number) => void;
    skipCooldown: (id: string) => void;
    finishAll: () => void;
    dismissReport: () => void;
    dismissAway: () => void;
    dev: (op: 'cash' | 'notoriety' | 'finish' | 'ff', amount?: number) => void;
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
      collectAll: () => dispatch({ type: 'collectAll', now: Date.now() }),
      buySafehouse: () => dispatch({ type: 'buySafehouse' }),
      upgradeSafehouse: (safehouseId) => dispatch({ type: 'upgradeSafehouse', safehouseId }),
      formCrew: (safehouseId) => dispatch({ type: 'formCrew', safehouseId }),
      recruit: (crewId, roleId) => dispatch({ type: 'recruit', crewId, roleId }),
      buyGear: (memberId, gearId) => dispatch({ type: 'buyGear', memberId, gearId }),
      upgradeSkill: (memberId) => dispatch({ type: 'upgradeSkill', memberId }),
      buyUpgrade: (upgradeId) => dispatch({ type: 'buyUpgrade', upgradeId }),
      prestige: () => dispatch({ type: 'prestige', now: Date.now() }),
      claimDaily: () => dispatch({ type: 'claimDaily', now: Date.now() }),
      buyPerk: (perkId) => dispatch({ type: 'buyPerk', perkId }),
      grantMarks: (amount) => dispatch({ type: 'grantMarks', amount }),
      rewardBonusCash: (amount) => dispatch({ type: 'rewardBonusCash', amount }),
      skipCooldown: (id) => dispatch({ type: 'skipCooldown', id, now: Date.now() }),
      finishAll: () => dispatch({ type: 'finishAll', now: Date.now() }),
      dismissReport: () => dispatch({ type: 'dismissReport' }),
      dismissAway: () => dispatch({ type: 'dismissAway' }),
      dev: (op, amount) => dispatch({ type: 'dev', op, amount, now: Date.now() }),
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
      event: ui.event,
      eventId: ui.eventId,
      away: ui.away,
      actions,
    }),
    [ui.game, ui.message, ui.messageId, ui.report, ui.event, ui.eventId, ui.away, actions],
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
