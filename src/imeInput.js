const EMPTY = Object.freeze({ text: "", clear: false });

/**
 * Consume an uncontrolled textarea without printing its IME preedit text.
 *
 * The host must keep the textarea value when `clear` is false. In particular,
 * compositionend leaves the committed buffer in place until the next input:
 * some browsers deliver that last input before compositionend, others after.
 * Remembering the consumed buffer lets us handle either order without timers
 * or suppressing a future insertion merely because it contains the same text.
 */
export function createImeInputAdapter() {
  let composing = false;
  let prefix = "";
  let consumed = null;

  return {
    start({ value = "" } = {}) {
      composing = true;
      prefix = value;
      consumed = null;
      return EMPTY;
    },

    input({ value = "", isComposing = false, inputType = "", data } = {}) {
      if (composing || isComposing) return EMPTY;

      let text = value;
      if (inputType.startsWith("delete") || inputType === "historyUndo") {
        text = "";
      } else if (consumed) {
        // These are distinct editing operations, never the trailing IME input.
        if (
          (inputType === "insertFromPaste" ||
            inputType === "insertReplacementText") &&
          typeof data === "string"
        ) {
          text = data;
        } else {
          // The expected value also covers engines that update the textarea
          // only after compositionend. Prefer the longest matching prefix.
          const previous = consumed
            .filter((candidate) => value.startsWith(candidate))
            .sort((a, b) => b.length - a.length)[0];
          if (previous !== undefined) text = value.slice(previous.length);
        }
      }

      consumed = null;
      prefix = "";
      return { text, clear: true };
    },

    end({ value = "", data = "" } = {}) {
      composing = false;
      const text = typeof data === "string" ? data : "";
      consumed = [...new Set([value, prefix + text])];
      prefix = "";
      return { text, clear: false };
    },

    reset() {
      composing = false;
      consumed = null;
      prefix = "";
      return { text: "", clear: true };
    },
  };
}
