import init from 'replicad-opencascadejs';
import wasmUrl from 'replicad-opencascadejs/src/replicad_single.wasm?url';
import { setOC, measureVolume } from 'replicad';
import { buildPulley } from './model.mjs';
import { exportPulley } from './exports.mjs';

let shape, signature;
const ready = init({ locateFile: () => wasmUrl }).then(setOC);
self.onmessage = async ({data}) => {
  const {id, action, params, format, unit} = data;
  try {
    await ready;
    const nextSignature = JSON.stringify(params);
    if (!shape || signature !== nextSignature) {
      const nextShape = buildPulley(params);
      shape?.delete(); shape = nextShape; signature = nextSignature;
    }
    if (action === 'export') {
      const blob = exportPulley(shape,format,unit);
      self.postMessage({id,blob});
    } else {
      const mesh=shape.mesh({tolerance:0.06,angularTolerance:0.15});
      mesh.edges=shape.meshEdges({tolerance:0.06,angularTolerance:0.15}).lines;
      self.postMessage({id, mesh, volume:measureVolume(shape)});
    }
  } catch(error) { self.postMessage({id,error: error instanceof Error ? error.message : 'The CAD model could not be generated. Try a smaller tooth count or reset the parameters.'}); }
};
