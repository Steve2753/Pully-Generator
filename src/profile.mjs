import {dimensions} from './parameters.mjs';

// One outline feeds both the CAD solid and the drawing. Arc midpoints preserve
// the same fitted HTD curves, including width/depth allowances and circular lands.
export function pulleyOutline(p) {
  const d=dimensions(p),profile=d.profile.filter(([,y])=>y>=0);
  const point=([x,y],angle)=>{
    x*=d.widthScale;y*=d.depthScale;
    return [x*Math.cos(angle)+(d.chordRadius-y)*Math.sin(angle),-x*Math.sin(angle)+(d.chordRadius-y)*Math.cos(angle)];
  };
  const commands=[{type:'move',to:point(profile[0],0)}];
  const arc=(to,via)=>commands.push({type:'arc',to,via});
  const line=to=>commands.push({type:'line',to});
  for(let i=0;i<p.teeth;i++){
    const a=i*2*Math.PI/p.teeth,next=(i+1)*2*Math.PI/p.teeth;
    arc(point(profile[4],a),point(profile[2],a));
    line(point(profile[5],a));
    for(const [start,end] of [[5,13],[13,21],[21,29],[29,37]])arc(point(profile[end],a),point(profile[(start+end)/2],a));
    line(point(profile[38],a));
    arc(point(profile[42],a),point(profile[40],a));
    arc(point(profile[0],i===p.teeth-1?0:next),[d.outsideDiameter/2*Math.sin((a+next)/2),d.outsideDiameter/2*Math.cos((a+next)/2)]);
  }
  return commands;
}

export function outlineSvgPath(commands,cx,cy,scale) {
  const map=([x,y])=>[cx+x*scale,cy-y*scale];
  const tau=2*Math.PI,positive=a=>(a%tau+tau)%tau;
  let previous;
  const path=commands.map(command=>{
    const to=map(command.to);
    let part=`${command.type==='move'?'M':'L'}${to.join(' ')}`;
    if(command.type==='arc'){
      const [x1,y1]=previous,[x2,y2]=map(command.via),[x3,y3]=to;
      const det=2*(x1*(y2-y3)+x2*(y3-y1)+x3*(y1-y2));
      const q1=x1*x1+y1*y1,q2=x2*x2+y2*y2,q3=x3*x3+y3*y3;
      const ux=(q1*(y2-y3)+q2*(y3-y1)+q3*(y1-y2))/det;
      const uy=(q1*(x3-x2)+q2*(x1-x3)+q3*(x2-x1))/det;
      const r=Math.hypot(x1-ux,y1-uy),start=Math.atan2(y1-uy,x1-ux);
      const end=positive(Math.atan2(y3-uy,x3-ux)-start),via=positive(Math.atan2(y2-uy,x2-ux)-start);
      const sweep=via<=end?1:0,angle=sweep?end:tau-end;
      part=`A${r} ${r} 0 ${angle>Math.PI?1:0} ${sweep} ${to.join(' ')}`;
    }
    previous=to;
    return part;
  });
  return path.join(' ')+' Z';
}
