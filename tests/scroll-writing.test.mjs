import test from "node:test";
import assert from "node:assert/strict";
import {
  blankDocument,
  normalizeDocument,
  rollWindow,
  exportSlices,
} from "../src/writingModel.js";
import {
  getPaperLayout,
  PAPER,
  STRIKE,
  PAPER_MOUTH_Y,
  inkEnvelope,
} from "../src/referenceGeometry.js";

for (const layoutId of ["reference", "compact"])
  test(`${layoutId}: a 10,000-line scroll reloads without truncation and always meets the fixed strike`, () => {
    const model = blankDocument("scroll", {
      layoutId,
      activeLine: 9999,
      lines: Array.from({ length: 10000 }, (_, i) => ({
        cursor: 1,
        glyphs: [{ id: `${i}`, character: "路", x: 0, units: 1, seed: i }],
      })),
    });
    const restored = normalizeDocument(JSON.parse(JSON.stringify(model)));
    assert.equal(restored.lines.length, 10000);
    assert.equal(restored.activeLine, 9999);
    assert.equal(restored.pageFull, false);
    const layout = getPaperLayout(restored);
    assert.equal(layout.maxLines, Infinity);
    for (const activeLine of [0, 1, 10, 32, 33, 100, 9999]) {
      const band = rollWindow({ ...restored, activeLine }, layout);
      assert.ok(band.last - band.first < 40, "rendering must be bounded");
      const inkHeight =
        (PAPER.width * layout.trackWidth * layout.glyphHeight) / 10000;
      const top =
        PAPER.top +
        band.feed +
        (layout.start * PAPER.height) / 100 +
        (activeLine - band.first) * band.pitch;
      assert.ok(Math.abs(top + inkHeight / 2 - STRIKE.y) < 1e-8);
      assert.ok(
        PAPER.top + band.feed + band.height > PAPER_MOUTH_Y,
        "continuous stock still enters the platen",
      );
      assert.ok(inkEnvelope(layout).top > layout.bailY + layout.bailHeight / 2);
    }
    const slices = exportSlices(model);
    let next = 0;
    for (const slice of slices) {
      assert.equal(slice.first, next);
      assert.ok(slice.height <= 6000);
      assert.ok(slice.last > slice.first);
      next = slice.last;
    }
    assert.equal(next, 10000, "each line must export once without omission");
  });

test("legacy A4 retains its page limit and original ink seeds", () => {
  const model = normalizeDocument({
    layoutId: "compact",
    activeLine: 5,
    lines: Array.from({ length: 6 }, () => ({
      cursor: 1,
      glyphs: [{ id: "kept", character: "字", x: 0, units: 1, seed: 548 }],
    })),
  });
  assert.equal(model.kind, "sheet");
  assert.equal(getPaperLayout(model).maxLines, 33);
  assert.equal(model.lines[0].glyphs[0].seed, 548);
  assert.deepEqual(
    exportSlices(model).map((s) => s.height),
    [3508],
  );
});
