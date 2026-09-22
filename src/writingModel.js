import { getPaperLayout, PAPER, STRIKE } from "./referenceGeometry.js";

export function blankDocument(kind = "sheet", extra = {}) {
  return {
    id: globalThis.crypto.randomUUID(),
    kind,
    layoutId: null,
    lines: [{ glyphs: [], cursor: 0 }],
    activeLine: 0,
    pageFull: false,
    ...extra,
  };
}

export function normalizeDocument(parsed, fallbackKind = "sheet") {
  if (!parsed?.lines?.length) return blankDocument(fallbackKind);
  const kind = ["sheet", "scroll", "letter"].includes(parsed.kind)
    ? parsed.kind
    : fallbackKind;
  const limit =
    kind === "scroll" ? parsed.lines.length : getPaperLayout(parsed).maxLines;
  const lines = parsed.lines
    .slice(0, limit)
    .map((row) => ({
      glyphs: Array.isArray(row.glyphs) ? row.glyphs : [],
      cursor: Number.isFinite(row.cursor) ? Math.max(0, row.cursor) : 0,
    }));
  const activeLine = Math.max(
    0,
    Math.min(
      Number.isInteger(parsed.activeLine) ? parsed.activeLine : 0,
      lines.length - 1,
    ),
  );
  return {
    ...parsed,
    id: parsed.id || globalThis.crypto.randomUUID(),
    kind,
    lines,
    activeLine,
    pageFull:
      kind === "scroll"
        ? false
        : Boolean(parsed.pageFull) && activeLine >= limit - 1,
  };
}

// A bounded visible band on one continuous roll. Old lines remain in storage;
// the current row never acquires a coordinate proportional to total length.
export function rollWindow(model, layout) {
  const pitch = (PAPER.width * layout.trackWidth * layout.linePitch) / 10000;
  const retain = Math.ceil(FRONT_PAPER_HEIGHT / pitch) + 2;
  const first = Math.max(0, model.activeLine - retain);
  return {
    first,
    last: model.activeLine,
    pitch,
    offset: model.activeLine - first,
    height: Math.max(PAPER.height, (model.activeLine - first) * pitch + 180),
    feed: -(model.activeLine - first) * pitch,
    activeTop:
      STRIKE.y - (PAPER.width * layout.trackWidth * layout.glyphHeight) / 20000,
  };
}
const FRONT_PAPER_HEIGHT = 520;

export function rollLengthMetres(model) {
  const layout = getPaperLayout(model);
  return (
    ((((model.activeLine + 1) * layout.linePitch * layout.trackWidth) / 10000) *
      210 +
      38) /
    1000
  );
}

export function documentExcerpt(model) {
  return (
    model.lines
      .slice(0, 8)
      .flatMap((row) => row.glyphs.map((g) => g.character))
      .join("")
      .trim()
      .slice(0, 100) || "未落字的稿纸"
  );
}

export function exportSlices(model, maxHeight = 6000, width = 2480) {
  const layout = getPaperLayout(model),
    pitch = (width * layout.trackWidth * layout.linePitch) / 10000;
  const height = layout.postcard ? Math.round(width * 105 / 148) : 3508;
  const top = (width * layout.paperHeight / PAPER.width) * layout.start / 100;
  if (model.kind !== "scroll")
    return [{ first: 0, last: model.lines.length, height, top }];
  const capacity = Math.max(1, Math.floor((maxHeight - top - 120) / pitch));
  return Array.from(
    { length: Math.ceil(model.lines.length / capacity) },
    (_, index) => {
      const first = index * capacity,
        last = Math.min(model.lines.length, first + capacity);
      return {
        first,
        last,
        top,
        height: Math.ceil(Math.max(900, top + (last - first) * pitch + 120)),
      };
    },
  );
}
