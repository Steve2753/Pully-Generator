import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as THREE from 'three';
import {createServer} from 'vite';
import {defaults} from '../src/parameters.mjs';
import {screenPanOffset} from '../src/pan.mjs';
import {fitCamera,standardViews} from '../src/camera.mjs';

test('front and side drawings label every feature in both display units',async()=>{
  const server=await createServer({server:{middlewareMode:true},appType:'custom'});
  try{
    const {default:Diagram,dimensionRows}=await server.ssrLoadModule('/src/Diagram.jsx');
    for(const variant of ['standard','tube','bearing'])for(const unit of ['in','mm']){
      const p={...defaults,variant,width:variant==='standard'?18:variant==='tube'?28:23};
      const html=renderToStaticMarkup(React.createElement(Diagram,{params:p,active:'',unit}));
      for(const row of dimensionRows(p,unit)){
        assert.ok(html.includes(row.label),`${variant} ${unit}: missing ${row.label}`);
        assert.ok(html.includes(row.value.replace('·','·')),`${variant} ${unit}: missing ${row.value}`);
      }
      assert.match(html,/FRONT/);assert.match(html,/SIDE/);
      assert.ok(html.includes(`${p.pitch} mm pitch`));
      if(unit==='in')assert.ok(html.includes(' in'));
    }
  }finally{await server.close();}
});

test('pan follows the pointer in perspective and orthographic views, including after rotation',()=>{
  const width=800,height=600;
  for(const projection of ['perspective','orthographic'])for(const position of [[45,-50,50],[0,-70,0],[0,0,75],[0,0,-75]]){
    const camera=projection==='perspective'?new THREE.PerspectiveCamera(34,width/height,.1,2000):new THREE.OrthographicCamera(-40,40,30,-30,.1,2000);
    if(projection==='orthographic')camera.zoom=1.7;
    camera.updateProjectionMatrix();
    camera.position.set(...position);camera.up.set(0,0,1);
    if(Math.abs(position[2])===75)camera.up.set(0,1,0);
    const target=new THREE.Vector3();camera.lookAt(target);camera.updateMatrixWorld();
    const start=new THREE.Vector3().project(camera);
    const offset=screenPanOffset(camera,target,32,24,height);
    camera.position.add(offset);target.add(offset);camera.lookAt(target);camera.updateMatrixWorld();
    const end=new THREE.Vector3().project(camera);
    const screenDx=(end.x-start.x)*width/2,screenDy=-(end.y-start.y)*height/2;
    assert.ok(screenDx>30&&screenDx<34,`horizontal pan ${screenDx}`);
    assert.ok(screenDy>22&&screenDy<26,`vertical pan ${screenDy}`);
  }
});

test('all standard views frame the entire model at wide and narrow aspect ratios',()=>{
  for(const projection of ['perspective','orthographic'])for(const aspect of [.5,1,2.5])for(const preset of Object.values(standardViews)){
    const camera=projection==='perspective'?new THREE.PerspectiveCamera(34,aspect):new THREE.OrthographicCamera();
    camera.up.set(...preset.up);
    const size=new THREE.Vector3(40,40,28).length();
    fitCamera(camera,size,aspect,new THREE.Vector3(...preset.direction));
    for(const x of [-20,20])for(const y of [-20,20])for(const z of [-14,14]){
      const point=new THREE.Vector3(x,y,z).project(camera);
      assert.ok(Math.abs(point.x)<1&&Math.abs(point.y)<1&&Math.abs(point.z)<1,`${projection}, aspect ${aspect}: clipped model`);
    }
    assert.ok(camera.up.clone().cross(camera.position).length()>0,'view direction must not be parallel to camera up');
  }
});
