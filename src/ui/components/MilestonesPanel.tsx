import { MILESTONES } from '../../data/milestones';
import { useGame } from '../../store/GameContext';
import { formatCash } from '../format';
import { Icon } from '../icons';

function rewardText(reward?: { cash?: number; notoriety?: number }): string {
  if (!reward) return '';
  if (reward.cash) return `+${formatCash(reward.cash)}`;
  if (reward.notoriety) return `+${reward.notoriety} Notoriety`;
  return '';
}

export function MilestonesPanel() {
  const { game } = useGame();
  const earned = game.milestonesEarned;
  const earnedCount = MILESTONES.filter((m) => earned.includes(m.id)).length;

  return (
    <section className="panel">
      <h2 className="panel-title">
        <span className="panel-ico">
          <Icon name="trophy" size={17} />
        </span>
        Milestones
        <span className="milestone-count">
          {earnedCount}/{MILESTONES.length}
        </span>
      </h2>
      <div className="milestone-list">
        {MILESTONES.map((m) => {
          const done = earned.includes(m.id);
          return (
            <div className={`milestone ${done ? 'done' : ''}`} key={m.id}>
              <span className="milestone-mark">{done ? '★' : '☆'}</span>
              <div className="milestone-body">
                <span className="milestone-name">{m.name}</span>
                <span className="milestone-desc">{m.description}</span>
              </div>
              <span className="milestone-reward">{rewardText(m.reward)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
