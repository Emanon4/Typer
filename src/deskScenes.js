export const VIEW_MODE_KEY = "typer-view-mode-v1";
export const DESK_SCENE_KEY = "typer-desk-scene-v1";
export const MACHINE_STYLE_KEY = "typer-machine-style-v1";

export const DESK_SCENES = [
  {
    id: "night",
    name: "夜灯木桌",
    era: "深夜书房",
    description: "绿罩台灯、旧书与冷掉的烟灰。",
    paper: { left: 37.6, top: 8.5, width: 27.1, clip: 43.4, start: 61.3 },
    strike: { topY: 46.2, originY: 62.4, centerX: 50.8, span: 13.2 },
    keys: { left: 29, top: 62.2, width: 46, height: 18.2 },
  },
  {
    id: "morning",
    name: "清晨书房",
    era: "雨后晨光",
    description: "冷窗光、旧书堆与尚有余温的台灯。",
    paper: { left: 40.75, top: 17.4, width: 26.3, clip: 46.4, start: 50.2 },
    strike: { topY: 49.2, originY: 64.2, centerX: 51.8, span: 12.4 },
    keys: { left: 30.8, top: 64.2, width: 42.2, height: 17.2 },
  },
  {
    id: "rain",
    name: "雨夜阁楼",
    era: "午夜城市",
    description: "雨窗冷光、近身机位与杂乱手稿。",
    paper: { left: 32.3, top: 5, width: 35.6, clip: 38.6, start: 43.8 },
    strike: { topY: 41.3, originY: 58.6, centerX: 49.2, span: 17.4 },
    keys: { left: 20.8, top: 59.2, width: 56.5, height: 21.3 },
  },
];

export const MACHINE_STYLES = [
  {
    id: "black",
    name: "黑漆黄铜",
    era: "经典办公室机",
    description: "磨损黑漆、氧化黄铜与深色键帽。",
  },
  {
    id: "ivory",
    name: "象牙白镀镍",
    era: "四十年代浅色机",
    description: "温润象牙漆、旧镀镍与炭黑键心。",
  },
  {
    id: "green",
    name: "深林绿黄铜",
    era: "作家定制机",
    description: "近黑深绿、奶油键心与陈年黄铜。",
  },
];

function loadChoice(key, values, fallback) {
  const stored = localStorage.getItem(key);
  return values.some((value) => value.id === stored) ? stored : fallback;
}

export function loadViewMode() {
  return localStorage.getItem(VIEW_MODE_KEY) === "closeup" ? "closeup" : "desk";
}

export function loadDeskSceneId() {
  return loadChoice(DESK_SCENE_KEY, DESK_SCENES, "night");
}

export function loadMachineStyleId() {
  return loadChoice(MACHINE_STYLE_KEY, MACHINE_STYLES, "black");
}

export function getDeskScene(id) {
  return DESK_SCENES.find((scene) => scene.id === id) || DESK_SCENES[0];
}

export function getMachineStyle(id) {
  return (
    MACHINE_STYLES.find((machine) => machine.id === id) || MACHINE_STYLES[0]
  );
}

export function getDeskAsset(sceneId, machineId) {
  return `/assets/desk-${sceneId}-${machineId}.png`;
}

