import {
  STRIKE_CONTACT_MS,
  ESCAPEMENT_START_MS,
  STRIKE_CYCLE_MS,
} from "./typewriterConfig.js";

// One queue item owns the linkage until the typebar has returned and the
// carriage has settled. Cancelled items must never write to a replacement sheet.
export async function runStrikeCycle({
  printing, wait, isCurrent, press, imprint, advance, phase,
}) {
  if (!isCurrent()) return false;
  press();
  phase(printing ? "lift" : "spacing");
  if (printing) {
    await wait(STRIKE_CONTACT_MS);
    if (!isCurrent()) return false;
    phase("contact");
    imprint();
    await wait(ESCAPEMENT_START_MS - STRIKE_CONTACT_MS);
    if (!isCurrent()) return false;
  }
  phase("escapement");
  advance();
  await wait(STRIKE_CYCLE_MS - ESCAPEMENT_START_MS);
  if (!isCurrent()) return false;
  phase("idle");
  return true;
}
