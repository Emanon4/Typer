import { useEffect, useMemo, useRef, useState } from "react";
import { createAudioEngine } from "./audioEngine";
import {
  DESK_SCENE_KEY,
  DESK_SCENES,
  getDeskAsset,
  getDeskScene,
  getMachineStyle,
  loadDeskSceneId,
  loadMachineStyleId,
  loadViewMode,
  MACHINE_STYLE_KEY,
  MACHINE_STYLES,
  VIEW_MODE_KEY,
} from "./deskScenes";
import { exportPaperPng } from "./exportPaper";
import { InkGlyph } from "./InkGlyph";
import {
  getPaperTemplate,
  loadPaperTemplateId,
  PAPER_SELECTION_KEY,
  PAPER_TEMPLATES,
} from "./paperTemplates";
import {
  LINE_PITCH_CQW,
  LIVE_PAPER_WIDTH_PERCENT,
  MAX_LINES,
  MAX_LINE_UNITS,
  PAPER_BAIL_WIDTH_PERCENT,
  PAPER_FEED_PERCENT,
  PAPER_START_LINE_PERCENT,
} from "./typewriterConfig";

const STORAGE_KEY = "typer-draft-v1";
const SOUND_KEY = "typer-sound-v1";
const MANUSCRIPT_KEY = "typer-manuscripts-v1";
const LEGACY_STORAGE_KEY = "lead-typewriter-draft-v1";
const LEGACY_SOUND_KEY = "lead-typewriter-sound-v1";
const LEGACY_MANUSCRIPT_KEY = "lead-typewriter-manuscripts-v1";

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

function cloneModel(model) {
  return JSON.parse(JSON.stringify(model));
}

function readMigratedValue(key, legacyKey) {
  const current = localStorage.getItem(key);
  if (current !== null) return current;
  const legacy = localStorage.getItem(legacyKey);
  if (legacy !== null) localStorage.setItem(key, legacy);
  return legacy;
}

function loadManuscripts() {
  try {
    const parsed = JSON.parse(
      readMigratedValue(MANUSCRIPT_KEY, LEGACY_MANUSCRIPT_KEY),
    );
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry) =>
        entry &&
        entry.id &&
        entry.savedAt &&
        Array.isArray(entry.model?.lines),
    );
  } catch {
    return [];
  }
}

function paperStyle(paper) {
  return {
    "--paper-texture": `url("${paper.asset}")`,
    "--paper-base": paper.base,
    "--paper-size": paper.backgroundSize,
    "--paper-position": paper.backgroundPosition,
  };
}

function manuscriptExcerpt(model) {
  const text = model.lines
    .flatMap((line) => line.glyphs.map((glyph) => glyph.character))
    .join("")
    .replace(/\s+/gu, " ")
    .trim();
  return text || "空白稿纸";
}

function formatSavedAt(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function FinishedSheet({ draft, paper }) {
  return (
    <article className="final-sheet" style={paperStyle(paper)}>
      <div className="paper-grain" />
      <div className="final-copy">
        {draft.lines.map((line, lineIndex) => (
          <div className="final-line" key={`line-${lineIndex}`}>
            {line.glyphs.map((glyph) => (
              <InkGlyph glyph={glyph} final key={glyph.id} />
            ))}
          </div>
        ))}
      </div>
    </article>
  );
}

function loadDraft() {
  try {
    const parsed = JSON.parse(readMigratedValue(STORAGE_KEY, LEGACY_STORAGE_KEY));
    if (!parsed || !Array.isArray(parsed.lines) || !parsed.lines.length) {
      return blankModel();
    }
    const activeLine = Math.min(
      Number.isFinite(parsed.activeLine) ? parsed.activeLine : 0,
      Math.min(parsed.lines.length - 1, MAX_LINES - 1),
    );
    return {
      lines: parsed.lines.slice(0, MAX_LINES).map((line) => ({
        glyphs: Array.isArray(line.glyphs) ? line.glyphs : [],
        cursor: Number.isFinite(line.cursor) ? line.cursor : 0,
      })),
      activeLine,
      pageFull: Boolean(parsed.pageFull) && activeLine >= MAX_LINES - 1,
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
    () => readMigratedValue(SOUND_KEY, LEGACY_SOUND_KEY) !== "off",
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
  const [manuscriptBoxOpen, setManuscriptBoxOpen] = useState(false);
  const [manuscripts, setManuscripts] = useState(loadManuscripts);
  const [viewingManuscript, setViewingManuscript] = useState(null);
  const [savedManuscriptId, setSavedManuscriptId] = useState("");
  const [paperId, setPaperId] = useState(loadPaperTemplateId);
  const [viewMode, setViewMode] = useState(loadViewMode);
  const [deskSceneId, setDeskSceneId] = useState(loadDeskSceneId);
  const [machineStyleId, setMachineStyleId] = useState(loadMachineStyleId);
  const [workbenchOpen, setWorkbenchOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
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
  const paperVisualStyle = paperStyle(selectedPaper);
  const selectedDeskScene = getDeskScene(deskSceneId);
  const selectedMachineStyle = getMachineStyle(machineStyleId);
  const deskAsset = getDeskAsset(deskSceneId, machineStyleId);

  const strikeGeometry = useMemo(() => {
    const lane = (strike.hash % 23) - 11;
    const originX = 50 + lane * 1.08;
    return {
      clipPath: `polygon(49.48% 52.1%, 50.52% 52.1%, ${originX + 0.82}% 69.2%, ${originX - 0.82}% 69.2%)`,
      originX,
    };
  }, [strike]);

  const deskStrikeGeometry = useMemo(() => {
    const lane = (strike.hash % 23) - 11;
    const geometry = selectedDeskScene.strike;
    const originX = geometry.centerX + (lane / 11) * geometry.span;
    return {
      clipPath: `polygon(49.42% ${geometry.topY}%, 50.58% ${geometry.topY}%, ${originX + 0.82}% ${geometry.originY}%, ${originX - 0.82}% ${geometry.originY}%)`,
      originX,
      originY: geometry.originY,
    };
  }, [selectedDeskScene, strike]);

  const deskPaperGeometry = {
    "--desk-paper-left": `${selectedDeskScene.paper.left}%`,
    "--desk-paper-top": `${selectedDeskScene.paper.top}%`,
    "--desk-paper-width": `${selectedDeskScene.paper.width}%`,
    "--desk-paper-clip": `${selectedDeskScene.paper.clip}%`,
  };

  const deskKeyPositions = useMemo(() => {
    const bounds = selectedDeskScene.keys;
    return KEY_POSITIONS.map((key) => ({
      ...key,
      left: bounds.left + ((key.left - 28.9) / 42.9) * bounds.width,
      top: bounds.top + ((key.top - 69.2) / 12.9) * bounds.height,
    }));
  }, [selectedDeskScene]);

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
    setSavedManuscriptId("");
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

  function switchViewMode(nextMode) {
    inputRef.current?.blur();
    setViewMode(nextMode);
    setWorkbenchOpen(false);
    setStatus(nextMode === "desk" ? "作家书桌已就绪" : "机械特写已就绪");
    rememberTimer(window.setTimeout(focusWriter, 180));
  }

  function chooseDeskScene(scene) {
    setDeskSceneId(scene.id);
    setStatus(`已进入「${scene.name}」`);
    play("space");
  }

  function chooseMachineStyle(machine) {
    setMachineStyleId(machine.id);
    setStatus(`已换成「${machine.name}」`);
    play("space");
  }

  function toggleWorkbench() {
    setWorkbenchOpen((open) => !open);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setStatus("当前浏览器没有允许进入全屏");
    }
  }

  function openPaperBox() {
    inputRef.current?.blur();
    setWorkbenchOpen(false);
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

  function openManuscriptBox() {
    inputRef.current?.blur();
    setWorkbenchOpen(false);
    setManuscriptBoxOpen(true);
    setStatus("正在查看文稿箱");
  }

  function closeManuscriptBox() {
    setManuscriptBoxOpen(false);
    if (!ejected) {
      setStatus("中文输入已就绪");
      rememberTimer(window.setTimeout(focusWriter, 120));
    }
  }

  function saveToManuscriptBox() {
    if (!hasInk) return;

    const snapshot = cloneModel(modelRef.current);
    const duplicate = manuscripts.find(
      (entry) =>
        entry.paperId === paperId &&
        JSON.stringify(entry.model) === JSON.stringify(snapshot),
    );
    if (duplicate) {
      setSavedManuscriptId(duplicate.id);
      setStatus("这张稿纸已经在文稿箱中");
      return;
    }

    const savedAt = new Date().toISOString();
    const entry = {
      id: globalThis.crypto?.randomUUID?.() || `${Date.now()}`,
      savedAt,
      paperId,
      model: snapshot,
      excerpt: manuscriptExcerpt(snapshot),
    };
    setManuscripts((current) => [entry, ...current]);
    setSavedManuscriptId(entry.id);
    setStatus("稿纸已存入文稿箱");
    play("space");
  }

  function viewManuscript(entry) {
    setManuscriptBoxOpen(false);
    setViewingManuscript(entry);
  }

  function returnToManuscriptBox() {
    setViewingManuscript(null);
    setManuscriptBoxOpen(true);
  }

  async function exportModel(sourceModel, sourcePaper) {
    if (exportState === "exporting") return;
    setExportState("exporting");
    setStatus("正在生成 300 DPI 稿纸");
    try {
      await exportPaperPng(sourceModel, sourcePaper);
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

  function exportDraft() {
    if (!hasInk) return;
    exportModel(modelRef.current, selectedPaper);
  }

  function exportStoredManuscript() {
    if (!viewingManuscript) return;
    exportModel(
      viewingManuscript.model,
      getPaperTemplate(viewingManuscript.paperId),
    );
  }

  const exportLabel =
    exportState === "exporting"
      ? "正在导出…"
      : exportState === "done"
        ? "已导出 PNG"
        : exportState === "error"
          ? "请重试"
          : "导出 PNG";

  const writerInput = (
    <textarea
      ref={inputRef}
      className="ime-input"
      aria-label="在 Typer 稿纸上输入文字，支持系统中文输入法"
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
  );

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
    localStorage.setItem(MANUSCRIPT_KEY, JSON.stringify(manuscripts));
  }, [manuscripts]);

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem(DESK_SCENE_KEY, deskSceneId);
  }, [deskSceneId]);

  useEffect(() => {
    localStorage.setItem(MACHINE_STYLE_KEY, machineStyleId);
  }, [machineStyleId]);

  useEffect(() => {
    const handleFullscreenChange = () =>
      setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

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
    <main className={`app-shell view-${viewMode}`}>
      {viewMode === "desk" ? (
        <section
          className={`desk-stage${machineHit ? " is-hit" : ""}${
            returning ? " is-returning" : ""
          }${ejecting ? " is-ejecting" : ""}`}
          onPointerDown={focusWriter}
          inert={
            ejected || paperBoxOpen || manuscriptBoxOpen || viewingManuscript
              ? true
              : undefined
          }
          aria-hidden={
            ejected || paperBoxOpen || manuscriptBoxOpen || viewingManuscript
              ? "true"
              : undefined
          }
          aria-label="Typer 全屏作家书桌"
        >
          <img
            className="desk-ambient-scene"
            src={deskAsset}
            alt=""
            aria-hidden="true"
            draggable="false"
          />
          <div className="desk-canvas" style={deskPaperGeometry}>
            <img
              className="desk-scene"
              src={deskAsset}
              alt={`${selectedDeskScene.name}中的${selectedMachineStyle.name}打字机`}
              draggable="false"
            />

            <div className="desk-paper-window" aria-hidden="true">
              <div
                className="desk-paper-sheet"
                style={{
                  ...paperVisualStyle,
                  "--desk-carriage-x": `${carriageX}%`,
                  "--desk-feed-y": `${-model.activeLine * PAPER_FEED_PERCENT}%`,
                }}
              >
                <div className="paper-grain" />
                <div className="desk-live-ink">
                  {model.lines.map((line, lineIndex) =>
                    line.glyphs.map((glyph) => (
                      <span
                        className="live-glyph-row"
                        style={{
                          top: `calc(${selectedDeskScene.paper.start}% + ${lineIndex * LINE_PITCH_CQW}cqw)`,
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
                        top: `calc(${selectedDeskScene.paper.start}% + ${model.activeLine * LINE_PITCH_CQW}cqw)`,
                      }}
                    >
                      {compositionText}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {strike.id > 0 && (
              <span
                key={`desk-${strike.id}`}
                className="desk-typebar-strike"
                style={{
                  clipPath: deskStrikeGeometry.clipPath,
                  "--bar-origin-x": `${deskStrikeGeometry.originX}%`,
                  "--bar-origin-y": `${deskStrikeGeometry.originY}%`,
                  "--bar-strike-y": `${selectedDeskScene.strike.topY}%`,
                }}
                aria-hidden="true"
              />
            )}

            <div className="desk-key-hotspots" aria-hidden="true">
              {deskKeyPositions.map((key) => (
                <span
                  className={`desk-key-hotspot${
                    activeKey === key.code ? " active" : ""
                  }`}
                  style={{ left: `${key.left}%`, top: `${key.top}%` }}
                  key={key.code}
                />
              ))}
            </div>
          </div>

          {writerInput}

          <header className="desk-brand-lockup">
            <span className="desk-brand-name">Typer</span>
            <span className="desk-slogan">让你情不自禁地开始写作！</span>
          </header>

          <nav className="desk-quick-actions" aria-label="Typer 快捷控制">
            <button
              className="glass-control"
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={toggleWorkbench}
              aria-expanded={workbenchOpen}
            >
              工作台
            </button>
            <button
              className="glass-control"
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={ejectPaper}
            >
              退纸 ↗
            </button>
          </nav>

          {workbenchOpen && (
            <aside
              className="workbench-panel"
              aria-label="Typer 工作台设置"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <header className="workbench-header">
                <div>
                  <p>Typer</p>
                  <h2>工作台</h2>
                </div>
                <button type="button" onClick={toggleWorkbench}>
                  收起
                </button>
              </header>

              <div className="workbench-section">
                <span className="workbench-label">写作模式</span>
                <div className="mode-options">
                  <button className="selected" type="button">
                    作家书桌
                  </button>
                  <button type="button" onClick={() => switchViewMode("closeup")}>
                    机械特写
                  </button>
                </div>
              </div>

              <div className="workbench-section">
                <span className="workbench-label">书桌场景</span>
                <div className="visual-options scene-options">
                  {DESK_SCENES.map((scene) => (
                    <button
                      className={scene.id === deskSceneId ? "selected" : ""}
                      type="button"
                      aria-pressed={scene.id === deskSceneId}
                      onClick={() => chooseDeskScene(scene)}
                      key={scene.id}
                    >
                      <img
                        src={getDeskAsset(scene.id, machineStyleId)}
                        alt=""
                        draggable="false"
                      />
                      <span>{scene.name}</span>
                      <small>{scene.era}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="workbench-section">
                <span className="workbench-label">打字机</span>
                <div className="visual-options machine-options">
                  {MACHINE_STYLES.map((machine) => (
                    <button
                      className={
                        machine.id === machineStyleId ? "selected" : ""
                      }
                      type="button"
                      aria-pressed={machine.id === machineStyleId}
                      onClick={() => chooseMachineStyle(machine)}
                      key={machine.id}
                    >
                      <img
                        src={getDeskAsset(deskSceneId, machine.id)}
                        alt=""
                        draggable="false"
                      />
                      <span>{machine.name}</span>
                      <small>{machine.era}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="workbench-tools">
                <button type="button" onClick={openPaperBox}>稿纸箱</button>
                <button type="button" onClick={openManuscriptBox}>
                  文稿箱{manuscripts.length ? ` ${manuscripts.length}` : ""}
                </button>
                <button type="button" onClick={toggleSound}>
                  声音：{soundOn ? "开" : "关"}
                </button>
                <button
                  type="button"
                  disabled={!hasInk || exportState === "exporting"}
                  onClick={exportDraft}
                >
                  {exportLabel}
                </button>
                <button type="button" onClick={toggleFullscreen}>
                  {fullscreen ? "退出全屏" : "进入全屏"}
                </button>
              </div>
            </aside>
          )}

          <div className={`desk-writer-status${focused ? " focused" : ""}`} role="status">
            <span className="status-lamp" />
            {status}
            {hasInk && !model.pageFull ? ` · 第 ${model.activeLine + 1} 行` : ""}
          </div>
        </section>
      ) : (
      <section
        className={`typewriter-stage${machineHit ? " is-hit" : ""}${
          returning ? " is-returning" : ""
        }${ejecting ? " is-ejecting" : ""}`}
        onPointerDown={focusWriter}
        inert={
          ejected || paperBoxOpen || manuscriptBoxOpen || viewingManuscript
            ? true
            : undefined
        }
        aria-hidden={
          ejected || paperBoxOpen || manuscriptBoxOpen || viewingManuscript
            ? "true"
            : undefined
        }
        aria-label="中文机械打字机写作台"
      >
        <img
          className="machine-base"
          src="/assets/typewriter-base.png"
          alt="黑漆黄铜机械打字机"
          draggable="false"
        />

        <div className="paper-window" aria-hidden="true">
          <div
            className="paper-sheet live-paper"
            style={{
              "--carriage-x": `${carriageX}%`,
              "--paper-feed-y": `${-model.activeLine * PAPER_FEED_PERCENT}%`,
              ...paperVisualStyle,
            }}
            data-active-line={model.activeLine}
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
        </div>

        <img
          className="paper-bail"
          src="/assets/paper-bail-reference.png"
          style={{ "--bail-x": `${bailCarriageX}%` }}
          alt=""
          aria-hidden="true"
          draggable="false"
        />

        {strike.id > 0 && (
          <span
            key={strike.id}
            className="typebar-strike"
            style={{
              clipPath: strikeGeometry.clipPath,
              "--bar-origin-x": `${strikeGeometry.originX}%`,
              "--bar-origin-y": "69.2%",
              "--bar-strike-y": "52.1%",
            }}
            aria-hidden="true"
          />
        )}

        <span
          className="return-lever-motion"
          aria-hidden="true"
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

        {writerInput}

        <header className="brand-lockup">
          <span className="brand-name">Typer</span>
          <span className="machine-number">让你情不自禁地开始写作！</span>
        </header>

        <nav className="stage-actions" aria-label="打字机控制">
          <button
            className="brass-button"
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => switchViewMode("desk")}
          >
            作家书桌
          </button>
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
            onClick={openManuscriptBox}
          >
            文稿箱{manuscripts.length ? ` ${manuscripts.length}` : ""}
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
          A4 稿纸 · 系统中文输入法 · 回车换行 · 退格只移动字车 · 退纸后可存入文稿箱
        </p>
      </section>
      )}

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
                <p className="paper-box-kicker">Typer · 纸库</p>
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

      {manuscriptBoxOpen && (
        <section
          className="manuscript-box-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="文稿箱"
        >
          <button
            className="paper-box-scrim"
            type="button"
            aria-label="关闭文稿箱"
            onClick={closeManuscriptBox}
          />
          <div className="manuscript-box-drawer">
            <header className="paper-box-header">
              <div>
                <p className="paper-box-kicker">Typer · 成稿档案</p>
                <h2>文稿箱</h2>
              </div>
              <button
                className="paper-box-close"
                type="button"
                onClick={closeManuscriptBox}
              >
                收起
              </button>
            </header>
            <p className="paper-box-intro">
              退纸后的稿件会连同纸张、字迹与换行一起保存。打开任意稿纸可重新查看和导出。
            </p>
            {manuscripts.length ? (
              <div className="manuscript-list">
                {manuscripts.map((entry, index) => {
                  const paper = getPaperTemplate(entry.paperId);
                  return (
                    <button
                      className="manuscript-card"
                      type="button"
                      onClick={() => viewManuscript(entry)}
                      key={entry.id}
                    >
                      <span
                        className="manuscript-card-sheet"
                        style={paperStyle(paper)}
                      >
                        <span className="paper-grain" />
                        <span className="manuscript-card-copy">
                          {entry.excerpt || manuscriptExcerpt(entry.model)}
                        </span>
                      </span>
                      <span className="manuscript-card-meta">
                        <span className="manuscript-card-title">
                          第 {manuscripts.length - index} 份稿纸
                        </span>
                        <span className="manuscript-card-paper">
                          {paper.name} · {entry.model.lines.length} 行
                        </span>
                        <time dateTime={entry.savedAt}>
                          {formatSavedAt(entry.savedAt)}
                        </time>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="manuscript-empty">
                <span className="manuscript-empty-sheet" />
                <p>还没有成稿。写完后退纸，再选择「存入文稿箱」。</p>
              </div>
            )}
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
            <FinishedSheet draft={model} paper={selectedPaper} />
            <div className="review-actions">
              <button
                className="fresh-sheet-button"
                type="button"
                onClick={
                  savedManuscriptId ? openManuscriptBox : saveToManuscriptBox
                }
              >
                {savedManuscriptId ? "打开文稿箱" : "存入文稿箱"}
              </button>
              <button
                className="fresh-sheet-button secondary"
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

      {viewingManuscript && (
        <section
          className="page-review stored-review"
          role="dialog"
          aria-modal="true"
          aria-label="文稿箱中的稿纸"
        >
          <button
            className="review-scrim review-scrim-button"
            type="button"
            aria-label="返回文稿箱"
            onClick={returnToManuscriptBox}
          />
          <div className="review-content">
            <p className="review-kicker">
              — 文稿箱 · {formatSavedAt(viewingManuscript.savedAt)} —
            </p>
            <FinishedSheet
              draft={viewingManuscript.model}
              paper={getPaperTemplate(viewingManuscript.paperId)}
            />
            <div className="review-actions">
              <button
                className="fresh-sheet-button"
                type="button"
                disabled={exportState === "exporting"}
                onClick={exportStoredManuscript}
              >
                {exportLabel}
              </button>
              <button
                className="fresh-sheet-button secondary"
                type="button"
                onClick={returnToManuscriptBox}
              >
                返回文稿箱
              </button>
            </div>
          </div>
        </section>
      )}

      <p className="mobile-note">横屏或桌面浏览器能看到完整机械动作。</p>
    </main>
  );
}
