const CJK_PATTERN = /[\u2E80-\u30FF\u3400-\u9FFF\uF900-\uFAFF\uFF01-\uFF60\uFFE0-\uFFEE\u{20000}-\u{2FA1F}]/u;
export const CHINESE_INK_FONT = '"Typer KingHwa OldSong"';

// Shared by live vector text and the full-resolution exported impression.
export function inkTypography(glyph, width, height) {
  const cjk = CJK_PATTERN.test(glyph.character);
  const fontSize = cjk ? Math.min(height * .94, width * .94) : height * .8;
  return {
    fontFamily: cjk
      ? `${CHINESE_INK_FONT}, "Songti SC", "STSong", serif`
      : '"Special Elite", "American Typewriter", "Courier New", monospace',
    fontWeight: 400,
    fontSize,
    x: width / 2,
    baseline: (height - fontSize) / 2 + fontSize * (cjk ? .79 : .88),
    color: "#332c24",
    opacity: (glyph.seed || 0) % 19 === 0 ? .83 : .89 + ((glyph.seed || 0) % 9) * .012,
  };
}

function seededRandom(seed) {
  let state=seed>>>0;
  return ()=>{
    state+=0x6d2b79f5;
    let value=state;
    value=Math.imul(value^(value>>>15),value|1);
    value^=value+Math.imul(value^(value>>>7),value|61);
    return ((value^(value>>>14))>>>0)/4294967296;
  };
}

// A physical ink impression in normalized coordinates. Both SVG and Canvas
// consume these exact paths, so paper-fiber voids survive preview and export.
export function inkImpression(glyph, width, height) {
  const type=inkTypography(glyph,width,height);
  const random=seededRandom((glyph.seed||0)+991);
  const f=type.fontSize;
  const paths=[[],[],[]];
  const number=value=>Number(value.toFixed(4));
  function fleck(x,y,rx,ry,layer) {
    const points=Array.from({length:6},(_,i)=>{
      const angle=i*Math.PI/3,rough=.65+random()*.65;
      return `${number(x+Math.cos(angle)*rx*rough)} ${number(y+Math.sin(angle)*ry*rough)}`;
    });
    paths[layer].push(`M${points.join("L")}Z`);
  }
  for(let i=0;i<128;i++) {
    const x=random()*width,y=random()*height;
    fleck(x,y,f*(.006+random()*.010),f*(.004+random()*.010),1);
  }
  for(let i=0;i<9;i++) {
    fleck(random()*width,random()*height,f*(.014+random()*.020),f*(.009+random()*.018),2);
  }
  for(let i=0;i<5;i++) {
    fleck(random()*width,random()*height,f*(.08+random()*.13),f*(.04+random()*.07),0);
  }
  // Short interrupted fibers, never a uniform line through the whole glyph.
  for(let i=0;i<2;i++) {
    const x=random()*width,y=height*(.15+random()*.7),length=f*(.2+random()*.35),thickness=f*(.004+random()*.006);
    paths[1].push(`M${number(x)} ${number(y)}l${number(length)} ${number(thickness)}l0 ${number(thickness)}l${number(-length)} ${number(-thickness)}Z`);
  }
  return {type,rotation:(random()-.5)*.5,lift:(random()-.5)*f*.018,spread:f*.012,
    wear:paths.map((parts,i)=>({path:parts.join(""),opacity:[.18,.52,.82][i]}))};
}
