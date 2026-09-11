import { GameProvider } from '../store/GameContext';
import { ActiveHeists } from './components/ActiveHeists';
import { DailyRewardBanner } from './components/DailyRewardBanner';
import { HeistList } from './components/HeistList';
import { DevPanel } from './components/DevPanel';
import { MilestonesPanel } from './components/MilestonesPanel';
import { OnboardingBanner } from './components/OnboardingBanner';
import { PrestigePanel } from './components/PrestigePanel';
import { ReportModal } from './components/ReportModal';
import { ResourceBar } from './components/ResourceBar';
import { SafehousePanel } from './components/SafehousePanel';
import { ScreenShake } from './components/ScreenShake';
import { SoundFx } from './components/SoundFx';
import { TabTitle } from './components/TabTitle';
import { Toast } from './components/Toast';
import { TopBar } from './components/TopBar';
import { UpgradePanel } from './components/UpgradePanel';
import { WelcomeBackModal } from './components/WelcomeBackModal';

export default function App() {
  return (
    <GameProvider>
      <ScreenShake>
        <div className="app">
          <TopBar />
          <ResourceBar />
          <OnboardingBanner />
          <DailyRewardBanner />

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
        </div>
      </ScreenShake>

      {/* Fixed overlays live OUTSIDE ScreenShake: a transform on the shake
          wrapper would otherwise become their containing block and yank them
          off-screen during the shake. */}
      <Toast />
      <ReportModal />
      <WelcomeBackModal />
      <DevPanel />
      <SoundFx />
      <TabTitle />
    </GameProvider>
  );
}
