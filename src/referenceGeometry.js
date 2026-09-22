// Measurements are in the supplied video's 1280 × 1024 logical frame.
// These are working mechanical parts, not regions cut out of a machine image.
import { STRIKE_CONTACT_MS, ESCAPEMENT_START_MS, STRIKE_DURATION_MS } from "./typewriterConfig.js";
import { getPaperTemplate } from "./paperTemplates.js";
export const FRAME = { width: 1280, height: 1024 };
export const STRIKE = { x: 640, y: 504 };
export const PAPER = { left: 403, top: 419, width: 474, height: 474 * 297 / 210 };
export const BASKET = { x: 640, y: 658 };
export const PAPER_MOUTH_Y = 518;
export const PAPER_EJECT_OFFSET_PERCENT = -140;
export const GUIDE_TOP = 522;
export const GUIDE_BOTTOM = 551;
export const RIBBON_WIDTH = 8;
export const RIBBON_REST_Y = 534;
export const RETURN_LEVER = {
  pivot: { x: 332, y: 537 },
  arm: [[0, 0], [-27, -35], [-161, -8], [-175, -19], [-175, -49]],
  grip: { x: -181, y: -65, width: 12, height: 43 },
};

export function returnLeverAngle(progress = 0) {
  return -Math.sin(Math.max(0,Math.min(1,progress))*Math.PI)*.22;
}

export function ribbonPosition(travel) {
  // The ribbon vibrator lifts only for contact, then falls below the text.
  const lift = Math.max(0, Math.min(1, (travel - .45) / .55));
  return RIBBON_REST_Y + (STRIKE.y - RIBBON_REST_Y) * lift;
}

export function paperFeedOffset(model, layout, ejectionProgress = 0) {
  const feed = -model.activeLine * layout.feed;
  return feed + (PAPER_EJECT_OFFSET_PERCENT - feed) * ejectionProgress;
}

export function inkEnvelope(layout) {
  const track = PAPER.width * layout.trackWidth / 100;
  const height = track * layout.glyphHeight / 100;
  const jitter = track * .12 / 100 + track * layout.glyphWidth / 100 * Math.sin(.48 * Math.PI / 180);
  return { top: STRIKE.y - height / 2 - jitter, bottom: STRIKE.y + height / 2 + jitter };
}

const rows = [
  { labels: "1234567890-", shifted: "!@#$%^&*()_", codes: ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0", "Minus"], xs: [331,393,455,517,579,641,703,765,827,889,951], y: 719 },
  { labels: "QWERTYUIOP", codes: ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP"], xs: [362,424,486,548,610,672,734,796,858,920], y: 776 },
  { labels: "ASDFGHJKL;'", codes: ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote"], xs: [331,393,455,517,579,641,703,765,827,889,951], y: 833 },
  { labels: "ZXCVBNM,./", codes: ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period", "Slash"], xs: [362,424,486,548,610,672,734,796,858,920], y: 890 },
];

export const REFERENCE_KEYS = [
  ...rows.flatMap(row => row.codes.map((code, index) => ({ code, label: row.labels[index], upper: row.shifted?.[index], x: row.xs[index], y: row.y, width: 47, height: 47 }))),
  { code: "ShiftLeft", label: "SHIFT", x: 280, y: 890, width: 86, height: 45 },
  { code: "ShiftRight", label: "SHIFT", x: 1000, y: 890, width: 86, height: 45 },
  { code: "Space", label: "", x: 640, y: 939, width: 373, height: 23 },
];

const leftTips = [[566,540],[556,552],[542,562],[534,574],[522,588],[524,606],[526,622],[519,638]];
export const TYPEBARS = Array.from({ length: 16 }, (_, index) => {
  const side = index < 8 ? -1 : 1;
  const lane = index % 8;
  const root = { x: BASKET.x + side * (12 + lane * 3.5), y: 645 + lane };
  const [leftX,y] = leftTips[lane];
  return { index, root, rest: { x: side < 0 ? leftX : FRAME.width - leftX, y } };
});

export function typebarPosition(index, travel) {
  const bar = TYPEBARS[index];
  return {
    root: bar.root,
    tip: {
      x: bar.rest.x + (STRIKE.x - bar.rest.x) * travel,
      y: bar.rest.y + (STRIKE.y - bar.rest.y) * travel,
    },
  };
}

export function strikeTravel(elapsed, contact = STRIKE_CONTACT_MS, release = ESCAPEMENT_START_MS, end = STRIKE_DURATION_MS) {
  if (elapsed <= 0 || elapsed >= end) return 0;
  if (elapsed < contact) return Math.sin(elapsed / contact * Math.PI / 2);
  if (elapsed <= release) return 1;
  const t = (elapsed - release) / (end - release);
  return (1 - t) ** 2;
}

export function layoutForFirstCharacter() { return "compact"; }

const paperLayouts = new Map();

export function getPaperLayout(model) {
  // A new sheet has one writing scale regardless of its first character.
  // Saved reference layouts keep their line positions and physical feed.
  const id = model?.layoutId || "compact";
  const compact = id === "compact";
  const postcard = model?.paperFormat === "postcard" && model?.kind !== "scroll";
  const paper = getPaperTemplate(model?.paperId);
  const key = `${id}:${postcard}:${model?.kind === "scroll"}:${paper.id}`;
  if (paperLayouts.has(key)) return paperLayouts.get(key);
  const paperHeight = postcard ? PAPER.width * 105 / 148 : PAPER.height;
  const trackWidth = 92;
  const trackPx = PAPER.width * trackWidth / 100;
  const glyphHeight = compact ? 3.05 : 5.9;
  const glyphWidth = 3.2;
  const linePitch = compact ? 4.1 : 56 / trackPx * 100;
  const glyphPx = glyphHeight * trackPx / 100;
  const activeTop = STRIKE.y - glyphPx / 2;
  const start = (activeTop - PAPER.top) / paperHeight * 100;
  const feed = linePitch * trackPx / paperHeight;
  const bailY = compact ? activeTop - (linePitch * trackPx / 100 - glyphPx) / 2 : 483;
  const maxLines = model?.kind === "scroll" ? Infinity : postcard ? Math.floor((paperHeight - (activeTop - PAPER.top) - glyphPx - 24) / (linePitch * trackPx / 100)) + 1 : compact ? 33 : Math.floor((PAPER.height * (1 - start / 100) - glyphPx) / (linePitch * trackPx / 100)) + 1;
  const layout = { id, paperHeight, postcard, maxUnits: compact ? 26 : 28, maxLines, trackLeft: 4, trackWidth,
    glyphWidth, glyphHeight, linePitch, start, feed, bailY, bailHeight: compact ? 2.6 : 8,
    glyphStart: compact ? 8 : 5.5, glyphRange: compact ? 84 : 89 };
  if (paper.printArea && !postcard && model?.kind !== "scroll") {
    // Margins belong to the saved paper. Preserve the physical type pitch and
    // strike height; only the carriage stops and the last writable row change.
    const { left, right, bottom } = paper.printArea;
    const unitPitch = layout.glyphRange / layout.maxUnits;
    const available = (right - left) / trackWidth * 100;
    layout.glyphStart = (left - layout.trackLeft) / trackWidth * 100;
    layout.maxUnits = Math.floor((available - glyphWidth - .3) / unitPitch);
    layout.glyphRange = layout.maxUnits * unitPitch;
    const inkHeight = glyphPx / paperHeight * 100;
    layout.maxLines = Math.floor((bottom - start - inkHeight - .3) / feed) + 1;
  }
  paperLayouts.set(key, layout);
  return layout;
}

export function referenceCarriageOffset(cursor, layout) {
  const glyphCenter = layout.trackLeft + layout.trackWidth / 100 *
    (layout.glyphStart + cursor / layout.maxUnits * layout.glyphRange + layout.glyphWidth / 2);
  return STRIKE.x - PAPER.left - PAPER.width * glyphCenter / 100;
}

export function paperLayoutStyle(layout) {
  return {
    "--glyph-width": `${layout.glyphWidth}cqw`,
    "--glyph-height": `${layout.glyphHeight}cqw`,
    "--ink-track-left": `${layout.trackLeft}%`,
    "--ink-track-width": `${layout.trackWidth}%`,
  };
}
