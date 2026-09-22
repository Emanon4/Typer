export const MAX_LINE_UNITS = 26;
export const MAX_LINES = 33;

// All stage percentages refer to the source video's 5:4 mechanical rig.
// The environment fills the viewport independently. Paper and ink
// percentages refer to their own unbordered boxes; a CSS border would change
// the ink container width and break these relationships. Draw the paper edge
// with an inset shadow instead.
export const STAGE_ASPECT_RATIO = 5 / 4;
export const PAPER_ASPECT_RATIO = 210 / 297;
export const LIVE_PAPER_LEFT_PERCENT = 31.5;
export const LIVE_PAPER_WIDTH_PERCENT = 37;
export const LIVE_PAPER_HEIGHT_PERCENT =
  (LIVE_PAPER_WIDTH_PERCENT * STAGE_ASPECT_RATIO) / PAPER_ASPECT_RATIO;
export const INK_TRACK_LEFT_PERCENT = 4;
export const INK_TRACK_WIDTH_PERCENT = 92;
export const GLYPH_START_PERCENT = 8;
export const GLYPH_RANGE_PERCENT = 84;
export const GLYPH_WIDTH_CQW = 3.2;
export const GLYPH_HEIGHT_CQW = 3.05;
export const INK_MAX_LIFT_CQW = 0.12;
export const INK_MAX_ROTATION_DEGREES = 0.48;
export const LINE_PITCH_CQW = 4.1;
export const PAPER_START_LINE_PERCENT = 12;
// Align the guide in reference-machine-body-v1.png with the live strike.
export const LIVE_PAPER_TOP_PERCENT = 49.75 -
  (PAPER_START_LINE_PERCENT / 100) * LIVE_PAPER_HEIGHT_PERCENT -
  GLYPH_HEIGHT_CQW * (INK_TRACK_WIDTH_PERCENT / 100) *
  (LIVE_PAPER_WIDTH_PERCENT / 100) * STAGE_ASPECT_RATIO / 2;
export const TYPEBAR_ORIGIN_Y_PERCENT = 65.16;
export const CARRIAGE_WIDTH_PERCENT = 70;

// cqw is measured against the ink track; feed is measured against A4 height.
export const PAPER_FEED_PERCENT =
  LINE_PITCH_CQW * (INK_TRACK_WIDTH_PERCENT / 100) * PAPER_ASPECT_RATIO;
export const GLYPH_HEIGHT_PAPER_PERCENT =
  GLYPH_HEIGHT_CQW * (INK_TRACK_WIDTH_PERCENT / 100) * PAPER_ASPECT_RATIO;
export const LINE_PITCH_STAGE_PERCENT =
  (PAPER_FEED_PERCENT / 100) * LIVE_PAPER_HEIGHT_PERCENT;
export const GLYPH_HEIGHT_STAGE_PERCENT =
  (GLYPH_HEIGHT_PAPER_PERCENT / 100) * LIVE_PAPER_HEIGHT_PERCENT;
export const GLYPH_WIDTH_PAPER_PERCENT =
  GLYPH_WIDTH_CQW * (INK_TRACK_WIDTH_PERCENT / 100);

// Rotation is around 25% 60% of the glyph box (the InkGlyph CSS origin).
// Express even horizontal extents in stage-height units before rotating.
const glyphWidthInStageHeightPercent =
  (GLYPH_WIDTH_PAPER_PERCENT / 100) * LIVE_PAPER_WIDTH_PERCENT * STAGE_ASPECT_RATIO;
const maximumRotationRadians = INK_MAX_ROTATION_DEGREES * Math.PI / 180;
export const GLYPH_VERTICAL_OVERFLOW_STAGE_PERCENT =
  INK_MAX_LIFT_CQW * (INK_TRACK_WIDTH_PERCENT / 100) *
    (LIVE_PAPER_WIDTH_PERCENT / 100) * STAGE_ASPECT_RATIO +
  0.75 * glyphWidthInStageHeightPercent * Math.sin(maximumRotationRadians) +
  0.6 * GLYPH_HEIGHT_STAGE_PERCENT * (1 - Math.cos(maximumRotationRadians));

export const STRIKE_X_PERCENT = 50;
export const ACTIVE_LINE_TOP_PERCENT =
  LIVE_PAPER_TOP_PERCENT +
  (PAPER_START_LINE_PERCENT / 100) * LIVE_PAPER_HEIGHT_PERCENT;
export const STRIKE_Y_PERCENT =
  ACTIVE_LINE_TOP_PERCENT + GLYPH_HEIGHT_STAGE_PERCENT / 2;

export const PAPER_BAIL_WIDTH_PERCENT = 39;
// This band describes a clean rendered rod, not the opaque extent of a PNG.
// It sits between glyph boxes including the paper-scaled lift and rotation
// envelope defined above. Fixed-pixel jitter cannot preserve that guarantee.
export const PAPER_BAIL_HEIGHT_PERCENT = 0.24;
export const PREVIOUS_LINE_BOTTOM_PERCENT =
  ACTIVE_LINE_TOP_PERCENT - LINE_PITCH_STAGE_PERCENT + GLYPH_HEIGHT_STAGE_PERCENT;
export const PAPER_BAIL_CENTER_Y_PERCENT =
  (PREVIOUS_LINE_BOTTOM_PERCENT + ACTIVE_LINE_TOP_PERCENT) / 2;
export const PAPER_BAIL_TOP_PERCENT =
  PAPER_BAIL_CENTER_Y_PERCENT - PAPER_BAIL_HEIGHT_PERCENT / 2;
export const PAPER_BAIL_BOTTOM_PERCENT =
  PAPER_BAIL_CENTER_Y_PERCENT + PAPER_BAIL_HEIGHT_PERCENT / 2;
export const PAPER_CLIP_BOTTOM_PERCENT =
  ACTIVE_LINE_TOP_PERCENT + GLYPH_HEIGHT_STAGE_PERCENT +
  GLYPH_VERTICAL_OVERFLOW_STAGE_PERCENT;

export function glyphOffsetOnPaperPercent(cursor) {
  return (
    INK_TRACK_LEFT_PERCENT +
    (INK_TRACK_WIDTH_PERCENT / 100) *
      (GLYPH_START_PERCENT + (cursor / MAX_LINE_UNITS) * GLYPH_RANGE_PERCENT)
  );
}

// At rest, the NEXT glyph's box center is at the fixed strike point. Commit
// ink before advancing cursor so its physical impression lands there first.
export function carriageOffsetPercent(cursor) {
  const strikeOnPaper =
    ((STRIKE_X_PERCENT - LIVE_PAPER_LEFT_PERCENT) / LIVE_PAPER_WIDTH_PERCENT) * 100;
  return strikeOnPaper - glyphOffsetOnPaperPercent(cursor) - GLYPH_WIDTH_PAPER_PERCENT / 2;
}

// Convert one physical carriage displacement into another part's local %.
export function carriageOffsetForWidthPercent(cursor, partWidthPercent) {
  return carriageOffsetPercent(cursor) *
    (LIVE_PAPER_WIDTH_PERCENT / partWidthPercent);
}

export function bailCarriageOffsetPercent(cursor) {
  return carriageOffsetForWidthPercent(cursor, PAPER_BAIL_WIDTH_PERCENT);
}

export function paperFeedOffsetPercent(activeLine) {
  return -activeLine * PAPER_FEED_PERCENT;
}

export function printedLineTopOnPaperPercent(lineIndex) {
  return PAPER_START_LINE_PERCENT + lineIndex * PAPER_FEED_PERCENT;
}

export function printedLineStageBounds(lineIndex, activeLine = lineIndex) {
  const top = LIVE_PAPER_TOP_PERCENT +
    ((printedLineTopOnPaperPercent(lineIndex) + paperFeedOffsetPercent(activeLine)) / 100) *
      LIVE_PAPER_HEIGHT_PERCENT;
  return { top, bottom: top + GLYPH_HEIGHT_STAGE_PERCENT };
}

export const STRIKE_DURATION_MS = 132;
export const STRIKE_CONTACT_MS = 50;
export const ESCAPEMENT_START_MS = 78;
export const CARRIAGE_SETTLE_MS = 76;
export const STRIKE_CYCLE_MS = Math.max(
  STRIKE_DURATION_MS,
  ESCAPEMENT_START_MS + CARRIAGE_SETTLE_MS,
);
