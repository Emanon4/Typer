import { publicAsset } from "./runtimeConfig.js";

export const PAPER_SELECTION_KEY = "typer-paper-v1";
const LEGACY_PAPER_SELECTION_KEY = "lead-typewriter-paper-v1";

export const PAPER_TEMPLATES = [
  {
    id: "reference-ivory",
    name: "原片米白",
    era: "参考视频原样",
    description: "保留原片的柔和奶油色、轻微暗角与压缩颗粒。",
    asset: "assets/reference-paper-stock.png",
    base: "#eee5cc",
    backgroundSize: "cover",
    backgroundPosition: "center top",
    fileLabel: "原片米白",
  },
  {
    id: "fiber-ivory",
    name: "纤维象牙",
    era: "棉浆打字纸",
    description: "现有的高纤维纸，近看能看到纸浆、压纹与细小杂质。",
    asset: "assets/paper-stock-real-v2.png",
    base: "#eee5d1",
    backgroundSize: "cover",
    backgroundPosition: "center top",
    fileLabel: "纤维象牙",
  },
  {
    id: "republic-letter",
    name: "民国书简",
    era: "朱砂双框信笺",
    description: "暖黄棉纸配朱砂双框，适合书简、家书与正式通信。",
    asset: "assets/paper-letter-v1.png",
    base: "#ead5a9",
    backgroundSize: "cover",
    backgroundPosition: "center",
    fileLabel: "民国书简",
  },
  {
    id: "red-grid",
    name: "红格稿纸",
    era: "早期誊写稿纸",
    description: "淡砖红方格与旧棉纸，适合中文短稿和逐字推敲。",
    asset: "assets/paper-grid-v1.png",
    base: "#eadbb8",
    backgroundSize: "cover",
    backgroundPosition: "center",
    fileLabel: "红格稿纸",
  },
  {
    id: "office-ruled",
    name: "蓝线信纸",
    era: "打字机时代办公纸",
    description: "褪色蓝横线与红色页边，来自二十世纪早期办公室气质。",
    asset: "assets/paper-ruled-v1.png",
    base: "#ebdfc3",
    backgroundSize: "cover",
    backgroundPosition: "center",
    fileLabel: "蓝线信纸",
  },
].map((paper) => ({ ...paper, asset: publicAsset(paper.asset) }));

export function getPaperTemplate(id) {
  return (
    PAPER_TEMPLATES.find((template) => template.id === id) ||
    PAPER_TEMPLATES[0]
  );
}

export function loadPaperTemplateId() {
  let stored = localStorage.getItem(PAPER_SELECTION_KEY);
  if (!stored) {
    stored = localStorage.getItem(LEGACY_PAPER_SELECTION_KEY);
    if (stored) localStorage.setItem(PAPER_SELECTION_KEY, stored);
  }
  return PAPER_TEMPLATES.some((template) => template.id === stored)
    ? stored
    : PAPER_TEMPLATES[0].id;
}
