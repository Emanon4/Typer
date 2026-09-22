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
  ...[
    { id: "kyoto", name: "京都春水", era: "木版风景明信片", description: "樱枝垂向河面，小桥与远处屋檐留在淡靛色春光里。", accent: "#6a737c" },
    { id: "venice", name: "水城晨曦", era: "铜版旅行明信片", description: "拱桥、贡多拉与清晨水光，一封来自威尼斯的问候。", accent: "#677b86" },
    { id: "botanical", name: "鸢尾花事", era: "植物图谱明信片", description: "旧植物图谱中的鸢尾与蕨叶，寄走一小片春天。", accent: "#73765d" },
    { id: "observatory", name: "夜航星图", era: "天文藏书明信片", description: "深蓝天幕上的黄铜星仪，把夜晚留给遥远的人。", accent: "#7c6940" },
    { id: "silk-road", name: "丝路远行", era: "旅行画册明信片", description: "驼队经过沙丘与绿洲，山色在天际慢慢变蓝。", accent: "#997055" },
    { id: "mediterranean", name: "地中海庭院", era: "石版风景明信片", description: "穿过石拱望见海，柏树与陶土色庭院盛着午后的安静。", accent: "#7e8869" },
  ].map(card => ({
    ...card,
    id: `postcard-${card.id}`,
    format: "postcard",
    frontAsset: `assets/postcards/${card.id}.webp`,
    asset: "assets/paper-stock-real-v2.png",
    base: "#eee5d1",
    backgroundSize: "cover",
    backgroundPosition: "center",
    fileLabel: card.name,
  })),
].map((paper) => ({ ...paper, asset: publicAsset(paper.asset), ...(paper.frontAsset ? { frontAsset: publicAsset(paper.frontAsset) } : {}) }));

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
