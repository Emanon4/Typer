import { useEffect, useRef } from "react";

const CJK_PATTERN =
  /[\u2E80-\u2EFF\u2F00-\u2FDF\u3000-\u303F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u{20000}-\u{2FA1F}]/u;

function hashNoise(x, y, seed) {
  let value = (x + 1) * 374761393 + (y + 1) * 668265263 + seed * 69069;
  value = (value ^ (value >>> 13)) * 1274126177;
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function makeRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export function paintInkGlyph(canvas, glyph, options = {}) {
  const cssWidth = Math.max(16, options.cssWidth ?? canvas.clientWidth);
  const cssHeight = Math.max(18, options.cssHeight ?? canvas.clientHeight);
  const ratio = Math.max(
    1,
    options.ratio ?? Math.min(window.devicePixelRatio || 1, 2.5),
  );
  const width = Math.max(1, Math.round(cssWidth * ratio));
  const height = Math.max(1, Math.round(cssHeight * ratio));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.clearRect(0, 0, width, height);

  if (/\s/u.test(glyph.character)) return;

  const random = makeRandom(glyph.seed);
  const isCjk = CJK_PATTERN.test(glyph.character);
  const fontSize = cssHeight * (isCjk ? 0.77 : 0.8);
  const fontFamily = isCjk
    ? '"Songti SC", "STSong", "Noto Serif CJK SC", serif'
    : '"Special Elite", "American Typewriter", "Courier New", monospace';
  const fontWeight = isCjk ? 700 : 400;
  const baseline = cssHeight * (isCjk ? 0.79 : 0.81);
  const left = cssHeight * (isCjk ? 0.035 : 0.025);

  context.save();
  context.scale(ratio, ratio);
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  context.globalCompositeOperation = "source-over";

  const weakStrike = glyph.seed % 13 === 0;
  const pressure = weakStrike ? 0.66 : 0.94 + random() * 0.06;
  const passes = isCjk ? 4 : 3;

  for (let pass = 0; pass < passes; pass += 1) {
    const horizontalJitter = (random() - 0.5) * (isCjk ? 0.42 : 0.28);
    const verticalJitter = (random() - 0.5) * 0.32;
    const opacity = pressure * (pass === 0 ? 0.76 : 0.2 + random() * 0.045);
    context.fillStyle = `rgba(35, 29, 23, ${opacity})`;
    context.fillText(
      glyph.character,
      left + horizontalJitter,
      baseline + verticalJitter,
    );
  }

  if (glyph.seed % 9 === 0) {
    context.fillStyle = `rgba(38, 31, 24, ${pressure * 0.2})`;
    context.fillText(glyph.character, left + 0.38, baseline + 0.16);
  }
  context.restore();

  const image = context.getImageData(0, 0, width, height);
  const data = image.data;
  const threadOffset = glyph.seed % Math.max(5, Math.round(ratio * 7));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      if (data[index + 3] === 0) continue;

      const fine = hashNoise(x, y, glyph.seed);
      const coarse = hashNoise(
        Math.floor(x / Math.max(2, ratio * 1.8)),
        Math.floor(y / Math.max(2, ratio * 1.8)),
        glyph.seed + 97,
      );
      const ribbonThread = (y + threadOffset) % Math.max(8, Math.round(ratio * 9));
      let density = 0.88 + coarse * 0.12;

      if (fine < 0.019) density *= 0.08;
      else if (fine < 0.062) density *= 0.56;
      if (ribbonThread <= 1) density *= 0.88;

      data[index] = 39;
      data[index + 1] = 32;
      data[index + 2] = 25;
      data[index + 3] = Math.round(data[index + 3] * density);
    }
  }

  context.putImageData(image, 0, 0);
}

export function InkGlyph({ glyph, final = false }) {
  const canvasRef = useRef(null);
  const wobble = ((glyph.seed % 7) - 3) * 0.16;
  const lift = ((glyph.seed % 5) - 2) * 0.38;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let cancelled = false;
    const render = () => {
      if (!cancelled) paintInkGlyph(canvas, glyph);
    };
    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    render();
    document.fonts?.ready.then(render);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [glyph]);

  return (
    <span
      className={`ink-glyph${final ? " final-ink" : ""}`}
      style={{
        left: `${8 + (glyph.x / 17.5) * 84}%`,
        "--ink-rotate": `${wobble}deg`,
        "--ink-lift": `${lift}px`,
      }}
    >
      <canvas ref={canvasRef} className="ink-canvas" aria-hidden="true" />
      <span className="ink-accessible">
        {glyph.character === " " ? "\u00a0" : glyph.character}
      </span>
    </span>
  );
}
