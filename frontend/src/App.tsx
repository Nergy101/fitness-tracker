import { useState } from "react";
import {
  Barbell,
  ChartBar,
  Moon,
  PersonSimpleRun,
  Sun,
  type Icon,
} from "@phosphor-icons/react";
import { type WorkoutTemplate } from "./api";
import { useTheme } from "./useTheme";
import WorkoutTab from "./components/WorkoutTab";
import ExercisesTab from "./components/ExercisesTab";
import HistoryTab from "./components/HistoryTab";
import WorkoutRunner from "./components/WorkoutRunner";

type TabId = "workout" | "exercises" | "history";

interface Tab {
  id: TabId;
  label: string;
  icon: Icon;
}

const TABS: Tab[] = [
  { id: "workout", label: "Workout", icon: Barbell },
  { id: "exercises", label: "Exercises", icon: PersonSimpleRun },
  { id: "history", label: "History", icon: ChartBar },
];

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [currentTab, setCurrentTab] = useState<TabId>("workout");
  const [runningWorkout, setRunningWorkout] = useState<WorkoutTemplate | null>(
    null,
  );
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  if (runningWorkout) {
    return (
      <div className="fixed inset-0 z-50">
        <WorkoutRunner
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
    <div className="app-shell flex flex-col h-screen">
      <header className="px-4 py-3 flex items-center justify-between border-b border-fg/10 shrink-0">
        <h1 className="text-lg font-bold">{tabTitle}</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-fg/40">FitnessTracker</span>
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="text-fg/50 hover:text-fg transition-colors p-1 rounded-lg"
          >
            {theme === "dark" ? <Sun size={20} weight="fill" /> : <Moon size={20} weight="fill" />}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4">
        {currentTab === "workout" && (
          <WorkoutTab onStartWorkout={setRunningWorkout} />
        )}
        {currentTab === "exercises" && <ExercisesTab />}
        {currentTab === "history" && (
          <HistoryTab refreshKey={historyRefreshKey} />
        )}
      </main>

      <nav className="bottom-nav flex items-center justify-around border-t border-fg/10 bg-surface px-2 py-2 shrink-0">
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
    </div>
  );
}
