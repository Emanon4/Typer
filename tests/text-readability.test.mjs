import test from "node:test";
import assert from "node:assert/strict";
import { inkTypography, inkImpression } from "../src/inkTypography.js";
import { getPaperLayout, inkEnvelope, GUIDE_TOP, RIBBON_WIDTH, RIBBON_REST_Y, ribbonPosition, STRIKE, strikeTravel } from "../src/referenceGeometry.js";

for(const id of ["reference","compact"]) {
  test(`${id}: resting guide and ribbon expose the whole active text row`,()=>{
    const ink=inkEnvelope(getPaperLayout({layoutId:id}));
    assert.ok(GUIDE_TOP>ink.bottom+2,"fixed guide must clear all printed columns");
    assert.ok(ribbonPosition(0)-RIBBON_WIDTH/2>ink.bottom+2,"resting ribbon must be entirely below the ink");
  });
}

test("ribbon lifts at contact and retracts when the physical stroke ends",()=>{
  assert.equal(ribbonPosition(strikeTravel(50)),STRIKE.y);
  assert.equal(ribbonPosition(strikeTravel(78)),STRIKE.y);
  assert.equal(ribbonPosition(strikeTravel(132)),RIBBON_REST_Y);
  assert.equal(ribbonPosition(strikeTravel(1000)),RIBBON_REST_Y);
});

test("Chinese screen and export metrics scale identically without faint impressions",()=>{
  const glyph={character:"墨",seed:117};
  const live=inkTypography(glyph,32,30.5),exported=inkTypography(glyph,320,305);
  assert.ok(live.fontSize>=30.5*.9);
  assert.ok(live.opacity>=.83);
  for(const key of ["fontSize","x","baseline"])assert.ok(Math.abs(exported[key]-live[key]*10)<1e-8);
  assert.equal(live.fontFamily,exported.fontFamily);
  assert.equal(live.fontWeight,exported.fontWeight);
  assert.ok(live.fontFamily.startsWith('"Typer KingHwa OldSong"'));
  assert.equal(live.fontWeight,400,"preserve the original font strokes without synthesized bold");
  for (const character of ["，", "。", "！", "？", "；", "："]) {
    assert.equal(inkTypography({character,seed:117},32,30.5).fontFamily,live.fontFamily);
  }
});

test("paper-fiber wear is reproducible and changes with each physical impression",()=>{
  const glyph={character:"墨",seed:117};
  assert.deepEqual(inkImpression(glyph,320,305),inkImpression(glyph,320,305));
  assert.notDeepEqual(inkImpression(glyph,320,305).wear,inkImpression({...glyph,seed:118},320,305).wear);
  const live=inkImpression(glyph,320,305),exported=inkImpression(glyph,640,610);
  assert.equal(live.rotation,exported.rotation);
  assert.equal(live.lift*2,exported.lift);
  assert.equal(live.spread*2,exported.spread);
  assert.deepEqual(live.wear.map(x=>x.opacity),exported.wear.map(x=>x.opacity));
});
