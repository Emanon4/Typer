import { useEffect, useMemo, useRef, useState } from "react";
import { createAudioEngine } from "./audioEngine";
import { exportPaperPng } from "./exportPaper";
import { InkGlyph } from "./InkGlyph";
import {
  getPaperTemplate,
  loadPaperTemplateId,
  PAPER_SELECTION_KEY,
  PAPER_TEMPLATES,
} from "./paperTemplates";

const MAX_LINE_UNITS = 17.5;
const MAX_LINES = 11;
const LINE_PITCH_CQW = 5.2;
const PAPER_FEED_PERCENT = 3.37;
const PAPER_START_LINE_PERCENT = 11.3;
const LIVE_PAPER_WIDTH_PERCENT = 42;
const PAPER_BAIL_WIDTH_PERCENT = 49;
const STORAGE_KEY = "lead-typewriter-draft-v1";
const SOUND_KEY = "lead-typewriter-sound-v1";

const KEY_ROWS = [
  {
    codes: [
      "Digit1",
      "Digit2",
      "Digit3",
      "Digit4",
      "Digit5",
      "Digit6",
      "Digit7",
      "Digit8",
      "Digit9",
      "Digit0",
      "Minus",
      "Equal",
    ],
    centers: [522, 572, 622, 672, 722, 772, 823, 873, 924, 975, 1025, 1075],
    top: 709,
  },
  {
    codes: [
      "KeyQ",
      "KeyW",
      "KeyE",
      "KeyR",
      "KeyT",
      "KeyY",
      "KeyU",
      "KeyI",
      "KeyO",
      "KeyP",
      "BracketLeft",
      "BracketRight",
    ],
    centers: [485, 537, 589, 641, 693, 745, 797, 849, 901, 953, 1005, 1057],
    top: 750,
  },
  {
    codes: [
      "KeyA",
      "KeyS",
      "KeyD",
      "KeyF",
      "KeyG",
      "KeyH",
      "KeyJ",
      "KeyK",
      "KeyL",
      "Semicolon",
      "Quote",
      "Enter",
    ],
    centers: [491, 545, 599, 653, 707, 761, 815, 869, 923, 977, 1031, 1085],
    top: 799,
  },
  {
    codes: [
      "ShiftLeft",
      "KeyZ",
      "KeyX",
      "KeyC",
      "KeyV",
      "KeyB",
      "KeyN",
      "KeyM",
      "Comma",
      "Period",
      "Slash",
      "Backslash",
      "ShiftRight",
    ],
    centers: [444, 512, 565, 619, 672, 726, 780, 834, 888, 942, 995, 1048, 1103],
    top: 841,
  },
];

const KEY_POSITIONS = KEY_ROWS.flatMap((row) =>
  row.codes.map((code, index) => ({
    code,
    left: (row.centers[index] / 1536) * 100,
    top: (row.top / 1024) * 100,
  })),
);

function blankModel() {
  return {
    lines: [{ glyphs: [], cursor: 0 }],
    activeLine: 0,
    pageFull: false,
  };
}

function loadDraft() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed || !Array.isArray(parsed.lines) || !parsed.lines.length) {
      return blankModel();
    }
    return {
      lines: parsed.lines.slice(0, MAX_LINES).map((line) => ({
        glyphs: Array.isArray(line.glyphs) ? line.glyphs : [],
        cursor: Number.isFinite(line.cursor) ? line.cursor : 0,
      })),
      activeLine: Math.min(
        Number.isFinite(parsed.activeLine) ? parsed.activeLine : 0,
        Math.min(parsed.lines.length - 1, MAX_LINES - 1),
      ),
      pageFull: Boolean(parsed.pageFull),
    };
  } catch {
    return blankModel();
  }
}

function splitGraphemes(text) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    return [
      ...new Intl.Segmenter("zh-Hans", { granularity: "grapheme" }).segment(
        text,
      ),
    ].map((entry) => entry.segment);
  }
  return Array.from(text);
}

function glyphUnits(character) {
  if (character === "\t") return 2;
  if (/\s/u.test(character)) return 0.55;
  if (
    /[\u2E80-\u2EFF\u2F00-\u2FDF\u3000-\u303F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u{20000}-\u{2FA1F}]/u.test(
      character,
    )
  ) {
    return 1;
  }
  return 0.56;
}

function codeHash(value) {
  return Array.from(value || "字").reduce(
    (total, character) => total + character.codePointAt(0),
    0,
  );
}

export function App() {
  const [model, setModel] = useState(loadDraft);
  const [soundOn, setSoundOn] = useState(
    () => localStorage.getItem(SOUND_KEY) !== "off",
  );
  const [activeKey, setActiveKey] = useState("");
  const [machineHit, setMachineHit] = useState(false);
  const [returning, setReturning] = useState(false);
  const [strike, setStrike] = useState({ id: 0, hash: 0 });
  const [compositionText, setCompositionText] = useState("");
  const [focused, setFocused] = useState(false);
  const [ejecting, setEjecting] = useState(false);
  const [ejected, setEjected] = useState(false);
  const [exportState, setExportState] = useState("idle");
  const [paperBoxOpen, setPaperBoxOpen] = useState(false);
  const [paperId, setPaperId] = useState(loadPaperTemplateId);
  const [status, setStatus] = useState("点击纸张，开始写作");

  const modelRef = useRef(model);
  const soundRef = useRef(soundOn);
  const inputRef = useRef(null);
  const compositionRef = useRef(false);
  const audioRef = useRef(null);
  const queueRef = useRef([]);
  const processingRef = useRef(false);
  const glyphIdRef = useRef(Date.now());
  const timersRef = useRef([]);

  const activeLine = model.lines[model.activeLine] || model.lines[0];
  const carriageX =
    ((MAX_LINE_UNITS / 2 - activeLine.cursor) / MAX_LINE_UNITS) * 58;
  const bailCarriageX =
    carriageX * (LIVE_PAPER_WIDTH_PERCENT / PAPER_BAIL_WIDTH_PERCENT);
  const hasInk = model.lines.some((line) => line.glyphs.length > 0);
  const selectedPaper = getPaperTemplate(paperId);
  const paperVisualStyle = {
    "--paper-texture": `url("${selectedPaper.asset}")`,
    "--paper-base": selectedPaper.base,
    "--paper-size": selectedPaper.backgroundSize,
    "--paper-position": selectedPaper.backgroundPosition,
  };

  const strikeClip = useMemo(() => {
    const lane = (strike.hash % 17) - 8;
    const topX = 50 + lane * 0.72;
    return `polygon(${topX - 0.42}% 52.5%, ${topX + 0.42}% 52.5%, 50.65% 68.8%, 49.35% 68.8%)`;
  }, [strike]);

  function rememberTimer(timer) {
    timersRef.current.push(timer);
    return timer;
  }

  function audio() {
    if (!audioRef.current) audioRef.current = createAudioEngine();
    return audioRef.current;
  }

  function play(name, ...args) {
    if (!soundRef.current) return;
    audio()[name]?.(...args);
  }

  function commitModel(nextModel) {
    modelRef.current = nextModel;
    setModel(nextModel);
  }

  function flashKey(code, light = false) {
    if (code) setActiveKey(code);
    setMachineHit(true);
    play(code === "Space" ? "space" : "key", light);
    rememberTimer(
      window.setTimeout(() => {
        setActiveKey("");
        setMachineHit(false);
      }, light ? 58 : 86),
    );
  }

  function delay(milliseconds) {
    return new Promise((resolve) => {
      rememberTimer(window.setTimeout(resolve, milliseconds));
    });
  }

  async function performReturn() {
    const current = modelRef.current;
    if (current.activeLine >= MAX_LINES - 1) {
      const full = { ...current, pageFull: true };
      commitModel(full);
      setStatus("纸张已写满，请退纸成稿");
      play("carriage");
      await delay(260);
      return false;
    }

    setReturning(true);
    setActiveKey("Enter");
    setStatus("回车换行");
    play("carriage");
    const next = {
      lines: [
        ...current.lines,
        { glyphs: [], cursor: 0 },
      ],
      activeLine: current.activeLine + 1,
      pageFull: false,
    };
    commitModel(next);
    await delay(850);
    setReturning(false);
    setActiveKey("");
    setStatus("中文输入已就绪");
    return true;
  }

  async function performBackspace() {
    const current = modelRef.current;
    const line = current.lines[current.activeLine];
    if (!line || line.cursor <= 0) {
      play("backspace");
      await delay(65);
      return;
    }
    const previousGlyph = [...line.glyphs]
      .reverse()
      .find((glyph) => glyph.x < line.cursor - 0.01);
    const step = previousGlyph?.units || 0.56;
    const lines = [...current.lines];
    lines[current.activeLine] = {
      ...line,
      cursor: Math.max(0, line.cursor - step),
    };
    commitModel({ ...current, lines });
    setReturning(true);
    play("backspace");
    await delay(95);
    setReturning(false);
  }

  async function performCharacter(item) {
    const character = item.character;
    const units = glyphUnits(character);
    let current = modelRef.current;
    let line = current.lines[current.activeLine];

    if (current.pageFull) {
      setStatus("纸张已写满，请退纸成稿");
      return;
    }

    if (line.cursor + units > MAX_LINE_UNITS) {
      const advanced = await performReturn();
      if (!advanced) return;
      current = modelRef.current;
      line = current.lines[current.activeLine];
    }

    const seed = codeHash(character) + glyphIdRef.current;
    const glyph = {
      id: `${glyphIdRef.current++}`,
      character,
      x: line.cursor,
      units,
      seed,
    };
    const lines = [...current.lines];
    lines[current.activeLine] = {
      glyphs: [...line.glyphs, glyph],
      cursor: line.cursor + units,
    };
    commitModel({ ...current, lines });
    flashKey(item.code || "", false);
    setStrike((previous) => ({ id: previous.id + 1, hash: seed }));
    setStatus(compositionRef.current ? "中文正在落纸" : "正在写作");
    await delay(character === " " ? 54 : 72);
  }

  async function processQueue() {
    if (processingRef.current || ejected || ejecting) return;
    processingRef.current = true;
    while (queueRef.current.length) {
      const item = queueRef.current.shift();
      if (item.type === "return") await performReturn();
      if (item.type === "backspace") await performBackspace();
      if (item.type === "character") await performCharacter(item);
    }
    processingRef.current = false;
  }

  function enqueue(items) {
    queueRef.current.push(...items);
    processQueue();
  }

  function enqueueText(text, code = "") {
    const items = splitGraphemes(text).flatMap((character) => {
      if (character === "\r") return [];
      if (character === "\n") return [{ type: "return" }];
      return [{ type: "character", character, code }];
    });
    enqueue(items);
  }

  function handleKeyDown(event) {
    if (ejected || ejecting) return;
    if (soundRef.current) audio().wake();

    if (event.isComposing || compositionRef.current || event.keyCode === 229) {
      flashKey(event.code, true);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      enqueue([{ type: "return" }]);
      return;
    }
    if (event.key === "Backspace") {
      event.preventDefault();
      enqueue([{ type: "backspace" }]);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      enqueueText("  ", "Space");
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key.length === 1) {
      event.preventDefault();
      enqueueText(event.key, event.code);
    }
  }

  function handleInput(event) {
    if (compositionRef.current) return;
    const value = event.currentTarget.value;
    if (value) enqueueText(value, "IME");
    event.currentTarget.value = "";
  }

  function handleCompositionStart() {
    compositionRef.current = true;
    setCompositionText("");
    setStatus("正在使用系统中文输入法选字");
  }

  function handleCompositionUpdate(event) {
    setCompositionText(event.data || "");
  }

  function handleCompositionEnd(event) {
    const committed = event.data || "";
    compositionRef.current = false;
    setCompositionText("");
    if (committed) enqueueText(committed, "IME");
    rememberTimer(
      window.setTimeout(() => {
        if (inputRef.current) inputRef.current.value = "";
      }, 0),
    );
  }

  function handlePaste(event) {
    event.preventDefault();
    enqueueText(event.clipboardData.getData("text"), "IME");
  }

  function focusWriter() {
    inputRef.current?.focus({ preventScroll: true });
  }

  async function ejectPaper() {
    if (ejected || ejecting) return;
    inputRef.current?.blur();
    queueRef.current = [];
    processingRef.current = false;
    setEjecting(true);
    setStatus("正在退纸");
    play("eject");
    await delay(760);
    setEjected(true);
    setEjecting(false);
  }

  function loadFreshSheet() {
    const fresh = blankModel();
    queueRef.current = [];
    processingRef.current = false;
    commitModel(fresh);
    setEjected(false);
    setExportState("idle");
    setStatus("新纸已装入");
    rememberTimer(window.setTimeout(focusWriter, 120));
  }

  function toggleSound() {
    const next = !soundRef.current;
    soundRef.current = next;
    setSoundOn(next);
    if (next) {
      audio().wake();
      audio().key(true);
    }
  }

  function openPaperBox() {
    inputRef.current?.blur();
    setPaperBoxOpen(true);
    setStatus("正在挑选稿纸");
  }

  function closePaperBox() {
    setPaperBoxOpen(false);
    setStatus(`已装入「${selectedPaper.name}」`);
    rememberTimer(window.setTimeout(focusWriter, 120));
  }

  function choosePaper(nextPaper) {
    setPaperId(nextPaper.id);
    setStatus(`已装入「${nextPaper.name}」`);
    play("space");
  }

  async function exportDraft() {
    if (!hasInk || exportState === "exporting") return;
    setExportState("exporting");
    setStatus("正在生成 300 DPI 稿纸");
    try {
      await exportPaperPng(modelRef.current, selectedPaper);
      setExportState("done");
      setStatus("高分辨率稿纸已导出");
      rememberTimer(window.setTimeout(() => setExportState("idle"), 1800));
    } catch (error) {
      console.error(error);
      setExportState("error");
      setStatus("导出失败，请重试");
      rememberTimer(window.setTimeout(() => setExportState("idle"), 2200));
    }
  }

  const exportLabel =
    exportState === "exporting"
      ? "正在导出…"
      : exportState === "done"
        ? "已导出 PNG"
        : exportState === "error"
          ? "请重试"
          : "导出 PNG";

  useEffect(() => {
    modelRef.current = model;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
  }, [model]);

  useEffect(() => {
    soundRef.current = soundOn;
    localStorage.setItem(SOUND_KEY, soundOn ? "on" : "off");
  }, [soundOn]);

  useEffect(() => {
    localStorage.setItem(PAPER_SELECTION_KEY, paperId);
  }, [paperId]);

  useEffect(() => {
    audio().preload();
    const timer = window.setTimeout(focusWriter, 180);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
    },
    [],
  );

  return (
    <main className="app-shell">
      <section
        className={`typewriter-stage${machineHit ? " is-hit" : ""}${
          returning ? " is-returning" : ""
        }${ejecting ? " is-ejecting" : ""}`}
        onPointerDown={focusWriter}
        inert={ejected || paperBoxOpen ? true : undefined}
        aria-hidden={ejected || paperBoxOpen ? "true" : undefined}
        aria-label="中文机械打字机写作台"
      >
        <img
          className="machine-base"
          src="/assets/typewriter-base.png"
          alt="黑漆黄铜机械打字机"
          draggable="false"
        />

        <div
          className="paper-sheet live-paper"
          style={{
            "--carriage-x": `${carriageX}%`,
            "--paper-feed-y": `${-model.activeLine * PAPER_FEED_PERCENT}%`,
            ...paperVisualStyle,
          }}
          data-active-line={model.activeLine}
          aria-hidden="true"
        >
          <div className="paper-grain" />
          <div className="live-ink">
            {model.lines.map((line, lineIndex) =>
              line.glyphs.map((glyph) => (
                <span
                  className="live-glyph-row"
                  data-line-index={lineIndex}
                  style={{
                    top: `calc(${PAPER_START_LINE_PERCENT}% + ${lineIndex * LINE_PITCH_CQW}cqw)`,
                  }}
                  key={glyph.id}
                >
                  <InkGlyph glyph={glyph} />
                </span>
              )),
            )}
            {compositionText && (
              <span
                className="composition-preview"
                style={{
                  left: `${8 + (activeLine.cursor / MAX_LINE_UNITS) * 84}%`,
                  top: `calc(${PAPER_START_LINE_PERCENT}% + ${model.activeLine * LINE_PITCH_CQW}cqw)`,
                }}
              >
                {compositionText}
              </span>
            )}
          </div>
        </div>

        <img
          className="paper-bail"
          src="/assets/paper-bail-reference.png"
          style={{ "--bail-x": `${bailCarriageX}%` }}
          alt=""
          aria-hidden="true"
          draggable="false"
        />

        <img
          className="machine-foreground"
          src="/assets/typewriter-base.png"
          alt=""
          aria-hidden="true"
          draggable="false"
        />

        {strike.id > 0 && (
          <img
            key={strike.id}
            className="typebar-strike"
            src="/assets/typewriter-base.png"
            style={{ clipPath: strikeClip }}
            alt=""
            aria-hidden="true"
            draggable="false"
          />
        )}

        <img
          className="return-lever-motion"
          src="/assets/typewriter-base.png"
          alt=""
          aria-hidden="true"
          draggable="false"
        />

        <img
          className="key-labels"
          src="/assets/key-labels.png"
          alt=""
          aria-hidden="true"
          draggable="false"
        />

        <div className="key-hotspots" aria-hidden="true">
          {KEY_POSITIONS.map((key) => (
            <span
              className={`key-hotspot${activeKey === key.code ? " active" : ""}`}
              style={{ left: `${key.left}%`, top: `${key.top}%` }}
              key={key.code}
            />
          ))}
          <span
            className={`space-hotspot${activeKey === "Space" ? " active" : ""}`}
          />
        </div>

        <textarea
          ref={inputRef}
          className="ime-input"
          aria-label="在打字机纸张上输入文字，支持系统中文输入法"
          autoCapitalize="sentences"
          autoCorrect="off"
          spellCheck="false"
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          onCompositionStart={handleCompositionStart}
          onCompositionUpdate={handleCompositionUpdate}
          onCompositionEnd={handleCompositionEnd}
          onPaste={handlePaste}
          onFocus={() => {
            setFocused(true);
            setStatus("中文输入已就绪");
          }}
          onBlur={() => setFocused(false)}
        />

        <header className="brand-lockup">
          <span className="brand-name">铅字写作所</span>
          <span className="machine-number">活字一号 · 中文试作机</span>
        </header>

        <nav className="stage-actions" aria-label="打字机控制">
          <button
            className="brass-button"
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={openPaperBox}
          >
            稿纸箱
          </button>
          <button
            className="brass-button"
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={toggleSound}
            aria-pressed={soundOn}
          >
            声音：{soundOn ? "开" : "关"}
          </button>
          <button
            className="brass-button"
            type="button"
            disabled={!hasInk || exportState === "exporting"}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={exportDraft}
          >
            {exportLabel}
          </button>
          <button
            className="brass-button"
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={ejectPaper}
          >
            退纸 ↗
          </button>
        </nav>

        <div className={`writer-status${focused ? " focused" : ""}`} role="status">
          <span className="status-lamp" />
          {status}
          {hasInk && !model.pageFull ? ` · 第 ${model.activeLine + 1} 行` : ""}
        </div>

        <p className="instruction-line">
          稿纸箱可换纸 · 使用系统中文输入法 · 回车换行 · 退格只移动字车 · 退纸成稿
        </p>
      </section>

      {paperBoxOpen && (
        <section
          className="paper-box-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="稿纸箱"
        >
          <button
            className="paper-box-scrim"
            type="button"
            aria-label="关闭稿纸箱"
            onClick={closePaperBox}
          />
          <div className="paper-box-drawer">
            <header className="paper-box-header">
              <div>
                <p className="paper-box-kicker">活字一号 · 纸库</p>
                <h2>稿纸箱</h2>
              </div>
              <button
                className="paper-box-close"
                type="button"
                onClick={closePaperBox}
              >
                收起
              </button>
            </header>
            <p className="paper-box-intro">
              五种纸都保留真实纸面。选择后会立即装入打字机，并用于成稿预览和
              300 DPI 导出。
            </p>
            <div className="paper-options">
              {PAPER_TEMPLATES.map((paper) => (
                <button
                  className={`paper-option${
                    paper.id === paperId ? " selected" : ""
                  }`}
                  type="button"
                  aria-pressed={paper.id === paperId}
                  aria-label={`${paper.name}，${paper.era}。${paper.description}`}
                  onClick={() => choosePaper(paper)}
                  key={paper.id}
                >
                  <span className="paper-option-preview">
                    <img src={paper.asset} alt="" draggable="false" />
                  </span>
                  <span className="paper-option-name">{paper.name}</span>
                  <span className="paper-option-era">{paper.era}</span>
                  <span className="paper-option-description">
                    {paper.description}
                  </span>
                </button>
              ))}
            </div>
            <footer className="paper-box-footer">
              当前装入：{selectedPaper.name}
            </footer>
          </div>
        </section>
      )}

      {ejected && (
        <section
          className="page-review"
          role="dialog"
          aria-modal="true"
          aria-label="完成的稿纸"
        >
          <div className="review-scrim" />
          <div className="review-content">
            <p className="review-kicker">— 你的稿纸 —</p>
            <article className="final-sheet" style={paperVisualStyle}>
              <div className="paper-grain" />
              <div className="final-copy">
                {model.lines.map((line, lineIndex) => (
                  <div className="final-line" key={`line-${lineIndex}`}>
                    {line.glyphs.map((glyph) => (
                      <InkGlyph glyph={glyph} final key={glyph.id} />
                    ))}
                  </div>
                ))}
              </div>
            </article>
            <div className="review-actions">
              <button
                className="fresh-sheet-button"
                type="button"
                disabled={exportState === "exporting"}
                onClick={exportDraft}
              >
                {exportLabel}
              </button>
              <button
                className="fresh-sheet-button secondary"
                type="button"
                onClick={loadFreshSheet}
              >
                装入新纸
              </button>
            </div>
          </div>
        </section>
      )}

      <p className="mobile-note">横屏或桌面浏览器能看到完整机械动作。</p>
    </main>
  );
}
