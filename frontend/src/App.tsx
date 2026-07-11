import { useState } from "react";
import {
  BarbellIcon as Barbell,
  ChartBarIcon as ChartBar,
  GearIcon as Gear,
  HeartbeatIcon as Heartbeat,
  PersonSimpleRunIcon as PersonSimpleRun,
  type Icon,
} from "@phosphor-icons/react";
import { type WorkoutTemplate } from "./api";
import WorkoutTab from "./components/WorkoutTab";
import ExercisesTab from "./components/ExercisesTab";
import HistoryTab from "./components/HistoryTab";
import HealthAndStatsTab from "./components/HealthAndStatsTab";
import WorkoutRunner from "./components/WorkoutRunner";
import TabataRunner from "./components/TabataRunner";
import AppSettingsModal from "./components/AppSettingsModal";
import Onboarding from "./components/Onboarding";
import LoginScreen from "./components/LoginScreen";
import { getStoredAuth, clearStoredAuth } from "./auth";
import { useTheme } from "./useTheme";
import ErrorBoundary from "./components/ErrorBoundary";
import OfflineBanner from "./components/OfflineBanner";
import { useHashRoute } from "./useHashRoute";
import { useOnboarding } from "./useOnboarding";

type TabId = "workout" | "exercises" | "history" | "health";

interface Tab {
  id: TabId;
  label: string;
  icon: Icon;
}

const TABS: Tab[] = [
  { id: "workout", label: "Workouts", icon: Barbell },
  { id: "exercises", label: "Exercises", icon: PersonSimpleRun },
  { id: "history", label: "History", icon: ChartBar },
  { id: "health", label: "Health", icon: Heartbeat },
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
      <div className="app-shell flex flex-col h-screen pt-[env(safe-area-inset-top)]">
        <OfflineBanner />
        <header className="px-4 py-3 flex items-center justify-between border-b border-fg/10 shrink-0">
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
              onClick={() => { clearStoredAuth(); setAuthenticated(false); }}
              className="text-[10px] text-fg/20 hover:text-red-400 transition-colors"
              title="Logout"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-4">
          {currentTab === "workout" && (
          <WorkoutTab
          onStartWorkout={setRunningWorkout}
          onLogWorkout={() => setHistoryRefreshKey((k) => k + 1)}
          />
          )}
          {currentTab === "exercises" && <ExercisesTab />}
          {currentTab === "history" && (
            <HistoryTab refreshKey={historyRefreshKey} />
          )}
          {currentTab === "health" && <HealthAndStatsTab key={healthRefreshKey} />}
        </main>

        <nav className="bottom-nav flex items-center justify-around border-t border-fg/10 bg-surface px-2 py-2 pb-[calc(env(safe-area-inset-bottom,0px)+8px)] shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
                currentTab === tab.id ? "text-accent" : "text-fg/40"
              }`}
            >
              <tab.icon size={24} weight={currentTab === tab.id ? "fill" : "regular"} />
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          ))}
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