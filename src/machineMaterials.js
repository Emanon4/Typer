// One repeatable surface texture, attached to each part's own clipping path.
// It cannot flicker between mechanical frames or spill onto paper/openings.
let enamelGrain;
const patterns = new WeakMap();

function grainPattern(ctx) {
  if (patterns.has(ctx)) return patterns.get(ctx);
  if (!enamelGrain) {
    enamelGrain = document.createElement("canvas");
    enamelGrain.width = enamelGrain.height = 192;
    const surface = enamelGrain.getContext("2d");
    let seed = 17391;
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 7600; i++) {
      const x = random() * 192, y = random() * 192;
      surface.fillStyle = i % 3 ? "rgba(0,0,0,.32)" : "rgba(255,246,216,.24)";
      surface.fillRect(x,y,.35 + random() * .65,.4 + random() * .6);
    }
    for (let i = 0; i < 28; i++) {
      const x = random() * 192, y = random() * 192;
      surface.fillStyle = "rgba(14,11,6,.14)";
      surface.fillRect(x,y,1.5 + random() * 4,.4);
    }
  }
  const pattern = ctx.createPattern(enamelGrain,"repeat");
  patterns.set(ctx,pattern);
  return pattern;
}

export function ageSurface(ctx,x,y,width,height,strength=.5) {
  ctx.save();
  ctx.clip();
  ctx.shadowColor = "transparent";
  ctx.globalAlpha *= strength;
  ctx.fillStyle = grainPattern(ctx);
  ctx.fillRect(x,y,width,height);
  ctx.restore();
}
