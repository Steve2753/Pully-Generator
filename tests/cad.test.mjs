import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setOC,measureVolume,importSTEP} from 'replicad';
import {buildPulley} from '../src/model.mjs';
import {defaults,dimensions,validate} from '../src/parameters.mjs';
import {parametersForDisplay,parametersForModel,formatLength} from '../src/units.mjs';
import {exportPulley} from '../src/exports.mjs';
import {profileDeviations} from '../scripts/check-profile-arcs.mjs';

const require=createRequire(import.meta.url);
const loaderPath=require.resolve('replicad-opencascadejs');
const loader=readFileSync(loaderPath,'utf8').replace('export default Module;','Module;');
const context=vm.createContext({require,process,console,Buffer,WebAssembly,TextDecoder,TextEncoder,Uint8Array,ArrayBuffer,Blob,setTimeout,clearTimeout,__dirname:path.dirname(loaderPath),__filename:loaderPath});
const init=vm.runInContext(loader,context);
setOC(await init({wasmBinary:readFileSync(path.join(path.dirname(loaderPath),'replicad_single.wasm')),print:()=>{},printErr:console.error}));
mkdirSync('test-output',{recursive:true});

test('nominal dimensions and impossible shaft/width combinations',()=>{
  assert.equal(validate(defaults).length,0);
  assert.ok(Math.abs(dimensions(defaults).outsideDiameter-37.05418634)<1e-6);
  assert.equal(dimensions(defaults).faceWidth,15);
  assert.equal(dimensions(defaults).boreAF,12.85);
  assert.ok(validate({...defaults,teeth:12,pitch:3}).length);
  assert.ok(validate({...defaults,variant:'tube',width:8}).length);
  assert.ok(validate({...defaults,teeth:24.5}).length);
  assert.ok(validate({...defaults,variant:'bearing',coneTip:35}).length);
});
test('fitted groove arcs preserve published 3M and 5M profile within 0.002 mm',()=>{
  for(const result of profileDeviations())assert.ok(result.deviation<0.002,JSON.stringify(result));
});
test('unit toggle converts every editable length and keeps tooth pitch unchanged',()=>{
  const inches=parametersForDisplay(defaults,'in');
  assert.equal(inches.shaft,.5);
  assert.equal(inches.pitch,5);
  assert.equal(inches.teeth,24);
  const again=parametersForModel(inches,'in');
  for(const key of Object.keys(defaults))assert.ok(typeof defaults[key]==='number'?Math.abs(again[key]-defaults[key])<1e-10:again[key]===defaults[key],key);
  assert.equal(formatLength(25.4,'in'),'1.0000 in');
});
test('selected output unit changes STEP metadata and STL coordinates, preserving physical size',async()=>{
  const shape=buildPulley(defaults);
  const mmStep=exportPulley(shape,'step','mm');
  const inStep=exportPulley(shape,'step','in');
  const inchText=await inStep.text();
  assert.match(inchText,/CONVERSION_BASED_UNIT\('INCH'/);
  const fromInches=await importSTEP(inStep);
  assert.ok(Math.abs(measureVolume(fromInches)-measureVolume(shape))<0.01);
  fromInches.delete();
  const mmText=await mmStep.text();
  assert.match(mmText,/SI_UNIT\(\.MILLI\.,\.METRE\.\)/);
  const mmStl=await exportPulley(shape,'stl','mm').arrayBuffer();
  const inStl=await exportPulley(shape,'stl','in').arrayBuffer();
  const zBounds=bytes=>{const view=new DataView(bytes),count=view.getUint32(80,true),values=[];for(let i=0;i<count;i++)for(let j=0;j<3;j++)values.push(view.getFloat32(84+i*50+12+j*12+8,true));return Math.max(...values)-Math.min(...values);};
  assert.ok(Math.abs(zBounds(mmStl)-defaults.width)<0.001);
  assert.ok(Math.abs(zBounds(inStl)-defaults.width/25.4)<0.0001);
  shape.delete();
});
test('groove and bore detail controls affect valid solids',()=>{
  const base=buildPulley(defaults),baseVolume=measureVolume(base);base.delete();
  const altered={...defaults,grooveWidth:0.2,grooveDepth:0.2,hexAngle:30,flanges:1,flangeSide:'top'};
  assert.equal(validate(altered).length,0);
  const shape=buildPulley(altered);
  assert.ok(Math.abs(measureVolume(shape)-baseVolume)>0.1);
  assert.ok(shape.mesh().triangles.length>100);
  shape.delete();
});
for(const variant of ['standard','tube','bearing'])for(const shaft of [12.7,9.525]) {
  test(`${variant} ${shaft} mm shaft is solid, correctly sized, and exports STEP and watertight STL`,async()=>{
    const p={...defaults,variant,shaft,width:variant==='tube'?28:variant==='bearing'?23:18};
    const shape=buildPulley(p);
    assert.ok(measureVolume(shape)>0);
    const bounds=shape.boundingBox.bounds;
    assert.ok(Math.abs((bounds[1][2]-bounds[0][2])-p.width)<1e-4);
    const step=shape.blobSTEP();const text=await step.text();
    assert.ok(text.startsWith('ISO-10303-21;'));assert.ok(text.includes('MANIFOLD_SOLID_BREP'));
    const imported=await importSTEP(step);assert.ok(Math.abs(measureVolume(imported)-measureVolume(shape))<0.01);imported.delete();
    const stl=shape.blobSTL({tolerance:.025,angularTolerance:.08,binary:true});
    const bytes=await stl.arrayBuffer();const data=new DataView(bytes);const count=data.getUint32(80,true);
    assert.equal(bytes.byteLength,84+count*50);assert.ok(count>100);
    // Every geometric edge in a closed triangulated surface has two incident faces.
    const edges=new Map();
    for(let i=0;i<count;i++){
      const points=[];
      for(let j=0;j<3;j++)points.push([0,1,2].map(k=>data.getFloat32(84+i*50+12+j*12+k*4,true).toFixed(4)).join(','));
      for(let j=0;j<3;j++){const edge=[points[j],points[(j+1)%3]].sort().join('|');edges.set(edge,(edges.get(edge)||0)+1);}
    }
    assert.equal([...edges.values()].filter(n=>n!==2).length,0,'STL must have no open or nonmanifold edges');
    if(shaft===12.7){writeFileSync(`test-output/${variant}.step`,text);writeFileSync(`test-output/${variant}.stl`,Buffer.from(bytes));}
    shape.delete();
  });
}
test('3M profile, flange modes, and changed tooth count export correctly',()=>{
  for(const flanges of [0,1,2]){
    const p={...defaults,pitch:3,teeth:36,shaft:9.525,flanges,width:16};const shape=buildPulley(p);
    assert.ok(measureVolume(shape)>0);assert.ok(shape.mesh().triangles.length>100);shape.delete();
  }
});
