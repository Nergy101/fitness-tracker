import { useEffect, useState } from "react";
import { CheckIcon as Check } from "@phosphor-icons/react";
import { api, type UserProfileResponse, type UserProfileUpdate } from "../../api";
import {
  requestNotificationPermission,
  registerPushSubscription,
  unsubscribePush,
  getNotificationStatus,
  type NotificationStatus,
} from "../../notifications";

interface HealthSettingsSectionProps {
  /** Called after the profile was saved successfully. */
  onSaved: () => void;
}

/** Health profile + push notification settings; fetches the profile itself so
 *  it can live in the app-level settings modal. */
export default function HealthSettingsSection({ onSaved }: HealthSettingsSectionProps) {
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);

  useEffect(() => {
    api.getProfile().then(setProfile).catch(() => {});
  }, []);

  if (!profile) {
    return <p className="text-xs text-fg/40">Loading health settings...</p>;
  }
  return <HealthSettingsForm profile={profile} onSaved={onSaved} />;
}

function HealthSettingsForm({
  profile,
  onSaved,
}: {
  profile: UserProfileResponse;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    height_cm: profile.height_cm ?? undefined,
    birthday: profile.birthday ?? "",
    gender: profile.gender ?? "",
    goal_weight_kg: profile.goal_weight_kg ?? undefined,
    weight_unit: profile.weight_unit,
    reminder_time: profile.reminder_time ?? "",
    notifications_enabled: profile.notifications_enabled,
  });
  const [saving, setSaving] = useState(false);

  // ─── Push Notification State ──────────────────────
  const [pushStatus, setPushStatus] = useState<NotificationStatus>(getNotificationStatus());
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [testSent, setTestSent] = useState(false);

  const handleEnablePush = async () => {
    setPushLoading(true);
    try {
      const perm = await requestNotificationPermission();
      setPushStatus(perm as NotificationStatus);
      if (perm === "granted") {
        const sub = await registerPushSubscription();
        if (sub) setPushSubscribed(true);
      }
    } catch (e) {
      console.error("Push notification setup failed", e);
    } finally {
      setPushLoading(false);
    }
  };

  const handleDisablePush = async () => {
    setPushLoading(true);
    try {
      await unsubscribePush();
      setPushSubscribed(false);
      setPushStatus("prompt"); // reset to prompt so user can re-enable
    } catch (e) {
      console.error("Push unsubscribe failed", e);
    } finally {
      setPushLoading(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      await api.sendTestNotification();
      setTestSent(true);
      setTimeout(() => setTestSent(false), 3000);
    } catch (e) {
      console.error("Test notification failed", e);
    }
  };

  const save = async (data: UserProfileUpdate) => {
    setSaving(true);
    try {
      await api.updateProfile(data);
      onSaved();
    } catch (e) {
      console.error("Profile save failed", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3.5">
      <div>
        <label className="text-xs text-fg/50 block mb-1">Height (cm)</label>
        <input type="number" step="0.1" value={form.height_cm ?? ""}
          onChange={(e) => setForm({ ...form, height_cm: e.target.value ? parseFloat(e.target.value) : undefined })}
          className="w-full bg-bg border border-fg/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-accent/50" />
      </div>
      <div>
        <label className="text-xs text-fg/50 block mb-1">Birthday</label>
        <input type="date" value={form.birthday}
          onChange={(e) => setForm({ ...form, birthday: e.target.value })}
          className="w-full max-w-full min-w-0 box-border bg-bg border border-fg/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-accent/50" />
      </div>
      <div>
        <label className="text-xs text-fg/50 block mb-1">Gender</label>
        <select value={form.gender}
          onChange={(e) => setForm({ ...form, gender: e.target.value })}
          className="w-full bg-bg border border-fg/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-accent/50"
        >
          <option value="">Prefer not to say</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label className="text-xs text-fg/50 block mb-1">Goal Weight (kg)</label>
        <input type="number" step="0.1" value={form.goal_weight_kg ?? ""}
          onChange={(e) => setForm({ ...form, goal_weight_kg: e.target.value ? parseFloat(e.target.value) : undefined })}
          className="w-full bg-bg border border-fg/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-accent/50" />
      </div>
      <div>
        <label className="text-xs text-fg/50 block mb-1">Daily workout reminder at</label>
        <input type="time" value={form.reminder_time}
          onChange={(e) => setForm({ ...form, reminder_time: e.target.value })}
          className="w-full max-w-full min-w-0 box-border bg-bg border border-fg/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-accent/50" />
      </div>

      {/* ─── Push Notifications ─────────────────── */}
      <div className="bg-bg/50 rounded-xl p-3 border border-fg/5">
        <p className="text-xs text-fg/40 mb-2.5">Push Notifications</p>
        {pushStatus === "unsupported" ? (
          <p className="text-xs text-fg/40">Not supported in this browser.</p>
        ) : pushStatus === "denied" ? (
          <p className="text-xs text-orange-400">
            Notifications are blocked. Enable them in your browser settings.
          </p>
        ) : pushSubscribed ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-xs text-green-400">Push notifications active</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleTestNotification}
                disabled={pushLoading}
                className="flex-1 bg-accent/20 text-accent rounded-lg py-1.5 text-xs font-medium hover:bg-accent/30 transition-colors disabled:opacity-50"
              >
                {testSent ? (
                  <span className="inline-flex items-center justify-center gap-1">
                    <Check size={12} weight="bold" /> Sent!
                  </span>
                ) : (
                  "Send Test"
                )}
              </button>
              <button
                onClick={handleDisablePush}
                disabled={pushLoading}
                className="bg-red-400/10 text-red-400 rounded-lg py-1.5 px-3 text-xs font-medium hover:bg-red-400/20 transition-colors disabled:opacity-50"
              >
                Disable
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleEnablePush}
            disabled={pushLoading}
            className="w-full bg-accent text-bg rounded-lg py-2 text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {pushLoading ? "Setting up..." : "Enable Push Notifications"}
          </button>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.notifications_enabled}
          onChange={(e) => setForm({ ...form, notifications_enabled: e.target.checked })}
          className="accent-accent" />
        <span className="text-fg/80">Enable daily reminders</span>
      </label>

      <button onClick={() => save(form)} disabled={saving}
        className="w-full bg-accent text-bg rounded-xl py-2.5 font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 mt-2">
        {saving ? "Saving..." : "Save Settings"}
      </button>
    </div>
  );
}
