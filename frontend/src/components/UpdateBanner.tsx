import { ArrowsClockwiseIcon as ArrowsClockwise } from "@phosphor-icons/react";

interface UpdateBannerProps {
  onUpdate: () => void;
}

export default function UpdateBanner({ onUpdate }: UpdateBannerProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-accent/90 text-on-accent px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium pt-[calc(env(safe-area-inset-top,0px)+8px)]">
      <ArrowsClockwise size={16} weight="bold" />
      <span>New version available</span>
      <button
        onClick={onUpdate}
        className="ml-2 px-3 py-0.5 rounded-full bg-on-accent/20 text-on-accent font-semibold text-xs hover:bg-on-accent/30 transition-colors"
      >
        Refresh
      </button>
    </div>
  );
}
