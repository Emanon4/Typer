const shifted = { Semicolon: ":", Quote: '"', Comma: "<", Period: ">", Slash: "?" };

export function pointerKeyAction(key, shift = false) {
  if (key.code.startsWith("Shift")) return { type: "shift" };
  if (key.code === "Enter") return { type: "return" };
  if (key.code === "Backspace") return { type: "backspace" };
  if (key.code === "Space") return { type: "character", character: " ", code: "Space" };
  const character = /^Key[A-Z]$/.test(key.code)
    ? (shift ? key.label.toUpperCase() : key.label.toLowerCase())
    : (shift ? key.upper || shifted[key.code] || key.label : key.label);
  return { type: "character", character, code: key.code };
}
