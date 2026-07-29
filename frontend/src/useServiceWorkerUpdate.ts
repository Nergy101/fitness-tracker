import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * Returns `needRefresh` (boolean) and `update` (function).
 * Call `update()` to activate the new service worker and reload.
 *
 * Suppresses `offlineReady` — we only care about updates,
 * not first-install notifications.
 */
export default function useServiceWorkerUpdate() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onOfflineReady() {
      // First install — nothing to show
    },
  });

  const update = () => updateServiceWorker(true);

  return { needRefresh, update };
}
