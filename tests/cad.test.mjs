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
import {pulleyOutline,outlineSvgPath} from '../src/profile.mjs';

// Integrate an SVG outline independently using the SVG endpoint-to-center arc
// conversion. Compare its enclosed area with the volume of an extruded CAD part.
function svgArea(path){
  const tokens=path.match(/[MLAZ]|[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  let index=0,point=[0,0],area=0;
  const number=()=>Number(tokens[index++]);
  while(index<tokens.length){
    const command=tokens[index++];
    if(command==='Z')break;
    if(command==='M'){point=[number(),number()];continue;}
    const [x1,y1]=point;
    if(command==='L'){
      point=[number(),number()];area+=(x1*point[1]-point[0]*y1)/2;continue;
    }
    const radius=number();number();number();
    const large=number(),sweep=number(),x2=number(),y2=number();
    const dx=(x1-x2)/2,dy=(y1-y2)/2;
    const factor=(large===sweep?-1:1)*Math.sqrt(Math.max(0,(radius**2-dx**2-dy**2)/(dx**2+dy**2)));
    const cx=(x1+x2)/2+factor*dy,cy=(y1+y2)/2-factor*dx;
    const start=Math.atan2(y1-cy,x1-cx),end=Math.atan2(y2-cy,x2-cx);
    let angle=end-start;
    if(sweep&&angle<0)angle+=2*Math.PI;
    if(!sweep&&angle>0)angle-=2*Math.PI;
    area+=(cx*(y2-y1)-cy*(x2-x1)+radius**2*angle)/2;
    point=[x2,y2];
  }
  return Math.abs(area);
}


const require=createRequire(import.meta.url);
const loaderPath=require.resolve('replicad-opencascadejs');
const loader=readFileSync(loaderPath,'utf8').replace('export default Module;','Module;');
const context=vm.createContext({require,process,console,Buffer,WebAssembly,TextDecoder,TextEncoder,Uint8Array,ArrayBuffer,Blob,setTimeout,clearTimeout,__dirname:path.dirname(loaderPath),__filename:loaderPath});
const init=vm.runInContext(loader,context);
setOC(await init({wasmBinary:readFileSync(path.join(path.dirname(loaderPath),'replicad_single.wasm')),print:()=>{},printErr:console.error}));
mkdirSync('test-output',{recursive:true});

test('curved drawing outline matches CAD cross section for both HTD profiles and groove adjustments',()=>{
  for(const pitch of [3,5])for(const offset of [0,.2,-.2]){
    const p={...defaults,pitch,teeth:36,shaft:9.525,flanges:0,grooveWidth:offset,grooveDepth:offset};
    const path=outlineSvgPath(pulleyOutline(p),142,169,3.2);
    assert.ok(!/NaN|Infinity/.test(path));
    assert.equal((path.match(/A/g)||[]).length,p.teeth*7);
    const shape=buildPulley(p),d=dimensions(p);
    const boreArea=3*Math.sqrt(3)/2*(d.boreCorners/2)**2;
    const cadArea=measureVolume(shape)/p.width+boreArea;
    assert.ok(Math.abs(svgArea(path)/3.2**2-cadArea)<1e-5,`Drawing differs from CAD: ${pitch}M offset ${offset}`);
    shape.delete();
  }
});


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
    shape.mesh({tolerance:.06,angularTolerance:.15});
    const edgeLines=shape.meshEdges({tolerance:.06,angularTolerance:.15}).lines;
    assert.ok(edgeLines.length>0&&edgeLines.length%6===0&&edgeLines.every(Number.isFinite),'CAD edges must contain valid line segments for shaded-with-edges display');
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
