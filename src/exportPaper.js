import { paintInkGlyph } from "./InkGlyph";
import { getPaperLayout } from "./referenceGeometry";
import { exportSlices } from "./writingModel";
import { zipSync, strToU8 } from "fflate";
import { seamlessRollTexture } from "./rollPaperTexture";

const PAGE_WIDTH = 2480;
const PAGE_HEIGHT = 3508;

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`无法载入纸张材质：${source}`));
    image.src = source;
  });
}

function drawCover(context, image, width, height, position) {
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
    sourceY = position?.includes("top") ? 0 : (image.naturalHeight - sourceHeight) / 2;
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
  return `Typer-${paper.fileLabel}-${date}.png`;
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("浏览器未能生成 PNG"));
    }, "image/png");
  });
}

async function renderSlice(model,paper,texture,slice) {
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_WIDTH;
  canvas.height = slice.height;
  const context = canvas.getContext("2d", { alpha: false });

  context.fillStyle = paper.base;
  context.fillRect(0, 0, PAGE_WIDTH, slice.height);
  if(model.kind==="scroll") {
    const textureHeight=PAGE_WIDTH*texture.naturalHeight/texture.naturalWidth;
    const layout=getPaperLayout(model);
    const phase=slice.first*PAGE_WIDTH*layout.trackWidth*layout.linePitch/10000;
    for(let y=-(phase%textureHeight);y<slice.height;y+=textureHeight)context.drawImage(texture,0,y,PAGE_WIDTH,textureHeight);
  } else drawCover(context, texture, PAGE_WIDTH, PAGE_HEIGHT, paper.backgroundPosition);

  const layout = getPaperLayout(model);
  const copyWidth = PAGE_WIDTH * layout.trackWidth / 100;
  const copyLeft = PAGE_WIDTH * layout.trackLeft / 100;
  const copyTop = slice.top;
  const linePitch = copyWidth * layout.linePitch / 100;
  const glyphWidth = copyWidth * layout.glyphWidth / 100;
  const glyphHeight = copyWidth * layout.glyphHeight / 100;

  for (const [lineIndex, line] of model.lines.slice(slice.first,slice.last).entries()) {
    for (const glyph of line.glyphs) {
      const stamp = document.createElement("canvas");
      paintInkGlyph(stamp, glyph, {
        cssWidth: glyphWidth,
        cssHeight: glyphHeight,
        ratio: 1,
      });
      const x = copyLeft + copyWidth * (layout.glyphStart + glyph.x / layout.maxUnits * layout.glyphRange) / 100;
      const y = copyTop + lineIndex * linePitch;
      context.drawImage(stamp, x, y, glyphWidth, glyphHeight);
    }
  }

  const blob=await canvasToBlob(canvas);
  canvas.width=canvas.height=1;
  return blob;
}

export async function exportPaperPng(model,paper) {
  await document.fonts?.ready;
  const texture=await loadImage(model.kind==="scroll"?await seamlessRollTexture(paper.asset):paper.asset),slices=exportSlices(model);
  let blob,fileName=makeFileName(paper);
  if(slices.length===1)blob=await renderSlice(model,paper,texture,slices[0]);
  else {
    const files={};
    for(const [i,slice] of slices.entries()) {
      const part=await renderSlice(model,paper,texture,slice);
      files[`Typer-长卷-${String(i+1).padStart(3,"0")}.png`]=new Uint8Array(await part.arrayBuffer());
    }
    files["长卷说明.txt"]=strToU8(`Typer 凯鲁亚克长卷\n共 ${model.lines.length} 行，依文件编号顺序展开。\n图像采用与写作时相同的纸张、字形与墨迹种子。\n`);
    blob=new Blob([zipSync(files,{level:0})],{type:"application/zip"});
    fileName=fileName.replace(/\.png$/,"-长卷.zip");
  }
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
