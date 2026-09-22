import { REFERENCE_KEYS } from "./referenceGeometry.js";

export const MACHINE_MODEL_KEY = "typer-machine-model-v1";

// A model changes the manufactured case and keys. Finishes only change its
// materials. All models mount the same carriage and strike mechanism.
export const MACHINE_MODELS = [
  { id: "classic", name: "经典开放式", description: "漆面描线 · 金属环圆键 · 外露字杆", keyRadius: null, keyInset: 2.4 },
  { id: "portable", name: "旅行便携式", description: "弧面小机壳 · 椭圆环键 · 皮纹提手", keyRadius: null, keyInset: 2.2 },
  { id: "editor", name: "编辑室事务机", description: "拱形铸壳 · 圆键 · 铆接铭牌", keyRadius: null, keyInset: 2.5 },
].map(model => Object.freeze(model));

export function getMachineModel(id) {
  return MACHINE_MODELS.find(model => model.id === id) || MACHINE_MODELS[0];
}

export function loadMachineModelId() {
  try { return getMachineModel(localStorage.getItem(MACHINE_MODEL_KEY)).id; }
  catch { return MACHINE_MODELS[0].id; }
}

export function getModelKeys(model = getMachineModel()) {
  if (model.id === "classic") return REFERENCE_KEYS;
  const portable = model.id === "portable";
  return REFERENCE_KEYS.map(key => ({
    ...key,
    x: 640 + (key.x - 640) * (portable ? .86 : .98),
    y: key.code === "Space" ? (portable ? 939 : 950) : (portable ? 742 : 735) + (key.y - 719) * (portable ? .87 : .99),
    width: key.width * (portable ? .86 : .96),
    height: key.height * (portable ? .78 : .84),
  }));
}

export function modelKeyTravel(model = getMachineModel()) {
  return model.id === "portable" ? 3.5 : 4.5;
}
