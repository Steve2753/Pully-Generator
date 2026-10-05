import * as THREE from 'three';

export function screenPanOffset(camera,target,dx,dy,viewportHeight){
  camera.updateMatrix();
  const distance=camera.position.distanceTo(target);
  const span=camera.isOrthographicCamera?(camera.top-camera.bottom)/camera.zoom:2*distance*Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
  const scale=span/Math.max(1,viewportHeight);
  const right=new THREE.Vector3().setFromMatrixColumn(camera.matrix,0);
  const up=new THREE.Vector3().setFromMatrixColumn(camera.matrix,1);
  return right.multiplyScalar(-dx*scale).add(up.multiplyScalar(dy*scale));
}
