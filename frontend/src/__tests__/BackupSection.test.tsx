import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import BackupSection from "../components/BackupSection";

const mockGetBackupConfig = vi.fn();
const mockListBackups = vi.fn();
const mockUpdateBackupConfig = vi.fn();
const mockCreateBackup = vi.fn();
const mockRestoreBackup = vi.fn();
const mockDeleteBackup = vi.fn();

vi.mock("../api", () => ({
  OfflineError: class OfflineError extends Error {
    readonly offline = true;
  },
  api: {
    getBackupConfig: (...args: unknown[]) => mockGetBackupConfig(...args),
    listBackups: (...args: unknown[]) => mockListBackups(...args),
    updateBackupConfig: (...args: unknown[]) => mockUpdateBackupConfig(...args),
    createBackup: (...args: unknown[]) => mockCreateBackup(...args),
    restoreBackup: (...args: unknown[]) => mockRestoreBackup(...args),
    deleteBackup: (...args: unknown[]) => mockDeleteBackup(...args),
  },
}));

const baseConfig = {
  location: "/data/backups",
  interval: "daily",
  last_backup: null,
};

const backups = [
  {
    filename: "backup-2026-07-01.json",
    created_at: "2026-07-01T08:00:00Z",
    size_bytes: 2048,
    table_counts: { workout_sessions: 5, weights: 3 },
  },
  {
    filename: "backup-2026-07-02.json",
    created_at: "2026-07-02T08:00:00Z",
    size_bytes: 4096,
    table_counts: { workout_sessions: 7, weights: 4 },
  },
];

describe("BackupSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBackupConfig.mockResolvedValue({ ...baseConfig });
    mockListBackups.mockResolvedValue(backups.map((b) => ({ ...b })));
  });

  it("renders null while config is not yet loaded", () => {
    mockGetBackupConfig.mockReturnValue(new Promise(() => {}));
    const { container } = render(<BackupSection />);
    expect(container.firstChild).toBeNull();
  });

  it("renders backup location and interval options", async () => {
    render(<BackupSection />);
    expect(await screen.findByText("/data/backups")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Backup Off" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Backup Daily" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Backup Weekly" })).toBeInTheDocument();
  });

  it("renders the backup list with filenames and sizes", async () => {
    render(<BackupSection />);
    expect(await screen.findByText("backup-2026-07-01.json")).toBeInTheDocument();
    expect(screen.getByText("backup-2026-07-02.json")).toBeInTheDocument();
    // 2048 bytes → 2.0 KB
    expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument();
  });

  it("creates a backup when Backup Now is clicked", async () => {
    mockCreateBackup.mockResolvedValue({
      filename: "backup-2026-08-03.json",
      size_bytes: 1024,
    });
    render(<BackupSection />);
    await screen.findByText("/data/backups");

    fireEvent.click(screen.getByRole("button", { name: "Backup now" }));

    await waitFor(() => {
      expect(mockCreateBackup).toHaveBeenCalled();
    });
    expect(await screen.findByText(/Backup created: backup-2026-08-03.json/)).toBeInTheDocument();
  });

  it("updates the interval config when an option is clicked", async () => {
    mockUpdateBackupConfig.mockResolvedValue({ ...baseConfig, interval: "weekly" });
    render(<BackupSection />);
    await screen.findByText("/data/backups");

    fireEvent.click(screen.getByRole("button", { name: "Backup Weekly" }));

    await waitFor(() => {
      expect(mockUpdateBackupConfig).toHaveBeenCalledWith({ interval: "weekly" });
    });
  });

  it("restores a backup after confirmation", async () => {
    mockRestoreBackup.mockResolvedValue({
      safety_backup: "pre-restore-2026-08-03.json",
    });
    render(<BackupSection />);
    await screen.findByText("backup-2026-07-01.json");

    fireEvent.click(screen.getByRole("button", { name: "Restore from backup-2026-07-01.json" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm restore" }));

    await waitFor(() => {
      expect(mockRestoreBackup).toHaveBeenCalledWith("backup-2026-07-01.json");
    });
    expect(await screen.findByText(/Restored from backup-2026-07-01.json/)).toBeInTheDocument();
  });

  it("deletes a backup after confirmation", async () => {
    mockDeleteBackup.mockResolvedValue({});
    render(<BackupSection />);
    await screen.findByText("backup-2026-07-02.json");

    fireEvent.click(screen.getByRole("button", { name: "Delete backup-2026-07-02.json" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => {
      expect(mockDeleteBackup).toHaveBeenCalledWith("backup-2026-07-02.json");
    });
    expect(await screen.findByText("Deleted backup-2026-07-02.json")).toBeInTheDocument();
  });
});
