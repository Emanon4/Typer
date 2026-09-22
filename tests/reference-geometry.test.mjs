import assert from "node:assert/strict";
import test from "node:test";
import { PAPER, STRIKE, TYPEBARS, getPaperLayout, referenceCarriageOffset, strikeTravel, typebarPosition, layoutForFirstCharacter } from "../src/referenceGeometry.js";

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test("the source-video sheet keeps the physical A4 aspect ratio", () => {
  close(PAPER.width / PAPER.height, 210 / 297);
});

for (const layoutId of ["reference", "compact"]) {
  const layout = getPaperLayout({layoutId});
  const track = PAPER.width * layout.trackWidth / 100;
  const glyphHeight = track * layout.glyphHeight / 100;
  const pitch = track * layout.linePitch / 100;
  test(`${layoutId}: every cursor position lands at the fixed strike point`, () => {
    for(let cursor = 0; cursor <= layout.maxUnits; cursor += .01) {
      const glyphCenter = PAPER.left + PAPER.width * layout.trackLeft / 100 +
        track * (layout.glyphStart + cursor / layout.maxUnits * layout.glyphRange + layout.glyphWidth / 2) / 100;
      close(glyphCenter + referenceCarriageOffset(cursor, layout), STRIKE.x);
    }
  });
  test(`${layoutId}: all active rows keep strike height and clear the bail`, () => {
    for(let row = 0; row < layout.maxLines; row += 1) {
      const sheetY = PAPER.height * layout.start / 100 + row * pitch;
      const feedY = row * PAPER.height * layout.feed / 100;
      close(PAPER.top + sheetY - feedY + glyphHeight / 2, STRIKE.y);
      assert.ok(sheetY + glyphHeight < PAPER.height, `row ${row} stays on the physical sheet`);
      const top = STRIKE.y - glyphHeight / 2;
      const jitter = track * .12 / 100 + track * layout.glyphWidth / 100 * Math.sin(.48 * Math.PI / 180);
      assert.ok(layout.bailY + layout.bailHeight / 2 < top - jitter);
      assert.ok(layout.bailY - layout.bailHeight / 2 > top - pitch + glyphHeight + jitter);
    }
  });
}

test("every separate typebar returns to its own slot and converges on one strike point", () => {
  assert.equal(new Set(TYPEBARS.map(bar => `${bar.rest.x},${bar.rest.y}`)).size, TYPEBARS.length);
  for(const bar of TYPEBARS) {
    assert.deepEqual(typebarPosition(bar.index, 0).tip, bar.rest);
    close(typebarPosition(bar.index, 1).tip.x, STRIKE.x);
    close(typebarPosition(bar.index, 1).tip.y, STRIKE.y);
  }
  assert.equal(strikeTravel(50), 1);
  assert.equal(strikeTravel(78), 1);
  assert.equal(strikeTravel(132), 0);
});

test("Chinese gets full-page capacity and saved unversioned ink retains its compact layout", () => {
  assert.equal(layoutForFirstCharacter("中"), "compact");
  assert.equal(layoutForFirstCharacter("A"), "reference");
  assert.equal(getPaperLayout({lines:[{glyphs:[{character:"A"}]}]}).id, "compact");
  assert.equal(getPaperLayout({layoutId:"compact"}).maxLines, 33);
});
