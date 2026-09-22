import { readFile, readdir, access, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve("dist/pages");
const html = await readFile(resolve(root, "index.html"), "utf8");
const files = await readdir(resolve(root, "assets"));
let checked = 0;
for (const file of ["index.html", ...files.filter((name) => /\.(js|css)$/.test(name)).map((name) => `assets/${name}`)]) {
  const content = await readFile(resolve(root, file), "utf8");
  if (/["'(]\/assets\//.test(content)) throw new Error(`Root-relative asset in ${file}`);
  for (const match of content.matchAll(/\/Typer\/(?:assets\/[^"'\s)<>`]+|favicon\.svg)/g)) {
    await access(resolve(root, match[0].slice("/Typer/".length)));
    checked++;
  }
  for (const match of content.matchAll(/["'](assets\/[^"'\s)<>`]+)["']/g)) {
    await access(resolve(root, match[1]));
    checked++;
  }
}
if (!html.includes('/Typer/assets/')) throw new Error("Missing GitHub Pages base");
const bundle = await readFile(resolve(root, "assets", files.find((name) => name.endsWith(".js"))), "utf8");
if (!bundle.includes("线上邮局尚未开通")) throw new Error("Pages must show mail service availability");
await writeFile(resolve(root, ".nojekyll"), "");
console.log(`GitHub Pages build verified: ${checked} asset references, static mail availability, /Typer/ base.`);
