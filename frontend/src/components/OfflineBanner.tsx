import { useEffect, useState } from "react";
import { WifiSlashIcon as WifiSlash } from "@phosphor-icons/react";

export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500/90 text-black px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium pt-[calc(env(safe-area-inset-top,0px)+8px)]">
      <WifiSlash size={16} weight="fill" />
      You're offline — some features may be unavailable
    </div>
  );
}