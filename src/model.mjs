import { draw, drawPolysides, makeCylinder } from 'replicad';
import { dimensions, validate } from './parameters.mjs';

// Groove coordinates adapted from droftarts' Parametric Pulley, via rbuckland.
// See public/PROFILE-NOTICE.txt. Lands and groove segments are circular arcs
// fitted to the published outline, with deviation verified below 0.002 mm.
export function buildPulley(p) {
  const errors = validate(p); if (errors.length) throw new Error(errors.join(' '));
  const d = dimensions(p);
  const profile = d.profile.filter(([,y]) => y >= 0);
  const rotatePoint = ([x,y], angle) => {x*=d.widthScale;y*=d.depthScale;return [x * Math.cos(angle) + (d.chordRadius-y) * Math.sin(angle), -x * Math.sin(angle) + (d.chordRadius-y) * Math.cos(angle)];};
  let outline = draw(rotatePoint(profile[0], 0));
  const r = d.outsideDiameter / 2;
  for (let i=0; i<p.teeth; i++) {
    const angle = i * 2 * Math.PI / p.teeth;
    outline = outline.threePointsArcTo(rotatePoint(profile[4],angle),rotatePoint(profile[2],angle));
    outline = outline.lineTo(rotatePoint(profile[5],angle));
    for (const [start,end] of [[5,13],[13,21],[21,29],[29,37]]) {
      outline = outline.threePointsArcTo(rotatePoint(profile[end],angle),rotatePoint(profile[(start+end)/2],angle));
    }
    outline = outline.lineTo(rotatePoint(profile[38],angle));
    outline = outline.threePointsArcTo(rotatePoint(profile[42],angle),rotatePoint(profile[40],angle));
    const nextAngle = (i+1) * 2 * Math.PI / p.teeth;
    const midAngle = (angle+nextAngle)/2;
    outline = outline.threePointsArcTo(rotatePoint(profile[0], i===p.teeth-1 ? 0 : nextAngle), [r*Math.sin(midAngle), r*Math.cos(midAngle)]);
  }
  const bottom = p.flanges > 0 && (p.flanges===2 || p.flangeSide==='bottom') ? p.flangeThickness : 0;
  let shape = outline.close().sketchOnPlane('XY', bottom).extrude(d.faceWidth);
  const fuse = (part) => { const previous = shape; shape = previous.fuse(part); previous.delete(); part.delete(); };
  const flangeRadius = d.flangeDiameter/2;
  if (bottom > 0) fuse(makeCylinder(flangeRadius, p.flangeThickness + 0.02));
  if (p.flanges === 2 || (p.flanges===1&&p.flangeSide==='top')) fuse(makeCylinder(flangeRadius, p.flangeThickness + 0.02, [0,0,bottom+d.faceWidth-0.02]));
  const bodyTop = p.width - d.extension;
  if (p.variant === 'tube') fuse(makeCylinder(p.extensionDiameter/2, p.extensionLength+0.02,[0,0,bodyTop-0.02]));
  if (p.variant === 'bearing') {
    // Revolved section gives an analytic cone rather than a faceted mesh.
    const cone = draw([0,bodyTop-0.02]).lineTo([p.coneBase/2,bodyTop-0.02]).lineTo([p.coneBase/2,bodyTop]).lineTo([p.coneTip/2,p.width]).lineTo([0,p.width]).close().sketchOnPlane('XZ').revolve([0,0,1]);
    fuse(cone);
  }
  const bore = drawPolysides(d.boreCorners/2,6).rotate(p.hexAngle).sketchOnPlane('XY',-1).extrude(p.width+2);
  const result = shape.cut(bore); shape.delete(); bore.delete();
  return result;
}
