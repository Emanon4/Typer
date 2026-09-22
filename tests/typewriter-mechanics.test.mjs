import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVE_LINE_TOP_PERCENT,
  CARRIAGE_SETTLE_MS,
  CARRIAGE_WIDTH_PERCENT,
  ESCAPEMENT_START_MS,
  GLYPH_HEIGHT_PAPER_PERCENT,
  GLYPH_HEIGHT_STAGE_PERCENT,
  GLYPH_VERTICAL_OVERFLOW_STAGE_PERCENT,
  GLYPH_WIDTH_PAPER_PERCENT,
  LIVE_PAPER_HEIGHT_PERCENT,
  LIVE_PAPER_LEFT_PERCENT,
  LIVE_PAPER_WIDTH_PERCENT,
  MAX_LINES,
  MAX_LINE_UNITS,
  PAPER_ASPECT_RATIO,
  PAPER_BAIL_BOTTOM_PERCENT,
  PAPER_BAIL_TOP_PERCENT,
  PAPER_BAIL_WIDTH_PERCENT,
  PAPER_CLIP_BOTTOM_PERCENT,
  PAPER_FEED_PERCENT,
  STAGE_ASPECT_RATIO,
  STRIKE_CONTACT_MS,
  STRIKE_CYCLE_MS,
  STRIKE_DURATION_MS,
  STRIKE_X_PERCENT,
  STRIKE_Y_PERCENT,
  bailCarriageOffsetPercent,
  carriageOffsetPercent,
  carriageOffsetForWidthPercent,
  glyphOffsetOnPaperPercent,
  printedLineStageBounds,
  printedLineTopOnPaperPercent,
} from "../src/typewriterConfig.js";

function almostEqual(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-10, `${message}: ${actual} !== ${expected}`);
}

test("the live sheet preserves A4 inside the source-video 5:4 rig", () => {
  almostEqual(
    (LIVE_PAPER_WIDTH_PERCENT * STAGE_ASPECT_RATIO) / LIVE_PAPER_HEIGHT_PERCENT,
    PAPER_ASPECT_RATIO,
    "sheet aspect ratio",
  );
});

test("every possible hundredth-unit cursor has one fixed strike point and carriage displacement", () => {
  // This covers full-width Chinese, .56-unit Latin, .55-unit spaces and their
  // mixed sequences, including the right margin before automatic return.
  for (let hundredths = 0; hundredths <= MAX_LINE_UNITS * 100; hundredths += 1) {
    const cursor = hundredths / 100;
    const sheetDisplacement = carriageOffsetPercent(cursor) * LIVE_PAPER_WIDTH_PERCENT / 100;
    const glyphStageX = LIVE_PAPER_LEFT_PERCENT + sheetDisplacement +
      (glyphOffsetOnPaperPercent(cursor) + GLYPH_WIDTH_PAPER_PERCENT / 2) *
        LIVE_PAPER_WIDTH_PERCENT / 100;
    almostEqual(glyphStageX, STRIKE_X_PERCENT, `strike at cursor ${cursor}`);
    almostEqual(
      bailCarriageOffsetPercent(cursor) * PAPER_BAIL_WIDTH_PERCENT / 100,
      sheetDisplacement,
      `paper/bail carriage at cursor ${cursor}`,
    );
    almostEqual(
      carriageOffsetForWidthPercent(cursor, CARRIAGE_WIDTH_PERCENT) * CARRIAGE_WIDTH_PERCENT / 100,
      sheetDisplacement,
      `paper/platen carriage at cursor ${cursor}`,
    );
  }
});

test("all 33 active rows stay at the strike height and fit on the original A4 sheet", () => {
  for (let line = 0; line < MAX_LINES; line += 1) {
    const bounds = printedLineStageBounds(line);
    almostEqual(bounds.top, ACTIVE_LINE_TOP_PERCENT, `active row ${line}`);
    almostEqual((bounds.top + bounds.bottom) / 2, STRIKE_Y_PERCENT, `strike row ${line}`);
    assert.ok(printedLineTopOnPaperPercent(line) >= 0);
    assert.ok(printedLineTopOnPaperPercent(line) + GLYPH_HEIGHT_PAPER_PERCENT +
      GLYPH_VERTICAL_OVERFLOW_STAGE_PERCENT / LIVE_PAPER_HEIGHT_PERCENT * 100 <= 100);
    almostEqual(
      bounds.bottom + GLYPH_VERTICAL_OVERFLOW_STAGE_PERCENT,
      PAPER_CLIP_BOTTOM_PERCENT,
      `ink envelope clip row ${line}`,
    );
    if (line > 0) {
      almostEqual(
        printedLineTopOnPaperPercent(line) - printedLineTopOnPaperPercent(line - 1),
        PAPER_FEED_PERCENT,
        `one platen step for row ${line}`,
      );
    }
  }
});

test("the rendered bail band clears paper-scaled lift and rotation at every row", () => {
  for (let activeLine = 0; activeLine < MAX_LINES; activeLine += 1) {
    const active = printedLineStageBounds(activeLine);
    const previous = printedLineStageBounds(activeLine - 1, activeLine);
    assert.ok(PAPER_BAIL_BOTTOM_PERCENT < active.top - GLYPH_VERTICAL_OVERFLOW_STAGE_PERCENT,
      `active row ${activeLine} clearance`);
    assert.ok(PAPER_BAIL_TOP_PERCENT > previous.bottom + GLYPH_VERTICAL_OVERFLOW_STAGE_PERCENT,
      `previous row ${activeLine} clearance`);
    almostEqual(
      active.top - PAPER_BAIL_BOTTOM_PERCENT,
      PAPER_BAIL_TOP_PERCENT - previous.bottom,
      `balanced bail clearance at row ${activeLine}`,
    );
    almostEqual(active.bottom - active.top, GLYPH_HEIGHT_STAGE_PERCENT, "glyph height");
  }
});

test("the mechanism finishes both typebar return and escapement before another cycle", () => {
  assert.ok(STRIKE_CONTACT_MS > 0);
  assert.ok(STRIKE_CONTACT_MS < ESCAPEMENT_START_MS);
  assert.ok(ESCAPEMENT_START_MS < STRIKE_DURATION_MS);
  assert.ok(STRIKE_CYCLE_MS >= STRIKE_DURATION_MS);
  assert.ok(STRIKE_CYCLE_MS >= ESCAPEMENT_START_MS + CARRIAGE_SETTLE_MS);
});
