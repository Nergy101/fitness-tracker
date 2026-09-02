// Backup/restore config and file types and methods.

import { fetchJSON } from "./client";

export interface BackupConfigResponse {
  location: string;
  interval: string;
  last_backup: string | null;
}

export interface BackupConfigUpdate {
  interval?: string | null;
}

export interface BackupResultResponse {
  filename: string;
  path: string;
  size_bytes: number;
  table_counts: Record<string, number>;
}

export interface BackupFileResponse {
  filename: string;
  size_bytes: number;
  created_at: string;
  table_counts: Record<string, number>;
}

export const backupApi = {
  getBackupConfig: () =>
    fetchJSON<BackupConfigResponse>("/api/v1/settings/backup"),
  updateBackupConfig: (data: BackupConfigUpdate) =>
    fetchJSON<BackupConfigResponse>("/api/v1/settings/backup", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  createBackup: () =>
    fetchJSON<BackupResultResponse>("/api/v1/backup", { method: "POST" }),
  listBackups: () =>
    fetchJSON<BackupFileResponse[]>("/api/v1/backups"),
  restoreBackup: (filename: string) =>
    fetchJSON<{ status: string; safety_backup: string; table_counts: Record<string, number> }>(
      "/api/v1/backup/restore",
      { method: "POST", body: JSON.stringify({ filename }) },
    ),
  deleteBackup: (filename: string) =>
    fetchJSON<{ status: string; filename: string }>(
      `/api/v1/backups/${encodeURIComponent(filename)}`,
      { method: "DELETE" },
    ),
};
