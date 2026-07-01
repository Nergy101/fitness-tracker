import { useState } from "react";
import { Barbell } from "@phosphor-icons/react";

interface ExerciseImageProps {
  src: string | null;
  alt: string;
  className?: string;
  iconSize?: number;
}

/** Exercise photo with a graceful icon fallback when the image is missing or
 *  fails to load. Centralizes the fallback so every call site behaves alike. */
export default function ExerciseImage({
  src,
  alt,
  className = "",
  iconSize = 32,
}: ExerciseImageProps) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;

  return (
    <div
      className={`flex items-center justify-center overflow-hidden bg-surface ${className}`}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Barbell size={iconSize} weight="regular" className="text-fg/25" />
      )}
    </div>
  );
}
