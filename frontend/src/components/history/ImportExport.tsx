import { useRef, useState } from "react";
import {
  Download as DownloadSimple,
  Upload as UploadSimple,
} from "reicon-react";
import {
  api,
  type SessionExerciseInput,
  type WorkoutSession,
  type WorkoutSessionInput,
} from "../../api";

// Bump when the export shape changes so future imports can migrate old files.
const HISTORY_EXPORT_VERSION = 1;

// Convert one raw imported object into a session payload, tolerating partial
// data (external JSON is untrusted). Returns null when it isn't session-shaped.
function toSessionInput(raw: unknown): WorkoutSessionInput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.template_name !== "string") return null;

  const exercisesRaw = Array.isArray(o.exercises) ? o.exercises : [];
  const exercises: SessionExerciseInput[] = exercisesRaw.map((e, i) => {
    const ex = (e && typeof e === "object" ? e : {}) as Record<string, unknown>;
    return {
      exercise_id: typeof ex.exercise_id === "number" ? ex.exercise_id : null,
      exercise_name: typeof ex.exercise_name === "string" ? ex.exercise_name : "",
      duration_seconds: typeof ex.duration_seconds === "number" ? ex.duration_seconds : 0,
      kcal_burned: typeof ex.kcal_burned === "number" ? ex.kcal_burned : 0,
      order_index: typeof ex.order_index === "number" ? ex.order_index : i,
      completed: ex.completed !== false,
    };
  });

  return {
    template_id: typeof o.template_id === "number" ? o.template_id : null,
    template_name: o.template_name,
    total_duration_seconds:
      typeof o.total_duration_seconds === "number" ? o.total_duration_seconds : 0,
    total_kcal_estimated:
      typeof o.total_kcal_estimated === "number" ? o.total_kcal_estimated : 0,
    exercises,
    started_at: typeof o.started_at === "string" ? o.started_at : null,
    finished_at: typeof o.finished_at === "string" ? o.finished_at : null,
  };
}

/** JSON import/export of the full session history. */
export default function ImportExport({
  sessions,
  onImported,
  onError,
}: {
  sessions: WorkoutSession[];
  onImported: (sessions: WorkoutSession[]) => void;
  onError: (message: string) => void;
}) {
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function exportSessions() {
    const payload = {
      version: HISTORY_EXPORT_VERSION,
      exported_at: new Date().toISOString(),
      sessions,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fitness-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importSessions(file: File) {
    setImporting(true);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      // Accept the versioned envelope { version, sessions: [...] } or a bare
      // array (pre-versioning exports).
      let rows: unknown[] = [];
      if (Array.isArray(parsed)) {
        rows = parsed;
      } else if (parsed && typeof parsed === "object") {
        const env = parsed as Record<string, unknown>;
        if (Array.isArray(env.sessions)) rows = env.sessions;
      }
      const payloads = rows
        .map(toSessionInput)
        .filter((p): p is WorkoutSessionInput => p !== null);
      if (payloads.length === 0) {
        onError("No valid sessions found in that file.");
        return;
      }
      for (const p of payloads) {
        await api.createSession(p);
      }
      onImported(await api.getSessions());
    } catch {
      onError("Could not import that file.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex gap-2 mt-2">
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={importing}
        className="flex-1 flex items-center justify-center gap-1.5 text-sm text-fg/60 hover:text-fg border border-fg/10 rounded-xl py-3 transition-colors disabled:opacity-50"
      >
        <UploadSimple size={16} weight="Outline" strokeWidth={2} />
        {importing ? "Importing..." : "Import"}
      </button>
      <button
        onClick={exportSessions}
        disabled={sessions.length === 0}
        className="flex-1 flex items-center justify-center gap-1.5 text-sm text-fg/60 hover:text-fg border border-fg/10 rounded-xl py-3 transition-colors disabled:opacity-50"
      >
        <DownloadSimple size={16} weight="Outline" strokeWidth={2} />
        Export
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importSessions(file);
          e.target.value = ""; // allow re-importing the same file
        }}
      />
    </div>
  );
}
