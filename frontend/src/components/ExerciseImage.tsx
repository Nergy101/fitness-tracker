import { useState, useCallback } from "react";

interface ExerciseImageProps {
  src: string | null;
  alt: string;
  className?: string;
  category?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  cardio: "from-green-500/20 to-green-500/10 text-green-500",
  strength: "from-blue-500/20 to-blue-500/10 text-blue-500",
  flexibility: "from-purple-500/20 to-purple-500/10 text-purple-500",
  other: "from-fg/10 to-fg/5 text-fg/40",
};

export default function ExerciseImage({
  src,
  alt,
  className = "",
  category,
}: ExerciseImageProps) {
  const [state, setState] = useState<"loading" | "loaded" | "error">(
    src ? "loading" : "error",
  );

  const onLoad = useCallback(() => setState("loaded"), []);
  const onError = useCallback(() => setState("error"), []);

  const initial = alt.charAt(0).toUpperCase();
  const catColors =
    CATEGORY_COLORS[category ?? ""] ?? CATEGORY_COLORS.other;

  return (
    <div
      className={`flex items-center justify-center overflow-hidden relative ${className}`}
    >
      {/* Shimmer skeleton while loading */}
      {state === "loading" && (
        <div className="absolute inset-0 bg-fg/5 animate-pulse rounded-inherit" />
      )}

      {/* Image (hidden until loaded, then fades in) */}
      {src && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={onLoad}
          onError={onError}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            state === "loaded" ? "opacity-100" : "opacity-0 absolute inset-0 pointer-events-none"
          }`}
        />
      )}

      {/* Error / no-image fallback */}
      {state === "error" && (
        <div
          className={`w-full h-full bg-gradient-to-br ${catColors} flex items-center justify-center text-xl font-bold`}
        >
          {initial}
        </div>
      )}
    </div>
  );
}
