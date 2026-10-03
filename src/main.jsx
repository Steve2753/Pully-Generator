import React, {useEffect,useRef,useState,useContext,createContext} from 'react';
import {createRoot} from 'react-dom/client';
import {Cog,Box,RotateCcw,Download,Maximize,Layers,Check,ChevronDown,Info,Hexagon,LoaderCircle,Ruler,SlidersHorizontal,ArrowUpRight,X} from 'lucide-react';
import Viewer from './Viewer';
import Diagram from './Diagram';
import {defaults,dimensions,validate,fileName,limits} from './parameters.mjs';
import {toDisplay,toModel,displayValue,formatLength,parametersForDisplay,parametersForModel,lengthKeys,MM_PER_INCH} from './units.mjs';
import './style.css';

const variantInfo = {standard:['Standard','A compact pulley with optional belt flanges.'],tube:['Tube insert','A cylindrical extension to locate the pulley inside a tube.'],bearing:['Bearing cone','A tapered end feature to contact a bearing’s inner race.']};
const ParameterContext=createContext(null);
function Field({name,label,step=0.1,badge}) {
  const {p,active,setActive,update,unit}=useContext(ParameterContext);
  const isLength=lengthKeys.includes(name),suffix=isLength?unit:name==='hexAngle'?'°':'T';
  return <label className={`field ${active===name?'focused':''}`}><span>{badge&&<b>{badge}</b>}{label}</span><div className="input-wrap"><input aria-label={`${label} (${suffix})`} type="number" value={isLength?displayValue(p[name],unit):Number.isNaN(p[name])?'':p[name]} min={isLength?toDisplay(limits[name]?.[0],unit):limits[name]?.[0]} max={isLength?toDisplay(limits[name]?.[1],unit):limits[name]?.[1]} step={isLength?unit==='in'?0.001:step:step} onFocus={()=>setActive(name)} onBlur={()=>setActive('')} onChange={e=>update(name,e.target.value===''?NaN:isLength?toModel(Number(e.target.value),unit):Number(e.target.value))}/><span>{suffix}</span></div></label>;
}
function App(){
  const [p,setP]=useState(defaults),[unit,setUnit]=useState('in'),[active,setActive]=useState(''),[mesh,setMesh]=useState(null),[volume,setVolume]=useState(null),[busy,setBusy]=useState(true),[error,setError]=useState(''),[format,setFormat]=useState('step'),[exporting,setExporting]=useState(false),[notice,setNotice]=useState(''),[tab,setTab]=useState('model'),[view,setView]=useState('iso'),[wireframe,setWireframe]=useState(false),[fitKey,setFitKey]=useState(0),[help,setHelp]=useState(false);
  const worker=useRef(),seq=useRef(0),latest=useRef(0),pending=useRef(new Map()), paramsRef=useRef(p);
  paramsRef.current=p;
  const errors=validate(p,unit),valid=!errors.length,d=dimensions(p),fmt=n=>Number.isFinite(n)?toDisplay(n,unit).toFixed(unit==='in'?4:2):'—';
  function request(action,params,extra={}){const id=++seq.current;return new Promise((resolve,reject)=>{pending.current.set(id,{resolve,reject});if(action==='build')latest.current=id;worker.current.postMessage({id,action,params,...extra});});}
  useEffect(()=>{
    const w=new Worker(new URL('./cad.worker.js',import.meta.url),{type:'module'});worker.current=w;
    w.onmessage=({data})=>{const job=pending.current.get(data.id);pending.current.delete(data.id);if(!job)return;if(data.error)job.reject(new Error(data.error));else job.resolve(data);};
    w.onerror=()=>{for(const job of pending.current.values())job.reject(new Error('The CAD engine could not load. Reload the page to try again.'));pending.current.clear();setBusy(false);setError('The CAD engine could not load. Reload the page to try again.');};
    return()=>{w.terminate();pending.current.clear();};
  },[]);
  useEffect(()=>{
    if(!valid){setBusy(false);return;}setBusy(true);setError('');
    let cancelled=false;
    const timer=setTimeout(()=>{const id=seq.current+1;request('build',p).then(result=>{if(!cancelled&&latest.current===id){setMesh(result.mesh);setVolume(result.volume);setBusy(false);}}).catch(e=>{if(!cancelled){setError(e.message);setBusy(false);}});},300);
    return()=>{cancelled=true;clearTimeout(timer);};
  },[p]);
  function update(key,value){setP(prev=>({...prev,[key]:value}));setNotice('');}
  function chooseVariant(variant){setP(prev=>({...prev,variant,width: variant==='tube'?28:variant==='bearing'?23:18}));setNotice('');}
  async function download(){
    if(!valid||exporting)return;setExporting(true);setNotice('');
    try{const result=await request('export',p,{format,unit});const url=URL.createObjectURL(result.blob);const a=document.createElement('a');a.href=url;a.download=`${fileName(p,unit)}.${format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);setNotice(`${format.toUpperCase()} downloaded · ${unit==='in'?'inch':'millimeter'} units`);}catch(e){setError(e.message);}finally{setExporting(false);}
  }
  useEffect(()=>{
    if(!help)return;
    const previous=document.activeElement;
    const onKey=e=>{
      if(e.key==='Escape'){setHelp(false);return;}
      if(e.key!=='Tab')return;
      const items=[...document.querySelectorAll('.modal button,.modal a[href]')];
      const first=items[0],last=items[items.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',onKey);
    return()=>{document.removeEventListener('keydown',onKey);previous?.focus();};
  },[help]);
  useEffect(()=>{
    const context=document.modelContext;if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    const register=t=>Promise.resolve(context.registerTool(t,{signal:lifecycle.signal})).catch(()=>{});
    register({name:'read_pulley_configuration',description:'Read current pulley parameters, calculated dimensions and validation errors in the selected display unit.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>{const current=paramsRef.current;const {profile,widthScale,depthScale,...calculated}=dimensions(current);return {unit,parameters:parametersForDisplay(current,unit),dimensions:Object.fromEntries(Object.entries(calculated).map(([key,value])=>[key,toDisplay(value,unit)])),errors:validate(current,unit)};}});
    register({name:'configure_pulley',description:`Update the visible pulley configuration. Lengths use ${unit==='in'?'inches':'millimeters'}; tooth pitch remains millimeters and hex orientation is degrees. Does not download a file.`,inputSchema:{type:'object',properties:{pitch:{enum:[3,5]},shaft:{enum:unit==='in'?[0.5,0.375]:[12.7,9.525]},variant:{enum:['standard','tube','bearing']},flanges:{enum:[0,1,2]},flangeSide:{enum:['bottom','top']},...Object.fromEntries(Object.entries(limits).filter(([key])=>key!=='teeth').map(([key,[minimum,maximum]])=>[key,{type:'number',minimum:lengthKeys.includes(key)?toDisplay(minimum,unit):minimum,maximum:lengthKeys.includes(key)?toDisplay(maximum,unit):maximum}])),teeth:{type:'integer',minimum:12,maximum:100}},additionalProperties:false},annotations:{readOnlyHint:false},execute:async(input)=>{if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!(k in defaults)))throw new Error('Unknown parameter.');const next={...paramsRef.current,...parametersForModel(input,unit)};const failures=validate(next,unit);if(failures.length)throw new Error(failures.join(' '));paramsRef.current=next;setP(next);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return {unit,parameters:parametersForDisplay(next,unit),status:'configured'};}});
    return()=>lifecycle.abort();
  },[unit]);
  return <ParameterContext.Provider value={{p,active,setActive,update,unit}}>
    <header><a className="brand" href={import.meta.env.BASE_URL} aria-label="Pulley Lab home"><span className="brand-icon"><Cog size={25}/></span>Pulley<span className="brand-light">Lab</span><span className="beta">BETA</span></a><button className="help-button" onClick={()=>setHelp(true)}><Info size={16}/> Export guide</button></header>
    <main>
      <div className="page-heading"><div><div className="eyebrow">DESIGN TOOLS / TIMING PULLEYS</div><h1>HTD pulley builder</h1><p>Built to fit your robot.</p></div><div className="unit-switch" role="group" aria-label="Length units"><button aria-pressed={unit==='in'} className={unit==='in'?'selected':''} onClick={()=>setUnit('in')}>Inches</button><button aria-pressed={unit==='mm'} className={unit==='mm'?'selected':''} onClick={()=>setUnit('mm')}>Millimeters</button></div></div>
      <div className="workspace">
        <aside className="config-panel"><div className="panel-heading"><SlidersHorizontal size={17}/><h2>Configuration</h2><button className="icon-button" title="Reset configuration" aria-label="Reset configuration" onClick={()=>{setP({...defaults});setNotice('');setFitKey(k=>k+1);}}><RotateCcw size={16}/></button></div>
          <section><div className="section-label"><span>01</span>Pulley variant</div><div className="variant-grid">{Object.entries(variantInfo).map(([key,[title]])=><button key={key} className={`variant-button ${p.variant===key?'selected':''}`} onClick={()=>chooseVariant(key)}><VariantIcon type={key}/><span>{title}</span>{p.variant===key&&<Check size={12} className="variant-check"/>}</button>)}</div><p className="field-note">{variantInfo[p.variant][1]}</p></section>
          <section><div className="section-label"><span>02</span>Belt & body</div><label className="field"><span>Belt profile</span><div className="select-wrap"><select aria-label="Belt profile" value={p.pitch} onChange={e=>update('pitch',Number(e.target.value))}><option value="5">HTD 5M · 5 mm pitch</option><option value="3">HTD 3M · 3 mm pitch</option></select><ChevronDown size={15}/></div></label><div className="field-row"><Field name="teeth" label="Tooth count" step={1} badge="A"/><Field name="width" label="Overall width" badge="B"/></div><p className="field-note">Overall width includes flanges and the end feature.</p></section>
          <section><div className="section-label"><span>03</span>Shaft interface</div><div className="field"><span><b>C</b>Hex shaft · across flats</span><div className="segmented">{[12.7,9.525].map(shaft=><button aria-pressed={p.shaft===shaft} key={shaft} className={p.shaft===shaft?'selected':''} onFocus={()=>setActive('shaft')} onBlur={()=>setActive('')} onClick={()=>update('shaft',shaft)}><Hexagon size={14}/>{unit==='in'?shaft===12.7?'1/2 in':'3/8 in':shaft===12.7?'12.7 mm':'9.525 mm'}</button>)}</div></div><Field name="clearance" label="Bore clearance" step={0.05}/><p className="field-note">Added to the total across-flat dimension.</p></section>
          <section><div className="section-label"><span>04</span>Belt flanges</div><div className="segmented three">{[0,1,2].map(count=><button key={count} aria-pressed={p.flanges===count} className={p.flanges===count?'selected':''} onClick={()=>update('flanges',count)}>{['None','One side','Both sides'][count]}</button>)}</div>{p.flanges===1&&<label className="field"><span>Single flange side</span><div className="select-wrap"><select value={p.flangeSide} onFocus={()=>setActive('flangeSide')} onBlur={()=>setActive('')} onChange={e=>update('flangeSide',e.target.value)}><option value="bottom">Bottom side</option><option value="top">Top side</option></select><ChevronDown size={15}/></div></label>}{p.flanges>0&&<div className="field-row"><Field name="flangeThickness" label="Thickness" badge="I"/><Field name="flangeOverhang" label="Overhang" badge="J"/></div>}</section>
          {p.variant!=='standard'&&<section><div className="section-label"><span>05</span>{p.variant==='tube'?'Tube insert':'Bearing cone'}</div>{p.variant==='tube'?<><div className="field-row"><Field name="extensionDiameter" label="Insert diameter" badge="P"/><Field name="extensionLength" label="Insert length" badge="Q"/></div><p className="field-note">Match the insert diameter to your tube’s inner diameter and fit allowance.</p></>:<><div className="field-row"><Field name="coneBase" label="Base diameter" badge="P"/><Field name="coneTip" label="Contact diameter" badge="R"/></div><Field name="coneLength" label="Cone length" badge="Q"/><p className="field-note">Size the contact face to your bearing’s inner race.</p></>}</section>}
          <section><div className="section-label"><span>06</span>Tooth & bore detail</div><div className="field-row"><Field name="grooveWidth" label="Groove width offset" badge="M"/><Field name="grooveDepth" label="Groove depth offset" badge="N"/></div><Field name="hexAngle" label="Hex orientation" step={1} badge="L"/><p className="field-note">Offsets adjust the tooth gap from the base HTD profile. Verify belt fit with a test print.</p></section>
          <div className="config-foot"><Ruler size={14}/> Lengths in {unit==='in'?'inches':'millimeters'} · tooth pitch in mm</div>
        </aside>
        <div className="result-column">
          <div className="preview-panel"><div className="preview-heading"><div className="view-tabs"><button className={tab==='model'?'active':''} onClick={()=>setTab('model')}><Box size={16}/>3D preview</button><button className={tab==='drawing'?'active':''} onClick={()=>setTab('drawing')}><Ruler size={16}/>Dimension diagram</button></div><span className="preview-state">{busy?<><LoaderCircle size={13} className="spin"/> Updating model</>:valid&&!error?<><Check size={13}/> Model ready</>:<>Check parameters</>}</span></div>
            <div className={`viewport ${tab==='drawing'?'drawing-mode':''}`}>
              {tab==='model'?<Viewer mesh={mesh} wireframe={wireframe} view={view} fitKey={fitKey}/>:<Diagram params={p} active={active} unit={unit}/>}
              {tab==='model'&&<div className="model-label"><span>HTD {p.pitch}M</span><strong>{p.teeth}T <i>/</i> {p.variant==='standard'?'STANDARD':p.variant==='tube'?'TUBE INSERT':'BEARING CONE'}</strong></div>}
              {tab==='model'&&<><div className="viewer-tools"><button title="Fit model" aria-label="Fit model" onClick={()=>setFitKey(k=>k+1)}><Maximize size={17}/></button><button title="Toggle wireframe" aria-label="Toggle wireframe" aria-pressed={wireframe} className={wireframe?'active':''} onClick={()=>setWireframe(!wireframe)}><Layers size={17}/></button></div><div className="orientation"><span className="axis-z">Z</span><span className="axis-y">Y</span><span className="axis-x">X</span><svg viewBox="0 0 50 50"><path d="M25 27V5 M25 27L45 38 M25 27L5 38" fill="none" strokeWidth="1.5" stroke="#a9b6c7"/></svg></div><div className="view-select">{['iso','front','top'].map(v=><button key={v} className={view===v?'active':''} onClick={()=>{setView(v);setFitKey(k=>k+1);}}>{v==='iso'?'Isometric':v==='front'?'Side':'Top'}</button>)}</div><span className="orbit-note">Left drag orbit · Right/middle drag pan · Scroll zoom</span></>}
              {!mesh&&busy&&<div className="loading-overlay"><LoaderCircle size={25} className="spin"/><span>Preparing your pulley…</span><small>Loading the CAD engine on first use</small></div>}
              {(errors.length>0||error)&&<div className="validation" role="alert"><Info size={18}/><div><strong>{error?'Model generation failed':'Adjust your dimensions'}</strong>{(error?[error]:errors).map((text,i)=><p key={i}>{text}</p>)}</div></div>}
            </div>
            <div className="measure-strip"><Metric label="PITCH DIAMETER" value={fmt(d.pitchDiameter)} unit={unit}/><Metric label="OUTSIDE DIAMETER" value={fmt(d.outsideDiameter)} unit={unit}/><Metric label="TOOTHED FACE" value={fmt(d.faceWidth)} unit={unit}/><Metric label="HEX BORE · AF" value={fmt(d.boreAF)} unit={unit}/></div>
          </div>
          <div className="lower-grid"><section className="diagram-panel"><div className="small-heading"><Ruler size={15}/><h2>Know your dimensions</h2><span>{unit}</span></div><Diagram params={p} active={active} unit={unit}/></section><section className="export-panel"><span className="eyebrow">READY FOR YOUR WORKSHOP</span><h2>From parameters<br/>to a part.</h2><p>Download your custom pulley for CAD or 3D printing.</p><div className="export-options">{['step','stl'].map(f=><button key={f} aria-pressed={format===f} className={format===f?'selected':''} onClick={()=>setFormat(f)}><span>.{f.toUpperCase()}</span><small>{f==='step'?'Solid CAD model':'3D print mesh'}</small>{format===f&&<Check size={15}/>}</button>)}</div><button className="download-button" disabled={!valid||!!error||exporting||busy} onClick={download}>{exporting?<LoaderCircle size={17} className="spin"/>:<Download size={17}/>} {exporting?'Generating file…':`Download ${format.toUpperCase()}`}</button><div className="download-status" role="status">{notice||`${volume&&!busy?`${unit==='in'?(volume/MM_PER_INCH**3).toFixed(3)+' in³':(volume/1000).toFixed(1)+' cm³'} · `:''}${unit==='in'?'Inch':'Millimeter'} units · generated locally`}</div><button className="inventor-link" onClick={()=>setHelp(true)}>Using Autodesk Inventor? <Info size={13}/></button></section></div>
        </div>
      </div>
      <footer><span><Cog size={14}/> PULLEY LAB <i>/</i> Built for the build season.</span><span>HTD community profile · <a href={`${import.meta.env.BASE_URL}PROFILE-NOTICE.txt`} target="_blank" rel="noreferrer">Profile & license</a></span></footer>
    </main>
    {help&&<div className="modal-backdrop" onClick={()=>setHelp(false)}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape')setHelp(false);}}><button autoFocus className="modal-close icon-button" aria-label="Close export guide" onClick={()=>setHelp(false)}><X size={20}/></button><div className="eyebrow">EXPORT GUIDE</div><h2 id="guide-title">Choose your next step.</h2><h3>STEP · for CAD</h3><p>A solid model for Inventor, Onshape, Fusion, and other CAD tools. STEP records the selected length unit.</p><h3>STL · for 3D printing</h3><p>A binary mesh. STL does not store units, so select {unit==='in'?'inches':'millimeters'} in your slicer for the current download. Test shaft and belt fit before printing a full set.</p><h3>IPT · through Autodesk Inventor</h3><p>Download STEP, open it in Inventor, import as a converted model, then save the part as .ipt. The result is an imported solid; it does not include a native Inventor feature history. Direct IPT export would require an Inventor automation service.</p><p className="guide-source"><a href="https://help.autodesk.com/cloudhelp/2025/ENU/Inventor-Help/files/GUID-0F475FF0-0B1D-46B2-9F0F-7F7E211925EF.htm" target="_blank" rel="noreferrer">Autodesk STEP import documentation <ArrowUpRight size={13}/></a></p><div className="guide-note"><Info size={17}/><p>The groove outline uses the published droftarts HTD community profile. Confirm your belt fits a test part. Overall width includes the flanges and insert or cone.</p></div><button className="download-button" onClick={()=>setHelp(false)}>Back to builder</button></div></div>}
  </ParameterContext.Provider>;
}
function Metric({label,value,unit}){return <div><span>{label}</span><strong>{value}<small>{unit}</small></strong></div>;}
function VariantIcon({type}){return <svg viewBox="0 0 44 34" fill="none" aria-hidden="true"><ellipse cx="19" cy="11" rx="11" ry="5"/><path d="M8 11v13c0 3 5 5 11 5s11-2 11-5V11 M12 14v11 M17 16v12 M22 16v12 M27 14v11"/><ellipse cx="19" cy="11" rx="3" ry="1.5"/>{type==='tube'&&<><path d="M13 7V3 M25 7V3"/><ellipse cx="19" cy="3" rx="6" ry="2.5"/></>}{type==='bearing'&&<><path d="M12 7l4-5 M26 7l-4-5"/><ellipse cx="19" cy="2" rx="3" ry="1.5"/></>}</svg>;}
createRoot(document.getElementById('root')).render(<App/>);
