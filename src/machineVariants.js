export const MACHINE_VARIANT_KEY = "typer-machine-finish-v1";

const brass = ["#d5c394", "#b29a65", "#897346", "#55472e"];
const nickel = ["#dbd7c7", "#adb0a6", "#797f74", "#464f46"];
const champagne = ["#dbc7a2", "#b99a6c", "#8b704d", "#5c4932"];
const darkKeys = ["#35342e", "#25251f", "#11120f"];

// Finishes contain color and lighting only. Physical geometry is intentionally
// absent: every edition runs the same mechanism and occlusion boundaries.
export const MACHINE_VARIANTS = [
  {
    id: "original", name: "黑漆黄铜", subtitle: "原版 · 暖灯与旧木",
    shell: ["#343332", "#2c2b2d", "#212022", "#0d0d0c"],
    bed: ["#24272a", "#151719", "#111310", "#282a28"],
    front: ["#31352f", "#1a1e19", "#090c09"],
    basket: ["#464642", "#303130", "#202120"],
    metal: brass, keys: darkKeys, legend: "#e2dfc6", secondary: "#a5a18c",
    spool: ["#252522", "#41262a", "#3d3a30", "#66614a"],
    accent: "#c7ac6f", edge: "#968053", enamel: .08,
    roomFilter: "none", roomTint: "transparent", roomTintOpacity: 0,
  },
  {
    id: "ivory", name: "骨瓷镍银", subtitle: "泛黄旧漆 · 磨旧镍边",
    shell: ["#d5c9ae", "#bcaf92", "#a6987c", "#685e4b"],
    bed: ["#686459", "#41443a", "#30362d", "#6e6652"],
    front: ["#c9bb9b", "#9f9274", "#5f5643"],
    basket: ["#aaa89b", "#656e6c", "#3e4a48"],
    metal: nickel, keys: darkKeys,
    legend: "#dfd8bb", secondary: "#aba68e",
    spool: ["#535d59", "#4a3435", "#565e56", "#adb6a5"],
    accent: "#c3bda5", edge: "#c9c5ad", enamel: .09,
    roomFilter: "brightness(1.25) saturate(.65)", roomTint: "#d4dac8", roomTintOpacity: .09,
  },
  {
    id: "forest", name: "松林黄铜", subtitle: "深绿烤漆 · 旧黄铜",
    shell: ["#434d3b", "#343e2e", "#252f22", "#131c12"],
    bed: ["#29483e", "#162e25", "#101e19", "#304a39"],
    front: ["#4a6552", "#263e2f", "#102418"],
    basket: ["#506252", "#35483b", "#1b3023"],
    metal: brass,
    keys: ["#40483b", "#2c362b", "#162016"], legend: "#eee5c9", secondary: "#b6b296",
    spool: ["#263b2d", "#482d2f", "#454638", "#82856a"],
    accent: "#b29a65", edge: "#9e8955", enamel: .09,
    roomFilter: "brightness(.92) saturate(.8)", roomTint: "#133729", roomTintOpacity: .17,
  },
  {
    id: "midnight", name: "午夜蓝钢", subtitle: "墨蓝旧漆 · 磨旧钢边",
    shell: ["#424a4c", "#303b3f", "#202b31", "#101b20"],
    bed: ["#293d53", "#17273a", "#0d192b", "#2b3c52"],
    front: ["#40546b", "#24354d", "#101d30"],
    basket: ["#506274", "#34485a", "#1c2f43"],
    metal: nickel, keys: darkKeys,
    legend: "#d8d7c1", secondary: "#aaa997",
    spool: ["#2d3b47", "#3e3445", "#394858", "#8596a1"],
    accent: "#adb0a6", edge: "#989e91", enamel: .08,
    roomFilter: "brightness(.74) saturate(.55)", roomTint: "#102840", roomTintOpacity: .34,
  },
  {
    id: "wine", name: "酒红香槟", subtitle: "暗红旧漆 · 暗金包边",
    shell: ["#654840", "#4f342f", "#392622", "#201511"],
    bed: ["#513a3a", "#301e23", "#1f151b", "#4d3033"],
    front: ["#7b4e48", "#502d31", "#2b161d"],
    basket: ["#65514d", "#463637", "#2e2229"],
    metal: champagne, keys: ["#463b3c", "#2f262a", "#191418"],
    legend: "#f0d9bc", secondary: "#b5a08d",
    spool: ["#463235", "#54252e", "#57423e", "#a28b73"],
    accent: "#b99a6c", edge: "#ae926c", enamel: .09,
    roomFilter: "brightness(.88) saturate(.8)", roomTint: "#4c2029", roomTintOpacity: .19,
  },
].map(variant => Object.freeze(variant));

export function getMachineVariant(id) {
  return MACHINE_VARIANTS.find(variant => variant.id === id) || MACHINE_VARIANTS[0];
}

export function loadMachineVariantId() {
  try { return getMachineVariant(localStorage.getItem(MACHINE_VARIANT_KEY)).id; }
  catch { return MACHINE_VARIANTS[0].id; }
}

export function variantStyle(variant) {
  return {
    "--finish-accent": variant.accent,
    "--finish-shell": variant.shell[1],
    "--finish-metal": variant.metal[1],
    "--finish-key": variant.keys[0],
    "--room-filter": variant.roomFilter,
    "--room-tint": variant.roomTint,
    "--room-tint-opacity": variant.roomTintOpacity,
  };
}
