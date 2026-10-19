// A strike cycle takes ~130 ms, so a long paste would hold the machine for
// minutes. Typing more than this at once is truncated with a visible notice.
export const MAX_PASTE_GRAPHEMES = 2000;

export function splitGraphemes(text) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    return [
      ...new Intl.Segmenter("zh-Hans", { granularity: "grapheme" }).segment(text),
    ].map((entry) => entry.segment);
  }
  return Array.from(text);
}

export function limitPaste(text, max = MAX_PASTE_GRAPHEMES) {
  const graphemes = splitGraphemes(text.replace(/\r/g, ""));
  return {
    text: graphemes.slice(0, max).join(""),
    dropped: Math.max(0, graphemes.length - max),
  };
}

// A held key repeats only at the machine's own pace, and only for the keys
// that move the carriage. Printing keys never auto-repeat on a typewriter.
export function acceptsKeyRepeat(key, pending) {
  return pending === 0 && (key === "Backspace" || key === " ");
}
