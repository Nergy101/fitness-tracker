/** Shared activity-type palette: fitness workouts, runs, walks, and boxing are
 * color-coded (and icon-coded) uniformly across History and Stats.
 *
 * Runs/walks/boxing are mirrored into WorkoutSessions with a "Run:"/"Walk:"/
 * "Boxing:" template-name prefix (see backend routers); `activityKind` is the
 * single classifier for that convention.
 */

import {
  BarbellIcon,
  HandFistIcon,
  PersonSimpleRunIcon,
  SneakerIcon,
  type Icon,
} from "@phosphor-icons/react";

export type ActivityKind = "workout" | "run" | "walk" | "boxing";

export const ACTIVITY_ICONS: Record<ActivityKind, Icon> = {
  workout: BarbellIcon,
  run: PersonSimpleRunIcon,
  walk: SneakerIcon,
  boxing: HandFistIcon,
};

export const ACTIVITY_COLORS: Record<ActivityKind, string> = {
  workout: "#fb923c", // orange-400
  run: "#38bdf8", // sky-400
  walk: "#4ade80", // green-400
  boxing: "#f87171", // red-400
};

export const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  workout: "Workouts",
  run: "Runs",
  walk: "Walks",
  boxing: "Boxing",
};

export function activityKind(templateName: string): ActivityKind {
  if (templateName.startsWith("Run:")) return "run";
  if (templateName.startsWith("Walk:")) return "walk";
  if (templateName.startsWith("Boxing:")) return "boxing";
  return "workout";
}