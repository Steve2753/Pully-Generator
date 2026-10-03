import profiles from './profiles.json' with { type: 'json' };
import {formatLength} from './units.mjs';

export const defaults = { pitch: 5, teeth: 24, width: 18, shaft: 12.7, clearance: 0.15, flanges: 2, flangeSide: 'bottom', flangeThickness: 1.5, flangeOverhang: 2, variant: 'standard', extensionLength: 10, extensionDiameter: 25.2, coneLength: 5, coneBase: 24, coneTip: 18, grooveWidth: 0, grooveDepth: 0, hexAngle: 0 };
export const limits = { teeth: [12, 100], width: [5, 100], clearance: [0, 0.6], flangeThickness: [0.5, 4], flangeOverhang: [0.5, 6], extensionLength: [1, 60], extensionDiameter: [12, 100], coneLength: [1, 30], coneBase: [12, 100], coneTip: [12, 100], grooveWidth: [-0.3,0.3], grooveDepth: [-0.3,0.3], hexAngle: [0,60] };
export function grooveScales(p,profile){
  const half=Math.max(...profile.map(([x])=>Math.abs(x)));
  const depth=Math.max(...profile.map(([,y])=>y));
  return {widthScale:(half+p.grooveWidth/2)/half,depthScale:(depth+p.grooveDepth)/depth};
}
export function dimensions(p) {
  const pitchDiameter = p.teeth * p.pitch / Math.PI;
  const outsideDiameter = pitchDiameter - 2 * (p.pitch === 5 ? 0.5715 : 0.381);
  const profile = profiles[p.pitch];
  const scales=grooveScales(p,profile);
  const halfGroove = Math.max(...profile.map(([x]) => Math.abs(x)))*scales.widthScale;
  const grooveDepth = Math.max(...profile.map(([,y]) => y))*scales.depthScale;
  const chordRadius = Math.sqrt((outsideDiameter / 2) ** 2 - halfGroove ** 2);
  const extension = p.variant === 'tube' ? p.extensionLength : p.variant === 'bearing' ? p.coneLength : 0;
  const faceWidth = p.width - p.flanges * p.flangeThickness - extension;
  const boreAF = p.shaft + p.clearance;
  return { pitchDiameter, outsideDiameter, rootDiameter: 2 * (chordRadius - grooveDepth), flangeDiameter: outsideDiameter + 2 * p.flangeOverhang, boreAF, boreCorners: boreAF / Math.cos(Math.PI / 6), faceWidth, extension, chordRadius, profile, ...scales };
}
export function validate(p,unit='mm') {
  const errors = [];
  for (const [key, [min,max]] of Object.entries(limits)) {
    if (!Number.isFinite(p[key]) || p[key] < min-1e-9 || p[key] > max+1e-9) errors.push(`${key.replace(/([A-Z])/g, ' $1')}: enter a value from ${key==='teeth'||key==='hexAngle'?min:formatLength(min,unit)} to ${key==='teeth'||key==='hexAngle'?max:formatLength(max,unit)}.`);
  }
  if (![3,5].includes(p.pitch)) errors.push('Choose HTD 3M or 5M.');
  if (![12.7,9.525].includes(p.shaft)) errors.push('Choose a 1/2-inch or 3/8-inch shaft.');
  if (!Number.isInteger(p.teeth)) errors.push('Tooth count must be a whole number.');
  if (![0,1,2].includes(p.flanges)) errors.push('Choose zero, one, or two flanges.');
  if (!['bottom','top'].includes(p.flangeSide)) errors.push('Choose the side for a single flange.');
  if (!['standard','tube','bearing'].includes(p.variant)) errors.push('Choose a supported pulley variant.');
  if (errors.length) return errors;
  const d = dimensions(p);
  if (d.faceWidth < 3) errors.push(`Increase overall width: the toothed face needs at least ${formatLength(3,unit)} after flanges and the end feature.`);
  if ((d.rootDiameter-d.boreCorners)/2 < 1.5) errors.push(`Increase tooth count or choose a smaller shaft: the tooth roots need at least ${formatLength(1.5,unit)} of wall around the hex corners.`);
  if (p.variant === 'tube' && p.extensionDiameter < d.boreCorners + 3) errors.push(`Increase insert diameter: leave at least ${formatLength(1.5,unit)} of wall around the hex corners.`);
  if (p.variant === 'tube' && p.extensionDiameter > d.rootDiameter) errors.push('Keep the insert diameter at or below the tooth-root diameter, or increase tooth count.');
  if (p.variant === 'bearing' && (p.coneTip < d.boreCorners + 2 || p.coneTip > p.coneBase || p.coneBase > d.rootDiameter)) errors.push(`The cone contact diameter must clear the hex corners by ${formatLength(2,unit)}, and be no larger than its base. The base must fit within the tooth-root diameter.`);
  return errors;
}
export function fileName(p,unit='mm') { return `HTD-${p.pitch}M-${p.teeth}T-${formatLength(p.width,unit).replace(' ','')}-${p.shaft === 12.7 ? 'half' : 'three-eighths'}-hex-${p.variant}`; }
