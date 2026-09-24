import { lazy, Suspense } from 'react';
import { GameProvider } from '../store/GameContext';
import { ActiveHeists } from './components/ActiveHeists';
import { AscensionPanel } from './components/AscensionPanel';
import { CoachTips } from './components/CoachTips';
import { DailyRewardBanner } from './components/DailyRewardBanner';
import { HeistList } from './components/HeistList';
import { MilestonesPanel } from './components/MilestonesPanel';
import { OnboardingBanner } from './components/OnboardingBanner';
import { PremiumPanel } from './components/PremiumPanel';
import { PrestigePanel } from './components/PrestigePanel';
import { ReportModal } from './components/ReportModal';
import { ResourceBar } from './components/ResourceBar';
import { SafehousePanel } from './components/SafehousePanel';
import { SoundFx } from './components/SoundFx';
import { TabTitle } from './components/TabTitle';
import { Toast } from './components/Toast';
import { TopBar } from './components/TopBar';
import { UpgradePanel } from './components/UpgradePanel';
import { WelcomeBackModal } from './components/WelcomeBackModal';
import { MapView } from './map/MapView';

// The dev/cheat panel (?dev=1) is DEV-only: gated behind import.meta.env.DEV so
// it is never reachable AND is tree-shaken out of production bundles entirely
// (the dynamic import lives in a branch the bundler drops when DEV is false).
const DevPanel = import.meta.env.DEV
  ? lazy(() => import('./components/DevPanel').then((m) => ({ default: m.DevPanel })))
  : null;

/** The original panel-based layout, kept reachable at ?classic=1 during the
 *  map-first port so nothing is lost while the new UI is built out. */
function ClassicLayout() {
  return (
    <div className="app">
      <TopBar />
      <ResourceBar />
      <OnboardingBanner />
      <DailyRewardBanner />
      <CoachTips />

      <main className="layout">
        <div className="col col-main">
          <SafehousePanel />
          <UpgradePanel />
          <PrestigePanel />
          <AscensionPanel />
          <MilestonesPanel />
          <PremiumPanel />
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
    </div>
  );
}

function useClassicMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has('classic');
}

export default function App() {
  const classic = useClassicMode();
  return (
    <GameProvider>
      {classic ? <ClassicLayout /> : <MapView />}

      {/* Shared overlays — work with either layout. The after-action debrief is
          skinned per layout: the classic modal here, the noir NoirReport inside
          MapView, so only one renders. */}
      <Toast />
      {classic && <ReportModal />}
      <WelcomeBackModal />
      {DevPanel && (
        <Suspense fallback={null}>
          <DevPanel />
        </Suspense>
      )}
      <SoundFx />
      <TabTitle />
    </GameProvider>
  );
}
