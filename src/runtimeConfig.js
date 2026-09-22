// Vite rewrites CSS/HTML URLs; dynamic JS asset paths need the same base.
export function publicAsset(path, base = import.meta.env?.BASE_URL || "/") {
  return `${base.replace(/\/*$/, "/")}${path.replace(/^\/+/, "")}`;
}

export const POST_AVAILABLE = import.meta.env?.MODE !== "pages";
