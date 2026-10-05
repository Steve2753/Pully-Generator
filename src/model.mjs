import { draw, drawPolysides, makeCylinder } from 'replicad';
import { dimensions, validate } from './parameters.mjs';
import { pulleyOutline } from './profile.mjs';

// Groove coordinates adapted from droftarts' Parametric Pulley, via rbuckland.
// See public/PROFILE-NOTICE.txt. Lands and groove segments are circular arcs
// fitted to the published outline, with deviation verified below 0.002 mm.
export function buildPulley(p) {
  const errors = validate(p); if (errors.length) throw new Error(errors.join(' '));
  const d = dimensions(p);
  const [start,...commands]=pulleyOutline(p);
  let outline = draw(start.to);
  for (const command of commands) {
    outline = command.type==='arc' ? outline.threePointsArcTo(command.to,command.via) : outline.lineTo(command.to);
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
