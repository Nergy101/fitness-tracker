import React from "react";

const ALL_ICONS = [
  "ArrowClockwiseIcon", "ArrowCounterClockwiseIcon", "ArrowDownIcon",
  "ArrowLeftIcon", "ArrowsLeftRightIcon", "ArrowUpIcon", "BarbellIcon",
  "BrandIcon", "CalendarBlankIcon", "CaretDownIcon", "CaretLeftIcon",
  "CaretRightIcon", "CaretUpIcon", "ChartBarIcon", "ChartPieSliceIcon",
  "CheckCircleIcon", "CheckIcon", "ClockCounterClockwiseIcon", "ClockIcon",
  "ConfettiIcon", "CopyIcon", "DownloadSimpleIcon", "EyeIcon", "EyeSlashIcon",
  "FireIcon", "FlagBannerIcon", "FlameIcon", "FootprintsIcon", "GearIcon",
  "HandFistIcon", "HeartbeatIcon", "HeartIcon", "InsightIcon",
  "LockKeyIcon", "MapTrifoldIcon", "MinusIcon", "MoonIcon", "PauseCircleIcon",
  "PencilSimpleIcon", "PersonSimpleRunIcon", "PlantIcon", "PlayCircleIcon",
  "PlusIcon", "PulseIcon", "PushPinIcon", "RocketLaunchIcon", "RulerIcon",
  "ScalesIcon", "SkipForwardIcon", "SmileyIcon", "SmileyMehIcon",
  "SmileySadIcon", "SmileyStickerIcon", "SmileyWinkIcon", "SneakerIcon",
  "SpeakerHighIcon", "SpeakerSlashIcon", "SunHorizonIcon", "SunIcon",
  "TimerIcon", "TrashIcon", "TrendDownIcon", "TrendUpIcon", "TrophyIcon",
  "UploadSimpleIcon", "WarningIcon", "WifiSlashIcon",
] as const;

const iconFactory = (name: string) => {
  const Icon = (props: Record<string, unknown>) =>
    React.createElement("span", { ...props, "data-testid": `icon-${name}` });
  Icon.displayName = name;
  return Icon;
};

const mockExports: Record<string, unknown> = {};
for (const name of ALL_ICONS) {
  mockExports[name] = iconFactory(name);
}

export { mockExports as phosphorIcons };
