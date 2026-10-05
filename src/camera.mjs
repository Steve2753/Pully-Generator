import * as THREE from 'three';

export const standardViews={
  iso:{direction:[1,-1,1],up:[0,0,1]},
  front:{direction:[0,-1,0],up:[0,0,1]},
  back:{direction:[0,1,0],up:[0,0,1]},
  right:{direction:[1,0,0],up:[0,0,1]},
  left:{direction:[-1,0,0],up:[0,0,1]},
  top:{direction:[0,0,1],up:[0,1,0]},
  bottom:{direction:[0,0,-1],up:[0,-1,0]},
};

export function fitCamera(camera,size,aspect,direction=camera.position.clone()){
  const radius=Math.max(size/2,.1),padding=1.3;
  const span=radius*padding/Math.min(1,aspect);
  camera.zoom=1;
  if(camera.isOrthographicCamera){
    camera.top=span;camera.bottom=-span;camera.right=span*aspect;camera.left=-span*aspect;
    camera.position.copy(direction.normalize().multiplyScalar(radius*4));
  }else{
    const angle=Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*Math.min(1,aspect));
    camera.aspect=aspect;
    camera.position.copy(direction.normalize().multiplyScalar(radius*padding/Math.sin(angle)));
  }
  camera.near=Math.max(.01,radius/1000);camera.far=radius*200;
  camera.lookAt(0,0,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();
}
