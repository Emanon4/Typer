import { useLayoutEffect, useRef, useState } from "react";
import { InkGlyph } from "./InkGlyph";
import { getPaperLayout, paperLayoutStyle } from "./referenceGeometry";
import { useRollPaperStyle } from "./rollPaperTexture";

export function paperStyle(paper) {
  return {
    "--paper-texture": `url("${paper.asset}")`,
    "--paper-base": paper.base,
    "--paper-size": paper.backgroundSize,
    "--paper-position": paper.backgroundPosition,
  };
}
export function PaperDocument({ draft, paper }) {
  const layout = getPaperLayout(draft),
    roll = draft.kind === "scroll";
  const textureStyle = useRollPaperStyle(paperStyle(paper), roll);
  const viewport = useRef(null),
    [width, setWidth] = useState(480),
    [scrollTop, setScrollTop] = useState(0);
  useLayoutEffect(() => {
    if (!roll || !viewport.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [roll]);
  const pitch = (width * layout.trackWidth * layout.linePitch) / 10000;
  const top = (((width * 297) / 210) * layout.start) / 100;
  const first = roll
    ? Math.max(0, Math.floor((scrollTop - top) / pitch) - 5)
    : 0;
  const last = roll
    ? Math.min(draft.lines.length, first + Math.ceil(900 / pitch) + 10)
    : draft.lines.length;
  const content = (
    <article
      className={`final-sheet${roll ? " final-roll" : ""}`}
      style={{
        ...textureStyle,
        ...paperLayoutStyle(layout),
        ...(roll
          ? {
              height: Math.max(
                width * 1.2,
                top + draft.lines.length * pitch + 80,
              ),
            }
          : {}),
      }}
    >
      <div className="paper-grain" />
      <div className="final-copy">
        {draft.lines.slice(first, last).map((line, i) => (
          <div
            className="final-line"
            style={{
              top: roll
                ? `${top + (first + i) * pitch}px`
                : `calc(${layout.start}% + ${(first + i) * layout.linePitch}cqw)`,
            }}
            key={first + i}
          >
            {line.glyphs.map((glyph) => (
              <InkGlyph glyph={glyph} final layout={layout} key={glyph.id} />
            ))}
          </div>
        ))}
      </div>
    </article>
  );
  return roll ? (
    <div
      className="roll-reader"
      ref={viewport}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      tabIndex={0}
      aria-label="展开阅读长卷"
    >
      {content}
    </div>
  ) : (
    content
  );
}
