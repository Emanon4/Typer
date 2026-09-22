import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createAudioEngine } from "./audioEngine";
import { createImeInputAdapter } from "./imeInput";
import { runStrikeCycle } from "./strikeCycle";
import { exportPaperPng } from "./exportPaper";
import { PaperDocument as FinishedSheet, paperStyle } from "./PaperDocument";
import { blankDocument, normalizeDocument, rollLengthMetres } from "./writingModel";
import { saveDocument, readDocument, listDocuments } from "./documentStore";
import { PostOffice } from "./PostOffice";
import { publicAsset } from "./runtimeConfig";
import "./correspondence.css";
import { ReferenceMachine, MachineFinishPreview } from "./ReferenceMachine";
import { MACHINE_VARIANTS, MACHINE_VARIANT_KEY, getMachineVariant, loadMachineVariantId, variantStyle } from "./machineVariants";
import { MACHINE_MODELS, MACHINE_MODEL_KEY, getMachineModel, loadMachineModelId } from "./machineModels";
import { REFERENCE_KEYS, getPaperLayout, layoutForFirstCharacter, paperLayoutStyle } from "./referenceGeometry";
import {
  getPaperTemplate,
  loadPaperTemplateId,
  PAPER_SELECTION_KEY,
  PAPER_TEMPLATES,
} from "./paperTemplates";
import {
  INK_TRACK_WIDTH_PERCENT,
  INK_TRACK_LEFT_PERCENT,
  LIVE_PAPER_WIDTH_PERCENT,
  LIVE_PAPER_LEFT_PERCENT,
  LIVE_PAPER_TOP_PERCENT,
  LIVE_PAPER_HEIGHT_PERCENT,
  PAPER_BAIL_WIDTH_PERCENT,
  PAPER_BAIL_TOP_PERCENT,
  PAPER_BAIL_HEIGHT_PERCENT,
  PAPER_CLIP_BOTTOM_PERCENT,
  STRIKE_DURATION_MS,
  GLYPH_WIDTH_CQW,
  GLYPH_HEIGHT_CQW,
  CARRIAGE_WIDTH_PERCENT,
} from "./typewriterConfig";

const STORAGE_KEY = "typer-draft-v1";
const SOUND_KEY = "typer-sound-v1";
const MANUSCRIPT_KEY = "typer-manuscripts-v1";
const LEGACY_STORAGE_KEY = "lead-typewriter-draft-v1";
const LEGACY_SOUND_KEY = "lead-typewriter-sound-v1";
const LEGACY_MANUSCRIPT_KEY = "lead-typewriter-manuscripts-v1";

const KEY_POSITIONS = REFERENCE_KEYS.filter(key => key.label.length === 1);

function blankModel(kind="sheet") { return blankDocument(kind); }

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


function loadDraft() {
  try {
    const parsed = JSON.parse(readMigratedValue(STORAGE_KEY, LEGACY_STORAGE_KEY));
    if (!parsed || !Array.isArray(parsed.lines) || !parsed.lines.length) {
      return blankModel();
    }
    return normalizeDocument(parsed);
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
  const [mechanismPhase, setMechanismPhase] = useState("idle");
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
  const [variantId, setVariantId] = useState(loadMachineVariantId);
  const [machineModelId, setMachineModelId] = useState(loadMachineModelId);
  const [workbenchOpen, setWorkbenchOpen] = useState(false);
  const [postOpen,setPostOpen] = useState(false);
  const [postUser,setPostUser] = useState(null);
  const [sealedDraft,setSealedDraft] = useState(null);
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  const [status, setStatus] = useState("点击纸张，开始写作");

  const modelRef = useRef(model);
  const soundRef = useRef(soundOn);
  const inputRef = useRef(null);
  const compositionRef = useRef(false);
  const imeInputRef = useRef(createImeInputAdapter());
  const audioRef = useRef(null);
  const queueRef = useRef([]);
  const processingRef = useRef(false);
  const cycleRef = useRef(0);
  const glyphIdRef = useRef(Date.now());
  const timersRef = useRef([]);
  const savePendingRef = useRef(Promise.resolve());
  const paperRef = useRef(paperId);
  paperRef.current=paperId;

  const hasInk = model.lines.some((line) => line.glyphs.length > 0);
  const selectedPaper = getPaperTemplate(paperId);
  const paperVisualStyle = paperStyle(selectedPaper);
  const selectedVariant = getMachineVariant(variantId);
  const selectedMachine = getMachineModel(machineModelId);
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

  function commitModel(nextModel, savedModel = nextModel) {
    modelRef.current = nextModel;
    if(savedModel.kind === "scroll" || savedModel.kind === "letter") {
      savePendingRef.current=saveDocument(savedModel,{paperId:paperRef.current}).catch(()=>{setStatus("本机存储空间不足，请先导出稿件；当前内容仍在纸上");});
    } else localStorage.setItem(STORAGE_KEY, JSON.stringify(savedModel));
    setModel(nextModel);
  }

  function delay(milliseconds) {
    return new Promise((resolve) => {
      rememberTimer(window.setTimeout(resolve, milliseconds));
    });
  }

  async function performReturn(cycle = cycleRef.current) {
    const current = modelRef.current;
    if (current.activeLine >= getPaperLayout(current).maxLines - 1) {
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
      ...current,
      lines: [
        ...current.lines,
        { glyphs: [], cursor: 0 },
      ],
      activeLine: current.activeLine + 1,
      pageFull: false,
    };
    commitModel(next);
    await delay(850);
    if (cycle !== cycleRef.current) return false;
    setReturning(false);
    setActiveKey("");
    setStatus("中文输入已就绪");
    return true;
  }

  async function performBackspace(cycle = cycleRef.current) {
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
    play("backspace");
    await delay(95);
    if (cycle !== cycleRef.current) return;
  }

  async function performCharacter(item, cycle) {
    const character = item.character;
    let current = modelRef.current;
    if (!current.layoutId) current = {...current, layoutId: layoutForFirstCharacter(character)};
    const layout = getPaperLayout(current);
    const units = layout.id === "reference" ? (character === "\t" ? 2 : 1) : glyphUnits(character);
    let line = current.lines[current.activeLine];

    if (current.pageFull) {
      setStatus("纸张已写满，请退纸成稿");
      return;
    }

    if (line.cursor + units > layout.maxUnits) {
      const advanced = await performReturn(cycle);
      if (!advanced || cycle !== cycleRef.current) return;
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
    const printing = !/\s/u.test(character);
    const keyCode = item.code === "IME" || !item.code
      ? KEY_POSITIONS[codeHash(character) % KEY_POSITIONS.length].code
      : item.code;
    await runStrikeCycle({
      printing,
      wait: delay,
      isCurrent: () => cycle === cycleRef.current,
      phase: setMechanismPhase,
      press: () => {
        // Mount the linkage before starting its clock, even when an entire
        // phrase arrived in a single IME commit or paste event.
        flushSync(() => {
          setActiveKey(printing ? keyCode : "Space");
          if (printing) setStrike((previous) => ({
            id: previous.id + 1, hash: codeHash(character),
          }));
        });
        if (!printing) play("space");
      },
      imprint: () => {
        const lines = [...current.lines];
        lines[current.activeLine] = { ...line, glyphs: [...line.glyphs, glyph] };
        current = { ...current, lines };
        // The ink is permanent at contact. Persist the eventual escapement
        // atomically so reloading in this frame cannot overprint the last key.
        const savedLines = [...lines];
        savedLines[current.activeLine] = {
          ...lines[current.activeLine], cursor: line.cursor + units,
        };
        commitModel(current, { ...current, lines: savedLines });
        setMachineHit(true);
        play("key", false);
        setStatus(compositionRef.current ? "中文正在落纸" : "正在写作");
      },
      advance: () => {
        const lines = [...current.lines];
        lines[current.activeLine] = {
          ...lines[current.activeLine],
          // Keep spaces in the manuscript so excerpts retain word boundaries.
          glyphs: printing ? lines[current.activeLine].glyphs : [...line.glyphs, glyph],
          cursor: line.cursor + units,
        };
        commitModel({ ...current, lines });
        setActiveKey("");
        setMachineHit(false);
      },
    });
  }

  async function processQueue() {
    if (processingRef.current || ejected || ejecting) return;
    processingRef.current = true;
    const cycle = cycleRef.current;
    try {
      while (cycle === cycleRef.current && queueRef.current.length) {
        const item = queueRef.current.shift();
        if (item.type === "return") await performReturn(cycle);
        if (item.type === "backspace") await performBackspace(cycle);
        if (item.type === "character") await performCharacter(item, cycle);
      }
    } finally {
      if (cycle === cycleRef.current) processingRef.current = false;
    }
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

    if (event.nativeEvent.isComposing || compositionRef.current || event.keyCode === 229) {
      // Preedit keys may arrive while the previous selected phrase is still
      // printing. They must not overwrite that physical key/typebar cycle.
      play(event.code === "Space" ? "space" : "key", true);
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
    const result = imeInputRef.current.input({
      value: event.currentTarget.value,
      data: event.nativeEvent.data,
      inputType: event.nativeEvent.inputType,
      isComposing: event.nativeEvent.isComposing,
    });
    if (result.text) enqueueText(result.text, "IME");
    if (result.clear) event.currentTarget.value = "";
  }

  function handleCompositionStart(event) {
    imeInputRef.current.start({ value: event.currentTarget.value });
    compositionRef.current = true;
    setCompositionText("");
    setStatus("正在使用系统中文输入法选字");
  }

  function handleCompositionUpdate(event) {
    setCompositionText(event.data || "");
  }

  function handleCompositionEnd(event) {
    const result = imeInputRef.current.end({
      value: event.currentTarget.value, data: event.data,
    });
    compositionRef.current = false;
    setCompositionText("");
    if (result.text) enqueueText(result.text, "IME");
    if (result.clear) event.currentTarget.value = "";
  }

  function handlePaste(event) {
    event.preventDefault();
    enqueueText(event.clipboardData.getData("text"), "IME");
  }

  function focusWriter(event) {
    // Keep Safari's default pointer focus from blurring the hidden writer.
    if (event?.type === "pointerdown" && event.target !== inputRef.current) event.preventDefault();
    inputRef.current?.focus({ preventScroll: true });
  }

  async function ejectPaper() {
    if (ejected || ejecting) return;
    if(processingRef.current||compositionRef.current){setStatus("请等当前文字落纸后再收稿");return;}
    inputRef.current?.blur();
    cycleRef.current += 1;
    queueRef.current = [];
    processingRef.current = false;
    setReturning(false);
    setActiveKey("");
    setMachineHit(false);
    setMechanismPhase("idle");
    setEjecting(true);
    setStatus(modelRef.current.kind==="scroll"?"正在收卷":"正在退纸");
    play("eject");
    await delay(760);
    setEjected(true);
    setEjecting(false);
    if(modelRef.current.kind==="scroll")await saveToManuscriptBox();
  }

  function loadFreshSheet() {
    const fresh = blankModel(modelRef.current.kind||"sheet");
    if(fresh.kind==="letter")fresh.ownerId=modelRef.current.ownerId;
    if(fresh.kind==="scroll")localStorage.setItem("typer-active-scroll-v1",fresh.id);
    cycleRef.current += 1;
    imeInputRef.current.reset();
    compositionRef.current = false;
    setCompositionText("");
    if (inputRef.current) inputRef.current.value = "";
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

  function chooseVariant(variant) {
    setVariantId(variant.id);
    setWorkbenchOpen(false);
    setStatus(`已换上「${variant.name}」`);
    rememberTimer(window.setTimeout(focusWriter, 120));
  }

  function chooseMachine(machine) {
    setMachineModelId(machine.id);
    setWorkbenchOpen(false);
    setStatus(`已换上「${machine.name}」`);
    rememberTimer(window.setTimeout(focusWriter, 120));
  }

  function toggleWorkbench() {
    setWorkbenchOpen((open) => !open);
  }

  function installDocument(next,nextPaper=paperId) {
    cycleRef.current++;queueRef.current=[];processingRef.current=false;
    imeInputRef.current.reset();compositionRef.current=false;setCompositionText("");
    if(inputRef.current)inputRef.current.value="";
    setReturning(false);setActiveKey("");setMachineHit(false);setMechanismPhase("idle");
    paperRef.current=nextPaper;setPaperId(nextPaper);commitModel(next);
    setEjected(false);setSavedManuscriptId("");setViewingManuscript(null);setManuscriptBoxOpen(false);setWorkbenchOpen(false);
    rememberTimer(window.setTimeout(focusWriter,120));
  }

  async function switchWritingMode(kind) {
    if(processingRef.current||compositionRef.current){setStatus("请等当前文字落纸后再换纸");return;}
    inputRef.current?.blur();
    await savePendingRef.current;
    try {
      let next=kind==="scroll"?await readDocument(localStorage.getItem("typer-active-scroll-v1")):loadDraft();
      if(!next)next=blankModel(kind);
      if(kind==="scroll")localStorage.setItem("typer-active-scroll-v1",next.id);
      localStorage.setItem("typer-writing-mode-v1",kind);
      installDocument(normalizeDocument(next,kind),next.paperId|| (kind==="scroll"?"reference-ivory":localStorage.getItem("typer-sheet-paper-v1")||paperId));
      setStatus(kind==="scroll"?"长卷已装好，写到哪里都没有页末":"原来的稿纸已装回");
    }catch{setStatus("暂时无法读取本机稿件，请重试");}
  }

  async function resumeScroll(entry) {
    await savePendingRef.current;
    if(modelRef.current.kind==="scroll"&&hasInk&&!savedManuscriptId)await saveToManuscriptBox();
    const next={...cloneModel(entry.model),id:crypto.randomUUID(),archived:false};
    await saveDocument(next,{paperId:entry.paperId,all:true});
    localStorage.setItem("typer-active-scroll-v1",next.id);localStorage.setItem("typer-writing-mode-v1","scroll");
    installDocument(next,entry.paperId);setStatus("长卷已装回，从上次落笔处继续");
  }

  async function startLetter({documentId,recipient="",ownerId}) {
    if(!postUser||ownerId!==postUser.id)return;
    if(processingRef.current||compositionRef.current)throw new Error("请等当前文字落纸后再取信笺");
    await savePendingRef.current;
    const existing=documentId?await readDocument(documentId):null;
    if(existing&&existing.ownerId!==ownerId)return;
    const next=existing||blankDocument("letter",{ownerId,recipient});
    if(existing?.mailedAt)return;
    installDocument(next,existing?.paperId||"republic-letter");
    setPostOpen(false);setSealedDraft(null);setStatus(recipient?`正在给 ${recipient} 写信`:"信笺已装好，写完后再封缄");
  }

  async function letterPosted(letter) {
    if(sealedDraft)await saveDocument({...sealedDraft,mailedAt:new Date().toISOString(),letterId:letter.id},{paperId:sealedDraft.paperId,all:true});
    setSealedDraft(null);
    await switchWritingMode(localStorage.getItem("typer-writing-mode-v1")==="scroll"?"scroll":"sheet");
    setStatus("信已投邮");
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
    paperRef.current=nextPaper.id;
    setPaperId(nextPaper.id);
    if(modelRef.current.kind==="scroll"||modelRef.current.kind==="letter")commitModel(modelRef.current);
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

  async function saveToManuscriptBox() {
    if (!hasInk) return;

    const snapshot = cloneModel(modelRef.current);
    if(snapshot.kind==="scroll") {
      await savePendingRef.current;
      if(savedManuscriptId){setStatus("长卷已在文稿箱中");return;}
      const archive={...snapshot,id:crypto.randomUUID()};
      await saveDocument(archive,{paperId,archived:true,all:true});
      const entry={id:archive.id,documentId:archive.id,kind:"scroll",paperId,savedAt:new Date().toISOString(),lineCount:archive.lines.length,excerpt:manuscriptExcerpt(archive).slice(0,100)};
      setManuscripts(current=>[entry,...current]);setSavedManuscriptId(archive.id);setStatus("长卷已收好，可在文稿箱展开或续写");return;
    }
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

  async function viewManuscript(entry) {
    const loaded=entry.documentId?await readDocument(entry.documentId):entry.model;
    if(!loaded){setStatus("这份稿件暂时无法读取");return;}
    setManuscriptBoxOpen(false);setViewingManuscript({...entry,model:loaded});
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
      const fileName=await exportPaperPng(sourceModel, sourcePaper);
      setExportState("done");
      setStatus(fileName.endsWith(".zip")?"长卷已按顺序导出为 PNG 压缩包":"高分辨率稿纸已导出");
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
        ? "已导出"
        : exportState === "error"
          ? "请重试"
          : (viewingManuscript?.model||model).kind==="scroll"?"导出长卷":"导出 PNG";

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
  }, [model]);

  useEffect(() => {
    soundRef.current = soundOn;
    localStorage.setItem(SOUND_KEY, soundOn ? "on" : "off");
  }, [soundOn]);

  useEffect(() => {
    localStorage.setItem(PAPER_SELECTION_KEY, paperId);
    if(!model.kind||model.kind==="sheet")localStorage.setItem("typer-sheet-paper-v1",paperId);
  }, [paperId]);

  useEffect(()=>{
    let cancelled=false;
    listDocuments().then(entries=>{
      if(cancelled)return;
      const saved=entries.filter(entry=>entry.archived&&entry.kind==="scroll").map(entry=>({id:entry.id,documentId:entry.id,kind:entry.kind,paperId:entry.paperId,savedAt:entry.updatedAt,lineCount:entry.lineCount,excerpt:entry.excerpt}));
      setManuscripts(current=>[...saved,...current.filter(entry=>!saved.some(item=>item.id===entry.id))].sort((a,b)=>b.savedAt.localeCompare(a.savedAt)));
    }).catch(()=>setStatus("本机稿件库暂时无法读取"));
    if(localStorage.getItem("typer-writing-mode-v1")==="scroll")switchWritingMode("scroll");
    return()=>{cancelled=true;};
  },[]);

  useEffect(()=>{
    if(modelRef.current.kind==="letter"&&postUser?.id!==modelRef.current.ownerId){setSealedDraft(null);switchWritingMode("sheet");}
  },[postUser?.id]);

  useEffect(() => {
    localStorage.setItem(MANUSCRIPT_KEY, JSON.stringify(manuscripts.filter(entry=>!entry.documentId)));
  }, [manuscripts]);

  useEffect(() => {
    // The desk experience was retired; old preferences must not restore it.
    localStorage.removeItem("typer-view-mode-v1");
    localStorage.removeItem("typer-desk-scene-v1");
  }, []);

  useEffect(() => {
    localStorage.setItem(MACHINE_VARIANT_KEY, variantId);
  }, [variantId]);

  useEffect(() => {
    localStorage.setItem(MACHINE_MODEL_KEY, machineModelId);
  }, [machineModelId]);

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
    <main
      className="app-shell"
      data-mechanism-phase={mechanismPhase}
      style={{
        "--strike-duration": `${STRIKE_DURATION_MS}ms`,
        "--live-paper-left": `${LIVE_PAPER_LEFT_PERCENT}%`,
        "--live-paper-top": `${LIVE_PAPER_TOP_PERCENT}%`,
        "--live-paper-width": `${LIVE_PAPER_WIDTH_PERCENT}%`,
        "--live-paper-height": `${LIVE_PAPER_HEIGHT_PERCENT}%`,
        "--ink-track-left": `${INK_TRACK_LEFT_PERCENT}%`,
        "--ink-track-width": `${INK_TRACK_WIDTH_PERCENT}%`,
        "--glyph-width": `${GLYPH_WIDTH_CQW}cqw`,
        "--glyph-height": `${GLYPH_HEIGHT_CQW}cqw`,
        "--bail-left": `${(100 - PAPER_BAIL_WIDTH_PERCENT) / 2}%`,
        "--bail-width": `${PAPER_BAIL_WIDTH_PERCENT}%`,
        "--bail-top": `${PAPER_BAIL_TOP_PERCENT}%`,
        "--bail-height": `${PAPER_BAIL_HEIGHT_PERCENT}%`,
        "--paper-clip-bottom": `${PAPER_CLIP_BOTTOM_PERCENT}%`,
        "--carriage-width": `${CARRIAGE_WIDTH_PERCENT}%`,
      }}
    >
      <section
        className={`typewriter-stage${machineHit ? " is-hit" : ""}${
          returning ? " is-returning" : ""
        }${ejecting ? " is-ejecting" : ""}`}
        onPointerDown={focusWriter}
        inert={
          ejected || paperBoxOpen || manuscriptBoxOpen || viewingManuscript || postOpen
            ? true
            : undefined
        }
        aria-hidden={
          ejected || paperBoxOpen || manuscriptBoxOpen || viewingManuscript || postOpen
            ? "true"
            : undefined
        }
        style={variantStyle(selectedVariant)}
        data-finish={selectedVariant.id}
        aria-label="中文机械打字机写作台"
      >
        <img className="closeup-environment" src={publicAsset("assets/reference-room-v1.png")} alt="" aria-hidden="true" draggable="false" />
        <div className="closeup-light" aria-hidden="true" />
        <ReferenceMachine
          variant={selectedVariant}
          machine={selectedMachine}
          model={model}
          compositionText={compositionText}
          activeKey={activeKey}
          strike={strike}
          returning={returning}
          ejecting={ejecting}
          paperVisualStyle={paperVisualStyle}
        >
          {writerInput}
        </ReferenceMachine>

        <header className="brand-lockup">
          <span className="brand-name">Typer</span>
          <span className="machine-number">让你情不自禁地开始写作！</span>
          <span className="finish-caption">{selectedMachine.name} · {selectedVariant.name}</span>
        </header>

        <nav className="stage-actions" aria-label="打字机控制">
          <button className="workbench-trigger" type="button" onPointerDown={event=>event.stopPropagation()} onClick={()=>{setWorkbenchOpen(false);setPostOpen(true);}}>信邮</button>
          <button className="workbench-trigger" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={toggleWorkbench} aria-expanded={workbenchOpen}>
            工作台
          </button>
          <button className="brass-button" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={toggleSound} aria-pressed={soundOn}>
            声音：{soundOn ? "开" : "关"}
          </button>
          <button className="brass-button" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={ejectPaper}>
            {model.kind==="scroll"?"收卷":model.kind==="letter"?"写好了":"退纸"}
          </button>
        </nav>

        <div className={`writer-status${focused ? " focused" : ""}`} role="status">
          <span className="status-lamp" />
          {status}
          {model.kind==="scroll"?` · 已写 ${rollLengthMetres(model).toFixed(2)} 米`:hasInk&&!model.pageFull?` · 第 ${model.activeLine+1} 行`:""}
        </div>

        <p className="instruction-line">
          {model.kind==="scroll"?"凯鲁亚克 · 长卷没有页末，想停时再收卷":model.kind==="letter"?`书信 · ${model.recipient?`致 ${model.recipient}`:"写完后折纸封缄"}`:"A4 稿纸 · 系统中文输入法 · 回车换行 · 退格只移动字车"}
        </p>
      </section>

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

                <section className="workbench-section" aria-label="纸张形态">
                  <span className="workbench-label">写作</span>
                  <div className="writing-modes">
                    <button aria-pressed={model.kind!=="scroll"&&model.kind!=="letter"} onClick={()=>switchWritingMode("sheet")}>散页稿纸<small>一张一张，留下一篇稿</small></button>
                    <button aria-pressed={model.kind==="scroll"} onClick={()=>switchWritingMode("scroll")}>凯鲁亚克<small>装入长卷，一直写下去</small></button>
                  </div>
                </section>
                <section className="workbench-section" aria-label="机械特写机型与配色">
                  <span className="workbench-label">机型</span>
                  <div className="machine-model-options">
                    {MACHINE_MODELS.map(machine => (
                      <button className={`machine-model-option${machine.id === machineModelId ? " selected" : ""}`} type="button" aria-label={`${machine.name}，${machine.description}`} aria-pressed={machine.id === machineModelId} onClick={() => chooseMachine(machine)} key={machine.id}>
                        <MachineFinishPreview variant={selectedVariant} machine={machine} />
                        <span>{machine.name}</span>
                        <small>{machine.description}</small>
                      </button>
                    ))}
                  </div>
                  <span className="workbench-label finish-label">配色</span>
                  <div className="finish-options finish-swatches">
                    {MACHINE_VARIANTS.map(variant => (
                      <button
                        className={`finish-option${variant.id === variantId ? " selected" : ""}`}
                        style={variantStyle(variant)}
                        type="button"
                        aria-label={`${variant.name}，${variant.subtitle}`}
                        aria-pressed={variant.id === variantId}
                        onClick={() => chooseVariant(variant)}
                        key={variant.id}
                      >
                        <span className="finish-swatch" aria-hidden="true" />
                        <span>{variant.name}</span>
                        <small>{variant.subtitle}</small>
                      </button>
                    ))}
                  </div>
                </section>
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
                          {entry.kind==="scroll"?"长卷":"稿纸"} · {manuscripts.length-index}
                        </span>
                        <span className="manuscript-card-paper">
                          {paper.name} · {entry.lineCount||entry.model.lines.length} 行
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
            <p className="review-kicker">— {model.kind==="scroll"?"收好的长卷":model.kind==="letter"?"待封的信笺":"你的稿纸"} —</p>
            <FinishedSheet draft={model} paper={selectedPaper} />
            <div className="review-actions">
              {model.kind==="letter"&&<button className="fresh-sheet-button" onClick={()=>{setSealedDraft({...cloneModel(model),paperId});setEjected(false);setPostOpen(true);}}>折纸 · 装入信封</button>}
              <button className="fresh-sheet-button secondary" onClick={()=>{setEjected(false);setStatus("继续写作");rememberTimer(window.setTimeout(focusWriter,100));}}>继续写</button>
              {model.kind!=="letter"&&<button
                className="fresh-sheet-button"
                type="button"
                onClick={
                  savedManuscriptId ? openManuscriptBox : saveToManuscriptBox
                }
              >
                {savedManuscriptId ? "打开文稿箱" : "存入文稿箱"}
              </button>}
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
                {model.kind==="scroll"?"装入新卷":"装入新纸"}
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
              {viewingManuscript.model.kind==="scroll"&&<button className="fresh-sheet-button" onClick={()=>resumeScroll(viewingManuscript)}>装回打字机 · 续写</button>}
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

      <PostOffice open={postOpen} user={postUser} onSession={setPostUser} onClose={()=>{setPostOpen(false);setSealedDraft(null);}} onCompose={startLetter} sealedDraft={sealedDraft} onPosted={letterPosted}/>
      <p className="mobile-note">横屏或桌面浏览器能看到完整机械动作。</p>
    </main>
  );
}
