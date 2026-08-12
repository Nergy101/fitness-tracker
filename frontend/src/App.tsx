import { lazy, Suspense, useCallback, useRef, useState } from "react";
import {
  BarbellIcon as Barbell,
  ChartBarIcon as ChartBar,
  ClockIcon as Clock,
  GearIcon as Gear,
  HeartbeatIcon as Heartbeat,
  PersonSimpleRunIcon as PersonSimpleRun,
  type Icon,
} from "@phosphor-icons/react";
import { api, type WorkoutTemplate } from "./api";
import WorkoutTab from "./components/WorkoutTab";
import WorkoutRunner from "./components/WorkoutRunner";
import TabataRunner from "./components/TabataRunner";
import AppSettingsModal from "./components/AppSettingsModal";
import Onboarding from "./components/Onboarding";
import LoginScreen from "./components/LoginScreen";
import { getStoredAuth, clearStoredAuth } from "./auth";
import { useTheme } from "./useTheme";
import ErrorBoundary from "./components/ErrorBoundary";
import OfflineBanner from "./components/OfflineBanner";
import UpdateBanner from "./components/UpdateBanner";
import LoadingSpinner from "./components/LoadingSpinner";
import { useHashRoute } from "./useHashRoute";
import { useOnboarding } from "./useOnboarding";
import useServiceWorkerUpdate from "./useServiceWorkerUpdate";

// Heavy tab components load on demand — only the active tab's code ships to
// the initial bundle (cuts ~40-50% of startup JS).
const ExercisesTab = lazy(() => import("./components/ExercisesTab"));
const HistoryTab = lazy(() => import("./components/HistoryTab"));
const HealthAndStatsTab = lazy(() => import("./components/HealthAndStatsTab"));
const StatsTab = lazy(() => import("./components/StatsTab"));

type TabId = "workout" | "exercises" | "history" | "health" | "stats";

interface Tab {
  id: TabId;
  label: string;
  icon: Icon;
}

const TABS: Tab[] = [
  { id: "workout", label: "Workouts", icon: Barbell },
  { id: "exercises", label: "Exercises", icon: PersonSimpleRun },
  { id: "health", label: "Health", icon: Heartbeat },
  { id: "history", label: "History", icon: Clock },
  { id: "stats", label: "Stats", icon: ChartBar },
];

const TAB_IDS: readonly TabId[] = TABS.map((t) => t.id);

export default function App() {
  // Nothing else mounts theme handling on the main screen (controls live in
  // the settings modal), so apply the persisted theme from the app root.
  useTheme();
  const { complete: onboardingComplete, markComplete } = useOnboarding();

  const [authenticated, setAuthenticated] = useState(() => {
    try {
      return !!getStoredAuth();
    } catch {
      clearStoredAuth();
      return false;
    }
  });
  const [currentTab, setCurrentTab] = useHashRoute<TabId>(TAB_IDS, "workout");
  const [runningWorkout, setRunningWorkout] = useState<WorkoutTemplate | null>(
    null,
  );
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [healthRefreshKey, setHealthRefreshKey] = useState(0);
  const touchStartX = useRef(0);
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);
  const { needRefresh, update: handleSWUpdate } = useServiceWorkerUpdate();

  const navigateTab = useCallback((dir: "left" | "right", tab: TabId) => {
    setSlideDir(dir);
    setCurrentTab(tab);
  }, [setCurrentTab]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) < 50) return;
    const idx = TAB_IDS.indexOf(currentTab);
    if (delta > 0 && idx < TAB_IDS.length - 1) {
      navigateTab("left", TAB_IDS[idx + 1]);
    } else if (delta < 0 && idx > 0) {
      navigateTab("right", TAB_IDS[idx - 1]);
    }
  };

  if (!authenticated) {
    return <LoginScreen onLogin={() => setAuthenticated(true)} />;
  }

  if (runningWorkout) {
    const Runner = runningWorkout.mode === "tabata" ? TabataRunner : WorkoutRunner;
    return (
      <div
        className="fixed inset-0 z-50"
        style={{ paddingTop: "max(env(safe-area-inset-top), 68px)" }}
      >
        <Runner
          workout={runningWorkout}
          onFinish={() => {
            setRunningWorkout(null);
            setHistoryRefreshKey((k) => k + 1);
          }}
          onCancel={() => setRunningWorkout(null)}
        />
      </div>
    );
  }

  const tabTitle = TABS.find((t) => t.id === currentTab)?.label ?? "";

  return (
    <ErrorBoundary>
      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(30px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes slide-in-left {
          from { transform: translateX(-30px); opacity: 0; }
          to   { transform: translateX(0);     opacity: 1; }
        }
        .tab-slide-right { animation: slide-in-right 200ms ease-out; }
        .tab-slide-left  { animation: slide-in-left  200ms ease-out; }
      `}</style>
      <div className="app-shell flex flex-col h-full overflow-hidden pt-[env(safe-area-inset-top)]">
        <OfflineBanner />
        {needRefresh && <UpdateBanner onUpdate={handleSWUpdate} />}
        <header className="flex h-14 shrink-0 items-center border-b border-fg/10 px-4">
          <div className="mx-auto w-full max-w-2xl flex items-center justify-between">
          <h1 className="text-lg font-bold">{tabTitle}</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-fg/40">FitnessTracker</span>
            <button
              onClick={() => setShowSettings(true)}
              aria-label="Settings"
              title="Settings"
              className="p-1.5 rounded-lg text-fg/50 hover:text-fg transition-colors"
            >
              <Gear size={20} weight="fill" />
            </button>
            <button
              onClick={() => { void api.logout(); clearStoredAuth(); setAuthenticated(false); }}
              className="text-[10px] text-fg/20 hover:text-red-400 transition-colors"
              title="Logout"
            >
              Logout
            </button>
          </div>
          </div>
        </header>

        <main
          className="min-h-0 flex-1 overflow-y-auto px-4 py-4 touch-pan-y"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className={`mx-auto w-full max-w-2xl ${slideDir ? `tab-slide-${slideDir}` : ""}`}
            key={currentTab}
            onAnimationEnd={() => setSlideDir(null)}
          >
          <Suspense
            fallback={
              <div className="py-16">
                <LoadingSpinner />
              </div>
            }
          >
          {currentTab === "workout" && (
          <WorkoutTab
          onStartWorkout={setRunningWorkout}
          onLogWorkout={() => setHistoryRefreshKey((k) => k + 1)}
          />
          )}
          {currentTab === "exercises" && <ExercisesTab />}
          {currentTab === "history" && (
            <HistoryTab refreshKey={historyRefreshKey} onStartWorkout={setRunningWorkout} />
          )}
          {currentTab === "health" && <HealthAndStatsTab key={healthRefreshKey} />}
          {currentTab === "stats" && <StatsTab />}
          </Suspense>
          </div>
        </main>

        <nav className="bottom-nav shrink-0 border-t border-fg/10 bg-surface">
          <div className="mx-auto flex h-12 w-full max-w-2xl items-center justify-around">
          {TABS.map((tab) => {
            const idx = TAB_IDS.indexOf(tab.id);
            const curIdx = TAB_IDS.indexOf(currentTab);
            const dir = idx > curIdx ? "left" : idx < curIdx ? "right" : null;
            return (
            <button
              key={tab.id}
              onClick={() => dir ? navigateTab(dir, tab.id) : setCurrentTab(tab.id)}
              aria-label={tab.label}
              className={`flex h-10 w-14 items-center justify-center rounded-full transition-colors ${
                currentTab === tab.id
                  ? "text-accent bg-accent/15"
                  : "text-fg/40"
              }`}
            >
              <tab.icon size={24} weight={currentTab === tab.id ? "fill" : "regular"} />
            </button>
          )})}
          </div>
        </nav>

        {showSettings && (
          <AppSettingsModal
            onClose={() => setShowSettings(false)}
            onHealthSaved={() => setHealthRefreshKey((k) => k + 1)}
          />
        )}

        {!onboardingComplete && <Onboarding onComplete={markComplete} />}
      </div>
    </ErrorBoundary>
  );
}