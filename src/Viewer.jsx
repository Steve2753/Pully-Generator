import React,{useEffect,useRef} from 'react';
import * as THREE from 'three';
import {TrackballControls} from 'three/addons/controls/TrackballControls.js';
import {screenPanOffset} from './pan.mjs';
import {fitCamera,standardViews} from './camera.mjs';

function disposeObject(s){
  if(!s.object)return;
  s.scene.remove(s.object);
  s.object.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  s.object=null;
}

export default function Viewer({mesh,displayMode,view,viewKey,projection,fitKey,theme,navigation,onOrbit}){
  const host=useRef(null),sceneRef=useRef(null),options=useRef({navigation,onOrbit});
  options.current={navigation,onOrbit};
  useEffect(()=>{
    const el=host.current,scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(34,1,.01,2000);
    camera.up.set(0,0,1);camera.position.set(60,-60,60);camera.lookAt(0,0,0);
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff,0x67768d,3));
    const key=new THREE.DirectionalLight(0xffffff,4);key.position.set(-50,80,100);scene.add(key);
    const fill=new THREE.DirectionalLight(0xd7e5ff,2);fill.position.set(60,-30,40);scene.add(fill);
    const s={scene,camera,renderer,controls:null,object:null,size:40,fitted:false};
    s.installControls=()=>{
      s.controls?.dispose();
      const controls=new TrackballControls(s.camera,renderer.domElement);
      controls.staticMoving=true;controls.rotateSpeed=1.5;controls.zoomSpeed=1;
      controls.noPan=true;
      // Do not intercept typing in configuration fields.
      controls.keys=[];controls.minDistance=s.size*.15;controls.maxDistance=s.size*30;
      controls.minZoom=.05;controls.maxZoom=20;
      controls.addEventListener('change',()=>{
        if(controls.state===0||controls.state===3)options.current.onOrbit();
      });
      s.controls=controls;
    };
    s.installControls();sceneRef.current=s;
    // Exact screen-space pan for every camera orientation and projection.
    let pan=null;
    const touches=new Map();
    const midpoint=()=>{
      const points=[...touches.values()];
      return touches.size===2?{x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2}:null;
    };
    const translate=(dx,dy)=>{
      const delta=screenPanOffset(s.camera,s.controls.target,dx,dy,el.clientHeight);
      s.camera.position.add(delta);s.controls.target.add(delta);s.controls.update();
    };
    const down=e=>{
      s.controls.handleResize();
      if(e.pointerType==='touch')touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(e.button!==1&&e.button!==2&&!(e.button===0&&(e.shiftKey||options.current.navigation==='pan')))return;
      e.preventDefault();e.stopImmediatePropagation();
      pan={id:e.pointerId,x:e.clientX,y:e.clientY};
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const move=e=>{
      if(touches.has(e.pointerId)){
        const previous=midpoint();
        touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
        const next=midpoint();
        if(previous&&next)translate(next.x-previous.x,next.y-previous.y);
      }
      if(!pan||pan.id!==e.pointerId)return;
      e.preventDefault();e.stopImmediatePropagation();
      translate(e.clientX-pan.x,e.clientY-pan.y);
      pan.x=e.clientX;pan.y=e.clientY;
    };
    const up=e=>{
      touches.delete(e.pointerId);
      if(pan?.id!==e.pointerId)return;
      e.preventDefault();e.stopImmediatePropagation();pan=null;
      if(renderer.domElement.hasPointerCapture(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId);
    };
    renderer.domElement.addEventListener('pointerdown',down,true);
    renderer.domElement.addEventListener('pointermove',move,true);
    renderer.domElement.addEventListener('pointerup',up,true);
    renderer.domElement.addEventListener('pointercancel',up,true);
    const resize=new ResizeObserver(()=>{
      const w=Math.max(el.clientWidth,1),h=Math.max(el.clientHeight,1),aspect=w/h;
      renderer.setSize(w,h);
      if(s.camera.isPerspectiveCamera)s.camera.aspect=aspect;
      else{s.camera.left=-s.camera.top*aspect;s.camera.right=s.camera.top*aspect;}
      s.camera.updateProjectionMatrix();s.controls.handleResize();
    });resize.observe(el);
    let frame;
    const animate=()=>{frame=requestAnimationFrame(animate);s.controls.update();renderer.render(scene,s.camera);};animate();
    return()=>{
      cancelAnimationFrame(frame);resize.disconnect();s.controls.dispose();disposeObject(s);
      for(const [event,handler] of [['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',up]])renderer.domElement.removeEventListener(event,handler,true);
      renderer.dispose();el.removeChild(renderer.domElement);sceneRef.current=null;
    };
  },[]);
  useEffect(()=>{
    const s=sceneRef.current;if(!s||!mesh)return;
    disposeObject(s);
    const previousSize=s.size;
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(mesh.vertices,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(mesh.normals,3));
    geometry.setIndex(mesh.triangles);geometry.computeBoundingBox();
    const center=geometry.boundingBox.getCenter(new THREE.Vector3());
    s.size=geometry.boundingBox.getSize(new THREE.Vector3()).length();
    geometry.translate(-center.x,-center.y,-center.z);
    const material=new THREE.MeshStandardMaterial({color:0xc1c9d2,metalness:.35,roughness:.5,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
    s.object=new THREE.Mesh(geometry,material);
    const edges=new THREE.BufferGeometry();
    edges.setAttribute('position',new THREE.Float32BufferAttribute(mesh.edges||[],3));
    edges.translate(-center.x,-center.y,-center.z);
    s.edges=new THREE.LineSegments(edges,new THREE.LineBasicMaterial({color:theme==='dark'?0x253447:0x334155}));
    s.edges.visible=displayMode==='edges';s.object.add(s.edges);
    material.wireframe=displayMode==='wireframe';s.scene.add(s.object);
    if(!s.fitted){
      fitCamera(s.camera,s.size,host.current.clientWidth/host.current.clientHeight);
      s.installControls();s.fitted=true;
    }else{
      const ratio=s.size/previousSize;
      s.camera.position.multiplyScalar(ratio);s.controls.target.multiplyScalar(ratio);
      if(s.camera.isOrthographicCamera)for(const key of ['left','right','top','bottom'])s.camera[key]*=ratio;
      s.camera.near*=ratio;s.camera.far*=ratio;s.camera.updateProjectionMatrix();
    }
    s.controls.minDistance=s.size*.15;s.controls.maxDistance=s.size*30;
  },[mesh]);
  useEffect(()=>{
    const s=sceneRef.current;if(!s?.object)return;
    s.object.material.wireframe=displayMode==='wireframe';s.edges.visible=displayMode==='edges';
    s.edges.material.color.set(theme==='dark'?0x253447:0x334155);
  },[displayMode,theme]);
  useEffect(()=>{
    const s=sceneRef.current;if(!s)return;
    const previous=s.camera,aspect=host.current.clientWidth/host.current.clientHeight;
    const preset=standardViews[view];
    const direction=preset?new THREE.Vector3(...preset.direction):previous.position.clone().sub(s.controls.target);
    const up=preset?new THREE.Vector3(...preset.up):previous.up.clone();
    s.camera=projection==='orthographic'?new THREE.OrthographicCamera(-1,1,1,-1,.01,2000):new THREE.PerspectiveCamera(34,aspect,.01,2000);
    s.camera.up.copy(up);fitCamera(s.camera,s.size,aspect,direction);
    s.installControls();
  },[viewKey,projection]);
  useEffect(()=>{
    const s=sceneRef.current;if(!s)return;
    const direction=s.camera.position.clone().sub(s.controls.target);
    fitCamera(s.camera,s.size,host.current.clientWidth/host.current.clientHeight,direction);
    s.installControls();
  },[fitKey]);
  return <div ref={host} className={`three-host navigation-${navigation}`} aria-label="Interactive 3D pulley. Left drag to orbit, Shift-left or right/middle drag to pan, scroll to zoom. Touch: drag to orbit, two fingers to pan and pinch to zoom."/>;
}
