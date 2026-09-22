import { useId, useMemo } from "react";
import { MAX_LINE_UNITS, GLYPH_START_PERCENT, GLYPH_RANGE_PERCENT, GLYPH_WIDTH_CQW, GLYPH_HEIGHT_CQW } from "./typewriterConfig";
import { inkImpression } from "./inkTypography";

// Paint directly at export resolution, never by enlarging a screen-sized stamp.
export function paintInkGlyph(canvas, glyph, options = {}) {
  const cssWidth = Math.max(1, options.cssWidth ?? canvas.clientWidth);
  const cssHeight = Math.max(1, options.cssHeight ?? canvas.clientHeight);
  const ratio = Math.max(1, options.ratio ?? window.devicePixelRatio ?? 1);
  canvas.width = Math.ceil(cssWidth * ratio);
  canvas.height = Math.ceil(cssHeight * ratio);
  const context = canvas.getContext("2d");
  const impression = inkImpression(glyph, cssWidth, cssHeight);
  const {type}=impression;
  context.scale(ratio, ratio);
  context.save();
  context.translate(cssWidth/2,cssHeight/2+impression.lift);
  context.rotate(impression.rotation*Math.PI/180);
  context.translate(-cssWidth/2,-cssHeight/2);
  context.font = `${type.fontWeight} ${type.fontSize}px ${type.fontFamily}`;
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.fillStyle = type.color;
  context.strokeStyle = type.color;
  context.lineWidth=impression.spread;
  context.globalAlpha=.18;
  context.strokeText(glyph.character,type.x,type.baseline);
  context.globalAlpha=1;
  context.fillText(glyph.character, type.x, type.baseline);
  context.globalCompositeOperation="destination-out";
  for(const wear of impression.wear) {
    context.globalAlpha=wear.opacity;
    context.fill(new Path2D(wear.path));
  }
  context.restore();
  context.globalCompositeOperation="destination-in";
  context.globalAlpha=type.opacity;
  context.fillRect(0,0,cssWidth,cssHeight);
}

export function InkGlyph({ glyph, final = false, layout }) {
  const width = (layout?.glyphWidth ?? GLYPH_WIDTH_CQW) * 100;
  const height = (layout?.glyphHeight ?? GLYPH_HEIGHT_CQW) * 100;
  const impression=useMemo(()=>inkImpression(glyph,width,height),[glyph.character,glyph.seed,width,height]);
  const {type}=impression;
  const maskId=`ink-${useId().replaceAll(":","")}`;
  return (
    <span
      className={`ink-glyph${final ? " final-ink" : ""}`}
      style={{left: `${(layout?.glyphStart ?? GLYPH_START_PERCENT) + (glyph.x / (layout?.maxUnits ?? MAX_LINE_UNITS)) * (layout?.glyphRange ?? GLYPH_RANGE_PERCENT)}%`}}
    >
      <svg className="ink-vector" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height} style={{maskType:"luminance"}}>
            <rect width={width} height={height} fill="white"/>
            {impression.wear.map((wear,index)=><path key={index} d={wear.path} fill="black" opacity={wear.opacity}/>)}
          </mask>
        </defs>
        <g opacity={type.opacity} transform={`translate(0 ${impression.lift}) rotate(${impression.rotation} ${width/2} ${height/2})`}>
          <text x={type.x} y={type.baseline} textAnchor="middle" fontFamily={type.fontFamily} fontWeight={type.fontWeight} fontSize={type.fontSize} fill={type.color} stroke={type.color} strokeWidth={impression.spread} strokeOpacity=".18" paintOrder="stroke" mask={`url(#${maskId})`}>
            {glyph.character === " " ? "\u00a0" : glyph.character}
          </text>
        </g>
      </svg>
      <span className="ink-accessible">{glyph.character === " " ? "\u00a0" : glyph.character}</span>
    </span>
  );
}
