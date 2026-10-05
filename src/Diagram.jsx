import React,{useId} from 'react';
import {dimensions,validate} from './parameters.mjs';
import {formatLength} from './units.mjs';
import {pulleyOutline,outlineSvgPath} from './profile.mjs';

export function dimensionRows(p,unit){
  const d=dimensions(p),len=(id,label,value,fields)=>({id,label,value:formatLength(value,unit),fields});
  return [
    {id:'A',label:'HTD teeth / pitch',value:`${p.teeth} teeth · ${p.pitch} mm pitch`,fields:['teeth','pitch']},
    len('B','Overall width',p.width,['width']),
    len('C','Hex bore across flats',d.boreAF,['shaft','clearance']),
    len('D','Toothed face width',d.faceWidth,['width']),
    len('E','Outside diameter',d.outsideDiameter,['teeth','pitch']),
    len('F','Pitch diameter',d.pitchDiameter,['teeth','pitch']),
    len('G','Tooth-root diameter',d.rootDiameter,['teeth','pitch','grooveWidth','grooveDepth']),
    ...(p.flanges?[len('H','Flange outside diameter',d.flangeDiameter,['flangeOverhang']),len('I','Flange thickness',p.flangeThickness,['flangeThickness']),len('J','Flange radial overhang',p.flangeOverhang,['flangeOverhang'])]:[]),
    ...(p.flanges===1?[{id:'O',label:'Single flange side',value:p.flangeSide==='top'?'Top':'Bottom',fields:['flangeSide']}]:[]),
    len('K','Total bore clearance',p.clearance,['clearance']),
    {id:'L',label:'Hex orientation',value:`${p.hexAngle.toFixed(1)}°`,fields:['hexAngle']},
    len('M','Groove width adjustment',p.grooveWidth,['grooveWidth']),
    len('N','Groove depth adjustment',p.grooveDepth,['grooveDepth']),
    ...(p.variant==='tube'?[len('P','Tube insert diameter',p.extensionDiameter,['extensionDiameter']),len('Q','Tube insert length',p.extensionLength,['extensionLength'])]:[]),
    ...(p.variant==='bearing'?[len('P','Cone base diameter',p.coneBase,['coneBase']),len('Q','Cone length',p.coneLength,['coneLength']),len('R','Bearing contact diameter',p.coneTip,['coneTip'])]:[]),
  ];
}
export default function Diagram({params:p,active,unit='mm'}){
  const uid=useId().replace(/:/g,'');
  if(validate(p,unit).length)return <div className="diagram-placeholder">Enter valid dimensions to see the diagram.</div>;
  const d=dimensions(p),rows=dimensionRows(p,unit);
  const color=ids=>ids.split('/').some(id=>rows.find(row=>row.id===id)?.fields.includes(active))?'var(--drawing-active)':'var(--drawing-annotation)';
  const scale=Math.min(164/(p.flanges?d.flangeDiameter:d.outsideDiameter),184/p.width);
  const cx=200,cy=175,outer=scale*d.outsideDiameter/2,root=scale*d.rootDiameter/2,pitch=scale*d.pitchDiameter/2,flange=scale*d.flangeDiameter/2,hex=scale*d.boreCorners/2;
  const total=p.width*scale,body=(p.width-d.extension)*scale,sx=200-total/2,sy=175;
  const f=p.flangeThickness*scale,hasBottom=p.flanges===2||(p.flanges===1&&p.flangeSide==='bottom'),hasTop=p.flanges===2||(p.flanges===1&&p.flangeSide==='top');
  const left=hasBottom?f:0,right=hasTop?f:0;
  const outline=pulleyOutline(p),toothPath=outlineSvgPath(outline,cx,cy,scale);
  const borePoints=Array.from({length:6},(_,i)=>{const a=i*Math.PI/3-p.hexAngle*Math.PI/180;return [d.boreCorners/2*Math.sin(a),d.boreCorners/2*Math.cos(a)];});
  const boreHalf=Math.max(...borePoints.map(([,y])=>Math.abs(y)))*scale;
  const edgeLevels=[...new Set(outline.filter(c=>c.type==='line'||c.type==='arc').map(c=>c.to[1].toFixed(5)))].map(Number).sort((a,b)=>a-b);
  const Callout=({ids,points,x,y,label})=><g style={{color:color(ids)}} className="drawing-callout"><polyline points={points}/><text x={x} y={y}>{ids} · {label}</text></g>;
  const Dim=({id,x1,x2,y,fromY,label})=><g style={{color:color(id)}} className="drawing-dimension"><path className="dimension-extension" d={`M${x1} ${fromY}V${y+5}M${x2} ${fromY}V${y+5}`}/><path d={`M${x1} ${y}H${x2}`} markerStart={`url(#arrow-${uid})`} markerEnd={`url(#arrow-${uid})`}/><text x={(x1+x2)/2} y={y-10} textAnchor="middle">{id} · {label}</text></g>;
  return <div className="feature-drawing">
    <svg className="drawing-definitions" width="0" height="0" aria-hidden="true" focusable="false">
        <defs><marker id={`arrow-${uid}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M10 1L0 5L10 9" fill="none" stroke="context-stroke"/></marker><pattern id={`hatch-${uid}`} width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" x2="0" y1="0" y2="7" stroke="var(--border)"/></pattern></defs>
    </svg>
    <div className="drawing-views" role="group" aria-label={`Front and side pulley drawings. ${rows.map(row=>`${row.id}: ${row.label}, ${row.value}`).join('; ')}.`}>
      <svg className="diagram-svg feature-svg drawing-front" viewBox="0 0 400 370" role="img" aria-label="Front pulley drawing">
        <g className="drawing-geometry" fill="none" stroke="#93a4b8" strokeWidth="1.1">
          {p.flanges>0&&<circle cx={cx} cy={cy} r={flange} fill={`url(#hatch-${uid})`}/>}
          <path className="tooth-outline" d={toothPath} fill="var(--drawing-fill)"/>
          <circle cx={cx} cy={cy} r={pitch} strokeDasharray="6 4"/>
          <circle cx={cx} cy={cy} r={root} strokeDasharray="2 3"/>
          <path d={borePoints.map(([x,y],i)=>`${i?'L':'M'}${cx+x*scale} ${cy-y*scale}`).join(' ')+'Z'} fill="var(--surface)"/>
          <path d={`M${cx-98} ${cy}H${cx+98}M${cx} ${cy-98}V${cy+98}`} strokeDasharray="8 3 2 3" strokeWidth=".6"/>
        </g>
        <Callout ids="A/M/N" points={`${cx-outer*.7},${cy-outer*.7} 82,56 18,56`} x="18" y="42" label="HTD grooves"/>
        <Callout ids="F" points={`${cx+pitch*.7},${cy-pitch*.7} 284,56 382,56`} x="242" y="42" label="Pitch circle"/>
        <Callout ids="C/K/L" points={`${cx+hex},${cy} 292,175 382,175`} x="258" y="158" label="Hex bore"/>
        <Callout ids="G" points={`${cx-root*.6},${cy+root*.7} 82,268 18,268`} x="18" y="287" label="Tooth roots"/>
        {p.flanges>0&&<Callout ids="H/J" points={`${cx+flange*.7},${cy+flange*.7} 298,268 382,268`} x="248" y="287" label="Flange"/>}
        <Dim id="E" x1={cx-outer} x2={cx+outer} y={322} fromY={cy+outer+6} label={`Ø ${formatLength(d.outsideDiameter,unit)}`}/>
        <text x={cx} y="356" textAnchor="middle" className="view-label">FRONT · {p.flanges} {p.flanges===1?'FLANGE':'FLANGES'}</text>
      </svg>
      <svg className="diagram-svg feature-svg drawing-side" viewBox="0 0 400 370" role="img" aria-label="Side pulley drawing">
        <g className="drawing-geometry" fill="none" stroke="#93a4b8" strokeWidth="1.1">
          <rect x={sx+left} y={sy-outer} width={body-left-right} height={outer*2} fill="var(--drawing-fill)"/>
          {edgeLevels.map((level,i)=><line key={i} x1={sx+left} x2={sx+body-right} y1={sy-level*scale} y2={sy-level*scale} strokeWidth=".5"/>)}
          {hasBottom&&<rect x={sx} y={sy-flange} width={f} height={flange*2} fill="var(--surface)"/>}
          {hasTop&&<rect x={sx+body-f} y={sy-flange} width={f} height={flange*2} fill="var(--surface)"/>}
          {p.variant==='tube'&&<rect x={sx+body} y={sy-p.extensionDiameter*scale/2} width={total-body} height={p.extensionDiameter*scale} fill="var(--drawing-fill)"/>}
          {p.variant==='bearing'&&<path d={`M${sx+body} ${sy-p.coneBase*scale/2}L${sx+total} ${sy-p.coneTip*scale/2}V${sy+p.coneTip*scale/2}L${sx+body} ${sy+p.coneBase*scale/2}Z`} fill="var(--drawing-fill)"/>}
          <path d={`M${sx} ${sy-boreHalf}H${sx+total}M${sx} ${sy+boreHalf}H${sx+total}`} strokeDasharray="4 3"/>
          <path d={`M${sx-18} ${sy}H${sx+total+18}`} strokeDasharray="8 3 2 3" strokeWidth=".6"/>
        </g>
        {p.flanges>0&&<Callout ids={p.flanges===1?'I/O':'I'} points={`${sx+(hasBottom?f/2:body-f/2)},${sy-flange} 82,56 18,56`} x="18" y="42" label={p.flanges===1?`${p.flangeSide} flange`:'Flange thickness'}/>}
        <Dim id="D" x1={sx+left} x2={sx+body-right} y={85} fromY={sy-outer-5} label={`${formatLength(d.faceWidth,unit)} face`}/>
        <Dim id="B" x1={sx} x2={sx+total} y={322} fromY={sy+Math.max(outer,p.flanges?flange:0)+6} label={`${formatLength(p.width,unit)} overall`}/>
        {d.extension>0&&<><Callout ids="P" points={`${sx+body},${sy-(p.variant==='tube'?p.extensionDiameter:p.coneBase)*scale/2} 302,56 382,56`} x="250" y="42" label={p.variant==='tube'?'Insert OD':'Base OD'}/><Callout ids="Q" points={`${sx+body+(total-body)/2},${sy+(p.variant==='tube'?p.extensionDiameter:p.coneTip)*scale/2} 302,268 382,268`} x="244" y="287" label={p.variant==='tube'?'Insert length':'Cone length'}/></>}
        {p.variant==='bearing'&&<Callout ids="R" points={`${sx+total},${sy-p.coneTip*scale/2} 308,161 382,161`} x="270" y="146" label="Contact OD"/>}
        <text x="200" y="356" textAnchor="middle" className="view-label">SIDE · {p.variant==='tube'?'TUBE INSERT':p.variant==='bearing'?'BEARING CONE':'STANDARD'}</text>
      </svg>
    </div>
    <dl className="dimension-schedule" aria-label="Complete feature dimensions">{rows.map(row=><div key={row.id} className={row.fields.includes(active)?'highlighted':''}><dt><b>{row.id}</b>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
    <p className="drawing-note">Curved HTD profile matches the model. Front and side views use the same scale. Flanges shown transparent to reveal teeth. Tooth pitch stays in millimeters.</p>
  </div>;
}
