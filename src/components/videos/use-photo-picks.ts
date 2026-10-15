"use client";

import { useEffect, useRef, useState } from "react";
import { fitsImageLimits, type ImageLimits } from "@/lib/image-limits";

// 图1 stands on the left, 图2 on the right.
export type Side = "left" | "right";

type Options = {
  maxImageBytes: number;
  imageLimits: ImageLimits;
  // Why a pick was dropped, or null when a new pick clears it.
  onError: (error: "invalid" | "imageSize" | null) => void;
};

const empty = { left: null, right: null };

// The photo per side of a video form, with a preview URL each. A file over
// the byte limit is dropped at once; one outside the pixel limits once the
// browser has read its size.
export function usePhotoPicks({ maxImageBytes, imageLimits, onError }: Options) {
  const [photos, setPhotos] = useState<Record<Side, File | null>>(empty);
  const [previews, setPreviews] = useState<Record<Side, string | null>>(empty);
  // The latest pick per side, so a slow size check for an earlier file changes nothing.
  const picked = useRef<Record<Side, File | null>>({ ...empty });

  useEffect(
    () => () => {
      for (const url of Object.values(previews)) if (url) URL.revokeObjectURL(url);
    },
    [previews],
  );

  function pick(side: Side, file: File | null) {
    onError(null);
    const tooBig = file !== null && file.size > maxImageBytes;
    if (tooBig) onError("invalid");
    setPhotos((current) => ({ ...current, [side]: tooBig ? null : file }));
    setPreviews((current) => ({ ...current, [side]: file && !tooBig ? URL.createObjectURL(file) : null }));
    picked.current[side] = tooBig ? null : file;
    if (!file || tooBig) return;
    void fitsImageLimits(file, imageLimits).then((fits) => {
      if (fits !== false || picked.current[side] !== file) return;
      picked.current[side] = null;
      setPhotos((current) => ({ ...current, [side]: null }));
      setPreviews((current) => ({ ...current, [side]: null }));
      onError("imageSize");
    });
  }

  return { photos, previews, pick };
}
