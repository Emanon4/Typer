import { useEffect, useState } from "react";

const cache = new Map();
// Mirror the scanned stock at its edge: adjacent samples share their exact
// boundary pixels, without a hard seam or a different paper asset.
export function seamlessRollTexture(source) {
  if (!cache.has(source))
    cache.set(
      source,
      new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight * 2;
          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0);
          context.translate(0, canvas.height);
          context.scale(1, -1);
          context.drawImage(image, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        };
        image.onerror = () => {
          cache.delete(source);
          reject(new Error("无法载入长卷纸张"));
        };
        image.src = source;
      }),
    );
  return cache.get(source);
}

export function useRollPaperStyle(style, enabled, offset = 0) {
  const source = style?.["--paper-texture"]?.match(
    /^url\(["']?(.*?)["']?\)$/,
  )?.[1];
  const [texture, setTexture] = useState(null);
  useEffect(() => {
    let alive = true;
    setTexture(null);
    if (enabled && source)
      seamlessRollTexture(source)
        .then((value) => {
          if (alive) setTexture({ source, value });
        })
        .catch(() => {});
    return () => {
      alive = false;
    };
  }, [source, enabled]);
  return enabled && texture?.source === source
    ? {
        ...style,
        "--paper-texture": `url("${texture.value}")`,
        "--roll-paper-offset": `${-offset * 100}cqw`,
      }
    : style;
}
