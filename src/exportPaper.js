import { paintInkGlyph } from "./InkGlyph";

const PAGE_WIDTH = 2480;
const PAGE_HEIGHT = 3508;
const MAX_LINE_UNITS = 17.5;

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`无法载入纸张材质：${source}`));
    image.src = source;
  });
}

function drawCover(context, image, width, height) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;

  if (imageRatio > targetRatio) {
    sourceWidth = image.naturalHeight * targetRatio;
    sourceX = (image.naturalWidth - sourceWidth) / 2;
  } else {
    sourceHeight = image.naturalWidth / targetRatio;
    sourceY = (image.naturalHeight - sourceHeight) / 2;
  }

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height,
  );
}

function makeFileName(paper) {
  const date = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .replaceAll("/", "-");
  return `铅字写作所-${paper.fileLabel}-${date}.png`;
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("浏览器未能生成 PNG"));
    }, "image/png");
  });
}

export async function exportPaperPng(model, paper) {
  await document.fonts?.ready;
  const texture = await loadImage(paper.asset);
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_WIDTH;
  canvas.height = PAGE_HEIGHT;
  const context = canvas.getContext("2d", { alpha: false });

  context.fillStyle = paper.base;
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  drawCover(context, texture, PAGE_WIDTH, PAGE_HEIGHT);

  const copyLeft = PAGE_WIDTH * 0.095;
  const copyTop = PAGE_HEIGHT * 0.085;
  const copyWidth = PAGE_WIDTH * 0.81;
  const copyHeight = PAGE_HEIGHT * 0.83;
  const inkLeft = copyLeft + copyWidth * 0.08;
  const inkWidth = copyWidth * 0.84;
  const linePitch = copyHeight * 0.073;
  const glyphWidth = copyWidth * 0.052;
  const glyphHeight = copyWidth * 0.051;

  for (const [lineIndex, line] of model.lines.entries()) {
    for (const glyph of line.glyphs) {
      const stamp = document.createElement("canvas");
      paintInkGlyph(stamp, glyph, {
        cssWidth: glyphWidth,
        cssHeight: glyphHeight,
        ratio: 1,
      });
      const x = inkLeft + (glyph.x / MAX_LINE_UNITS) * inkWidth;
      const y = copyTop + lineIndex * linePitch;
      context.drawImage(stamp, x, y, glyphWidth, glyphHeight);
    }
  }

  const blob = await canvasToBlob(canvas);
  const fileName = makeFileName(paper);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  return fileName;
}
