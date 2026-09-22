import { publicAsset } from "./runtimeConfig.js";

export const STAMPS = [
  { id: "road", name: "山路", region: "远方", caption: "写给远方", description: "山脊与蜿蜒的道路，把未说完的话带向远方。", asset: "assets/post-stamp-road.png" },
  { id: "swallow", name: "归燕", region: "归途", caption: "见字如晤", description: "一只衔信归来的燕子，穿过旧纸上的暮色。", asset: "assets/post-stamp-swallow.png" },
  { id: "dunhuang", name: "敦煌飞天", region: "中国 · 敦煌", caption: "流沙与飞天", description: "飘带、莲花与矿物色，取意于敦煌壁画中绵延的风。" },
  { id: "kyoto", name: "京都白鹤", region: "日本 · 京都", caption: "松间远山", description: "白鹤掠过海浪，靛蓝木版线条里留着松枝与远山。" },
  { id: "nile", name: "尼罗河畔", region: "埃及 · 尼罗河", caption: "纸草与莲花", description: "朱鹭栖于莲花之间，纸草与柱式写下古河流域的记忆。" },
  { id: "athens", name: "雅典之夜", region: "希腊 · 雅典", caption: "橄榄与智慧", description: "猫头鹰、橄榄枝与爱奥尼柱，以温润的凹版线条相遇。" },
  { id: "persia", name: "波斯花园", region: "伊朗 · 波斯文化", caption: "夜莺来信", description: "柏树、石榴与夜莺，藏在细密的花园纹样和旧玫瑰色里。" },
  { id: "jaipur", name: "斋浦尔阶井", region: "印度 · 斋浦尔", caption: "一池旧日光", description: "阶井层层向下，孔雀与花枝勾勒出赭粉色的建筑诗。" },
  { id: "sahel", name: "萨赫勒书页", region: "西非 · 萨赫勒", caption: "沙土与手稿", description: "土筑建筑、手稿与棕榈，以赭石和靛蓝致意当地的知识传统。" },
  { id: "andes", name: "安第斯长风", region: "南美 · 安第斯", caption: "群山的回声", description: "神鹰飞越山地梯田，边框取意于安第斯织物的几何韵律。" },
  { id: "venice", name: "威尼斯水信", region: "意大利 · 威尼斯", caption: "水上的晨光", description: "贡多拉驶过拱桥，铜版画般的细线托住水城的清晨。" },
  { id: "botanica", name: "鸢尾标本", region: "欧洲 · 植物图谱", caption: "春日存档", description: "鸢尾花舒展在新艺术纹样中，像一页珍藏已久的植物图谱。" },
].map((stamp, index) => ({
  ...stamp,
  number: String(index + 1).padStart(2, "0"),
  asset: publicAsset(stamp.asset || `assets/stamps/${stamp.id}.webp`),
}));

export const stampById = (id) => STAMPS.find((stamp) => stamp.id === id) || STAMPS[0];
const PREFERRED_STAMP_KEY = "typer-preferred-stamp-v1";
export function preferredStampId() {
  try { return stampById(localStorage.getItem(PREFERRED_STAMP_KEY)).id; }
  catch { return STAMPS[0].id; }
}
export function preferStamp(id) {
  try { localStorage.setItem(PREFERRED_STAMP_KEY, stampById(id).id); }
  catch { /* The current seal can still use the selected stamp. */ }
}
