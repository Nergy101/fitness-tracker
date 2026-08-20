import { useState } from "react";
import { DownloadSimpleIcon as DownloadSimple } from "@phosphor-icons/react";
import { api, OfflineError } from "../api";

const EXPORT_ENTITIES: { entity: string; label: string }[] = [
  { entity: "sessions", label: "Workout sessions" },
  { entity: "weights", label: "Weight entries" },
  { entity: "runs", label: "Runs & walks" },
  { entity: "boxing", label: "Boxing" },
  { entity: "cycling", label: "Cycling" },
  { entity: "measurements", label: "Body measurements" },
  { entity: "wellness", label: "Wellness check-ins" },
  { entity: "injuries", label: "Injuries" },
];

export default function ExportSection() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleExport = async (entity: string, label: string) => {
    setDownloading(entity);
    try {
      await api.downloadExport(entity);
      setMessage(`${label} exported as CSV.`);
    } catch (e: unknown) {
      if (e instanceof OfflineError) {
        setMessage("Export unavailable while offline.");
      } else {
        setMessage(e instanceof Error ? e.message : "Export failed");
      }
    } finally {
      setDownloading(null);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-fg/40">
        Download your data as CSV for analysis or migration.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {EXPORT_ENTITIES.map(({ entity, label }) => (
          <button
            key={entity}
            onClick={() => handleExport(entity, label)}
            disabled={downloading !== null}
            aria-label={`Export ${label}`}
            className="flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-bg border border-fg/10 text-fg/70 hover:text-fg hover:border-accent/30 transition-colors disabled:opacity-50"
          >
            <DownloadSimple size={14} weight="bold" />
            {downloading === entity ? "..." : label}
          </button>
        ))}
      </div>
      {message && (
        <p className="text-xs text-accent bg-accent/5 rounded-lg px-3 py-2">
          {message}
        </p>
      )}
    </div>
  );
}
