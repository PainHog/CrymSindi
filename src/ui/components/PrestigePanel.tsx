import { CONFIG } from '../../data/config';
import { canPrestige, notorietyGainFor, notorietyMult, notorietySkillBonus } from '../../engine';
import { useGame } from '../../store/GameContext';
import { formatCash, pct } from '../format';
import { Icon } from '../icons';

export function PrestigePanel() {
  const { game, actions } = useGame();
  const can = canPrestige(game);
  const gain = notorietyGainFor(game.lifetimeCash);
  const bonusTake = pct(notorietyMult(game) - 1);
  const bonusPower = notorietySkillBonus(game).toFixed(1);

  const onRetire = () => {
    if (!can) return;
    const ok = window.confirm(
      `Go legit? This wipes your cash, crews, safehouses and heist tiers, and grants +${gain} Notoriety (permanent). Career stats, contract progress and milestones are kept.`,
    );
    if (ok) actions.prestige();
  };

  return (
    <section className="panel prestige-panel">
      <h2 className="panel-title">
        <span className="panel-ico">
          <Icon name="crown" size={17} />
        </span>
        Go legit
      </h2>
      <p className="prestige-blurb">
        Retire the operation for permanent <strong>Notoriety</strong>, then spend it in the{' '}
        <strong>Notoriety</strong> tree below on perks that last across every future run — more
        take, sharper crews, kept upgrades. The further you push each run, the more you bank.
      </p>

      <div className="prestige-stats">
        <div className="pstat">
          <span className="pstat-label">Notoriety</span>
          <span className="pstat-value">{game.notoriety}</span>
        </div>
        <div className="pstat">
          <span className="pstat-label">Retirements</span>
          <span className="pstat-value">{game.prestigeCount}</span>
        </div>
        <div className="pstat">
          <span className="pstat-label">Current bonus</span>
          <span className="pstat-value">
            +{bonusTake} · +{bonusPower} power
          </span>
        </div>
      </div>

      <button className="btn primary block" disabled={!can} onClick={onRetire}>
        {can
          ? `Retire crew — bank +${gain} Notoriety`
          : `Unlocks at ${formatCash(CONFIG.prestigeThreshold)} lifetime take (you have ${formatCash(game.lifetimeCash, 'floor')})`}
      </button>
    </section>
  );
}
