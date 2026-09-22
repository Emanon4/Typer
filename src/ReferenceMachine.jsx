import { useLayoutEffect, useRef } from "react";
import { InkGlyph } from "./InkGlyph";
import { FRAME, PAPER, PAPER_MOUTH_Y, PAPER_EJECT_OFFSET_PERCENT, GUIDE_TOP, GUIDE_BOTTOM, RIBBON_WIDTH, RETURN_LEVER, returnLeverAngle, ribbonPosition, paperFeedOffset, TYPEBARS, typebarPosition, strikeTravel, getPaperLayout, paperLayoutStyle, referenceCarriageOffset } from "./referenceGeometry";
import { getMachineVariant } from "./machineVariants";
import { getMachineModel, getModelKeys, modelKeyTravel } from "./machineModels";
import { ageSurface } from "./machineMaterials";
import { rollWindow } from "./writingModel";
import { useRollPaperStyle } from "./rollPaperTexture";
import "./referenceMachine.css";

function roundRect(ctx, x, y, width, height, radius, fill, stroke, line = 1) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = line; ctx.stroke(); }
}
function gradient(ctx, x1, y1, x2, y2, stops) {
  const fill = ctx.createLinearGradient(x1, y1, x2, y2);
  stops.forEach(([stop, color]) => fill.addColorStop(stop, color));
  return fill;
}
function circle(ctx, x, y, r, fill, stroke, line = 1) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = line; ctx.stroke(); }
}
function line(ctx, points, color, width) {
  ctx.beginPath(); ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}

function screw(ctx,x,y,r,finish) {
  const metal=gradient(ctx,x-r,y-r,x+r,y+r,[[0,finish.metal[0]],[.45,finish.metal[2]],[1,finish.metal[3]]]);
  circle(ctx,x,y,r,metal,"#191a16",.6);
  line(ctx,[[x-r*.55,y+r*.2],[x+r*.55,y-r*.2]],"#27291e",.9);
}

function nameplate(ctx,x,y,width,height,finish,small=false) {
  const metal=gradient(ctx,x,y,x+width*.4,y+height,[[0,finish.metal[2]],[.4,finish.metal[1]],[1,finish.metal[3]]]);
  roundRect(ctx,x,y,width,height,3,metal,finish.metal[3],.8);
  ageSurface(ctx,x,y,width,height,.75);
  roundRect(ctx,x+3,y+3,width-6,height-6,1,null,`${finish.metal[0]}66`,.6);
  ctx.font=`${small?12:15}px Georgia, "Times New Roman", serif`;
  ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle="#28261e";
  ctx.fillText("T Y P E R",x+width/2,y+height/2+.6);
  screw(ctx,x+8,y+height/2,1.6,finish);screw(ctx,x+width-8,y+height/2,1.6,finish);
}

function drawKey(ctx, key, amount, finish, machine) {
  const { x, y, width, height } = key;
  const depressed = amount * modelKeyTravel(machine);
  const r = height / 2;
  const radius = machine.keyRadius ?? r;
  const shadow = gradient(ctx, 0, y, 0, y + r + 8, [[0,"#24211c"],[1,"#080808"]]);
  roundRect(ctx, x - width / 2, y - r + 5, width, height + 2, radius, shadow);
  ctx.save(); ctx.translate(0, depressed);
  ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = 4 - amount * 2; ctx.shadowOffsetY = 3 - amount * 2;
  const brass = gradient(ctx, x, y - r, x + r, y + r, [[0,finish.metal[0]],[.2,finish.metal[1]],[.7,finish.metal[2]],[1,finish.metal[3]]]);
  roundRect(ctx, x - width / 2, y - r, width, height, radius, brass, finish.metal[3], .7);
  ctx.shadowColor = "transparent";
  const face = gradient(ctx, 0, y - r, 0, y + r, [[0,finish.keys[0]],[.52,finish.keys[1]],[1,finish.keys[2]]]);
  const inset = machine.keyInset;
  roundRect(ctx, x - width / 2 + inset, y - r + inset, width - inset * 2, height - inset * 2, Math.max(2,radius - inset), face, "rgba(229,207,144,.23)", .6);
  ageSurface(ctx,x-width/2,y-r,width,height,.35);
  // A rolled metal bezel surrounds the old glass-covered legend. Its small
  // reflection and wear stay inside the key's tested physical outline.
  roundRect(ctx,x-width/2+.9,y-r+.9,width-1.8,height-1.8,Math.max(1,radius-.9),null,`${finish.metal[0]}77`,.5);
  ctx.save();
  roundRect(ctx,x-width/2+inset,y-r+inset,width-inset*2,height-inset*2,Math.max(2,radius-inset));ctx.clip();
  const glass=gradient(ctx,0,y-r,0,y+3,[[0,"rgba(255,246,219,.08)"],[.8,"rgba(255,246,219,0)"],[1,"rgba(0,0,0,0)"]]);
  ctx.fillStyle=glass;ctx.fillRect(x-width/2,y-r,width,height/2);
  ctx.restore();
  ctx.fillStyle = finish.legend; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `${key.label === "SHIFT" ? (machine.id === "portable" ? 10 : 12) : (machine.id === "classic" ? 21 : 19)}px "Special Elite", "Courier New", monospace`;
  if(key.label === "SHIFT") {
    [...key.label].forEach((letter,index)=>ctx.fillText(letter,x+(index-2)*(machine.id === "portable" ? 7 : 8.3),y+2));
  } else ctx.fillText(key.label, x, y + (key.upper ? 5 : 2));
  if (key.upper) { ctx.font = '8px "Special Elite", monospace'; ctx.fillStyle = finish.secondary; ctx.fillText(key.upper, x, y - 11); }
  ctx.restore();
}

export function drawSpool(ctx, x, rotation, finish) {
  const y = 613;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.4)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 4;
  circle(ctx, x, y, 38, finish.spool[0], finish.spool[2], 2);
  ageSurface(ctx,x-38,y-38,76,76,.6);
  ctx.shadowColor = "transparent";
  circle(ctx, x, y, 31, finish.spool[1]);
  circle(ctx, x, y, 24, finish.spool[2]);
  ctx.save(); ctx.translate(x, y); ctx.rotate(rotation);
  for (let i = 0; i < 9; i += 1) {
    ctx.rotate(Math.PI * 2 / 9);
    roundRect(ctx, -2.5, -23, 5, 14, .8, finish.spool[3]);
  }
  ctx.restore();
  circle(ctx, x, y, 11, "#26271c");
  const pin = gradient(ctx,x-6,y-8,x+8,y+9,[[0,finish.metal[0]],[.45,finish.metal[1]],[1,finish.metal[3]]]);
  circle(ctx,x,y,9,pin,finish.metal[3],1);
  ctx.restore();
}

function drawRod(ctx, index, travel) {
  const { root, tip } = typebarPosition(index, travel);
  const dx = tip.x - root.x, dy = tip.y - root.y;
  const length = Math.hypot(dx,dy);
  ctx.save(); ctx.translate(root.x,root.y); ctx.rotate(Math.atan2(dy,dx) + Math.PI / 2);
  ctx.shadowColor="rgba(0,0,0,.55)"; ctx.shadowBlur=1.3; ctx.shadowOffsetX=1; ctx.shadowOffsetY=1;
  const steel=gradient(ctx,-3,0,3,0,[[0,"#716f61"],[.27,"#b9b9aa"],[.52,"#e5e3d2"],[.8,"#c0c1b2"],[1,"#656759"]]);
  ctx.beginPath(); ctx.moveTo(-1.8,0); ctx.lineTo(-3,-length+5); ctx.lineTo(3,-length+5); ctx.lineTo(1.8,0); ctx.closePath();
  ctx.fillStyle=steel; ctx.fill();
  ctx.shadowColor="transparent";
  roundRect(ctx,-3.4,-length,6.8,7,1.2,steel);
  ctx.restore();
}

export function drawBasket(ctx, finish) {
  const basket=gradient(ctx,0,646,0,675,[[0,finish.basket[0]],[.3,finish.basket[1]],[1,finish.basket[2]]]);
  ctx.beginPath();ctx.moveTo(592,672);ctx.quadraticCurveTo(591,646,612,642);ctx.quadraticCurveTo(641,636,670,642);ctx.quadraticCurveTo(688,647,689,672);ctx.quadraticCurveTo(640,680,592,672);ctx.closePath();ctx.fillStyle=basket;ctx.fill();
  roundRect(ctx,625,647,31,5,2,"#070807");
}

export function drawGuide(ctx, finish) {
  const guide=gradient(ctx,0,GUIDE_TOP,0,GUIDE_BOTTOM,[[0,finish.metal[0]],[.5,finish.metal[1]],[1,finish.metal[3]]]);
  roundRect(ctx,619,GUIDE_BOTTOM-9,42,9,2,guide);
  roundRect(ctx,619,GUIDE_TOP,7,24,3,guide);
  roundRect(ctx,654,GUIDE_TOP,7,24,3,guide);
}

function drawModelChassis(ctx, finish, machine) {
  const portable = machine.id === "portable";
  const shell = gradient(ctx,0,585,0,984,[[0,finish.shell[0]],[.3,finish.shell[1]],[.78,finish.shell[2]],[1,finish.shell[3]]]);
  ctx.save();
  ctx.shadowColor="rgba(0,0,0,.55)";ctx.shadowBlur=17;ctx.shadowOffsetY=10;
  if(portable) {
    ctx.beginPath();ctx.moveTo(335,586);ctx.quadraticCurveTo(290,590,284,652);ctx.lineTo(270,932);ctx.quadraticCurveTo(269,974,319,982);ctx.lineTo(961,982);ctx.quadraticCurveTo(1011,974,1010,932);ctx.lineTo(996,652);ctx.quadraticCurveTo(990,590,945,586);ctx.closePath();ctx.fillStyle=shell;ctx.fill();
    ctx.shadowColor="transparent";
    ageSurface(ctx,269,586,742,397);
    roundRect(ctx,286,713,708,211,25,"#111510",`${finish.edge}66`,2);
    roundRect(ctx,292,719,696,199,20,gradient(ctx,0,719,0,918,[[0,"#080b09"],[1,finish.bed[1]]]));
    // The handle is mounted to the front lip, below the last moving key.
    roundRect(ctx,481,963,25,12,3,finish.metal[2]);roundRect(ctx,774,963,25,12,3,finish.metal[2]);
    roundRect(ctx,495,962,290,14,5,finish.metal[3]);
    roundRect(ctx,517,961,246,12,4,gradient(ctx,0,961,0,973,[[0,"#41413a"],[1,"#111611"]]));
    ageSurface(ctx,517,961,246,12,.85);
    for(let x=523;x<756;x+=5)line(ctx,[[x,964],[x+1,970]],"rgba(148,127,90,.16)",.6);
    line(ctx,[[307,945],[307,953],[464,953]],`${finish.edge}99`,1);
    line(ctx,[[973,945],[973,953],[816,953]],`${finish.edge}99`,1);
  } else {
    // A broad plinth and separate angled cheeks give the office machine its
    // stepped cast frame, rather than a rescaled version of the round case.
    ctx.beginPath();ctx.moveTo(251,630);ctx.lineTo(1029,630);ctx.lineTo(1061,960);ctx.lineTo(1043,984);ctx.lineTo(237,984);ctx.lineTo(219,960);ctx.closePath();ctx.fillStyle=shell;ctx.fill();
    ctx.shadowColor="transparent";
    ageSurface(ctx,219,630,843,355,.6);
    roundRect(ctx,232,711,816,222,18,"#080d0d",finish.metal[3],1.5);
    roundRect(ctx,239,718,802,209,13,gradient(ctx,0,718,0,927,[[0,finish.bed[0]],[1,finish.bed[2]]]));
    ageSurface(ctx,239,718,802,209,.65);
    const cheek=gradient(ctx,215,0,253,0,[[0,finish.shell[3]],[.65,finish.shell[0]],[1,finish.shell[2]]]);
    ctx.beginPath();ctx.moveTo(236,713);ctx.lineTo(251,713);ctx.lineTo(231,950);ctx.lineTo(220,960);ctx.closePath();ctx.fillStyle=cheek;ctx.fill();
    ctx.beginPath();ctx.moveTo(1029,713);ctx.lineTo(1044,713);ctx.lineTo(1060,960);ctx.lineTo(1049,950);ctx.closePath();ctx.fill();
    roundRect(ctx,231,977,818,9,2,finish.shell[3]);
    line(ctx,[[247,978],[1033,978]],`${finish.metal[1]}88`,1);
    line(ctx,[[252,969],[424,969]],`${finish.metal[1]}66`,.7);
    line(ctx,[[856,969],[1028,969]],`${finish.metal[1]}66`,.7);
    for(const x of [264,1016])screw(ctx,x,953,4,finish);
  }
  roundRect(ctx,340,552,600,151,12,gradient(ctx,0,552,0,703,[[0,"#101511"],[1,"#060806"]]));
  ctx.restore();
}

// Covers are drawn AFTER all moving internals. QA uses these same manufactured
// surfaces as masks, so a typebar may travel behind them but never through them.
export function drawModelCover(ctx, finish, machine = getMachineModel()) {
  if(machine.id === "classic")return;
  ctx.save();
  const portable=machine.id === "portable";
  const cover=gradient(ctx,0,548,0,715,[[0,finish.shell[0]],[.12,finish.shell[1]],[.82,finish.shell[2]],[1,finish.shell[3]]]);
  ctx.beginPath();
  if(portable) {
    ctx.moveTo(284,714);ctx.lineTo(293,615);ctx.quadraticCurveTo(300,555,378,548);ctx.lineTo(590,548);ctx.quadraticCurveTo(607,548,607,570);ctx.lineTo(607,630);ctx.quadraticCurveTo(607,665,640,665);ctx.quadraticCurveTo(673,665,673,630);ctx.lineTo(673,570);ctx.quadraticCurveTo(673,548,690,548);ctx.lineTo(902,548);ctx.quadraticCurveTo(980,555,987,615);ctx.lineTo(996,714);ctx.closePath();
  } else {
    ctx.moveTo(236,711);ctx.lineTo(249,567);ctx.quadraticCurveTo(251,548,270,548);ctx.lineTo(443,548);ctx.lineTo(443,642);ctx.quadraticCurveTo(443,686,470,686);ctx.lineTo(810,686);ctx.quadraticCurveTo(837,686,837,642);ctx.lineTo(837,548);ctx.lineTo(1010,548);ctx.quadraticCurveTo(1029,548,1031,567);ctx.lineTo(1044,711);ctx.closePath();
  }
  ctx.fillStyle=cover;ctx.fill();ctx.lineWidth=1;ctx.strokeStyle=`${finish.edge}55`;ctx.stroke();
  ageSurface(ctx,236,548,808,167,.6);
  if(portable) {
    line(ctx,[[309,700],[971,700]],`${finish.edge}88`,1);
    line(ctx,[[312,696],[968,696]],`${finish.metal[1]}55`,.6);
    // Raised shoulder highlights follow the two sides of the strike throat.
    ctx.beginPath();ctx.moveTo(319,590);ctx.quadraticCurveTo(333,558,587,558);ctx.moveTo(693,558);ctx.quadraticCurveTo(947,558,961,590);ctx.strokeStyle=`${finish.metal[0]}44`;ctx.lineWidth=2;ctx.stroke();
    nameplate(ctx,354,627,155,29,finish);
    // A knurled tension adjuster, seated in the cover, with an engraved scale.
    circle(ctx,881,645,17,finish.shell[3],`${finish.metal[2]}aa`,.8);
    for(let i=0;i<12;i++) {
      const a=i*Math.PI/6;
      line(ctx,[[881+Math.cos(a)*14,645+Math.sin(a)*14],[881+Math.cos(a)*16,645+Math.sin(a)*16]],finish.metal[1],.6);
    }
    circle(ctx,881,645,10,gradient(ctx,874,635,889,655,[[0,finish.metal[1]],[.5,finish.metal[2]],[1,finish.metal[3]]]));
    line(ctx,[[875,647],[887,643]],finish.shell[3],1.7);
    for(const x of [315,965])screw(ctx,x,680,3.2,finish);
  } else {
    // Shallow cast reliefs replace the modern ventilation grilles. These are
    // solid cheeks: the arch is an inset in metal, not a hole into the ribbon.
    for(const x of [275,881]) {
      ctx.beginPath();ctx.moveTo(x,677);ctx.lineTo(x+8,603);ctx.quadraticCurveTo(x+10,570,x+62,568);ctx.quadraticCurveTo(x+114,570,x+116,603);ctx.lineTo(x+124,677);ctx.closePath();
      ctx.fillStyle=gradient(ctx,x,574,x+124,677,[[0,finish.shell[3]],[.18,finish.shell[1]],[.8,finish.shell[2]],[1,finish.shell[3]]]);ctx.fill();
      ctx.strokeStyle=`${finish.metal[1]}66`;ctx.lineWidth=1;ctx.stroke();
      ageSurface(ctx,x,568,124,109,.75);
      ctx.beginPath();ctx.moveTo(x+9,669);ctx.lineTo(x+16,604);ctx.quadraticCurveTo(x+19,582,x+62,579);ctx.quadraticCurveTo(x+105,582,x+108,604);ctx.lineTo(x+115,669);ctx.closePath();
      ctx.strokeStyle=`${finish.metal[1]}77`;ctx.lineWidth=.7;ctx.stroke();
      // Raised vertical ribs belong to the same casting and meet its foot.
      for(const dx of [43,81]) {
        line(ctx,[[x+dx,599],[x+dx-1,658]],`${finish.shell[3]}bb`,3.4);
        line(ctx,[[x+dx+1,599],[x+dx,658]],`${finish.metal[0]}33`,1);
      }
      line(ctx,[[x+17,681],[x+107,681]],finish.shell[3],3);
      for(const dx of [13,111])screw(ctx,x+dx,673,2.2,finish);
    }
    // One removable mechanism cover, with a continuous lower seam.
    line(ctx,[[255,704],[1025,704]],finish.metal[3],2);
    nameplate(ctx,566,687,148,21,finish,true);
    for(const x of [266,1014])for(const y of [562,692])screw(ctx,x,y,3.5,finish);
  }
  ctx.restore();
}

export function drawBody(ctx, { activeKey = "", travel = 0, lane = 0, stampCount = 0, finish = getMachineVariant(), machine = getMachineModel() }) {
  ctx.save();
  if(machine.id === "classic") {
  // Keyboard bed and cast chassis: the silhouettes are measured in the frame.
  ctx.shadowColor="rgba(0,0,0,.5)"; ctx.shadowBlur=17; ctx.shadowOffsetY=10;
  const bed=gradient(ctx,270,710,1010,920,[[0,finish.bed[0]],[.18,finish.bed[1]],[.75,finish.bed[2]],[1,finish.bed[3]]]);
  ctx.beginPath();ctx.moveTo(291,688);ctx.lineTo(989,688);ctx.lineTo(1027,935);ctx.lineTo(253,935);ctx.closePath();ctx.fillStyle=bed;ctx.fill();
  ageSurface(ctx,253,688,774,247,.65);
  const shell=gradient(ctx,0,559,0,702,[[0,finish.shell[0]],[.1,finish.shell[1]],[.7,finish.shell[2]],[1,finish.shell[3]]]);
  roundRect(ctx,275,558,730,144,16,shell,`${finish.edge}33`);
  ctx.shadowColor="transparent";
  ageSurface(ctx,275,558,730,144,.65);
  // Fine painted lining follows the original casting, behind every moving part.
  roundRect(ctx,283,566,714,127,12,null,`${finish.metal[1]}55`,.8);
  roundRect(ctx,287,570,706,119,10,null,`${finish.metal[1]}33`,.6);
  for(const x of [298,982])for(const y of [582,680])screw(ctx,x,y,2.4,finish);
  ctx.save(); ctx.globalAlpha=finish.enamel;
  line(ctx,[[293,560],[987,560]],finish.metal[0],1.5);
  roundRect(ctx,282,563,716,13,8,gradient(ctx,0,563,0,576,[[0,"#ffffff"],[1,"rgba(255,255,255,0)"]]));
  ctx.restore();
  ctx.font='15px Georgia, "Times New Roman", serif';ctx.textAlign="center";ctx.fillStyle=finish.id === "ivory" ? finish.legend : finish.metal[1];
  ctx.fillText("T Y P E R",640,578);
  } else drawModelChassis(ctx,finish,machine);
  // The reference fan has eight independently articulated rods on each side.
  // Draw the rising member only once, in front of the ribbon at contact.
  TYPEBARS.forEach(bar=>{if(bar.index!==lane||travel<=.02)drawRod(ctx,bar.index,0);});
  // Expose the whole printed row after the strike, including its neighbors.
  const ribbonY=ribbonPosition(travel);
  const shoulderY=538+(ribbonY-504)*.55;
  line(ctx,[[486,582],[570,shoulderY],[640,ribbonY],[710,shoulderY],[794,582]],"#29221b",RIBBON_WIDTH);
  line(ctx,[[486,581],[546,549]],"#73262d",5);
  line(ctx,[[734,549],[794,581]],"#73262d",5);
  // Moving rods stay behind the opaque spools and basket. Their pivots can
  // never pop through the front cover, including partial lift/return frames.
  if(travel>.02)drawRod(ctx,lane,travel);
  drawSpool(ctx,486,stampCount*.032,finish);drawSpool(ctx,794,-stampCount*.032,finish);
  drawBasket(ctx,finish);
  drawModelCover(ctx,finish,machine);
  drawGuide(ctx,finish);
  // The base is behind the space bar, not a second copy of the machine image.
  if(machine.id === "classic") {
    const front=gradient(ctx,0,921,0,968,[[0,finish.front[0]],[.22,finish.front[1]],[1,finish.front[2]]]);
    roundRect(ctx,250,922,780,46,13,front,"rgba(182,157,91,.08)");
    ageSurface(ctx,250,922,780,46,.65);
    line(ctx,[[273,959],[425,959]],`${finish.metal[1]}77`,.75);
    line(ctx,[[855,959],[1007,959]],`${finish.metal[1]}77`,.75);
  }
  getModelKeys(machine).forEach(key=>drawKey(ctx,key,key.code===activeKey?Math.max(.75,travel):0,finish,machine));
  ctx.restore();
}

function drawKnob(ctx, x, rotation, finish) {
  const y=540;
  const gold=gradient(ctx,x-24,y-26,x+23,y+25,[[0,finish.metal[0]],[.5,finish.metal[1]],[1,finish.metal[2]]]);
  circle(ctx,x,y,28,gold,finish.metal[2],1);
  ctx.save();ctx.translate(x,y);ctx.rotate(rotation);
  for(let i=0;i<22;i+=1){ctx.rotate(Math.PI*2/22);line(ctx,[[0,-8],[0,-23]],finish.metal[2],2);line(ctx,[[1,-9],[1,-23]],finish.metal[0],1);}
  ctx.restore();circle(ctx,x,y,4,finish.metal[0]);
}

export function drawReturnLever(ctx, { returnProgress = 0, finish = getMachineVariant() } = {}) {
  const {pivot,arm,grip}=RETURN_LEVER;
  ctx.save();
  // This bearing plate is fastened to the left platen housing. Its axle is
  // the single pivot for the complete bent lever and its fitted Bakelite grip.
  const mount=gradient(ctx,319,525,353,550,[[0,finish.metal[0]],[.4,finish.metal[2]],[1,finish.metal[3]]]);
  roundRect(ctx,319,525,34,25,4,mount,"#28281f",1);
  for(const x of [324,348]) {circle(ctx,x,544,2.3,finish.metal[0]);line(ctx,[[x-1.4,544],[x+1.4,544]],finish.metal[3],.8);}
  ctx.translate(pivot.x,pivot.y);ctx.rotate(returnLeverAngle(returnProgress));
  ctx.lineCap="round";ctx.lineJoin="round";
  line(ctx,arm,finish.metal[3],8);
  const metal=gradient(ctx,-180,-36,0,-28,[[0,finish.metal[2]],[.25,finish.metal[0]],[.7,finish.metal[1]],[1,finish.metal[3]]]);
  line(ctx,arm,metal,5.6);
  // The metal tang enters this grip by 27 logical pixels; both use this same
  // transform, so neither return animation nor carriage travel can split them.
  const bakelite=gradient(ctx,grip.x,0,grip.x+grip.width,0,[[0,"#191e1b"],[.22,"#4e5550"],[.65,"#333b34"],[1,"#101611"]]);
  roundRect(ctx,grip.x,grip.y,grip.width,grip.height,4,bakelite,"#232c24",.8);
  roundRect(ctx,grip.x+1,grip.y+grip.height-5,grip.width-2,4,1,finish.metal[2]);
  circle(ctx,0,0,7,finish.metal[3],finish.metal[0],1);
  circle(ctx,0,0,3.5,finish.metal[1]);line(ctx,[[-2,0],[2,0]],finish.metal[3],1);
  ctx.restore();
}

export function drawCarriage(ctx, { layout, activeLine = 0, returnProgress = 0, finish = getMachineVariant() }) {
  ctx.save();
  const platen=gradient(ctx,0,516,0,565,[[0,"#292d2b"],[.15,"#3c3d39"],[.35,"#333530"],[.78,"#1d211c"],[1,"#0a0e0a"]]);
  roundRect(ctx,320,PAPER_MOUTH_Y,635,565-PAPER_MOUTH_Y,22,platen);
  const ruler=gradient(ctx,0,518,0,529,[[0,finish.metal[2]],[.5,finish.metal[1]],[1,finish.metal[3]]]);
  roundRect(ctx,352,519,574,10,0,ruler);
  for(let i=0;i<=42;i+=1){const x=353+i*13.6;line(ctx,[[x,520],[x,i%5===0?529:527]],finish.metal[0],.7);}
  drawReturnLever(ctx,{returnProgress,finish});
  drawKnob(ctx,295,activeLine*.38,finish);drawKnob(ctx,980,activeLine*.38,finish);
  // Bail and rubber wheels share this canvas and the paper's translating parent.
  const y=layout.bailY, h=layout.bailHeight;
  // The bail is hinged outside the paper's printable width. Its two solid
  // arms stay with the carriage and remain visible when the sheet is ejected.
  ctx.save();ctx.lineCap="round";ctx.lineJoin="round";
  for(const side of [-1,1]) {
    const end=side<0?394:889,hinge=end+side*13;
    const points=[[hinge,539],[hinge,512],[end,y]];
    line(ctx,points,finish.metal[3],4);
    line(ctx,points,finish.metal[1],2.2);
    screw(ctx,hinge,539,4,finish);
  }
  ctx.restore();
  // All strokes (including the shadow) stay inside the tested bail band.
  line(ctx,[[394,y+h*.22],[889,y+h*.22]],"rgba(0,0,0,.35)",h*.52);
  line(ctx,[[394,y],[889,y]],finish.metal[2],Math.min(2,h*.55));
  line(ctx,[[394,y-h*.2],[889,y-h*.2]],finish.metal[0],Math.min(.8,h*.18));
  const rubber=gradient(ctx,0,y-h/2,0,y+h/2,[[0,"#4b4a3c"],[.4,"#575646"],[1,"#383b2f"]]);
  for(const x of [518,766])roundRect(ctx,x-12,y-h/2,24,h,h/2,rubber);
  ctx.restore();
}

function useMechanicalCanvas(ref, draw, dependencies, animateFor=0) {
  useLayoutEffect(()=>{
    const canvas=ref.current;
    if(!canvas)return undefined;
    let frame, cancelled=false;
    const start=performance.now();
    function paint(now=performance.now()) {
      if(cancelled)return;
      cancelAnimationFrame(frame);
      const width=canvas.clientWidth, height=canvas.clientHeight;
      if(!width||!height)return;
      const ratio=Math.max(window.devicePixelRatio||1,2);
      const pixelsW=Math.round(width*ratio),pixelsH=Math.round(height*ratio);
      if(canvas.width!==pixelsW||canvas.height!==pixelsH){canvas.width=pixelsW;canvas.height=pixelsH;}
      const ctx=canvas.getContext("2d");
      ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.setTransform(canvas.width/FRAME.width,0,0,canvas.height/FRAME.height,0,0);
      draw(ctx,now-start);
      if(now-start<animateFor)frame=requestAnimationFrame(paint);
    }
    const resize=new ResizeObserver(()=>paint(performance.now()));resize.observe(canvas);
    document.fonts?.ready.then(()=>{if(!cancelled)paint(performance.now());});
    paint(start);
    return()=>{cancelled=true;cancelAnimationFrame(frame);resize.disconnect();};
  },dependencies);
}

export function ReferenceMachine({ model, compositionText, activeKey, strike, returning, ejecting, paperVisualStyle, variant = getMachineVariant(), machine = getMachineModel(), inspection, children }) {
  const bodyRef=useRef(null),carriageRef=useRef(null),paperNode=useRef(null);
  const layout=getPaperLayout(model),active=model.lines[model.activeLine];
  const lane=inspection?.lane ?? strike.hash%TYPEBARS.length;
  const strikeStarted=useRef({id:0,time:0});
  if(strikeStarted.current.id!==strike.id)strikeStarted.current={id:strike.id,time:performance.now()};
  const feedStarted=useRef({from:model.activeLine,to:model.activeLine,time:performance.now()});
  if(feedStarted.current.to!==model.activeLine)feedStarted.current={from:feedStarted.current.to,to:model.activeLine,time:performance.now()};
  const stampCount=model.lines.reduce((sum,row)=>sum+row.glyphs.length,0);
  useMechanicalCanvas(bodyRef,(ctx)=>{
    const elapsed=performance.now()-strikeStarted.current.time;
    drawBody(ctx,{activeKey,travel:inspection?.travel ?? strikeTravel(elapsed),lane,stampCount,finish:variant,machine});
  },[activeKey,strike.id,returning,stampCount,variant.id,machine.id,inspection],inspection?0:160);
  useMechanicalCanvas(carriageRef,(ctx)=>{
    const progress=returning?Math.min(1,(performance.now()-feedStarted.current.time)/820):1;
    const turn=1-(1-progress)**3;
    drawCarriage(ctx,{layout,activeLine:feedStarted.current.from+(feedStarted.current.to-feedStarted.current.from)*turn,returnProgress:inspection?.returnProgress ?? (returning?progress:0),finish:variant});
  },[layout.id,model.activeLine,returning,variant.id,inspection],inspection?0:(returning?850:0));
  const carriageX=referenceCarriageOffset(active.cursor,layout);
  const roll=model.kind==="scroll";
  const band=roll?rollWindow(model,layout):null;
  const textureStyle=useRollPaperStyle(paperVisualStyle,roll,(band?.first||0)*(band?.pitch||0)/PAPER.width);
  const first=band?.first||0;
  const visibleRows=roll?model.lines.slice(first,band.last+1):model.lines;
  const paperHeight=band?.height||PAPER.height;
  const rowStart=layout.start*PAPER.height/paperHeight;
  const feed=roll?band.feed/paperHeight*100:paperFeedOffset(model,layout);
  useLayoutEffect(()=>{
    if(!roll||!returning||inspection||!paperNode.current)return;
    // Rebase long-roll coordinates invisibly, then advance one physical pitch.
    const motion=paperNode.current.animate([
      {transform:`translate3d(0,${(band.feed+band.pitch)/paperHeight*100}%,0)`},
      {transform:`translate3d(0,${feed}%,0)`},
    ],{duration:820,easing:"cubic-bezier(.18,.86,.28,1.03)"});
    return()=>motion.cancel();
  },[roll,model.activeLine,returning]);
  return (
    <div className={`reference-rig${roll?" continuous-roll":""}`} style={{...paperLayoutStyle(layout),"--paper-mouth-bottom":`${100-PAPER_MOUTH_Y/FRAME.height*100}%`,"--paper-eject-offset":`${PAPER_EJECT_OFFSET_PERCENT}%`}} data-writing-kind={model.kind||"sheet"} data-machine-model={machine.id} data-variant={variant.id} data-inspection={inspection ? "true" : undefined} data-layout={layout.id} data-active-line={model.activeLine} data-cursor={active.cursor}>
      <div className="reference-carriage" style={{"--carriage-x":`${carriageX/FRAME.width*100}%`}}>
        <div className={`reference-paper-window${ejecting?" ejecting":""}`}>
          <div ref={paperNode} className="paper-sheet reference-paper" style={{...textureStyle,...(roll?{height:`${paperHeight/FRAME.height*100}%`,transition:ejecting?undefined:"none"}:{}),"--paper-feed-y":`${feed}%`,...(inspection?.ejectionProgress !== undefined ? {transform:`translate3d(0,${feed+(PAPER_EJECT_OFFSET_PERCENT-feed)*inspection.ejectionProgress}%,0)`,opacity:1} : {})}}>
            <div className="paper-grain" />
            <div className="live-ink">
              {visibleRows.map((row,index)=>row.glyphs.map(glyph=>(
                <span className="live-glyph-row" data-line-index={index+first} style={{top:`calc(${rowStart}% + ${index*layout.linePitch}cqw)`}} key={glyph.id}>
                  <InkGlyph glyph={glyph} layout={layout}/>
                </span>
              )))}
              {compositionText&&<span className="composition-preview" style={{left:`${layout.glyphStart+active.cursor/layout.maxUnits*layout.glyphRange}%`,top:`calc(${rowStart}% + ${(model.activeLine-first)*layout.linePitch}cqw)`}}>{compositionText}</span>}
            </div>
          </div>
        </div>
        <canvas className="reference-carriage-hardware" ref={carriageRef} aria-hidden="true" />
      </div>
      <canvas className="reference-machine" ref={bodyRef} aria-hidden="true" />
      {children}
    </div>
  );
}

export function MachineFinishPreview({ variant, machine = getMachineModel() }) {
  const canvasRef = useRef(null);
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    let cancelled = false;
    function paint() {
      if (cancelled) return;
      canvas.width = 704;
      canvas.height = 408;
      const ctx = canvas.getContext("2d");
      ctx.scale(.8, .8);
      ctx.translate(-200, -480);
      drawBody(ctx, { finish: variant, machine });
    }
    paint();
    document.fonts?.ready.then(paint);
    return () => { cancelled = true; };
  }, [variant.id, machine.id]);
  return <canvas className="finish-preview" ref={canvasRef} aria-hidden="true" />;
}
