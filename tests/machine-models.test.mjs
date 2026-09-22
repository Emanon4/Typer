import assert from "node:assert/strict";
import test from "node:test";
import { MACHINE_MODELS, getMachineModel, getModelKeys, modelKeyTravel } from "../src/machineModels.js";
import { REFERENCE_KEYS } from "../src/referenceGeometry.js";

test("changing physical model preserves every key and the original reference geometry",()=>{
  const original=structuredClone(REFERENCE_KEYS);
  for(const model of MACHINE_MODELS) {
    const keys=getModelKeys(model);
    assert.deepEqual(keys.map(k=>k.code),REFERENCE_KEYS.map(k=>k.code));
    assert.deepEqual(keys.map(k=>k.label),REFERENCE_KEYS.map(k=>k.label));
  }
  assert.deepEqual(REFERENCE_KEYS,original);
  assert.equal(getMachineModel("old-saved-or-unknown-model").id,"classic");
});

for(const model of MACHINE_MODELS) {
  test(`${model.id}: all keys clear each other through independent depression and release`,()=>{
    const keys=getModelKeys(model),travel=modelKeyTravel(model);
    for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++) {
      const a=keys[i],b=keys[j];
      for(const aPress of [0,travel/2,travel])for(const bPress of [0,travel/2,travel]) {
        // Round keycaps can have overlapping bounding boxes without touching.
        // Test their actual rounded shapes, including each stationary base.
        const shapes=(key,press)=>[
          {...key,y:key.y+press,radius:model.keyRadius??key.height/2},
          {...key,y:key.y+6,height:key.height+2,radius:model.keyRadius??key.height/2},
        ];
        for(const sa of shapes(a,aPress))for(const sb of shapes(b,bPress)) {
          const dx=Math.max(0,Math.abs(sa.x-sb.x)-(sa.width/2-sa.radius+sb.width/2-sb.radius));
          const dy=Math.max(0,Math.abs(sa.y-sb.y)-(sa.height/2-sa.radius+sb.height/2-sb.radius));
          assert.ok(Math.hypot(dx,dy)>sa.radius+sb.radius+.7,`${a.code} collides with ${b.code}`);
        }
      }
    }
  });
}
