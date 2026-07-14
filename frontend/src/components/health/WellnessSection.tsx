import { useEffect, useState } from "react";
import {
  FaceSmile as Smiley,
  EmojiNormal2 as SmileyMeh,
  EmojiSad2 as SmileySad,
  StickerSmile as SmileySticker,
  FaceSmile as SmileyWink,
} from "reicon-react";
import { api, type WellnessResponse, type WellnessTrendsResponse } from "../../api";
import { shortDate } from "./utils";

export default function WellnessSection() {
  const [entries, setEntries] = useState<WellnessResponse[]>([]);
  const [trends, setTrends] = useState<WellnessTrendsResponse | null>(null);
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [stress, setStress] = useState(3);
  const [sleep, setSleep] = useState(7);

  useEffect(() => {
    api.getWellnessEntries().then(setEntries).catch(() => {});
    api.getWellnessTrends().then(setTrends).catch(() => {});
  }, []);

  const submit = async () => {
    await api.createWellnessEntry({ mood, energy, stress, sleep_hours: sleep });
    api.getWellnessEntries().then(setEntries);
    api.getWellnessTrends().then(setTrends);
  };

  const moodIcon = (val: number) => {
    const MoodFace =
      val <= 1 ? SmileySad
      : val <= 2 ? SmileyMeh
      : val <= 3 ? Smiley
      : val <= 4 ? SmileyWink
      : SmileySticker;
    return <MoodFace size={14} weight="Filled" className="inline align-[-2px] text-accent" />;
  };

  const latest = entries[0];

  return (
    <div className="bg-surface rounded-xl p-4 border border-fg/5 space-y-3">
      {latest && (
        <div className="text-xs text-fg/50 mb-1">
          Last: Mood {moodIcon(latest.mood ?? 3)} {latest.mood}/5 ·
          Energy {latest.energy}/5 ·
          Stress {latest.stress}/5 ·
          Sleep {latest.sleep_hours?.toFixed(1)}h
          <span className="text-fg/30 ml-1">({shortDate(latest.date)})</span>
        </div>
      )}

      {trends && trends.weekly_averages.length > 0 && (
        <div className="flex gap-3 text-[10px] text-fg/40">
          {trends.weekly_averages.slice(0, 4).reverse().map((w) => (
            <div key={w.week_start} className="flex-1 text-center bg-bg rounded-lg py-1.5">
              <p className="font-medium text-fg">{w.avg_mood ?? "—"}</p>
              <p>Mood</p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div>
          <p className="text-xs text-fg/50 mb-1">Mood: {moodIcon(mood)}</p>
          <input type="range" min="1" max="5" value={mood} onChange={(e) => setMood(parseInt(e.target.value))}
            className="w-full accent-accent" />
        </div>
        <div>
          <p className="text-xs text-fg/50 mb-1">Energy: {energy}/5</p>
          <input type="range" min="1" max="5" value={energy} onChange={(e) => setEnergy(parseInt(e.target.value))}
            className="w-full accent-accent" />
        </div>
        <div>
          <p className="text-xs text-fg/50 mb-1">Stress: {stress}/5</p>
          <input type="range" min="1" max="5" value={stress} onChange={(e) => setStress(parseInt(e.target.value))}
            className="w-full accent-accent" />
        </div>
        <div>
          <p className="text-xs text-fg/50 mb-1">Sleep: {sleep}h</p>
          <input type="range" min="3" max="12" step="0.5" value={sleep} onChange={(e) => setSleep(parseFloat(e.target.value))}
            className="w-full accent-accent" />
        </div>
        <button onClick={submit}
          className="w-full bg-accent text-bg rounded-lg py-2 text-sm font-semibold mt-1">
          Log Check-in
        </button>
      </div>
    </div>
  );
}
