import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as THREE from 'three';
import {createServer} from 'vite';
import {defaults} from '../src/parameters.mjs';
import {screenPanOffset} from '../src/pan.mjs';

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

test('right or middle mouse drag translates the model in the same screen direction',()=>{
  const width=800,height=600;
  for(const position of [[45,-50,50],[0,-70,0],[0,0,75]]){
    const camera=new THREE.PerspectiveCamera(34,width/height,.1,2000);
    camera.position.set(...position);camera.up.set(0,0,1);
    if(position[2]===75)camera.up.set(0,1,0);
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
