import assert from "node:assert/strict";
import test from "node:test";
import { MACHINE_VARIANTS } from "../src/machineVariants.js";
import { PAPER, PAPER_MOUTH_Y, PAPER_EJECT_OFFSET_PERCENT, TYPEBARS, REFERENCE_KEYS, getPaperLayout, inkEnvelope, paperFeedOffset, typebarPosition } from "../src/referenceGeometry.js";

test("all five finishes are palette-only: no variant can override physical geometry or depth",()=>{
  assert.equal(MACHINE_VARIANTS.length,5);
  const expected=["id","name","subtitle","shell","bed","front","basket","metal","keys","legend","secondary","spool","accent","edge","enamel","roomFilter","roomTint","roomTintOpacity"].sort();
  for(const variant of MACHINE_VARIANTS)assert.deepEqual(Object.keys(variant).sort(),expected);
});

for(const id of ["reference","compact"]) {
  const layout=getPaperLayout({layoutId:id});
  test(`${id}: the entire ink envelope clears both foreground hardware boundaries`,()=>{
    const ink=inkEnvelope(layout);
    assert.ok(ink.bottom<PAPER_MOUTH_Y,"platen must never mask the active glyph envelope");
    assert.ok(ink.top>layout.bailY+layout.bailHeight/2,"bail, rollers and their shadows must stay above active ink");
  });
  test(`${id}: every sheet row ejects upwards continuously with a permanent paper mouth`,()=>{
    for(let activeLine=0;activeLine<layout.maxLines;activeLine++) {
      let previous=Infinity;
      for(let step=0;step<=100;step++) {
        const offset=paperFeedOffset({activeLine},layout,step/100);
        assert.ok(offset<=previous,"ejection cannot reverse feed");previous=offset;
        const paperBottom=PAPER.top+PAPER.height*(1+offset/100);
        const visibleBottom=Math.min(paperBottom,PAPER_MOUTH_Y);
        assert.ok(visibleBottom<=PAPER_MOUTH_Y);
      }
      assert.equal(paperFeedOffset({activeLine},layout,1),PAPER_EJECT_OFFSET_PERCENT);
    }
  });
}

test("all type-slugs stay below the bail throughout lift and fit within the guide at contact",()=>{
  for(const id of ["reference","compact"]) {
    const layout=getPaperLayout({layoutId:id});
    for(const bar of TYPEBARS)for(let step=0;step<=100;step++) {
      const {tip}=typebarPosition(bar.index,step/100);
      assert.ok(tip.y-3.4>layout.bailY+layout.bailHeight/2);
      if(step===100)assert.ok(tip.x-3.4>626&&tip.x+3.4<654);
    }
  }
});

test("keycaps retain a positive physical gap to their neighbors throughout their travel",()=>{
  const keys=REFERENCE_KEYS.filter(key=>key.code!=="Space");
  for(const a of keys)for(const b of keys) {
    if(a===b)continue;
    for(const press of [0,4.5]) {
      const horizontalOverlap=Math.abs(a.x-b.x)<(a.width+b.width)/2;
      const verticalOverlap=Math.abs(a.y+press-b.y)<(a.height+b.height)/2;
      assert.ok(!(horizontalOverlap&&verticalOverlap),`${a.code} overlaps ${b.code}`);
    }
  }
});
