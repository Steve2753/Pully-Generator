import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {screenPanOffset} from './pan.mjs';

export default function Viewer({ mesh, wireframe, view, fitKey }) {
  const host = useRef(null), sceneRef = useRef(null);
  useEffect(() => {
    const el = host.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 2000);
    const renderer = new THREE.WebGLRenderer({antialias:true,alpha:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.setClearColor(0x000000,0); renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera,renderer.domElement);
    controls.enableDamping=true; controls.dampingFactor=0.08;
    controls.enablePan=false;
    // Move the camera in screen coordinates, so the pulley follows the drag.
    // OrbitControls' built-in pan is disabled to avoid a second, view-dependent
    // translation when the camera uses Z as its up axis.
    let pan=null;
    const down=e=>{
      if(e.button!==1&&e.button!==2)return;
      e.preventDefault();e.stopImmediatePropagation();
      pan={id:e.pointerId,x:e.clientX,y:e.clientY};
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const move=e=>{
      if(!pan||pan.id!==e.pointerId)return;
      e.preventDefault();e.stopImmediatePropagation();
      const dx=e.clientX-pan.x,dy=e.clientY-pan.y;pan.x=e.clientX;pan.y=e.clientY;
      const delta=screenPanOffset(camera,controls.target,dx,dy,el.clientHeight);
      camera.position.add(delta);controls.target.add(delta);controls.update();
    };
    const up=e=>{if(pan?.id===e.pointerId){e.preventDefault();e.stopImmediatePropagation();pan=null;if(renderer.domElement.hasPointerCapture(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId);}};
    const menu=e=>e.preventDefault();
    renderer.domElement.addEventListener('pointerdown',down,true);
    renderer.domElement.addEventListener('pointermove',move,true);
    renderer.domElement.addEventListener('pointerup',up,true);
    renderer.domElement.addEventListener('pointercancel',up,true);
    renderer.domElement.addEventListener('contextmenu',menu);
    const ambient = new THREE.HemisphereLight(0xffffff,0x67768d,3); scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff,4); key.position.set(-50,80,100); scene.add(key);
    const fill = new THREE.DirectionalLight(0xd7e5ff,2); fill.position.set(60,-30,40); scene.add(fill);
    sceneRef.current = {scene,camera,renderer,controls,object:null,size:40};
    const resize = new ResizeObserver(() => {const w=el.clientWidth,h=el.clientHeight; renderer.setSize(w,h); camera.aspect=w/h; camera.updateProjectionMatrix();}); resize.observe(el);
    let frame;
    const animate = () => {frame=requestAnimationFrame(animate); controls.update(); renderer.render(scene,camera);}; animate();
    return () => {cancelAnimationFrame(frame);resize.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',down,true);renderer.domElement.removeEventListener('pointermove',move,true);renderer.domElement.removeEventListener('pointerup',up,true);renderer.domElement.removeEventListener('pointercancel',up,true);renderer.domElement.removeEventListener('contextmenu',menu);renderer.dispose();sceneRef.current.object?.geometry.dispose();sceneRef.current.object?.material.dispose();el.removeChild(renderer.domElement);sceneRef.current=null;};
  },[]);
  useEffect(() => {
    const s=sceneRef.current;if(!s||!mesh)return;
    if(s.object){s.scene.remove(s.object);s.object.geometry.dispose();s.object.material.dispose();}
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(mesh.vertices,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(mesh.normals,3));
    geometry.setIndex(mesh.triangles);geometry.computeBoundingBox();
    const center=geometry.boundingBox.getCenter(new THREE.Vector3());geometry.translate(-center.x,-center.y,-center.z);
    const previousSize=s.size;
    s.size=geometry.boundingBox.getSize(new THREE.Vector3()).length();
    s.object=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xc1c9d2,metalness:0.63,roughness:0.35,wireframe}));
    s.scene.add(s.object);
    if(s.fitted)s.camera.position.multiplyScalar(s.size/previousSize);
    if(!s.fitted){s.camera.position.set(s.size*1.35,-s.size*1.65,s.size*1.35);s.camera.up.set(0,0,1);s.controls.target.set(0,0,0);s.controls.update();s.fitted=true;}
  },[mesh]);
  useEffect(()=>{const s=sceneRef.current;if(s?.object)s.object.material.wireframe=wireframe;},[wireframe]);
  useEffect(()=>{
    const s=sceneRef.current;if(!s)return; const distance=s.size*2.5;
    s.camera.up.set(0,0,1);
    if(view==='top'){s.camera.position.set(0,0,distance);s.camera.up.set(0,1,0);}
    else if(view==='front')s.camera.position.set(0,-distance,0);
    else s.camera.position.set(distance*0.55,-distance*0.68,distance*0.55);
    s.controls.target.set(0,0,0);s.controls.update();
  },[view,fitKey]);
  return <div ref={host} className="three-host" aria-label="Interactive 3D pulley. Drag to orbit; scroll or pinch to zoom."/>;
}
