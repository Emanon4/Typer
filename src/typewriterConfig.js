export const MAX_LINE_UNITS = 26;
export const MAX_LINES = 33;
// Glyph rows use a 92%-wide ink track inside an A4 sheet. A 4.1cqw row is
// therefore a 2.667%-high platen step: 4.1 * 0.92 / (297 / 210). Keeping these
// values coupled holds the strike line fixed and leaves paper below line 33.
export const LINE_PITCH_CQW = 4.1;
export const PAPER_FEED_PERCENT = 2.667;
export const PAPER_START_LINE_PERCENT = 12;
export const LIVE_PAPER_WIDTH_PERCENT = 45;
export const PAPER_BAIL_WIDTH_PERCENT = 49;
