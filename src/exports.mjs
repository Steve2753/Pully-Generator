import {getOC} from 'replicad';
import {MM_PER_INCH} from './units.mjs';

export function exportPulley(shape,format,unit){
  if(format==='step'){
    // The model is always built in mm; STEP records the selected output unit.
    const oc=getOC();
    oc.Interface_Static.SetCVal('xstep.cascade.unit','MM');
    oc.Interface_Static.SetCVal('write.step.unit',unit==='in'?'INCH':'MM');
    try{return shape.blobSTEP();}
    finally{
      oc.Interface_Static.SetCVal('xstep.cascade.unit','MM');
      oc.Interface_Static.SetCVal('write.step.unit','MM');
    }
  }
  if(format!=='stl')throw new Error('Choose STEP or STL.');
  // STL has no unit metadata, so write coordinates in the selected unit.
  if(unit==='mm')return shape.blobSTL({tolerance:0.025,angularTolerance:0.08,binary:true});
  const inchShape=shape.clone().scale(1/MM_PER_INCH);
  try{return inchShape.blobSTL({tolerance:0.025/MM_PER_INCH,angularTolerance:0.08,binary:true});}
  finally{inchShape.delete();}
}
