import { useState, useEffect, useCallback } from "react";
import {
  Download as DownloadSimple,
  ArrowDottedRotateAnticlockwise as ArrowCounterClockwise,
} from "reicon-react";
import { api, type BackupConfigResponse, type BackupFileResponse, type BackupResultResponse } from "../api";

const SEGMENT_ON = "bg-accent/15 border-accent/30 text-accent";
const SEGMENT_OFF = "border-fg/10 text-fg/40 hover:text-fg/70";
const SEGMENT =
  "flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-2 py-2 rounded-lg border transition-colors ";

const INTERVAL_OPTIONS = [
  { value: "disabled", label: "Off" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(iso: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export default function BackupSection() {
  const [config, setConfig] = useState<BackupConfigResponse | null>(null);
  const [backups, setBackups] = useState<BackupFileResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [cfg, bkps] = await Promise.all([api.getBackupConfig(), api.listBackups()]);
      setConfig(cfg);
      setBackups(bkps);
    } catch {
      // offline / backend not available
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleIntervalChange = async (interval: string) => {
    if (!config) return;
    const updated = await api.updateBackupConfig({ interval });
    setConfig(updated);
  };

  const handleBackup = async () => {
    setLoading(true);
    try {
      const result: BackupResultResponse = await api.createBackup();
      showMsg(`Backup created: ${result.filename} (${formatBytes(result.size_bytes)})`);
      loadData();
    } catch (e: unknown) {
      showMsg(e instanceof Error ? e.message : "Backup failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (filename: string) => {
    setLoading(true);
    setRestoreTarget(null);
    try {
      const result = await api.restoreBackup(filename);
      showMsg(`Restored from ${filename}. Safety backup: ${result.safety_backup}`);
      loadData();
    } catch (e: unknown) {
      showMsg(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setLoading(false);
    }
  };

  const showMsg = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 4000);
  };

  if (!config) return null;

  return (
    <div className="space-y-3">
      {/* Location (read-only from settings.toml) */}
      <p className="text-xs text-fg/30">
        Saving to: <span className="text-fg/50 font-mono">{config.location}</span>
      </p>

      {/* Interval */}
      <div className="flex gap-1.5">
        {INTERVAL_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleIntervalChange(opt.value)}
            aria-label={`Backup ${opt.label}`}
            aria-pressed={config.interval === opt.value}
            className={SEGMENT + (config.interval === opt.value ? SEGMENT_ON : SEGMENT_OFF)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Manual backup */}
      <div className="flex gap-2 items-center">
        <button
          onClick={handleBackup}
          disabled={loading}
          aria-label="Backup now"
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
        >
          <DownloadSimple size={14} weight="Outline" strokeWidth={2} />
          Backup Now
        </button>
        {config.last_backup && (
          <span className="text-[10px] text-fg/30">
            Last: {formatTimestamp(config.last_backup)}
          </span>
        )}
      </div>

      {message && (
        <p className="text-xs text-accent bg-accent/5 rounded-lg px-3 py-2">{message}</p>
      )}

      {/* Restore */}
      {backups.length > 0 && (
        <div className="border-t border-fg/10 pt-3">
          <p className="text-xs text-fg/40 mb-2">Restore from Backup</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {backups.map((b) => (
              <div
                key={b.filename}
                className="flex items-center justify-between bg-bg rounded-lg px-3 py-2 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-fg/80 truncate">{b.filename}</p>
                  <p className="text-fg/30">
                    {formatTimestamp(b.created_at)} · {formatBytes(b.size_bytes)}
                    {" · "}{Object.values(b.table_counts).reduce((a, c) => a + c, 0)} records
                  </p>
                </div>
                {restoreTarget === b.filename ? (
                  <div className="flex gap-1.5 shrink-0 ml-2">
                    <button
                      onClick={() => handleRestore(b.filename)}
                      aria-label="Confirm restore"
                      className="text-[10px] font-medium px-2 py-1 rounded bg-red-500/20 text-red-400"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setRestoreTarget(null)}
                      aria-label="Cancel restore"
                      className="text-[10px] font-medium px-2 py-1 rounded bg-fg/10 text-fg/50"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setRestoreTarget(b.filename)}
                    aria-label={`Restore from ${b.filename}`}
                    className="shrink-0 ml-2 text-fg/30 hover:text-accent transition-colors"
                  >
                    <ArrowCounterClockwise size={14} weight="Outline" strokeWidth={2} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}