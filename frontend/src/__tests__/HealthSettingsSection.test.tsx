import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import HealthSettingsSection from "../components/health/HealthSettingsSection";
import type { UserProfileResponse } from "../api";

const mockGetProfile = vi.fn();
const mockUpdateProfile = vi.fn();
const mockSendTestNotification = vi.fn();
const mockGetNotificationStatus = vi.fn();
const mockRequestNotificationPermission = vi.fn();
const mockRegisterPushSubscription = vi.fn();
const mockUnsubscribePush = vi.fn();
const mockGetPushSubscription = vi.fn();

vi.mock("../api", () => ({
  api: {
    getProfile: (...args: unknown[]) => mockGetProfile(...args),
    updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
    sendTestNotification: (...args: unknown[]) => mockSendTestNotification(...args),
  },
}));

vi.mock("../notifications", () => ({
  getNotificationStatus: () => mockGetNotificationStatus(),
  requestNotificationPermission: (...args: unknown[]) =>
    mockRequestNotificationPermission(...args),
  registerPushSubscription: (...args: unknown[]) => mockRegisterPushSubscription(...args),
  unsubscribePush: (...args: unknown[]) => mockUnsubscribePush(...args),
  getPushSubscription: (...args: unknown[]) => mockGetPushSubscription(...args),
}));

vi.mock("../logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("@phosphor-icons/react", () => ({
  CheckIcon: () => <span data-icon="check" />,
}));

function profile(overrides: Partial<UserProfileResponse> = {}): UserProfileResponse {
  return {
    height_cm: 182,
    birthday: "1994-05-02",
    gender: "male",
    goal_weight_kg: 80,
    weight_unit: "kg",
    reminder_time: "18:30",
    notifications_enabled: true,
    ...overrides,
  };
}

const liveSubscription = {
  endpoint: "https://push.example.com/abc",
  keys: { p256dh: "key", auth: "auth" },
};

describe("HealthSettingsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProfile.mockResolvedValue(profile());
    mockUpdateProfile.mockResolvedValue(profile());
    mockSendTestNotification.mockResolvedValue({ status: "ok" });
    mockGetNotificationStatus.mockReturnValue("default" as never);
    mockGetPushSubscription.mockResolvedValue(null);
    mockRegisterPushSubscription.mockResolvedValue(liveSubscription);
    mockUnsubscribePush.mockResolvedValue(undefined);
    mockRequestNotificationPermission.mockResolvedValue("granted");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a loading placeholder, then the profile form", async () => {
    render(<HealthSettingsSection onSaved={vi.fn()} />);
    expect(screen.getByText("Loading health settings...")).toBeInTheDocument();
    expect(await screen.findByLabelText("Height (cm)")).toBeInTheDocument();
    expect(screen.getByLabelText("Birthday")).toBeInTheDocument();
    expect(screen.getByLabelText("Goal Weight (kg)")).toBeInTheDocument();
    expect(screen.getByLabelText("Daily workout reminder time")).toBeInTheDocument();
  });

  it("shows a retry affordance when the profile fails to load", async () => {
    mockGetProfile.mockRejectedValueOnce(new Error("offline"));
    render(<HealthSettingsSection onSaved={vi.fn()} />);

    expect(await screen.findByText("Could not load health settings.")).toBeInTheDocument();
    // No longer stuck on the loading placeholder.
    expect(screen.queryByText("Loading health settings...")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry loading health settings" }));
    expect(await screen.findByLabelText("Height (cm)")).toBeInTheDocument();
    expect(mockGetProfile).toHaveBeenCalledTimes(2);
  });

  it("saves the edited profile and notifies the parent", async () => {
    const onSaved = vi.fn();
    render(<HealthSettingsSection onSaved={onSaved} />);
    const height = await screen.findByLabelText("Height (cm)");

    fireEvent.change(height, { target: { value: "180" } });
    fireEvent.change(screen.getByLabelText("Daily workout reminder time"), {
      target: { value: "07:15" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(mockUpdateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ height_cm: 180, reminder_time: "07:15" }),
    );
  });

  it("does not mark the parent as saved when the save fails", async () => {
    mockUpdateProfile.mockRejectedValueOnce(new Error("500"));
    const onSaved = vi.fn();
    render(<HealthSettingsSection onSaved={onSaved} />);

    fireEvent.click(await screen.findByRole("button", { name: "Save settings" }));

    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalled());
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("reports push as active when the browser still holds a subscription", async () => {
    mockGetNotificationStatus.mockReturnValue("granted" as never);
    mockGetPushSubscription.mockResolvedValue(liveSubscription);

    render(<HealthSettingsSection onSaved={vi.fn()} />);

    expect(await screen.findByText("Push notifications active")).toBeInTheDocument();
    // The "Enable" CTA must not be offered on top of an active subscription.
    expect(
      screen.queryByRole("button", { name: "Enable push notifications" }),
    ).not.toBeInTheDocument();
  });

  it("offers Enable when granted but no subscription is live, then activates", async () => {
    mockGetNotificationStatus.mockReturnValue("granted" as never);
    mockGetPushSubscription.mockResolvedValue(null);

    render(<HealthSettingsSection onSaved={vi.fn()} />);
    const enable = await screen.findByRole("button", { name: "Enable push notifications" });

    fireEvent.click(enable);

    expect(await screen.findByText("Push notifications active")).toBeInTheDocument();
    expect(mockRegisterPushSubscription).toHaveBeenCalledTimes(1);
  });

  it("subscribes through the permission prompt when status is not yet granted", async () => {
    mockGetNotificationStatus.mockReturnValue("prompt" as never);
    mockGetProfile.mockResolvedValue(profile());

    render(<HealthSettingsSection onSaved={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Enable push notifications" }));

    expect(await screen.findByText("Push notifications active")).toBeInTheDocument();
    expect(mockRequestNotificationPermission).toHaveBeenCalled();
    // No point probing the push manager before permission is granted.
    expect(mockGetPushSubscription).not.toHaveBeenCalled();
  });

  it("disables push and returns to the Enable control", async () => {
    mockGetNotificationStatus.mockReturnValue("granted" as never);
    mockGetPushSubscription.mockResolvedValue(liveSubscription);

    render(<HealthSettingsSection onSaved={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Disable push notifications" }));

    await waitFor(() => expect(mockUnsubscribePush).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByRole("button", { name: "Enable push notifications" }),
    ).toBeInTheDocument();
  });

  it("sends a test notification and confirms it", async () => {
    mockGetNotificationStatus.mockReturnValue("granted" as never);
    mockGetPushSubscription.mockResolvedValue(liveSubscription);

    render(<HealthSettingsSection onSaved={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Send test notification" }));

    await waitFor(() => expect(mockSendTestNotification).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Sent!")).toBeInTheDocument();
  });

  it("explains when notifications are blocked or unsupported", async () => {
    mockGetNotificationStatus.mockReturnValue("denied" as never);
    const { unmount } = render(<HealthSettingsSection onSaved={vi.fn()} />);
    expect(
      await screen.findByText(/Notifications are blocked\. Enable them in your browser settings\./),
    ).toBeInTheDocument();
    unmount();

    mockGetNotificationStatus.mockReturnValue("unsupported" as never);
    render(<HealthSettingsSection onSaved={vi.fn()} />);
    expect(await screen.findByText("Not supported in this browser.")).toBeInTheDocument();
  });

  it("stays on the Enable control when the subscription check fails", async () => {
    mockGetNotificationStatus.mockReturnValue("granted" as never);
    mockGetPushSubscription.mockRejectedValue(new Error("no SW"));

    render(<HealthSettingsSection onSaved={vi.fn()} />);

    expect(
      await screen.findByRole("button", { name: "Enable push notifications" }),
    ).toBeInTheDocument();
  });
});
