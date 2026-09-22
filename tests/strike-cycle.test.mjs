import assert from "node:assert/strict";
import test from "node:test";
import { runStrikeCycle } from "../src/strikeCycle.js";
import { STRIKE_CONTACT_MS, ESCAPEMENT_START_MS, STRIKE_CYCLE_MS } from "../src/typewriterConfig.js";

function fixture(printing = true, cancelAt = Infinity) {
  let elapsed = 0;
  const events = [];
  const record = (name) => events.push([name, elapsed]);
  return {
    events,
    options: {
      printing,
      wait: async (ms) => { elapsed += ms; },
      isCurrent: () => elapsed < cancelAt,
      press: () => record("press"),
      imprint: () => record("ink"),
      advance: () => record("advance"),
      phase: record,
    },
  };
}

test("ink appears at contact; escapement follows; next key waits for settling", async () => {
  const { events, options } = fixture();
  await runStrikeCycle(options);
  await runStrikeCycle(options);
  assert.deepEqual(events.filter(([name]) => ["press", "ink", "advance"].includes(name)), [
    ["press", 0], ["ink", STRIKE_CONTACT_MS], ["advance", ESCAPEMENT_START_MS],
    ["press", STRIKE_CYCLE_MS], ["ink", STRIKE_CYCLE_MS + STRIKE_CONTACT_MS],
    ["advance", STRIKE_CYCLE_MS + ESCAPEMENT_START_MS],
  ]);
});

test("space advances without ink or typebar lift", async () => {
  const { events, options } = fixture(false);
  await runStrikeCycle(options);
  assert.equal(events.some(([name]) => name === "ink" || name === "lift"), false);
  assert.equal(events.filter(([name]) => name === "advance").length, 1);
});

test("cancellation during lift prevents ink and escapement", async () => {
  const { events, options } = fixture(true, STRIKE_CONTACT_MS);
  assert.equal(await runStrikeCycle(options), false);
  assert.equal(events.some(([name]) => name === "ink" || name === "advance"), false);
});

test("cancellation after contact prevents a stale escapement", async () => {
  const { events, options } = fixture(true, ESCAPEMENT_START_MS);
  assert.equal(await runStrikeCycle(options), false);
  assert.equal(events.filter(([name]) => name === "ink").length, 1);
  assert.equal(events.some(([name]) => name === "advance"), false);
});
