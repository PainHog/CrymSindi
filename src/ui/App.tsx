import { GameProvider } from '../store/GameContext';
import { ActiveHeists } from './components/ActiveHeists';
import { HeistList } from './components/HeistList';
import { DevPanel } from './components/DevPanel';
import { MilestonesPanel } from './components/MilestonesPanel';
import { PrestigePanel } from './components/PrestigePanel';
import { ReportModal } from './components/ReportModal';
import { ResourceBar } from './components/ResourceBar';
import { SafehousePanel } from './components/SafehousePanel';
import { Toast } from './components/Toast';
import { TopBar } from './components/TopBar';
import { UpgradePanel } from './components/UpgradePanel';

export default function App() {
  return (
    <GameProvider>
      <div className="app">
        <TopBar />
        <ResourceBar />

        <main className="layout">
          <div className="col col-main">
            <SafehousePanel />
            <UpgradePanel />
            <PrestigePanel />
            <MilestonesPanel />
          </div>
          <div className="col col-side">
            <ActiveHeists />
            <HeistList />
          </div>
        </main>

        <footer className="footer">
          <p>
            Active idle heist management · progress is resolved from real timestamps · a proof of
            concept build.
          </p>
        </footer>

        <Toast />
        <ReportModal />
        <DevPanel />
      </div>
    </GameProvider>
  );
}
