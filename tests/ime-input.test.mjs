import test from "node:test";
import assert from "node:assert/strict";
import { createImeInputAdapter } from "../src/imeInput.js";

function writer() {
  const adapter = createImeInputAdapter();
  let value = "";
  const printed = [];
  return {
    printed,
    get value() {
      return value;
    },
    event(method, details = {}) {
      if (details.value !== undefined) value = details.value;
      const result = adapter[method]({ ...details, value });
      if (result.text) printed.push(result.text);
      if (result.clear) value = "";
      return result;
    },
  };
}

test("preedit never prints, including a final input before compositionend", () => {
  const input = writer();
  input.event("start");
  input.event("input", {
    value: "ni",
    data: "ni",
    isComposing: true,
    inputType: "insertCompositionText",
  });
  input.event("input", {
    value: "你",
    data: "你",
    isComposing: false,
    inputType: "insertFromComposition",
  });
  assert.deepEqual(input.printed, []);
  input.event("end", { data: "你" });
  assert.deepEqual(input.printed, ["你"]);
});

for (const inputType of ["insertText", "insertCompositionText", "insertFromComposition"]) {
  test(`a trailing ${inputType} consumes the committed buffer only once`, () => {
    const input = writer();
    input.event("start");
    input.event("input", { value: "你好", isComposing: true });
    input.event("end", { data: "你好" });
    input.event("input", { value: "你好", data: "你好", inputType });
    assert.deepEqual(input.printed, ["你好"]);
    assert.equal(input.value, "");
  });
}

test("compositionend may precede the final textarea update", () => {
  const input = writer();
  input.event("start");
  input.event("input", { value: "nihao", isComposing: true });
  input.event("end", { data: "你好" });
  input.event("input", { value: "你好", data: "你好", inputType: "insertText" });
  assert.deepEqual(input.printed, ["你好"]);
  assert.equal(input.value, "");
});

test("a genuine identical insertion following a trailing input is preserved", () => {
  const input = writer();
  input.event("start");
  input.event("end", { value: "你", data: "你" });
  input.event("input", { value: "你", data: "你", inputType: "insertText" });
  input.event("input", { value: "你", data: "你", inputType: "insertText" });
  assert.deepEqual(input.printed, ["你", "你"]);
});

test("new text is preserved when the browser has no trailing input", () => {
  const input = writer();
  input.event("start");
  input.event("input", { value: "你", isComposing: true });
  input.event("end", { data: "你" });
  // The committed textarea buffer remains, so the next edit appends to it.
  input.event("input", { value: input.value + "你", data: "你", inputType: "insertText" });
  assert.deepEqual(input.printed, ["你", "你"]);
  assert.equal(input.value, "");
});

test("consecutive compositions can commit identical words without a trailing input", () => {
  const input = writer();
  for (let count = 0; count < 3; count += 1) {
    input.event("start");
    input.event("input", { value: input.value + "你好", isComposing: true });
    input.event("end", { data: "你好" });
  }
  assert.deepEqual(input.printed, ["你好", "你好", "你好"]);
  input.event("input", { inputType: "insertFromComposition", data: "你好" });
  assert.equal(input.value, "");
  assert.deepEqual(input.printed, ["你好", "你好", "你好"]);
});

test("cancelling a composition prints neither preedit nor its trailing deletion", () => {
  const input = writer();
  input.event("start");
  input.event("input", { value: "quxiao", isComposing: true });
  input.event("end", { data: "" });
  input.event("input", { value: "", inputType: "deleteCompositionText" });
  assert.deepEqual(input.printed, []);
  input.event("input", { value: "a", data: "a", inputType: "insertText" });
  assert.deepEqual(input.printed, ["a"]);
});

test("a cancelled composition with an unchanged final buffer is not printed", () => {
  const input = writer();
  input.event("start");
  input.event("input", { value: "quxiao", isComposing: true });
  input.event("end", { data: "" });
  input.event("input", { inputType: "insertCompositionText" });
  assert.deepEqual(input.printed, []);
});

test("native isComposing protects preedit even if compositionstart was not observed", () => {
  const input = writer();
  input.event("input", { value: "zhong", isComposing: true });
  assert.deepEqual(input.printed, []);
  assert.equal(input.value, "zhong");
  input.event("end", { value: "中", data: "中" });
  input.event("input", { inputType: "insertText", data: "中" });
  assert.deepEqual(input.printed, ["中"]);
});

test("paste or replacement of identical text is a new operation", () => {
  for (const inputType of ["insertFromPaste", "insertReplacementText"]) {
    const input = writer();
    input.event("start");
    input.event("end", { value: "你", data: "你" });
    input.event("input", { value: "你", data: "你", inputType });
    assert.deepEqual(input.printed, ["你", "你"]);
  }
});

test("ordinary inputs preserve complete Unicode text and line breaks", () => {
  const input = writer();
  const text = "你好👩🏽‍💻e\u0301\n第二行";
  input.event("input", { value: text, inputType: "insertFromPaste" });
  assert.deepEqual(input.printed, [text]);
  assert.equal(input.value, "");
});

test("reset drops an abandoned transaction without printing it", () => {
  const input = writer();
  input.event("start");
  input.event("input", { value: "wei", isComposing: true });
  input.event("reset");
  input.event("input", { value: "新", inputType: "insertText" });
  assert.deepEqual(input.printed, ["新"]);
});
