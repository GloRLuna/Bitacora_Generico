import { useState, useRef, useEffect } from 'react';
import html2pdf from 'html2pdf.js';

/* ─── Constants ──────────────────────────────────────────────── */
const APPS_SCRIPT_URL=(import.meta.env.VITE_APPS_SCRIPT_URL as string)||'';
const ANALISTAS_LIST=['Analista 1','Analista 2','Analista 3','Analista 4','Analista 5','Analista 6','Analista 7','Analista 8'];
const ANALISTAS_TIER2=['Analista 4','Analista 8'];
const SUPERVISORES_LIST=['Supervisor 1','Supervisor 2','Supervisor 3'];
const CLIENTES_HEADER=['Cliente 1','Cliente 2','Cliente 3','Cliente 4','Cliente 5','Cliente 6','Cliente 7'];
const CLIENTES_INC=['Cliente 1','Cliente 2','Cliente 3','Cliente 4','Cliente 5','Cliente 6','Cliente 7'];
const CLIENTE_COLORS={'N/A':{color:'#9C9C9C',bg:'#1A1A1A',border:'#9C9C9C'},'Cliente 3':{color:'#7B8FD4',bg:'#1A1E35',border:'#404E93'},'Cliente 1':{color:'#009EE2',bg:'#001F30',border:'#009EE2'},'Cliente 2':{color:'#00C4CC',bg:'#001E20',border:'#00585F'},'Cliente 4':{color:'#9B6BA8',bg:'#1C0E1C',border:'#53284F'},'Cliente 6':{color:'#75C11F',bg:'#0F1F00',border:'#75C11F'},'Cliente 5':{color:'#F87171',bg:'#2D0A0A',border:'#F87171'},'Cliente 7':{color:'#EE6F29',bg:'#2A1200',border:'#EE6F29'}};
const TURNOS=[{label:'Matutino',hora:'07:00 – 15:00',saludo:'Buenos días',codigo:'TM'},{label:'Vespertino',hora:'15:00 – 22:00',saludo:'Buenas tardes',codigo:'TV'},{label:'Nocturno',hora:'22:00 – 07:00',saludo:'Buenas noches',codigo:'TN'}];
const SEVERIDADES=['Crítica','Alta','Media','Baja'];
const FUENTES=['Cortex','QRadar','Memcyco','CrowdStrike','Otro'];
const ESTATUS_INC=['Abierto','En seguimiento','Cerrado'];
const URGENCIAS=['Alta','Media','Baja'];
const IMPACTOS=['Informativo','Administrativo','Operativo','Seguridad'];
const RESPONSABLES_BASE=['Cliente','CTI','SOC','Otro'];
const CANALES=['Personal','WhatsApp','Correo','Teams','Slack','Otro'];
const RECOMENDACIONES=['Tuning','Excluir','Ajustar severidad','Documentar'];
const SLA_HORAS={'Crítica':1,'Alta':1,'Media':2,'Baja':4};
const ID_PREFIJOS={'Cliente 1':'C1-','Cliente 2':'C2-','Cliente 3':'C3-','Cliente 4':'C4-','Cliente 5':'C5-','Cliente 6':'C6-','Cliente 7':'C7-'};
const incCompleto=(inc)=>{
  const base=inc.analista&&inc.cliente&&inc.id.trim()&&inc.fuente&&inc.fechaHoraLlegada&&inc.numEventos;
  if(!base)return false;
  if(inc.estatus==='En seguimiento')return!!inc.seguimientoRazon;
  if(inc.estatus==='Cerrado')return!!(inc.clasificacion&&inc.fechaHoraEntrega&&inc.fechaHoraRetro&&inc.retroalimentacion.trim());
  return true;
};
const CORREOS_PRINCIPALES=[{email:'destinatario1@ejemplo.com',nombre:'Destinatario 1'},{email:'destinatario2@ejemplo.com',nombre:'Destinatario 2'},{email:'destinatario3@ejemplo.com',nombre:'Destinatario 3'},{email:'destinatario4@ejemplo.com',nombre:'Destinatario 4'}];
const CORREOS_COMPANEROS=[{email:'analista1@ejemplo.com',nombre:'Analista 1'},{email:'analista2@ejemplo.com',nombre:'Analista 2'},{email:'analista3@ejemplo.com',nombre:'Analista 3'},{email:'analista4@ejemplo.com',nombre:'Analista 4'},{email:'analista5@ejemplo.com',nombre:'Analista 5'},{email:'analista6@ejemplo.com',nombre:'Analista 6'},{email:'analista7@ejemplo.com',nombre:'Analista 7'},{email:'analista8@ejemplo.com',nombre:'Analista 8'}];
const CHECK_INICIO=['Acceso a QRadar / SIEM / Cortex / Memcyco /Crowdstrike','Validar comunicación celular SOC','Revisión de la bitácora del turno anterior','Validar alertas críticas en curso','Informe alertas abiertas','Check correo electrónico / WhatsApp Alertas','Proyectar en videowall','Validar listado de falsos positivos'];
const CHECK_CIERRE=['Verificar estabilidad del entorno','Actualizar tickets trabajados','Documentar alertas activas','Realizar llenado de la bitácora','Notificar incidentes relevantes','Notificar cambio de turno','Cerrar sesiones en plataformas','Verificación de orden y limpieza de la estación de trabajo'];
const emptyInc=()=>({id:'',analista:'',severidad:'Baja',fuente:'QRadar',cliente:'',numEventos:'1',estatus:'Abierto',clasificacion:'',seguimientoRazon:'',fechaHoraLlegada:'',fechaHoraEntrega:'',retroalimentacion:'',fechaHoraRetro:''});
const emptyPend=()=>({pendiente:'',impacto:'',urgencia:'Baja',responsable:'SOC',responsableOtro:'',fechaHora:'',estatus:'',comentarios:'',evidencias:[]});
const emptyFT=()=>({regla:'',fuente:'QRadar',volumen:'',descripcion:'',repetitivo:'No',recomendacion:'Tuning',accion:'',aprobacion:'No',notas:''});
const emptyAna=()=>({nombre:'',alertasCortex:'0',ticketsJira:'0',alertasMemcyco:'0',alertasCrowdStrike:'0',porCliente:{}});
const initChecks=(items)=>Object.fromEntries(items.map((_,i)=>[i,false]));

/* ─── Upload image to Drive ──────────────────────────────────── */
async function uploadImageToDrive(file,fecha,turnoLabel,pendIdx,imgIdx){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=async(ev)=>{
      try{
        const base64=ev.target.result.split(',')[1];
        const ext=file.name.split('.').pop()||'jpg';
        const tc={'Matutino':'TM','Vespertino':'TV','Nocturno':'TN'}[turnoLabel]||'TX';
        const filename=`${fecha}_${tc}_Pendiente-${pendIdx+1}_img${imgIdx+1}.${ext}`;
        const resp=await fetch('/.netlify/functions/upload-evidencia',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base64,filename,mimeType:file.type||'image/jpeg',fecha})});
        const json=await resp.json();
        if(!json.ok)throw new Error(json.error||'Error subiendo imagen');
        resolve({name:filename,driveUrl:json.url});
      }catch(err){reject(err);}
    };
    reader.onerror=()=>reject(new Error('Error leyendo archivo'));
    reader.readAsDataURL(file);
  });
}

/* ─── Palette ────────────────────────────────────────────────── */
const C={bg:'#070D1F',surface:'#0D1630',card:'#111E3A',cardBorder:'#1E3060',accent:'#2563EB',accentDim:'#1E40AF',accentBg:'#0F2040',text:'#E2E8F0',textMuted:'#7B93BC',textDim:'#4A6490',success:'#059669',successBg:'#052E1C',danger:'#DC2626',dangerBg:'#2D0A0A',warn:'#D97706',warnBg:'#2D1A02',inputBg:'#0A1428',inputBorder:'#1E3060',calRed:'#C0392B',calRedDark:'#6B1111',calRedBright:'#E74C3C',dropBg:'#0A1220',dropHover:'#162040'};
const IPT={width:'100%',boxSizing:'border-box',padding:'7px 10px',border:`1px solid ${C.inputBorder}`,borderRadius:6,background:C.inputBg,color:C.text,fontSize:13,outline:'none'};
const LBL={fontSize:11,color:C.textMuted,display:'block',marginBottom:3,textTransform:'uppercase',letterSpacing:'0.04em'};
const CARD={background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:10,padding:'1rem 1.25rem',marginBottom:12};
const H2S={fontSize:14,fontWeight:500,color:C.text,marginBottom:12,display:'flex',alignItems:'center',gap:8};
const sev=(s)=>({Crítica:'#FF0000',Alta:'#EF4444',Media:'#EAB308',Baja:'#3B82F6'}[s]||C.textMuted);
const sevBg=(s)=>({Crítica:'#3D0000',Alta:'#2D0A0A',Media:'#2D2500',Baja:'#0F2040'}[s]||'#1a1a2e');
const pill=(active,col=C.accent,bg=C.accentBg)=>({padding:'4px 12px',borderRadius:20,fontSize:12,border:`1px solid ${active?col:C.inputBorder}`,background:active?bg:C.inputBg,color:active?col:C.textMuted,cursor:'pointer',fontWeight:active?500:400});
const LOGO_URL='';
const LOGO_APP_URL='';

/* ─── Calendar helpers ───────────────────────────────────────── */
const DIAS_SEMANA=['Do','Lu','Ma','Mi','Ju','Vi','Sá'];
const MESES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const isoToDate=(iso)=>{if(!iso)return null;const d=new Date(iso);return isNaN(d)?null:d;};
const dateToIso=(d,h,m)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
const displayDT=(iso)=>{if(!iso)return'';const d=new Date(iso);if(isNaN(d))return iso;return`${d.getDate()} ${MESES[d.getMonth()].slice(0,3)} ${d.getFullYear()}  ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;};

/* ═══════════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function ScrollColumn({items,selected,onSelect,width=52}){
  const ref=useRef(null);const ITEM_H=36;
  useEffect(()=>{const i=items.indexOf(selected);if(ref.current&&i>=0)ref.current.scrollTop=i*ITEM_H;},[selected,items]);
  return(
    <div style={{position:'relative',width}}>
      <div onClick={()=>{const i=items.indexOf(selected);if(i>0)onSelect(items[i-1]);}} style={{display:'flex',justifyContent:'center',alignItems:'center',height:22,cursor:'pointer',color:C.calRedBright,fontSize:14,background:'#0A0E1A',userSelect:'none'}}>▲</div>
      <div ref={ref} className="cal-scroll" style={{height:ITEM_H*4,overflowY:'scroll',scrollBehavior:'smooth'}}>
        <div style={{height:ITEM_H}}/>
        {items.map(item=>{const sel=item===selected;return(<div key={item} onClick={()=>onSelect(item)} style={{height:ITEM_H,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:13,fontWeight:sel?700:400,background:sel?C.calRed:'transparent',color:sel?'#fff':C.text,borderRadius:6,margin:'0 4px',transition:'background 0.12s'}}>{item}</div>);})}
        <div style={{height:ITEM_H*3}}/>
      </div>
      <div onClick={()=>{const i=items.indexOf(selected);if(i<items.length-1)onSelect(items[i+1]);}} style={{display:'flex',justifyContent:'center',alignItems:'center',height:22,cursor:'pointer',color:C.calRedBright,fontSize:14,background:'#0A0E1A',userSelect:'none'}}>▼</div>
    </div>
  );
}

function CustomDateTimePicker({value,onChange,label,required,timeOnly=false,minIso=null}){
  const [open,setOpen]=useState(false);
  const ref=useRef(null);
  useEffect(()=>{const h=(e)=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h);},[]);
  const now=new Date();const minDate=minIso?isoToDate(minIso):null;
  const getSelH=()=>{if(timeOnly&&value){const parts=value.split(':');return parseInt(parts[0])||0;}const p=isoToDate(value);return p?p.getHours():now.getHours();};
  const getSelM=()=>{if(timeOnly&&value){const parts=value.split(':');return parseInt(parts[1])||0;}const p=isoToDate(value);return p?p.getMinutes():0;};
  const selH=getSelH(),selM=getSelM();
  const parsed=timeOnly?null:isoToDate(value);const selDate=parsed||now;
  const [vy,setVy]=useState(selDate.getFullYear());const [vm,setVm]=useState(selDate.getMonth());
  const HOURS=Array.from({length:24},(_,i)=>String(i).padStart(2,'0'));
  const MINS=Array.from({length:60},(_,i)=>String(i).padStart(2,'0'));
  const selHStr=String(selH).padStart(2,'0'),selMStr=String(selM).padStart(2,'0');
  const emit=(d,h,m)=>{if(timeOnly){onChange(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);return;}onChange(dateToIso(d,h,m));};
  const pickDay=(day)=>{const nd=new Date(vy,vm,day);if(minDate){const mm=new Date(minDate.getFullYear(),minDate.getMonth(),minDate.getDate());if(nd<mm)return;}emit(nd,selH,selM);};
  const pickH=(hStr)=>{const h=parseInt(hStr);let m=selM;if(minDate&&!timeOnly){const t=new Date(selDate.getFullYear(),selDate.getMonth(),selDate.getDate(),h,m);if(t<minDate){if(h<minDate.getHours())return;m=minDate.getMinutes();}}emit(selDate,h,m);};
  const pickM=(mStr)=>emit(selDate,selH,parseInt(mStr));
  const firstDay=new Date(vy,vm,1).getDay(),dim=new Date(vy,vm+1,0).getDate();
  const isDis=(day)=>{if(!minDate)return false;const d=new Date(vy,vm,day),mm=new Date(minDate.getFullYear(),minDate.getMonth(),minDate.getDate());return d<mm;};
  return(
    <div ref={ref} style={{position:'relative'}}>
      {label&&<label style={LBL}>{label}{required?' *':''}</label>}
      <div onClick={()=>setOpen(o=>!o)} style={{...IPT,cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',border:`1px solid ${open?C.calRed:C.inputBorder}`}}>
        <span style={{color:value?C.text:C.textDim}}>{timeOnly?(value||'HH:MM'):(displayDT(value)||'Seleccionar fecha y hora')}</span>
        <span style={{fontSize:12,color:C.calRed,marginLeft:6}}>📅</span>
      </div>
      {open&&(
        <div style={{position:'absolute',zIndex:9999,top:'100%',left:0,marginTop:4,background:'#080C18',border:`1px solid ${C.calRedDark}`,borderRadius:12,boxShadow:'0 12px 40px rgba(0,0,0,0.85)',display:'flex',overflow:'hidden',minWidth:timeOnly?180:430}}>
          {!timeOnly&&(
            <div style={{padding:'14px 12px 10px',borderRight:`1px solid ${C.calRedDark}`}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <button onClick={()=>{const d=new Date(vy,vm-1,1);setVm(d.getMonth());setVy(d.getFullYear());}} style={{background:'none',border:'none',color:C.calRedBright,cursor:'pointer',fontSize:18,padding:'0 6px',lineHeight:1}}>‹</button>
                <span style={{color:C.text,fontWeight:600,fontSize:13}}>{MESES[vm]} {vy}</span>
                <button onClick={()=>{const d=new Date(vy,vm+1,1);setVm(d.getMonth());setVy(d.getFullYear());}} style={{background:'none',border:'none',color:C.calRedBright,cursor:'pointer',fontSize:18,padding:'0 6px',lineHeight:1}}>›</button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,32px)',gap:2,marginBottom:4}}>{DIAS_SEMANA.map(d=><div key={d} style={{textAlign:'center',fontSize:10,color:'#4A5568',fontWeight:700,padding:'2px 0'}}>{d}</div>)}</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,32px)',gap:2}}>
                {Array(firstDay).fill(null).map((_,i)=><div key={'e'+i}/>)}
                {Array(dim).fill(null).map((_,i)=>{const day=i+1,iT=day===now.getDate()&&vm===now.getMonth()&&vy===now.getFullYear(),iS=parsed&&day===parsed.getDate()&&vm===parsed.getMonth()&&vy===parsed.getFullYear()&&value,dis=isDis(day);return(<div key={day} onClick={()=>!dis&&pickDay(day)} style={{width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:6,cursor:dis?'not-allowed':'pointer',fontSize:12,fontWeight:iS?700:400,background:iS?C.calRed:iT?'#1A0505':'transparent',color:dis?'#2D2D2D':iS?'#fff':iT?C.calRedBright:C.text,border:iT&&!iS?`1px solid ${C.calRedDark}`:'1px solid transparent',opacity:dis?0.35:1}} onMouseEnter={e=>{if(!iS&&!dis)e.currentTarget.style.background=C.calRedDark;}} onMouseLeave={e=>{if(!iS&&!dis)e.currentTarget.style.background=iT?'#1A0505':'transparent';}}>{day}</div>);})}
              </div>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:8}}>
                <button onClick={()=>onChange('')} style={{background:'none',border:'none',color:C.calRedBright,cursor:'pointer',fontSize:12}}>Borrar</button>
                <button onClick={()=>{const t=new Date();setVm(t.getMonth());setVy(t.getFullYear());pickDay(t.getDate());}} style={{background:'none',border:'none',color:C.calRedBright,cursor:'pointer',fontSize:12}}>Hoy</button>
              </div>
            </div>
          )}
          <div style={{display:'flex',background:'#0A0E1A',padding:'8px 4px'}}>
            <div><div style={{textAlign:'center',fontSize:10,color:'#4A5568',fontWeight:700,marginBottom:4,paddingTop:2}}>HH</div><ScrollColumn items={HOURS} selected={selHStr} onSelect={pickH} width={52}/></div>
            <div style={{width:1,background:C.calRedDark,margin:'0 4px'}}/>
            <div><div style={{textAlign:'center',fontSize:10,color:'#4A5568',fontWeight:700,marginBottom:4,paddingTop:2}}>MM</div><ScrollColumn items={MINS} selected={selMStr} onSelect={pickM} width={52}/></div>
            <div style={{display:'flex',alignItems:'flex-end',paddingBottom:22,paddingLeft:6}}>
              <button onClick={()=>setOpen(false)} style={{background:C.calRed,border:'none',color:'#fff',borderRadius:8,padding:'7px 14px',cursor:'pointer',fontSize:12,fontWeight:700,boxShadow:'0 2px 10px rgba(192,57,43,0.5)'}}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function CustomTimePicker({value,onChange,label,required}){return <CustomDateTimePicker value={value} onChange={onChange} label={label} required={required} timeOnly/>;}

function CustomDatePicker({value,onChange,label,required}){
  const [open,setOpen]=useState(false);const ref=useRef(null);
  useEffect(()=>{const h=(e)=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h);},[]);
  const now=new Date();const parsed=value?new Date(value+'T00:00:00'):now;
  const [vy,setVy]=useState(parsed.getFullYear());const [vm,setVm]=useState(parsed.getMonth());
  const firstDay=new Date(vy,vm,1).getDay(),dim=new Date(vy,vm+1,0).getDate();
  const selY=value?parseInt(value.slice(0,4)):-1,selMo=value?parseInt(value.slice(5,7))-1:-1,selD=value?parseInt(value.slice(8,10)):-1;
  const pickDay=(day)=>{onChange(`${vy}-${String(vm+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`);setOpen(false);};
  const displayVal=()=>{if(!value)return'';const d=new Date(value+'T00:00:00');return`${d.getDate()} ${MESES[d.getMonth()].slice(0,3)} ${d.getFullYear()}`;};
  return(
    <div ref={ref} style={{position:'relative'}}>
      {label&&<label style={LBL}>{label}{required?' *':''}</label>}
      <div onClick={()=>setOpen(o=>!o)} style={{...IPT,cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',border:`1px solid ${open?C.calRed:C.inputBorder}`}}>
        <span style={{color:value?C.text:C.textDim}}>{displayVal()||'Seleccionar fecha'}</span>
        <span style={{fontSize:12,color:C.calRed}}>📅</span>
      </div>
      {open&&(
        <div style={{position:'absolute',zIndex:9999,top:'100%',left:0,marginTop:4,background:'#080C18',border:`1px solid ${C.calRedDark}`,borderRadius:12,boxShadow:'0 12px 40px rgba(0,0,0,0.85)',padding:'14px 12px 10px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <button onClick={()=>{const d=new Date(vy,vm-1,1);setVm(d.getMonth());setVy(d.getFullYear());}} style={{background:'none',border:'none',color:C.calRedBright,cursor:'pointer',fontSize:18,padding:'0 6px',lineHeight:1}}>‹</button>
            <span style={{color:C.text,fontWeight:600,fontSize:13}}>{MESES[vm]} {vy}</span>
            <button onClick={()=>{const d=new Date(vy,vm+1,1);setVm(d.getMonth());setVy(d.getFullYear());}} style={{background:'none',border:'none',color:C.calRedBright,cursor:'pointer',fontSize:18,padding:'0 6px',lineHeight:1}}>›</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,32px)',gap:2,marginBottom:4}}>{DIAS_SEMANA.map(d=><div key={d} style={{textAlign:'center',fontSize:10,color:'#4A5568',fontWeight:700}}>{d}</div>)}</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,32px)',gap:2}}>
            {Array(firstDay).fill(null).map((_,i)=><div key={'e'+i}/>)}
            {Array(dim).fill(null).map((_,i)=>{const day=i+1,iT=day===now.getDate()&&vm===now.getMonth()&&vy===now.getFullYear(),iS=day===selD&&vm===selMo&&vy===selY;return(<div key={day} onClick={()=>pickDay(day)} style={{width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:iS?700:400,background:iS?C.calRed:iT?'#1A0505':'transparent',color:iS?'#fff':iT?C.calRedBright:C.text,border:iT&&!iS?`1px solid ${C.calRedDark}`:'1px solid transparent'}} onMouseEnter={e=>{if(!iS)e.currentTarget.style.background=C.calRedDark;}} onMouseLeave={e=>{if(!iS)e.currentTarget.style.background=iT?'#1A0505':'transparent';}}>{day}</div>);})}
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:8}}>
            <button onClick={()=>{onChange('');setOpen(false);}} style={{background:'none',border:'none',color:C.calRedBright,cursor:'pointer',fontSize:12}}>Borrar</button>
            <button onClick={()=>{const t=new Date();setVm(t.getMonth());setVy(t.getFullYear());pickDay(t.getDate());}} style={{background:'none',border:'none',color:C.calRedBright,cursor:'pointer',fontSize:12}}>Hoy</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CSelect({value,onChange,options,label,required,placeholder='— Seleccionar —',accentColor=C.accent}){
  const [open,setOpen]=useState(false);const ref=useRef(null);
  useEffect(()=>{const h=(e)=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h);},[]);
  const norm=(o)=>typeof o==='string'?{value:o,label:o}:o;
  const normed=options.map(norm);
  const displayLabel=normed.find(o=>o.value===value)?.label||(value||'');
  return(
    <div ref={ref} style={{position:'relative',width:'100%'}}>
      {label&&<label style={LBL}>{label}{required?' *':''}</label>}
      <div onClick={()=>setOpen(o=>!o)} style={{...IPT,cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',background:C.dropBg,border:`1px solid ${open?accentColor:C.inputBorder}`,transition:'border-color 0.2s'}}>
        <span style={{color:value?C.text:C.textDim,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{displayLabel||placeholder}</span>
        <span style={{color:accentColor,fontSize:10,marginLeft:8,transform:open?'rotate(180deg)':'rotate(0)',transition:'transform 0.2s',flexShrink:0}}>▼</span>
      </div>
      {open&&(
        <div style={{position:'absolute',zIndex:9999,top:'100%',left:0,right:0,marginTop:3,background:C.dropBg,border:`1px solid ${accentColor}`,borderRadius:8,boxShadow:'0 8px 28px rgba(0,0,0,0.7)',overflow:'hidden',maxHeight:260,overflowY:'auto'}} className="cal-scroll">
          <div onClick={()=>{onChange('');setOpen(false);}} style={{padding:'9px 14px',fontSize:13,cursor:'pointer',color:!value?C.calRedBright:C.textDim,background:!value?'rgba(192,57,43,0.12)':'transparent',borderBottom:`1px solid ${C.inputBorder}`}} onMouseEnter={e=>{if(value)e.currentTarget.style.background=C.dropHover;}} onMouseLeave={e=>{if(value)e.currentTarget.style.background='transparent';}}>{placeholder}</div>
          {normed.map(o=>{const sel=o.value===value;return(<div key={o.value} onClick={()=>{onChange(o.value);setOpen(false);}} style={{padding:'9px 14px',fontSize:13,cursor:'pointer',color:sel?'#fff':C.text,background:sel?C.calRed:'transparent',borderBottom:`1px solid ${C.inputBorder}`,fontWeight:sel?600:400,transition:'background 0.12s'}} onMouseEnter={e=>{if(!sel)e.currentTarget.style.background=C.dropHover;}} onMouseLeave={e=>{if(!sel)e.currentTarget.style.background='transparent';}}>{o.label}</div>);})}
        </div>
      )}
    </div>
  );
}

function NumSpinner({value,onChange,min=0,label,labelColor,small=false}){
  const num=parseInt(value)||0;
  const dec=()=>onChange(String(Math.max(min,num-1)));
  const inc=()=>onChange(String(num+1));
  const H=small?48:48,BW=14,FS=small?12:12,BFS=15;
  return(
    <div>
      {label&&<label style={{...LBL,color:labelColor||C.textMuted}}>{label}</label>}
      <div style={{display:'flex',alignItems:'stretch',borderRadius:6,overflow:'hidden',border:`1px solid ${C.inputBorder}`,background:C.inputBg,height:H}}>
        <input type="number" min={min} value={value} onChange={e=>onChange(e.target.value)} style={{flex:1,border:'none',background:'transparent',color:C.text,fontSize:FS,fontWeight:600,textAlign:'center',outline:'none',padding:'0 4px',minWidth:0}}/>
        <div style={{display:'flex',flexDirection:'column',width:BW,flexShrink:0,borderLeft:`1px solid ${C.inputBorder}`}}>
          <div onClick={inc} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',userSelect:'none',fontSize:BFS,fontWeight:700,color:C.textMuted,background:'transparent',transition:'background 0.12s,color 0.12s'}} onMouseEnter={e=>{e.currentTarget.style.background=C.accentDim;e.currentTarget.style.color='#fff';}} onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color=C.textMuted;}}>＋</div>
          <div style={{height:1,background:C.inputBorder}}/>
          <div onClick={dec} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',userSelect:'none',fontSize:BFS,fontWeight:700,color:C.textMuted,background:'transparent',transition:'background 0.12s,color 0.12s'}} onMouseEnter={e=>{e.currentTarget.style.background=C.accentDim;e.currentTarget.style.color='#fff';}} onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color=C.textMuted;}}>－</div>
        </div>
      </div>
    </div>
  );
}

function CircleCheck({checked,onChange,label}){
  return(
    <div onClick={onChange} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 10px',cursor:'pointer',userSelect:'none',borderRadius:8,background:checked?'rgba(37,99,235,0.08)':'transparent',transition:'background 0.15s'}} onMouseEnter={e=>{if(!checked)e.currentTarget.style.background='rgba(37,99,235,0.05)';}} onMouseLeave={e=>{e.currentTarget.style.background=checked?'rgba(37,99,235,0.08)':'transparent';}}>
      <div style={{width:22,height:22,borderRadius:'50%',flexShrink:0,border:`2px solid ${checked?C.accent:'#2A3F6A'}`,background:checked?C.accent:'transparent',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.18s',boxShadow:checked?'0 0 8px rgba(37,99,235,0.4)':'none'}}>
        {checked&&(<svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4L4 7.5L10 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>)}
      </div>
      <span style={{fontSize:13,color:checked?C.textDim:C.text,textDecoration:checked?'line-through':'none',lineHeight:1.4,flex:1,textAlign:'left'}}>{label}</span>
    </div>
  );
}

/* ── Notas con múltiples entradas retráctiles ────────────────── */
// Recibe: notas (string con separador |||), setNotas, notasExpanded, setNotasExpanded
function NotasBlock({notas,setNotas,notasExpanded,setNotasExpanded}){
  const arr=notas?notas.split('|||'):[''];
  return(
    <div>
      {arr.map((nota,i)=>(
        <div key={i} style={{marginBottom:8,border:`1px solid ${C.inputBorder}`,borderRadius:8,overflow:'hidden'}}>
          <div onClick={()=>setNotasExpanded((p:any)=>({...p,[i]:!p[i]}))}
            style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',background:C.inputBg,cursor:'pointer',userSelect:'none'}}>
            <span style={{fontSize:12,color:C.textMuted}}>
              Nota #{i+1}{nota.trim()?` — ${nota.trim().slice(0,40)}${nota.trim().length>40?'...':''}` : ''}
            </span>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              {arr.length>1&&(
                <span onClick={e=>{e.stopPropagation();const a=[...arr];a.splice(i,1);setNotas(a.join('|||'));setNotasExpanded((p:any)=>{const n:any={};Object.keys(p).forEach(k=>{if(+k<i)n[k]=p[k];else if(+k>i)n[+k-1]=p[k];});return n;});}}
                  style={{fontSize:11,color:C.danger,cursor:'pointer',fontWeight:700}}>✕</span>
              )}
              <span style={{fontSize:11,color:C.textDim,display:'inline-block',transform:notasExpanded[i]!==false?'rotate(180deg)':'rotate(0)',transition:'transform 0.2s'}}>▼</span>
            </div>
          </div>
          {notasExpanded[i]!==false&&(
            <textarea value={nota} onChange={e=>{const a=[...arr];a[i]=e.target.value;setNotas(a.join('|||'));}} rows={3}
              style={{...IPT,resize:'vertical',borderRadius:0,border:'none',borderTop:`1px solid ${C.inputBorder}`}}
              placeholder="Observaciones del turno..."/>
          )}
        </div>
      ))}
      <button onClick={()=>{setNotas(notas?notas+'|||':'');setNotasExpanded((p:any)=>({...p,[arr.length]:true}));}}
        style={{padding:'5px 12px',cursor:'pointer',fontSize:12,color:C.accent,border:`1px solid ${C.accent}`,background:'transparent',borderRadius:6}}>
        + Nueva nota
      </button>
    </div>
  );
}

function FileInput({pendIdx,evidencias,onUploadStart,onUploadDone,onRemove,fecha,turnoLabel}){
  const inputRef=useRef(null);
  const handleFiles=async(files)=>{
    for(let j=0;j<files.length;j++){
      const file=files[j];const tmpId=Date.now()+j;
      onUploadStart(tmpId,file.name);
      try{const result=await uploadImageToDrive(file,fecha,turnoLabel,pendIdx,evidencias.length+j);onUploadDone(tmpId,result);}
      catch(err){onUploadDone(tmpId,null,err.message);}
    }
  };
  return(
    <div>
      <label style={LBL}>Evidencias (imágenes)</label>
      <div onClick={()=>inputRef.current?.click()} style={{...IPT,cursor:'pointer',display:'flex',alignItems:'center',gap:10,background:C.dropBg,border:`1px dashed ${C.inputBorder}`,color:C.textMuted,fontSize:13,justifyContent:'center',minHeight:38,transition:'border-color 0.2s,background 0.2s'}} onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.background=C.dropHover;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.inputBorder;e.currentTarget.style.background=C.dropBg;}}>
        <span style={{color:C.accent,fontSize:16}}>📎</span>
        <span style={{fontSize:12}}>Seleccionar imágenes — se suben a Drive automáticamente</span>
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={e=>{handleFiles(Array.from(e.target.files));e.target.value='';}}/>
      {evidencias.length>0&&(
        <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:8}}>
          {evidencias.map((ev,j)=>(
            <div key={ev.tmpId||j} style={{position:'relative',width:80,height:80,borderRadius:6,overflow:'hidden',border:`1px solid ${C.cardBorder}`,background:C.inputBg,display:'flex',alignItems:'center',justifyContent:'center'}}>
              {ev.uploading&&(<div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,padding:6}}><div style={{width:20,height:20,border:`2px solid ${C.accent}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/><span style={{fontSize:9,color:C.textMuted,textAlign:'center',lineHeight:1.2}}>{ev.name?.split('.')[0]?.slice(0,10)}</span></div>)}
              {ev.error&&(<div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,padding:4}}><span style={{fontSize:16}}>⚠️</span><span style={{fontSize:9,color:C.danger,textAlign:'center',lineHeight:1.2}}>Error</span></div>)}
              {ev.driveUrl&&!ev.uploading&&(<a href={ev.driveUrl} target="_blank" rel="noreferrer" style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,padding:6,textDecoration:'none',width:'100%',height:'100%',justifyContent:'center'}}><span style={{fontSize:22}}>🖼️</span><span style={{fontSize:9,color:C.accent,textAlign:'center',lineHeight:1.2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:72}}>{ev.name}</span></a>)}
              <button onClick={()=>onRemove(j)} style={{position:'absolute',top:-1,right:-1,width:18,height:18,borderRadius:'50%',background:C.danger,border:'none',color:'#fff',cursor:'pointer',fontSize:10,padding:0,lineHeight:'18px',textAlign:'center',zIndex:1}}>✕</button>
            </div>
          ))}
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   REPORTE PREVIEW
   ═══════════════════════════════════════════════════════════════ */
function ReportePreview(p){
  const totalAlertas=p.totalPor('alertasCortex')+p.totalPor('ticketsJira')+p.totalPor('alertasMemcyco')+p.totalPor('alertasCrowdStrike');
  const MetCard=({label,val,color})=>(<div style={{background:C.accentBg,border:`1px solid ${C.cardBorder}`,borderRadius:8,padding:'10px 8px',textAlign:'center'}}><div style={{fontSize:11,color:color||C.textMuted,marginBottom:2,textTransform:'uppercase',letterSpacing:'0.04em'}}>{label}</div><div style={{fontSize:22,fontWeight:500,color:color||C.text}}>{val}</div></div>);
  return(
    <div style={{width:'100%',boxSizing:'border-box',overflow:'hidden'}}>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14,alignItems:'center'}}>
        <button onClick={p.enviarPorCorreoIntegrado} disabled={p.enviandoCorreo||p.guardando}
          style={{padding:'8px 22px',cursor:(p.enviandoCorreo||p.guardando)?'not-allowed':'pointer',background:p.guardado&&p.correoExito?C.success:(p.enviandoCorreo||p.guardando)?'#6B7280':C.accentDim,border:'none',color:'#fff',fontWeight:600,borderRadius:6,fontSize:13,opacity:(p.enviandoCorreo||p.guardando)?0.75:1}}>
          {(p.enviandoCorreo||p.guardando)?'⏳ Procesando...':(p.guardado&&p.correoExito)?'✓ Enviado y guardado':'🚀 Enviar y guardar bitácora'}
        </button>
        <button onClick={p.nuevaBitacora} style={{padding:'8px 14px',cursor:'pointer',background:'transparent',border:`1px solid ${C.inputBorder}`,color:C.textMuted,borderRadius:6,fontSize:13}}>Nueva bitácora</button>
      </div>
      {p.correoExito&&<div style={{background:C.successBg,border:`1px solid ${C.success}`,borderRadius:8,padding:'8px 14px',marginBottom:8,fontSize:12,color:C.success}}>✓ Bitácora enviada por correo.</div>}
      {p.guardado&&<div style={{background:C.successBg,border:`1px solid ${C.success}`,borderRadius:8,padding:'8px 14px',marginBottom:8,fontSize:12,color:C.success}}>✓ Guardado en Sheets.</div>}
      {p.correoError&&<div style={{background:C.dangerBg,border:`1px solid ${C.danger}`,borderRadius:8,padding:'8px 14px',marginBottom:8,fontSize:12,color:C.danger}}>⚠ {p.correoError}</div>}
      {p.errorGuardado&&<div style={{background:C.dangerBg,border:`1px solid ${C.danger}`,borderRadius:8,padding:'8px 14px',marginBottom:12,fontSize:12,color:C.danger}}>⚠ {p.errorGuardado}</div>}

      <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 320px',gap:14,alignItems:'start',width:'100%',boxSizing:'border-box'}}>
        <div style={{minWidth:0}}>
          {/* Encabezado */}
          <div style={CARD}>
            <p style={{...H2S,color:C.accent}}>🛡️ Encabezado</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <CustomDatePicker value={p.fecha} onChange={p.setFecha} label="Fecha" required/>
              <CSelect value={String(p.turno)} onChange={v=>p.setTurno(+v)} label="Turno" options={TURNOS.map((t,i)=>({value:String(i),label:`${t.label} — ${t.hora}`}))}/>
              <CSelect value={p.saliente} onChange={p.setSaliente} label="Analista saliente" options={ANALISTAS_LIST}/>
              <CSelect value={p.entrante} onChange={p.setEntrante} label="Analista entrante" options={ANALISTAS_LIST}/>
              <CSelect value={p.supervisor} onChange={p.setSupervisor} label="Supervisor / Líder / T2" options={SUPERVISORES_LIST}/>
              <CSelect value={p.canal} onChange={p.setCanal} label="Canal" options={CANALES}/>
              <div style={{gridColumn:'1/-1'}}>
                <label style={LBL}>Clientes</label>
                <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:4}}>
                  {CLIENTES_HEADER.map(c=>{const cl=CLIENTE_COLORS[c]||{color:C.accent,bg:C.accentBg,border:C.accent};const sel=p.clientesSel.includes(c);return <button key={c} onClick={()=>p.toggleCliente(c)} style={{padding:'3px 12px',borderRadius:20,fontSize:12,border:`1.5px solid ${sel?cl.border:C.inputBorder}`,background:sel?cl.bg:C.inputBg,color:sel?cl.color:C.textMuted,cursor:'pointer',fontWeight:sel?600:400}}>{c}</button>;})}
                </div>
              </div>
            </div>
          </div>

          {/* Checklist */}
          <div style={CARD}>
            <p style={{...H2S,color:C.accent}}>✅ Checklist</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {[['☀️','Inicio',CHECK_INICIO,p.checksI,p.setChecksI,'#F59E0B','rgba(245,158,11,0.12)'],['🌙','Cierre',CHECK_CIERRE,p.checksC,p.setChecksC,'#7B8FD4','rgba(123,143,212,0.12)']].map(([icon,title,items,checks,setter,acColor,acBg])=>(
                <div key={title}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <div style={{display:'flex',alignItems:'center',gap:6}}><span style={{fontSize:18}}>{icon}</span><span style={{fontSize:12,color:acColor,fontWeight:600}}>{title}</span></div>
                    <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:p.pctChecks(checks)>=50?C.successBg:C.dangerBg,color:p.pctChecks(checks)>=50?C.success:C.danger}}>{p.pctChecks(checks)}%</span>
                  </div>
                  <div style={{background:acBg,borderRadius:8,overflow:'hidden',border:`1px solid ${acColor}22`}}>
                    {items.map((item,i)=>(<div key={i} style={{borderBottom:i<items.length-1?`1px solid ${acColor}22`:'none'}}><CircleCheck checked={!!checks[i]} onChange={()=>p.toggleCheck(setter,i)} label={item}/></div>))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Métricas */}
          <div style={CARD}>
            <p style={{...H2S,color:C.accent}}>📊 Métricas</p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:8,marginBottom:10}}>
              <MetCard label="Cortex" val={p.totalPor('alertasCortex')} color="#3B82F6"/>
              <MetCard label="Jira" val={p.totalPor('ticketsJira')} color="#10B981"/>
              <MetCard label="Memcyco" val={p.totalPor('alertasMemcyco')} color="#F59E0B"/>
              <MetCard label="CrowdStrike" val={p.totalPor('alertasCrowdStrike')} color="#EC4899"/>
            </div>
            {p.analistas.map((a,i)=>(
              <div key={i} style={{marginBottom:8,padding:'10px',background:C.inputBg,borderRadius:8}}>
                <div style={{fontSize:12,color:C.textMuted,marginBottom:8}}>Analista {i+1}: <strong style={{color:C.text}}>{a.nombre||'—'}</strong></div>
                {p.clientesSel.filter(c=>c!=='N/A').length>0&&(
                  <div style={{marginBottom:8}}>
                    <label style={{...LBL,marginBottom:6}}>Alertas por cliente</label>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(100px,1fr))',gap:6}}>
                      {p.clientesSel.filter(c=>c!=='N/A').map(c=>{const cl=CLIENTE_COLORS[c]||{color:C.accent,bg:C.accentBg,border:C.accent};return(<div key={c} style={{background:cl.bg,border:`1px solid ${cl.border}`,borderRadius:8,padding:'8px 6px',textAlign:'center'}}><div style={{fontSize:10,color:cl.color,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.04em',fontWeight:600}}>{c}</div><input type="number" min="0" value={a.porCliente[c]||'0'} onChange={e=>p.updApc(i,c,e.target.value)} style={{width:'100%',boxSizing:'border-box',textAlign:'center',fontSize:18,fontWeight:500,color:cl.color,background:'transparent',border:'none',outline:'none',padding:0}}/></div>);})}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8,marginTop:8}}>
              {[[p.incConf,p.setIncConf,'Inc. confirmados'],[p.incCont,p.setIncCont,'Inc. contenidos'],[p.eventos,p.setEventos,'Eventos sosp.'],[p.escalados,p.setEscalados,'Escalados']].map(([val,setter,lab])=>(<NumSpinner key={lab} value={val} onChange={setter} label={lab}/>))}
            </div>
          </div>

          {/* Incidentes */}
          <div style={CARD}>
            <p style={{...H2S,color:C.accent}}>🚨 Incidentes</p>
            {p.soloNA?(
              <div style={{background:C.accentBg,border:`1px solid ${C.accent}`,borderRadius:8,padding:'16px',textAlign:'center'}}>
                <span style={{fontSize:13,color:C.textMuted,fontStyle:'italic'}}>No hubo alertas que reportar durante este turno.</span>
              </div>
            ):(
              <>{p.incidentes.map((inc,i)=>(<div key={i} style={{marginBottom:10,padding:'10px',background:C.inputBg,borderRadius:8,borderLeft:`3px solid ${sev(inc.severidad)}`}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}><span style={{fontSize:12,fontWeight:600,color:C.text}}>#{i+1} — {inc.id||'Sin ID'}</span><span style={{fontSize:11,padding:'2px 8px',borderRadius:10,background:sevBg(inc.severidad),color:sev(inc.severidad)}}>{inc.severidad}</span></div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}><CSelect value={inc.analista} onChange={v=>p.updInc(i,'analista',v)} label="Analista" options={ANALISTAS_LIST}/><div><label style={LBL}>ID/Case</label><input value={inc.id} onChange={e=>p.updInc(i,'id',e.target.value)} style={{...IPT}}/></div><CSelect value={inc.cliente} onChange={v=>p.updInc(i,'cliente',v)} label="Cliente" options={CLIENTES_INC}/><CSelect value={inc.severidad} onChange={v=>p.updInc(i,'severidad',v)} label="Severidad" options={SEVERIDADES}/><CSelect value={inc.estatus} onChange={v=>p.updInc(i,'estatus',v)} label="Estatus" options={ESTATUS_INC}/><NumSpinner value={inc.numEventos} onChange={v=>p.updInc(i,'numEventos',v)} label="# Eventos" min={1}/><div style={{gridColumn:'1/-1'}}><label style={LBL}>Descripción</label><input value={inc.descripcion} onChange={e=>p.updInc(i,'descripcion',e.target.value)} style={{...IPT}}/></div><CustomDateTimePicker value={inc.fechaHoraLlegada} onChange={v=>p.updInc(i,'fechaHoraLlegada',v)} label="Llegada"/><CustomDateTimePicker value={inc.fechaHoraEntrega} onChange={v=>p.updInc(i,'fechaHoraEntrega',v)} label="Entrega" minIso={inc.fechaHoraLlegada||undefined}/></div></div>))}
              <button onClick={()=>p.setIncidentes(pr=>[...pr,emptyInc()])} style={{padding:'5px 12px',cursor:'pointer',fontSize:12,color:C.accent,border:`1px solid ${C.accent}`,background:'transparent',borderRadius:6}}>+ Agregar incidente</button></>
            )}
          </div>

          {/* Notas — usa el componente compartido, recibe props de p */}
          <div style={CARD}>
            <p style={{...H2S,color:C.accent}}>📝 Notas generales</p>
            <NotasBlock notas={p.notas} setNotas={p.setNotas} notasExpanded={p.notasExpanded} setNotasExpanded={p.setNotasExpanded}/>
          </div>

          {p.pendientes&&p.pendientes.some((pd:any)=>pd.pendiente)&&(
            <div style={CARD}>
              <p style={{...H2S,color:C.accent}}>📌 Pendientes</p>
              {p.pendientes.filter((pd:any)=>pd.pendiente).map((pd:any,i:number)=>(
                <div key={i} style={{marginBottom:8,padding:'10px 12px',background:C.inputBg,borderRadius:8,borderLeft:`3px solid ${pd.urgencia==='Alta'?C.danger:pd.urgencia==='Media'?C.warn:C.success}`}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{fontSize:13,fontWeight:500,color:C.text}}>{pd.pendiente}</span>
                    <span style={{fontSize:11,padding:'1px 8px',borderRadius:10,background:pd.urgencia==='Alta'?C.dangerBg:pd.urgencia==='Media'?C.warnBg:C.successBg,color:pd.urgencia==='Alta'?C.danger:pd.urgencia==='Media'?C.warn:C.success}}>{pd.urgencia}</span>
                  </div>
                  <div style={{fontSize:11,color:C.textMuted,display:'flex',gap:12}}>
                    {pd.impacto&&<span>Impacto: <strong style={{color:C.text}}>{pd.impacto}</strong></span>}
                    <span>Responsable: <strong style={{color:C.text}}>{pd.responsable==='Otro'?(pd.responsableOtro||'Otro'):pd.responsable}</strong></span>
                    {pd.estatus&&<span>Estatus: <strong style={{color:C.text}}>{pd.estatus}</strong></span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {p.fineTuning&&p.fineTuning.some((ft:any)=>ft.regla)&&(
            <div style={CARD}>
              <p style={{...H2S,color:C.accent}}>🔧 Fine Tuning</p>
              {p.fineTuning.filter((ft:any)=>ft.regla).map((ft:any,i:number)=>(
                <div key={i} style={{marginBottom:8,padding:'10px 12px',background:C.inputBg,borderRadius:8}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{fontSize:13,fontWeight:500,color:C.text}}>{ft.regla}</span>
                    <span style={{fontSize:11,padding:'1px 8px',borderRadius:10,background:C.accentBg,color:C.accent}}>{ft.fuente}</span>
                  </div>
                  <div style={{fontSize:11,color:C.textMuted,display:'flex',gap:12,flexWrap:'wrap'}}>
                    {ft.descripcion&&<span>{ft.descripcion}</span>}
                    <span>Recomendación: <strong style={{color:C.text}}>{ft.recomendacion}</strong></span>
                    {ft.accion&&<span>Acción: <strong style={{color:C.text}}>{ft.accion}</strong></span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={CARD}>
            <p style={{...H2S,color:C.accent}}>📧 Cuerpo del correo</p>
            <textarea value={p.cuerpoCorreo} onChange={e=>p.setCuerpoCorreo(e.target.value)} rows={6} style={{...IPT,resize:'vertical',fontFamily:'monospace',fontSize:12,lineHeight:1.7}}/>
            <button onClick={p.copiarTexto} style={{marginTop:8,fontSize:12,padding:'4px 12px',borderRadius:6,border:`1px solid ${p.copiado?C.success:C.inputBorder}`,background:p.copiado?C.successBg:C.inputBg,color:p.copiado?C.success:C.textMuted,cursor:'pointer'}}>{p.copiado?'✓ Copiado':'Copiar texto'}</button>
          </div>
        </div>

        {/* Columna derecha sticky */}
        <div style={{position:'sticky',top:12,minWidth:0}}>
          <div style={{...CARD,border:`1px solid ${C.accent}`}}>
            <p style={{...H2S,color:C.accent}}>🤝 Confirmación de entrega</p>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <div style={{padding:'8px 12px',borderRadius:8,background:C.accentBg,border:`1px solid ${C.cardBorder}`}}>
                <div style={{fontSize:11,color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:6}}>Analistas</div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}>
                  <span><span style={{color:C.textMuted}}>Saliente: </span><strong style={{color:C.text}}>{p.saliente||'—'}</strong></span>
                  <span><span style={{color:C.textMuted}}>Entrante: </span><strong style={{color:C.text}}>{p.entrante||'—'}</strong></span>
                </div>
              </div>
              <CustomTimePicker value={p.horaEntrega} onChange={p.setHoraEntrega} label="Hora de entrega" required/>
              <CustomTimePicker value={p.horaRecepcion} onChange={p.setHoraRecepcion} label="Hora de recepción" required/>
            </div>
            <div style={{marginTop:14,padding:'12px',background:C.accentBg,borderRadius:8}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}><span style={{color:C.textMuted}}>Saliente:</span><span style={{color:C.text,fontWeight:500}}>{p.saliente||'—'}{p.horaEntrega?` · ${p.horaEntrega}`:''}</span></div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}><span style={{color:C.textMuted}}>Entrante:</span><span style={{color:C.text,fontWeight:500}}>{p.entrante||'—'}{p.horaRecepcion?` · ${p.horaRecepcion}`:''}</span></div>
            </div>
          </div>
          <div style={CARD}>
            <p style={{...H2S,color:C.textMuted,fontSize:12}}>📋 Resumen del turno</p>
            <div style={{display:'flex',flexDirection:'column',gap:6,fontSize:12}}>
              {[['Fecha',p.fecha],['Turno',TURNOS[p.turno].label],['Saliente',p.saliente||'—'],['Entrante',p.entrante||'—'],['Supervisor',p.supervisor||'—'],['Clientes',p.clientesSel.join(', ')||'—'],['Total alertas',totalAlertas],['Inc. confirmados',p.incConf],['Check inicio',p.pctChecks(p.checksI)+'%'],['Check cierre',p.pctChecks(p.checksC)+'%']].map(([k,v])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:`1px solid ${C.cardBorder}`}}>
                  <span style={{color:C.textMuted}}>{k}</span><span style={{color:C.text,fontWeight:500}}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════════ */
export default function App(){
  const [turno,setTurno]=useState(0);
  const [fecha,setFecha]=useState(new Date().toISOString().slice(0,10));
  const [clientesSel,setClientesSel]=useState([]);
  const [saliente,setSaliente]=useState('');
  const [entrante,setEntrante]=useState('');
  const [supervisor,setSupervisor]=useState('');
  const [canal,setCanal]=useState('Personal');
  const [checksI,setChecksI]=useState(initChecks(CHECK_INICIO));
  const [checksC,setChecksC]=useState(initChecks(CHECK_CIERRE));
  const [analistas,setAnalistas]=useState([emptyAna()]);
  const [incConf,setIncConf]=useState('0');
  const [incCont,setIncCont]=useState('0');
  const [eventos,setEventos]=useState('0');
  const [escalados,setEscalados]=useState('0');
  const [incidentes,setIncidentes]=useState([emptyInc()]);
  const [expandedTickets,setExpandedTickets]=useState<Record<number,boolean>>({});
  const [metOpen,setMetOpen]=useState(false);
  const [expandedAnalistas,setExpandedAnalistas]=useState<Record<number,boolean>>({0:true});
  const toggleExpandAnalista=(i:number)=>setExpandedAnalistas(p=>({...p,[i]:!p[i]}));
  const toggleExpandTicket=(i:number)=>setExpandedTickets(p=>({...p,[i]:!p[i]}));
  const [pendientes,setPendientes]=useState([emptyPend()]);
  const [expandedPends,setExpandedPends]=useState<Record<number,boolean>>({0:true});
  const toggleExpandPend=(i:number)=>setExpandedPends(p=>({...p,[i]:!p[i]}));
  const [expandedFTs,setExpandedFTs]=useState<Record<number,boolean>>({0:true});
  const toggleExpandFT=(i:number)=>setExpandedFTs(p=>({...p,[i]:!p[i]}));
  const pendCompleto=(p:any)=>!!(p.pendiente.trim()&&p.impacto&&p.urgencia&&p.responsable&&(p.responsable!=='Otro'||p.responsableOtro.trim())&&p.fechaHora&&p.estatus.trim());
  const [fineTuning,setFineTuning]=useState([emptyFT()]);
  const [horaEntrega,setHoraEntrega]=useState('');
  const [horaRecepcion,setHoraRecepcion]=useState('');
  const [cuerpoCorreo,setCuerpoCorreo]=useState('');
  // notas: string con separador |||
  const [notas,setNotas]=useState('');
  const [notasExpanded,setNotasExpanded]=useState<Record<number,boolean>>({0:true});
  // checklist collapsible
  const [checklistExpanded,setChecklistExpanded]=useState<Record<string,boolean>>({CHECK_INICIO:true,CHECK_CIERRE:true});
  const [destinosSel,setDestinosSel]=useState<string[]>(()=>CORREOS_PRINCIPALES.filter(c=>c.email!=='destinatario4@ejemplo.com').map(c=>c.email));
  const [ccSel,setCcSel]=useState<string[]>(()=>CORREOS_COMPANEROS.map(c=>c.email));
  const [correoExtraTo,setCorreoExtraTo]=useState('');
  const [correoExtraCc,setCorreoExtraCc]=useState('');
  const [correosExtraTo,setCorreosExtraTo]=useState([]);
  const [correosExtraCc,setCorreosExtraCc]=useState([]);
  const [seccion,setSeccion]=useState('encabezado');
  const [errores,setErrores]=useState([]);
  const [guardando,setGuardando]=useState(false);
  const [guardado,setGuardado]=useState(false);
  const [errorGuardado,setErrorGuardado]=useState('');
  const [copiado,setCopiado]=useState(false);
  const [reporte,setReporte]=useState(null);
  const [sinAlertas,setSinAlertas]=useState(false);
  const [enviandoCorreo,setEnviandoCorreo]=useState(false);
  const [correoExito,setCorreoExito]=useState(false);
  const [correoError,setCorreoError]=useState('');

  const soloNA=sinAlertas;
  const totalPor=(f)=>analistas.reduce((s,a)=>s+(parseInt(a[f])||0),0);
  const totalAlertas=totalPor('alertasCortex')+totalPor('ticketsJira')+totalPor('alertasMemcyco')+totalPor('alertasCrowdStrike');
  const slaEstado=(inc)=>{if(!inc.fechaHoraLlegada||!inc.fechaHoraEntrega)return null;const diff=(new Date(inc.fechaHoraEntrega)-new Date(inc.fechaHoraLlegada))/3600000;const limite=SLA_HORAS[inc.severidad]??4;if(diff>=limite)return'riesgo';if(diff>=limite*0.5)return'tardio';return'ok';};
  const slaRiesgo=sinAlertas?0:incidentes.filter(inc=>slaEstado(inc)==='riesgo').length;
  const metricasConValor=()=>[incConf,incCont,eventos,escalados].some(v=>parseInt(v)>0)||totalAlertas>0;
  const pctChecks=(ch)=>{const t=Object.keys(ch).length,m=Object.values(ch).filter(Boolean).length;return Math.round((m/t)*100);};
  const resumenCliente=()=>{const m={};analistas.forEach(a=>Object.entries(a.porCliente||{}).forEach(([k,v])=>{m[k]=(m[k]||0)+(parseInt(v)||0);}));return m;};
  const genCuerpo=(t,ent)=>{const to=TURNOS[(t??turno)];return`${to.saludo},\n\nSe comparte la bitácora de cambio de turno ${to.label.toLowerCase()} al analista ${(ent??entrante)||'[Analista]'}.\n\nQuedando atento/a a cualquier aclaración que pudiera surgir.\n\nSaludos,\n${saliente||'[Analista saliente]'}`;};
  const toggleCliente=(c)=>{setSinAlertas(false);setClientesSel(prev=>prev.includes(c)?prev.filter(x=>x!==c):[...prev,c]);};
  const toggleCheck=(setter,i)=>setter(p=>({...p,[i]:!p[i]}));
  const updA=(i,f,v)=>setAnalistas(p=>p.map((a,idx)=>idx===i?{...a,[f]:v}:a));
  const updApc=(i,c,v)=>setAnalistas(p=>p.map((a,idx)=>idx===i?{...a,porCliente:{...a.porCliente,[c]:v}}:a));
  const updInc=(i,f,v)=>setIncidentes(p=>p.map((x,idx)=>idx===i?{...x,[f]:v}:x));
  const updPend=(i,f,v)=>setPendientes(p=>p.map((x,idx)=>idx===i?{...x,[f]:v}:x));
  const updFT=(i,f,v)=>setFineTuning(p=>p.map((x,idx)=>idx===i?{...x,[f]:v}:x));
  const toggleDest=(e)=>setDestinosSel(p=>p.includes(e)?p.filter(x=>x!==e):[...p,e]);
  const toggleCc=(e)=>setCcSel(p=>p.includes(e)?p.filter(x=>x!==e):[...p,e]);
  const addExtraTo=()=>{if(correoExtraTo.trim()&&!correosExtraTo.includes(correoExtraTo.trim())){setCorreosExtraTo(p=>[...p,correoExtraTo.trim()]);setDestinosSel(p=>[...p,correoExtraTo.trim()]);}setCorreoExtraTo('');};
  const addExtraCc=()=>{if(correoExtraCc.trim()&&!correosExtraCc.includes(correoExtraCc.trim())){setCorreosExtraCc(p=>[...p,correoExtraCc.trim()]);setCcSel(p=>[...p,correoExtraCc.trim()]);}setCorreoExtraCc('');};
  const allDestinosOpts=[...CORREOS_PRINCIPALES,...correosExtraTo.map(e=>({email:e,nombre:e.split('@')[0]}))];
  const allCcOpts=[...CORREOS_COMPANEROS,...correosExtraCc.map(e=>({email:e,nombre:e.split('@')[0]}))];
  const toFinal=destinosSel.join('; ');
  const ccFinal=ccSel.join(', ');
  const buildAsunto=()=>`BITÁCORA CAMBIO DE TURNO - ${TURNOS[turno].label.toUpperCase()} ${fecha}`;

  // helper para notas en PDF/Sheets
  const notasParaExportar=()=>notas.split('|||').filter(Boolean).map((n,i)=>`Nota ${i+1}: ${n.trim()}`).join('\n\n');

  const validar=()=>{
    const errs=[];
    if(!fecha)errs.push('Encabezado: falta la fecha.');
    if(!saliente.trim())errs.push('Encabezado: falta el analista saliente.');
    if(!entrante.trim())errs.push('Encabezado: falta el analista entrante.');
    if(!supervisor.trim())errs.push('Encabezado: falta el supervisor/líder.');
    if(clientesSel.length===0&&!sinAlertas)errs.push('Encabezado: selecciona al menos un cliente o marca Sin alertas.');
    if(pctChecks(checksI)<50)errs.push('Checklist: marca al menos el 50% de inicio de turno.');
    if(pctChecks(checksC)<50)errs.push('Checklist: marca al menos el 50% de cierre de turno.');
    if(!soloNA&&metricasConValor()){
      const vacios=incidentes.filter(inc=>!inc.id.trim());
      if(incidentes.length===1&&vacios.length===1)errs.push('Debes registrar al menos un ticket.');
      else incidentes.forEach((inc,i)=>{
        if(!inc.id.trim())errs.push(`Ticket #${i+1}: falta el ID/Case.`);
        if(!inc.cliente)errs.push(`Ticket #${i+1}: falta el cliente.`);
        if(!inc.fechaHoraLlegada)errs.push(`Ticket #${i+1}: falta la fecha/hora de llegada.`);
      });
    }
    if(!horaEntrega)errs.push('Confirmación: falta la hora de entrega.');
    if(!horaRecepcion)errs.push('Confirmación: falta la hora de recepción.');
    return errs;
  };

  const buildReporteData=()=>({
    fecha,turno:TURNOS[turno].label,horario:TURNOS[turno].hora,clientes:clientesSel,
    analistaSaliente:saliente,analistaEntrante:entrante,supervisor,canal,
    checkInicioPorc:pctChecks(checksI),checkCierrePorc:pctChecks(checksC),
    totalAlertas,cortex:totalPor('alertasCortex'),jira:totalPor('ticketsJira'),
    memcyco:totalPor('alertasMemcyco'),crowdstrike:totalPor('alertasCrowdStrike'),
    incidentesConfirmados:parseInt(incConf)||0,incidentesContenidos:parseInt(incCont)||0,
    eventosSospechosos:parseInt(eventos)||0,escalados:parseInt(escalados)||0,
    slaRiesgo,notasGenerales:notasParaExportar(),entregadoPor:saliente,recibidoPor:entrante,
    horaEntrega,horaRecepcion,
    analistas:analistas.filter(a=>a.nombre.trim()).map(a=>({nombre:a.nombre,cortex:parseInt(a.alertasCortex)||0,jira:parseInt(a.ticketsJira)||0,memcyco:parseInt(a.alertasMemcyco)||0,crowdstrike:parseInt(a.alertasCrowdStrike)||0,porCliente:a.porCliente})),
    alertasPorCliente:resumenCliente(),
    incidentes:sinAlertas?[]:incidentes.map(inc=>({...inc})),
    pendientes:pendientes.filter(p=>p.pendiente&&p.pendiente.trim()).map(p=>({pendiente:p.pendiente,impacto:p.impacto,urgencia:p.urgencia,responsable:p.responsable,responsableOtro:p.responsableOtro||'',fechaHora:p.fechaHora,estatus:p.estatus,comentarios:p.comentarios||'',evidencias:(p.evidencias||[]).filter((ev:any)=>ev.driveUrl&&!ev.uploading&&!ev.error).map((ev:any)=>ev.driveUrl).join(', ')})),
    fineTuning:fineTuning.filter(f=>f.regla&&f.regla.trim()).map(f=>({regla:f.regla,fuente:f.fuente,volumen:f.volumen,descripcion:f.descripcion,repetitivo:f.repetitivo,recomendacion:f.recomendacion,accion:f.accion,aprobacion:f.aprobacion,notas:f.notas})),
  });

  const generarReporte=()=>{
    const errs=validar();
    if(errs.length>0){setErrores(errs);setSeccion('errores');return;}
    setErrores([]);
    if(!cuerpoCorreo)setCuerpoCorreo(genCuerpo(turno,entrante));
    setReporte(buildReporteData());
    setSeccion('reporte');
  };

  const BITACORA_CSS=`
.bpdf h2{font-size:12px;font-weight:bold;color:#fff;background:#0D1630;padding:6px 10px;margin:14px 0 6px;border-radius:4px}
.bpdf table{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:10px}
.bpdf th{background:#0D1630;color:#fff;padding:5px 8px;text-align:left}
.bpdf td{padding:4px 8px;border-bottom:1px solid #e0e7ff}
.bpdf .header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #2563EB;padding-bottom:12px;margin-bottom:16px}
.bpdf .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
.bpdf .label{font-size:9px;color:#555;text-transform:uppercase}
.bpdf .value{font-weight:bold}
.bpdf .firma{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:16px}
.bpdf .firma-box{border-top:1px solid #333;padding-top:4px;font-size:9px;color:#555;text-align:center}
.bpdf .footer{margin-top:20px;padding-top:10px;border-top:1px solid #ccc;font-size:9px;color:#888;text-align:center}`;

  const buildBitacoraBody=()=>{
    const t=TURNOS[turno];
    const notasHTML=notas?notas.split('|||').filter(Boolean).map((n,i)=>`<strong>Nota ${i+1}:</strong> ${n.trim()}`).join('<br/><br/>'):null;
    const H2='display:block;font-size:12px;font-weight:bold;color:#fff;background:#0D1630;padding:6px 10px;margin:14px 0 6px;border-radius:4px';
    const TH='background:#0D1630;color:#fff;padding:5px 8px;text-align:left;font-size:10px;font-weight:bold';
    const TD='padding:4px 8px;border-bottom:1px solid #e0e7ff;font-size:10px;color:#1a1a2e';
    const TDhi='padding:4px 8px;border-bottom:1px solid #e0e7ff;font-size:10px;color:#1a1a2e;background:#f0f4ff';
    const LBL='font-size:9px;color:#555;text-transform:uppercase;margin-bottom:2px';
    const VAL='font-weight:bold;font-size:10px;color:#1a1a2e';
    return `
<table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:3px solid #2563EB;padding-bottom:12px;margin-bottom:16px">
  <tr>
    <td>${LOGO_URL?`<img src="${LOGO_URL}" style="height:50px" crossorigin="anonymous"/>`:''}</td>
    <td style="text-align:right;vertical-align:middle">
      <div style="font-size:14px;font-weight:bold">Bitácora de Cambio de Turno – SOC</div>
      <div style="font-size:10px;color:#555">${t.label} | ${t.hora} | ${fecha}</div>
    </td>
  </tr>
</table>
<span style="${H2}">Encabezado</span>
<table width="100%" cellpadding="0" cellspacing="4" style="margin-bottom:10px">
  <tr>
    <td width="50%" style="padding:3px 4px"><div style="${LBL}">Clientes</div><div style="${VAL}">${reporte.clientes.join(', ')||'—'}</div></td>
    <td width="50%" style="padding:3px 4px"><div style="${LBL}">Supervisor</div><div style="${VAL}">${supervisor||'—'}</div></td>
  </tr>
  <tr>
    <td width="50%" style="padding:3px 4px"><div style="${LBL}">Saliente</div><div style="${VAL}">${saliente||'—'}</div></td>
    <td width="50%" style="padding:3px 4px"><div style="${LBL}">Entrante</div><div style="${VAL}">${entrante||'—'}</div></td>
  </tr>
  <tr>
    <td width="50%" style="padding:3px 4px"><div style="${LBL}">Canal</div><div style="${VAL}">${canal||'—'}</div></td>
    <td width="50%" style="padding:3px 4px"><div style="${LBL}">Check Inicio / Cierre</div><div style="${VAL}">${pctChecks(checksI)}% / ${pctChecks(checksC)}%</div></td>
  </tr>
</table>
<span style="${H2}">Métricas</span>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:10px">
  <thead><tr>
    <th style="${TH}">Herramienta</th><th style="${TH}">Total</th>
    <th style="${TH}">Inc. Confirmados</th><th style="${TH}">Inc. Contenidos</th>
    <th style="${TH}">Eventos Sosp.</th><th style="${TH}">Escalados</th>
  </tr></thead>
  <tbody>
    <tr><td style="${TD}">Cortex</td><td style="${TD}">${reporte.cortex}</td><td rowspan="4" style="${TD};vertical-align:middle;text-align:center">${reporte.incidentesConfirmados}</td><td rowspan="4" style="${TD};vertical-align:middle;text-align:center">${reporte.incidentesContenidos}</td><td rowspan="4" style="${TD};vertical-align:middle;text-align:center">${reporte.eventosSospechosos}</td><td rowspan="4" style="${TD};vertical-align:middle;text-align:center">${reporte.escalados}</td></tr>
    <tr><td style="${TD}">Jira</td><td style="${TD}">${reporte.jira}</td></tr>
    <tr><td style="${TD}">Memcyco</td><td style="${TD}">${reporte.memcyco}</td></tr>
    <tr><td style="${TD}">CrowdStrike</td><td style="${TD}">${reporte.crowdstrike}</td></tr>
    <tr><td style="${TDhi}"><strong>Total alertas</strong></td><td style="${TDhi}"><strong>${reporte.totalAlertas}</strong></td><td colspan="4" style="${TDhi}"></td></tr>
  </tbody>
</table>
${soloNA?'<p style="font-style:italic;color:#555;border-left:3px solid #2563EB;padding-left:8px;font-size:10px">No hubo alertas que reportar durante este turno.</p>':metricasConValor()&&reporte.incidentes&&reporte.incidentes.length>0?`
<span style="${H2}">Tickets</span>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:10px">
  <thead><tr><th style="${TH}">#</th><th style="${TH}">ID</th><th style="${TH}">Cliente</th><th style="${TH}">Severidad</th><th style="${TH}">Fuente</th><th style="${TH}">Estatus</th><th style="${TH}">Razón seguimiento</th><th style="${TH}">Clasificación</th><th style="${TH}">Llegada</th><th style="${TH}">Entrega</th></tr></thead>
  <tbody>${reporte.incidentes.map((inc,i)=>`<tr><td style="${TD}">${i+1}</td><td style="${TD}">${inc.id||'—'}</td><td style="${TD}">${inc.cliente||'—'}</td><td style="${TD}">${inc.severidad}</td><td style="${TD}">${inc.fuente||'—'}</td><td style="${TD}">${inc.estatus}</td><td style="${TD}">${inc.seguimientoRazon||'—'}</td><td style="${TD}">${inc.clasificacion||'—'}</td><td style="${TD}">${inc.fechaHoraLlegada?new Date(inc.fechaHoraLlegada).toLocaleString('es-MX'):'—'}</td><td style="${TD}">${inc.fechaHoraEntrega?new Date(inc.fechaHoraEntrega).toLocaleString('es-MX'):'—'}</td></tr>`).join('')}</tbody>
</table>`:''}
${reporte.pendientes&&reporte.pendientes.some(p=>p.pendiente)?`
<span style="${H2}">Pendientes</span>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:10px">
  <thead><tr><th style="${TH}">#</th><th style="${TH}">Descripción</th><th style="${TH}">Impacto</th><th style="${TH}">Urgencia</th><th style="${TH}">Responsable</th><th style="${TH}">Estatus</th></tr></thead>
  <tbody>${reporte.pendientes.filter(p=>p.pendiente).map((p,i)=>`<tr><td style="${TD}">${i+1}</td><td style="${TD}">${p.pendiente}</td><td style="${TD}">${p.impacto||'—'}</td><td style="${TD}">${p.urgencia}</td><td style="${TD}">${p.responsable==='Otro'?(p.responsableOtro||'Otro'):p.responsable}</td><td style="${TD}">${p.estatus||'—'}</td></tr>`).join('')}</tbody>
</table>`:''}
${notasHTML?`<span style="${H2}">Notas generales</span><p style="font-size:10px;line-height:1.6;padding:0 4px">${notasHTML}</p>`:''}
<span style="${H2}">Confirmación de entrega</span>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px">
  <tr>
    <td width="50%" style="border-top:1px solid #333;padding-top:6px;font-size:9px;color:#555;text-align:center;padding-right:10px">
      <strong>${saliente||'—'}</strong><br>Analista Saliente · ${horaEntrega||'—'}
    </td>
    <td width="50%" style="border-top:1px solid #333;padding-top:6px;font-size:9px;color:#555;text-align:center;padding-left:10px">
      <strong>${entrante||'—'}</strong><br>Analista Entrante · ${horaRecepcion||'—'}
    </td>
  </tr>
</table>
<div style="margin-top:20px;padding-top:10px;border-top:1px solid #ccc;font-size:9px;color:#888;text-align:center">Bitácora SOC | ${new Date().toLocaleString('es-MX')}</div>`;
  };

  const buildBitacoraHTML=()=>`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Bitácora SOC</title><style>body{font-family:Arial,sans-serif;color:#1a1a2e;font-size:11px;margin:0;padding:0;background:#fff}${BITACORA_CSS.replace(/\.bpdf /g,'')}</style></head><body style="margin:0;padding:0;background:#fff"><div id="bpdf-root" class="bpdf" style="background:#fff;padding:20px;font-family:Arial,sans-serif;font-size:11px;color:#1a1a2e">${buildBitacoraBody()}</div></body></html>`;

  const descargarPDF=()=>{if(!reporte)return;const w=window.open('','_blank');if(!w)return;w.document.write(buildBitacoraHTML());w.document.close();w.focus();setTimeout(()=>w.print(),600);};

  const enviarTodo=async()=>{
    if(!reporte)return;
    if(!toFinal){setCorreoError('Selecciona al menos un destinatario.');return;}
    setCorreoExito(false);setCorreoError('');setErrorGuardado('');setEnviandoCorreo(true);setGuardando(true);
    await new Promise(r=>setTimeout(r,50));
    // Iframe approach: the iframe has its own document with its own stylesheet,
    // so CSS renders correctly and the main app's dark theme doesn't bleed in.
    const pdfIframe=document.createElement('iframe');
    pdfIframe.style.cssText='position:absolute;left:-9999px;top:0;width:794px;height:1px;border:none';
    document.body.appendChild(pdfIframe);
    pdfIframe.contentDocument!.open();
    pdfIframe.contentDocument!.write(buildBitacoraHTML());
    pdfIframe.contentDocument!.close();
    await new Promise(r=>setTimeout(r,500));
    const pdfRoot=pdfIframe.contentDocument!.getElementById('bpdf-root')||pdfIframe.contentDocument!.body;
    pdfIframe.style.height=pdfRoot.scrollHeight+'px';
    await new Promise(r=>setTimeout(r,100));
    let pdfBase64:string='';let pdfError:string='';
    try{
      const blob:Blob=await html2pdf().set({margin:10,filename:'Bitacora_SOC.pdf',image:{type:'jpeg',quality:0.95},html2canvas:{scale:2,logging:false,useCORS:true,windowWidth:794},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}}).from(pdfRoot).output('blob');
      if(!blob||blob.size<500)throw new Error('PDF generado está vacío o corrupto');
      pdfBase64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve((reader.result as string).split(',')[1]);reader.onerror=()=>reject(new Error('Error al leer el PDF'));reader.readAsDataURL(blob);});
    }catch(e:any){pdfError=e?.message||'Error generando PDF';}
    finally{document.body.removeChild(pdfIframe);}
    const tareaCorreo=pdfError?Promise.reject(new Error('No se pudo generar el PDF: '+pdfError)):fetch('/.netlify/functions/enviar-bitacora',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:toFinal,cc:ccFinal,subject:buildAsunto(),text:cuerpoCorreo||genCuerpo(turno,entrante),pdfBase64})}).then(r=>{if(!r.ok)throw new Error('Falló el servidor al enviar el correo');});
    const tareaSheets=(async()=>{
      const pendientesLimpios=pendientes.filter((p:any)=>p.pendiente&&p.pendiente.trim()).map((p:any)=>({pendiente:p.pendiente,impacto:p.impacto,urgencia:p.urgencia,responsable:p.responsable,responsableOtro:p.responsableOtro||'',fechaHora:p.fechaHora,estatus:p.estatus,comentarios:p.comentarios||'',evidencias:(p.evidencias||[]).filter((ev:any)=>ev.driveUrl&&!ev.uploading&&!ev.error).map((ev:any)=>ev.driveUrl).join(', ')}));
      const fineTuningLimpios=fineTuning.filter((f:any)=>f.regla&&f.regla.trim()).map((f:any)=>({regla:f.regla,fuente:f.fuente,volumen:f.volumen,descripcion:f.descripcion,repetitivo:f.repetitivo,recomendacion:f.recomendacion,accion:f.accion,aprobacion:f.aprobacion,notas:f.notas}));
      const dataFinal={...reporte,pendientes:pendientesLimpios,fineTuning:fineTuningLimpios};
      const form=document.createElement('form');form.method='POST';form.action=APPS_SCRIPT_URL;form.target='hidden_iframe';form.style.display='none';
      const inp=document.createElement('input');inp.type='hidden';inp.name='data';inp.value=JSON.stringify(dataFinal);form.appendChild(inp);
      const iframe=document.createElement('iframe');iframe.name='hidden_iframe';iframe.style.display='none';
      document.body.appendChild(iframe);document.body.appendChild(form);form.submit();
      await new Promise(r=>setTimeout(r,6000));
      document.body.removeChild(form);document.body.removeChild(iframe);
    })();
    const [resCorreo,resSheets]=await Promise.allSettled([tareaCorreo,tareaSheets]);
    if(resCorreo.status==='fulfilled'){setCorreoExito(true);}else{setCorreoError('Error correo: '+((resCorreo as PromiseRejectedResult).reason?.message||'Error desconocido'));}
    if(resSheets.status==='fulfilled'){setGuardado(true);setTimeout(()=>setGuardado(false),4000);}else{setErrorGuardado('Error Sheets: '+((resSheets as PromiseRejectedResult).reason?.message||'Error desconocido'));}
    setEnviandoCorreo(false);setGuardando(false);
  };
  const enviarPorCorreoIntegrado=enviarTodo;
  const enviarCorreo=()=>{if(!toFinal)return;window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(toFinal)}${ccFinal?'&cc='+encodeURIComponent(ccFinal):''}&su=${encodeURIComponent(buildAsunto())}&body=${encodeURIComponent(cuerpoCorreo||genCuerpo(turno,entrante))}`,'_blank');};
  const copiarTexto=()=>navigator.clipboard.writeText(cuerpoCorreo||genCuerpo(turno,entrante)).then(()=>{setCopiado(true);setTimeout(()=>setCopiado(false),2000);});
  const nuevaBitacora=()=>{setReporte(null);setErrores([]);setGuardado(false);setErrorGuardado('');setSinAlertas(false);setClientesSel([]);setSeccion('encabezado');};

  const SECCIONES=['encabezado','checklist','metricas','incidentes','cierre','reporte','pendientes','finetuning'];
  const LABELS={encabezado:'Encabezado',checklist:'Checklist',metricas:'Métricas',incidentes:'Tickets',pendientes:'Pendientes',finetuning:'Fine Tuning',cierre:'Confirmación',reporte:'Reporte'};
  const Nav=({from,to})=>(<div style={{display:'flex',gap:8,marginTop:4}}>{from&&<button onClick={()=>setSeccion(from)} style={{...IPT,width:'auto',padding:'7px 16px',cursor:'pointer',color:C.textMuted}}>← Atrás</button>}{to&&<button onClick={()=>setSeccion(to)} style={{padding:'7px 20px',cursor:'pointer',background:C.accentDim,border:'none',color:'#fff',fontWeight:500,borderRadius:6,fontSize:13}}>Siguiente →</button>}</div>);
  const MetCard=({label,val,color})=>(<div style={{background:C.accentBg,border:`1px solid ${C.cardBorder}`,borderRadius:8,padding:'10px 8px',textAlign:'center'}}><div style={{fontSize:11,color:color||C.textMuted,marginBottom:2,textTransform:'uppercase',letterSpacing:'0.04em'}}>{label}</div><div style={{fontSize:22,fontWeight:500,color:color||C.text}}>{val}</div></div>);

  return(
    <>
      <style>{`.cal-scroll::-webkit-scrollbar{display:none}.cal-scroll{-ms-overflow-style:none;scrollbar-width:none}input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}input[type=number]{-moz-appearance:textfield}`}</style>
      <div style={{fontFamily:'var(--font-sans)',background:C.bg,minHeight:'100vh',padding:'0 0 2rem'}}>
        {/* Header */}
        <div style={{background:C.surface,borderBottom:`1px solid ${C.cardBorder}`,padding:'12px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',gap:16}}>
            <div style={{fontSize:20,fontWeight:500,color:C.text}}>Bitácora SOC</div>
            <button onClick={()=>{localStorage.removeItem('bitacora_token');localStorage.removeItem('bitacora_user');window.location.reload();}} style={{fontSize:11,padding:'4px 10px',borderRadius:6,border:`1px solid ${C.inputBorder}`,background:'transparent',color:C.textMuted,cursor:'pointer',transition:'all 0.2s'}} onMouseOver={e=>{e.currentTarget.style.borderColor='#EF4444';e.currentTarget.style.color='#EF4444';}} onMouseOut={e=>{e.currentTarget.style.borderColor=C.inputBorder;e.currentTarget.style.color=C.textMuted;}}>⏻ Cerrar sesión</button>
          </div>
          {LOGO_APP_URL&&<img src={LOGO_APP_URL} alt="" style={{height:44,width:'auto',objectFit:'contain'}}/>}
        </div>

        <div style={{padding:'0 16px'}}>
          {/* Nav pills */}
          <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:16}}>
            {SECCIONES.map(s=>{
              const encabezadoOk=clientesSel.length>0||sinAlertas;
              const bloqueado=(s!=='encabezado'&&!encabezadoOk)||(s==='incidentes'&&sinAlertas);
              const oculto=s==='reporte'&&!reporte;
              if(oculto)return null;
              return(<button key={s} onClick={()=>!bloqueado&&setSeccion(s)} title={bloqueado?'Completa el encabezado primero':''} style={{fontSize:11,padding:'4px 10px',borderRadius:20,border:seccion===s?`1px solid ${C.accent}`:bloqueado?`1px solid ${C.textDim}`:`1px solid ${C.inputBorder}`,background:seccion===s?C.accentBg:C.inputBg,color:seccion===s?C.accent:bloqueado?C.textDim:C.textMuted,cursor:bloqueado?'not-allowed':'pointer',fontWeight:seccion===s?500:400,textTransform:'uppercase',letterSpacing:'0.04em',marginLeft:s==='pendientes'?'auto':'0',opacity:bloqueado?0.4:1}}>{LABELS[s]}</button>);
            })}
          </div>

          {/* ERRORES */}
          {seccion==='errores'&&(<div><div style={{...CARD,borderLeft:`3px solid ${C.danger}`}}><p style={{...H2S,color:C.danger}}>⚠️ Campos requeridos incompletos</p>{errores.map((e,i)=>(<div key={i} style={{display:'flex',gap:8,padding:'6px 0',borderBottom:`1px solid ${C.cardBorder}`}}><span style={{color:C.danger}}>✕</span><span style={{fontSize:13,color:C.text}}>{e}</span></div>))}</div><button onClick={()=>setSeccion('encabezado')} style={{...IPT,width:'auto',padding:'7px 16px',cursor:'pointer',color:C.textMuted}}>← Volver al formulario</button></div>)}

          {/* ENCABEZADO */}
          {seccion==='encabezado'&&(
            <div>
              <div style={CARD}>
                <p style={H2S}>🛡️ Encabezado del turno</p>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                  <CustomDatePicker value={fecha} onChange={setFecha} label="Fecha" required/>
                  <CSelect value={String(turno)} onChange={v=>{const t=+v;setTurno(t);if(cuerpoCorreo)setCuerpoCorreo(genCuerpo(t,entrante));}} label="Turno *" options={TURNOS.map((t,i)=>({value:String(i),label:`${t.label} — ${t.hora}`}))}/>
                  <CSelect value={saliente} onChange={setSaliente} label="Analista saliente *" options={ANALISTAS_LIST}/>
                  <CSelect value={entrante} onChange={setEntrante} label="Analista entrante *" options={ANALISTAS_LIST}/>
                  <CSelect value={supervisor} onChange={setSupervisor} label="Supervisor / Líder / T2 *" options={SUPERVISORES_LIST}/>
                  <CSelect value={canal} onChange={setCanal} label="Canal de comunicación *" options={CANALES}/>
                </div>
                <div>
                  <label style={LBL}>Clientes cubiertos *</label>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:6}}>
                    {CLIENTES_HEADER.map(c=>{const cl=CLIENTE_COLORS[c]||{color:C.accent,bg:C.accentBg,border:C.accent};const sel=clientesSel.includes(c);return(<button key={c} onClick={()=>toggleCliente(c)} style={{padding:'4px 14px',borderRadius:20,fontSize:12,border:`1.5px solid ${sel?cl.border:C.inputBorder}`,background:sel?cl.bg:C.inputBg,color:sel?cl.color:C.textMuted,cursor:'pointer',fontWeight:sel?600:400,transition:'all 0.15s'}}>{c}</button>);})}
                  </div>
                  <div style={{marginTop:10,display:'flex',alignItems:'center',gap:10}}>
                    <button onClick={()=>{setSinAlertas(s=>{if(!s)setClientesSel([]);return!s;});}} style={{padding:'6px 18px',borderRadius:20,fontSize:12,border:`1.5px solid ${sinAlertas?'#F59E0B':C.inputBorder}`,background:sinAlertas?'#2D1A02':C.inputBg,color:sinAlertas?'#F59E0B':C.textMuted,cursor:'pointer',fontWeight:sinAlertas?600:400,transition:'all 0.15s',display:'flex',alignItems:'center',gap:6}}>
                      {sinAlertas?'✓':''} 🔕 Sin alertas este turno
                    </button>
                    {sinAlertas&&<span style={{fontSize:11,color:'#F59E0B',fontStyle:'italic'}}>Se omitirán Métricas y Tickets</span>}
                  </div>
                  {!(clientesSel.length>0||sinAlertas)&&<div style={{marginTop:8,fontSize:11,color:C.danger}}>⚠ Selecciona al menos un cliente o marca "Sin alertas" para continuar.</div>}
                </div>
              </div>
              <div style={{display:'flex',gap:8,marginTop:4}}>
                <button onClick={()=>setSeccion('checklist')} disabled={!(clientesSel.length>0||sinAlertas)} style={{padding:'7px 20px',cursor:clientesSel.length>0||sinAlertas?'pointer':'not-allowed',background:clientesSel.length>0||sinAlertas?C.accentDim:'#1A2848',border:'none',color:'#fff',fontWeight:500,borderRadius:6,fontSize:13,opacity:clientesSel.length>0||sinAlertas?1:0.45}}>Siguiente →</button>
              </div>
            </div>
          )}

          {/* CHECKLIST — con retracción */}
          {seccion==='checklist'&&(
            <div>
              {[['CHECK_INICIO','☀️','Inicio de Turno',CHECK_INICIO,checksI,setChecksI,'#F59E0B','rgba(245,158,11,0.12)'],['CHECK_CIERRE','🌙','Cierre de Turno',CHECK_CIERRE,checksC,setChecksC,'#7B8FD4','rgba(123,143,212,0.12)']].map(([key,icon,title,items,checks,setter,acColor,acBg])=>(
                <div key={key} style={{...CARD,borderTop:`3px solid ${acColor}`}}>
                  <div onClick={()=>setChecklistExpanded(p=>({...p,[key]:!p[key]}))} style={{display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',userSelect:'none',marginBottom:checklistExpanded[key]!==false?14:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <span onClick={e=>{e.stopPropagation();setter(Object.fromEntries(items.map((_,i)=>[i,true])));setChecklistExpanded(p=>({...p,[key]:true}));}} style={{fontSize:28,lineHeight:1,cursor:'pointer'}} title="Marcar todo">{icon}</span>
                      <div>
                        <p style={{fontSize:15,fontWeight:600,color:acColor,margin:0}}>{title}</p>
                        <p style={{fontSize:11,color:C.textMuted,margin:'2px 0 0',textTransform:'uppercase',letterSpacing:'0.06em'}}>{Object.values(checks).filter(Boolean).length} / {items.length} completados</p>
                      </div>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <span style={{fontSize:18,fontWeight:700,color:pctChecks(checks)>=50?C.success:C.danger}}>{pctChecks(checks)}%</span>
                      <div style={{width:60,height:5,borderRadius:3,background:'#1A2848',overflow:'hidden'}}><div style={{height:'100%',width:`${pctChecks(checks)}%`,background:pctChecks(checks)>=50?C.success:C.danger,borderRadius:3,transition:'width 0.3s'}}/></div>
                      <span style={{fontSize:11,color:C.textDim,display:'inline-block',transform:checklistExpanded[key]!==false?'rotate(180deg)':'rotate(0)',transition:'transform 0.2s'}}>▼</span>
                    </div>
                  </div>
                  {checklistExpanded[key]!==false&&(
                    <div style={{background:acBg,borderRadius:8,overflow:'hidden',border:`1px solid ${acColor}22`}}>
                      {items.map((item,i)=>(<div key={i} style={{borderBottom:i<items.length-1?`1px solid ${acColor}22`:'none'}}><CircleCheck checked={!!checks[i]} onChange={()=>toggleCheck(setter,i)} label={item}/></div>))}
                    </div>
                  )}
                </div>
              ))}
              <Nav from="encabezado" to={sinAlertas?"pendientes":"metricas"}/>
            </div>
          )}

          {/* MÉTRICAS */}
          {seccion==='metricas'&&(
            <div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:10}}><MetCard label="Cortex" val={totalPor('alertasCortex')} color="#3B82F6"/><MetCard label="Jira" val={totalPor('ticketsJira')} color="#10B981"/><MetCard label="Memcyco" val={totalPor('alertasMemcyco')} color="#F59E0B"/><MetCard label="CrowdStrike" val={totalPor('alertasCrowdStrike')} color="#EC4899"/></div>
              <div style={{background:C.accentBg,border:`1px solid ${C.accent}`,borderRadius:10,padding:'10px 16px',marginBottom:14,display:'flex',alignItems:'center',justifyContent:'space-between'}}><span style={{fontSize:13,color:C.accent,textTransform:'uppercase',letterSpacing:'0.05em'}}>Total alertas revisadas</span><span style={{fontSize:26,fontWeight:500,color:C.accent}}>{totalAlertas}</span></div>
              {analistas.map((a,i)=>{
                const isOpen=expandedAnalistas[i]!==false;
                return(
                  <div key={i} style={{...CARD,padding:isOpen?'1rem 1.25rem':'0.6rem 1rem'}}>
                    <div onClick={()=>toggleExpandAnalista(i)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',userSelect:'none',marginBottom:isOpen?10:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{fontSize:12,color:C.textDim,display:'inline-block',transform:isOpen?'rotate(90deg)':'rotate(0deg)',transition:'transform 0.2s'}}>▶</span>
                        <p style={{fontSize:13,fontWeight:600,color:a.nombre?C.text:C.textMuted,margin:0}}>{a.nombre?`Analista SOC ${ANALISTAS_TIER2.includes(a.nombre)?'TIER 2':'TIER 1'} – ${a.nombre}`:`Analista ${i+1}`}</p>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        {!isOpen&&a.nombre&&<span style={{fontSize:11,color:C.textDim}}>Cortex {a.alertasCortex} · Jira {a.ticketsJira} · Memcyco {a.alertasMemcyco} · CS {a.alertasCrowdStrike}</span>}
                        {analistas.length>1&&<button onClick={e=>{e.stopPropagation();setAnalistas(p=>p.filter((_,idx)=>idx!==i));}} style={{fontSize:12,color:C.danger,background:'none',border:'none',cursor:'pointer',padding:0}}>Eliminar</button>}
                      </div>
                    </div>
                    {isOpen&&(<>
                      <div style={{marginBottom:4}}><CSelect value={a.nombre} onChange={v=>updA(i,'nombre',v)} label="Nombre del analista *" options={ANALISTAS_LIST}/></div>
                      <div style={{marginBottom:10,fontSize:11,color:C.textMuted,fontStyle:'italic',paddingLeft:2}}>Alertas revisadas durante el turno</div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:10}}>
                        <NumSpinner value={a.alertasCortex} onChange={v=>updA(i,'alertasCortex',v)} label="Cortex" labelColor="#3B82F6"/>
                        <NumSpinner value={a.ticketsJira} onChange={v=>updA(i,'ticketsJira',v)} label="Jira" labelColor="#10B981"/>
                        <NumSpinner value={a.alertasMemcyco} onChange={v=>updA(i,'alertasMemcyco',v)} label="Memcyco" labelColor="#F59E0B"/>
                        <NumSpinner value={a.alertasCrowdStrike} onChange={v=>updA(i,'alertasCrowdStrike',v)} label="CrowdStrike" labelColor="#EC4899"/>
                      </div>
                      {clientesSel.filter(c=>c!=='N/A').length>0&&(<div style={{marginTop:8}}><div style={{marginBottom:8,fontSize:11,color:C.textMuted,fontStyle:'italic',paddingLeft:2}}>Alertas entregadas en el turno por cliente</div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:8}}>{clientesSel.filter(c=>c!=='N/A').map(c=>{const cl=CLIENTE_COLORS[c]||{color:C.accent,bg:C.accentBg,border:C.accent};return(<div key={c} style={{background:cl.bg,border:`1px solid ${cl.border}`,borderRadius:8,padding:'10px 8px',textAlign:'center'}}><div style={{fontSize:11,color:cl.color,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.04em',fontWeight:600}}>{c}</div><input type="number" min="0" value={a.porCliente[c]||'0'} onChange={e=>updApc(i,c,e.target.value)} onFocus={e=>e.target.select()} style={{width:'100%',boxSizing:'border-box',textAlign:'center',fontSize:22,fontWeight:500,color:cl.color,background:'transparent',border:'none',outline:'none',padding:0}}/></div>);})}</div></div>)}
                    </>)}
                  </div>
                );
              })}
              <button onClick={()=>{setAnalistas(p=>[...p,emptyAna()]);setExpandedAnalistas(p=>({...Object.fromEntries(Object.keys(p).map(k=>[k,false])),[analistas.length]:true}));}} style={{padding:'6px 14px',marginBottom:12,cursor:'pointer',fontSize:13,color:C.accent,border:`1px solid ${C.accent}`,background:'transparent',borderRadius:6}}>+ Agregar analista</button>
              {(()=>{
                const metAdicionalesVacio=[incConf,incCont,eventos,escalados].every(v=>parseInt(v)===0);
                const metOpenEfectivo=metOpen||!metAdicionalesVacio;
                return(
                  <div style={CARD}>
                    <div onClick={()=>setMetOpen(o=>!o)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',userSelect:'none'}}>
                      <p style={{...H2S,marginBottom:0}}>📊 Métricas adicionales</p>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        {metAdicionalesVacio&&!metOpenEfectivo&&<span style={{fontSize:11,color:C.textDim,fontStyle:'italic'}}>todo en cero</span>}
                        {/* SLA en riesgo oculto en UI — se calcula internamente para Sheets */}
                        <span style={{color:C.textDim,fontSize:12,transform:metOpenEfectivo?'rotate(180deg)':'rotate(0deg)',transition:'transform 0.2s'}}>▼</span>
                      </div>
                    </div>
                    {metOpenEfectivo&&(<>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:12}}>
                        <NumSpinner value={incConf} onChange={setIncConf} label="Incidentes confirmados"/>
                        <NumSpinner value={incCont} onChange={setIncCont} label="Incidentes contenidos"/>
                        <NumSpinner value={eventos} onChange={setEventos} label="Eventos sospechosos"/>
                        <NumSpinner value={escalados} onChange={setEscalados} label="Escalados Tier 2 / Team Líder"/>
                      </div>
                      {/* Bloque SLA en riesgo oculto en UI — datos disponibles para Sheets */}
                    </>)}
                  </div>
                );
              })()}
              <Nav from="checklist" to="incidentes"/>
            </div>
          )}

          {/* INCIDENTES */}
          {seccion==='incidentes'&&(
            <div>
              {soloNA?(<div style={{...CARD,borderLeft:`3px solid ${C.accent}`,textAlign:'center',padding:'32px 24px'}}><div style={{fontSize:32,marginBottom:12}}>🔕</div><div style={{fontSize:15,color:C.text,fontWeight:500,marginBottom:8}}>Turno sin alertas</div><div style={{fontSize:13,color:C.textMuted,fontStyle:'italic'}}>No hubo alertas que reportar durante este turno.</div></div>):(
                <>
                  {metricasConValor()&&(<div style={{background:C.warnBg,border:`1px solid ${C.warn}`,borderRadius:8,padding:'8px 14px',marginBottom:12,fontSize:12,color:C.warn}}>⚠️ Hay métricas con valor — los tickets son obligatorios.</div>)}
                  {incidentes.map((inc,i)=>{
                    const completo=incCompleto(inc);const collapsed=completo&&i<incidentes.length-1;const expanded=!!expandedTickets[i];const isOpen=!collapsed||expanded;
                    const prefijo=ID_PREFIJOS[inc.cliente]||'';
                    const handleClienteChange=(v)=>{const np=ID_PREFIJOS[v]||'';const op=ID_PREFIJOS[inc.cliente]||'';const idActual=inc.id;const nuevoId=idActual===''||idActual===op?np:idActual.startsWith(op)?np+idActual.slice(op.length):idActual;updInc(i,'cliente',v);updInc(i,'id',nuevoId);};
                    return(
                      <div key={i} style={{...CARD,borderLeft:`3px solid ${sev(inc.severidad)}`,padding:isOpen?'1rem 1.25rem':'0.6rem 1rem'}}>
                        <div onClick={()=>collapsed&&toggleExpandTicket(i)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:6,cursor:collapsed?'pointer':'default',marginBottom:isOpen?10:0}}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            {collapsed&&<span style={{fontSize:12,color:C.textDim,transition:'transform 0.2s',display:'inline-block',transform:expanded?'rotate(90deg)':'rotate(0deg)'}}>▶</span>}
                            <span style={{fontSize:13,fontWeight:500,color:C.text}}>Ticket #{i+1}</span>
                            {inc.cliente&&<span style={{fontSize:11,padding:'1px 8px',borderRadius:12,background:CLIENTE_COLORS[inc.cliente]?.bg||C.accentBg,color:CLIENTE_COLORS[inc.cliente]?.color||C.accent,border:`1px solid ${CLIENTE_COLORS[inc.cliente]?.border||C.accent}`,fontWeight:600}}>{inc.cliente}</span>}
                            {inc.id&&<span style={{fontSize:11,color:C.textMuted}}>{inc.id}</span>}
                            {!isOpen&&completo&&<span style={{fontSize:10,padding:'1px 7px',borderRadius:10,background:C.successBg,color:C.success,border:`1px solid ${C.success}40`}}>✓ completo</span>}
                          </div>
                          <div style={{display:'flex',gap:6,alignItems:'center'}}>
                            {/* SLA badges ocultos en UI — se envían a Sheets */}
                            <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:sevBg(inc.severidad),color:sev(inc.severidad),fontWeight:500}}>{inc.severidad}</span>
                          </div>
                        </div>
                        {isOpen&&(
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                            <CSelect value={inc.analista} onChange={v=>updInc(i,'analista',v)} label="Analista que reporta" options={ANALISTAS_LIST}/>
                            <CSelect value={inc.cliente} onChange={v=>handleClienteChange(v)} label="Cliente *" options={CLIENTES_INC}/>
                            <div><label style={LBL}>ID Ticket / Case *</label><input value={inc.id} onChange={e=>updInc(i,'id',e.target.value)} style={{...IPT}} placeholder={prefijo||'INC-0001'}/></div>
                            <CSelect value={inc.severidad} onChange={v=>updInc(i,'severidad',v)} label="Severidad" options={SEVERIDADES}/>
                            <CSelect value={inc.fuente} onChange={v=>updInc(i,'fuente',v)} label="Fuente" options={FUENTES}/>
                            <NumSpinner value={inc.numEventos} onChange={v=>updInc(i,'numEventos',v)} label="Número de eventos" min={1}/>
                            <div><CustomDateTimePicker value={inc.fechaHoraLlegada} onChange={v=>updInc(i,'fechaHoraLlegada',v)} label="Fecha y hora de llegada" required/></div>
                            <div>
                              <CustomDateTimePicker value={inc.fechaHoraEntrega} onChange={v=>updInc(i,'fechaHoraEntrega',v)} label="Fecha y hora de entrega" minIso={inc.fechaHoraLlegada||undefined}/>
                              {/* Indicador ⏱ SLA oculto en UI — datos calculados para Sheets */}
                            </div>
                            <CSelect value={inc.estatus} onChange={v=>{updInc(i,'estatus',v);if(v!=='Cerrado'){updInc(i,'clasificacion','');updInc(i,'fechaHoraRetro','');updInc(i,'retroalimentacion','');}if(v!=='En seguimiento')updInc(i,'seguimientoRazon','');}} label="Estatus" options={ESTATUS_INC}/>
                            {inc.estatus==='En seguimiento'&&(<div style={{gridColumn:'1/-1'}}><CSelect value={inc.seguimientoRazon} onChange={v=>updInc(i,'seguimientoRazon',v)} label="Razón de seguimiento" options={['Bajo investigación','Actualización/Mantenimiento','Monitoreo/Prueba']} accentColor={C.warn}/></div>)}
                            {inc.estatus==='Cerrado'&&(<div style={{gridColumn:'1/-1'}}><CSelect value={inc.clasificacion} onChange={v=>updInc(i,'clasificacion',v)} label="Clasificación del cierre" options={['Falso Positivo','Verdadero Positivo','Benigno Positivo']} accentColor="#10B981"/></div>)}
                            {inc.estatus==='Cerrado'&&(<div style={{gridColumn:'1/-1',background:C.accentBg,borderRadius:8,padding:'10px 12px'}}><div style={{display:'grid',gap:8}}><CustomDateTimePicker value={inc.fechaHoraRetro} onChange={v=>updInc(i,'fechaHoraRetro',v)} label="Fecha y hora de retroalimentación"/><textarea value={inc.retroalimentacion} onChange={e=>updInc(i,'retroalimentacion',e.target.value)} rows={2} style={{...IPT,resize:'vertical'}} placeholder="Describe la retroalimentación..."/></div></div>)}
                            <div style={{gridColumn:'1/-1',display:'flex',justifyContent:'flex-end'}}>
                              {incidentes.length>1&&<button onClick={()=>setIncidentes(p=>p.filter((_,idx)=>idx!==i))} style={{fontSize:12,color:C.danger,background:'none',border:'none',cursor:'pointer',padding:0}}>Eliminar ticket</button>}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <button onClick={()=>{setIncidentes(p=>[...p,emptyInc()]);setExpandedTickets({});}} style={{padding:'6px 14px',marginBottom:12,cursor:'pointer',fontSize:13,color:C.accent,border:`1px solid ${C.accent}`,background:'transparent',borderRadius:6}}>+ Agregar ticket</button>
                </>
              )}
              <Nav from="metricas" to="pendientes"/>
            </div>
          )}

          {/* PENDIENTES */}
          {seccion==='pendientes'&&(
            <div>
              {pendientes.map((p,i)=>{
                const completo=pendCompleto(p);const isOpen=expandedPends[i]!==false;
                return(
                  <div key={i} style={{...CARD,padding:isOpen?'1rem 1.25rem':'0.6rem 1rem'}}>
                    <div onClick={()=>toggleExpandPend(i)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',userSelect:'none',marginBottom:isOpen?10:0,gap:8,flexWrap:'wrap'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{fontSize:12,color:C.textDim,display:'inline-block',transform:isOpen?'rotate(90deg)':'rotate(0deg)',transition:'transform 0.2s'}}>▶</span>
                        <span style={{fontSize:13,fontWeight:500,color:C.text}}>Pendiente #{i+1}</span>
                        {p.pendiente&&<span style={{fontSize:11,color:C.textMuted,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.pendiente}</span>}
                        {!isOpen&&completo&&<span style={{fontSize:10,padding:'1px 7px',borderRadius:10,background:C.successBg,color:C.success,border:`1px solid ${C.success}40`}}>✓ completo</span>}
                      </div>
                      <div style={{display:'flex',gap:6}}>
                        {p.urgencia&&<span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:p.urgencia==='Alta'?C.dangerBg:p.urgencia==='Media'?C.warnBg:C.successBg,color:p.urgencia==='Alta'?C.danger:p.urgencia==='Media'?C.warn:C.success,border:`1px solid ${p.urgencia==='Alta'?C.danger:p.urgencia==='Media'?C.warn:C.success}40`,fontWeight:500}}>{p.urgencia}</span>}
                        {p.responsable&&<span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:C.accentBg,color:C.accent,border:`1px solid ${C.accent}40`}}>{p.responsable==='Otro'?(p.responsableOtro||'Otro'):p.responsable}</span>}
                      </div>
                    </div>
                    {isOpen&&(
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                        <div style={{gridColumn:'1/-1'}}><label style={LBL}>Descripción *</label><input value={p.pendiente} onChange={e=>updPend(i,'pendiente',e.target.value)} style={{...IPT}} placeholder="¿Qué queda pendiente?"/></div>
                        <CSelect value={p.impacto} onChange={v=>updPend(i,'impacto',v)} label="Impacto *" options={IMPACTOS}/>
                        <CSelect value={p.urgencia} onChange={v=>updPend(i,'urgencia',v)} label="Urgencia *" options={URGENCIAS}/>
                        <CSelect value={p.responsable} onChange={v=>updPend(i,'responsable',v)} label="Responsable *" options={RESPONSABLES_BASE}/>
                        <CustomDateTimePicker value={p.fechaHora} onChange={v=>updPend(i,'fechaHora',v)} label="Fecha y hora compromiso *"/>
                        {p.responsable==='Otro'&&(<div style={{gridColumn:'1/-1'}}><label style={LBL}>Especificar responsable *</label><input value={p.responsableOtro} onChange={e=>updPend(i,'responsableOtro',e.target.value)} style={{...IPT}} placeholder="Nombre o área"/></div>)}
                        <div><label style={LBL}>Estatus *</label><input value={p.estatus} onChange={e=>updPend(i,'estatus',e.target.value)} style={{...IPT}} placeholder="En espera, en proceso..."/></div>
                        <div style={{gridColumn:'1/-1'}}><label style={LBL}>Comentarios</label><input value={p.comentarios||''} onChange={e=>updPend(i,'comentarios',e.target.value)} style={{...IPT}} placeholder="Información adicional..."/></div>
                        <div style={{gridColumn:'1/-1'}}>
                          <FileInput pendIdx={i} evidencias={p.evidencias||[]} fecha={fecha} turnoLabel={TURNOS[turno].label}
                            onUploadStart={(tmpId,name)=>updPend(i,'evidencias',[...(p.evidencias||[]),{tmpId,name,uploading:true}])}
                            onUploadDone={(tmpId,result,err)=>updPend(i,'evidencias',(p.evidencias||[]).map(ev=>ev.tmpId===tmpId?{...ev,uploading:false,driveUrl:result?.driveUrl||null,name:result?.name||ev.name,error:err||null}:ev))}
                            onRemove={j=>updPend(i,'evidencias',(p.evidencias||[]).filter((_,k)=>k!==j))}/>
                        </div>
                        <div style={{gridColumn:'1/-1',display:'flex',justifyContent:'flex-end'}}>
                          {pendientes.length>1&&<button onClick={()=>setPendientes(prev=>prev.filter((_,idx)=>idx!==i))} style={{fontSize:12,color:C.danger,background:'none',border:'none',cursor:'pointer',padding:0}}>Eliminar pendiente</button>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <button onClick={()=>{setPendientes(p=>[...p,emptyPend()]);setExpandedPends(p=>({...Object.fromEntries(Object.keys(p).map(k=>[k,false])),[pendientes.length]:true}));}} style={{padding:'6px 14px',marginBottom:12,cursor:'pointer',fontSize:13,color:C.accent,border:`1px solid ${C.accent}`,background:'transparent',borderRadius:6}}>+ Agregar pendiente</button>
              <Nav from="incidentes" to="finetuning"/>
            </div>
          )}

          {/* FINE TUNING */}
          {seccion==='finetuning'&&(
            <div>
              <p style={{fontSize:12,color:C.textMuted,marginBottom:12,fontStyle:'italic'}}>Sección opcional. Puedes dejarla vacía si no hay ruido que reportar.</p>
              {fineTuning.map((f,i)=>{
                const ftOpen=expandedFTs[i]!==false;
                return(
                  <div key={i} style={{...CARD,padding:ftOpen?'1rem 1.25rem':'0.6rem 1rem'}}>
                    <div onClick={()=>toggleExpandFT(i)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',userSelect:'none',marginBottom:ftOpen?10:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{fontSize:12,color:C.textDim,display:'inline-block',transform:ftOpen?'rotate(90deg)':'rotate(0deg)',transition:'transform 0.2s'}}>▶</span>
                        <p style={{fontSize:13,fontWeight:500,color:C.text,margin:0}}>{f.regla||`Regla #${i+1}`}</p>
                        {!ftOpen&&f.fuente&&<span style={{fontSize:11,color:C.textMuted}}>{f.fuente}</span>}
                      </div>
                      {fineTuning.length>1&&<button onClick={e=>{e.stopPropagation();setFineTuning(p=>p.filter((_,idx)=>idx!==i));}} style={{fontSize:12,color:C.danger,background:'none',border:'none',cursor:'pointer',padding:0}}>Eliminar</button>}
                    </div>
                    {ftOpen&&(
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                        <div><label style={LBL}>Regla</label><input value={f.regla} onChange={e=>updFT(i,'regla',e.target.value)} style={{...IPT}} placeholder="Nombre de la regla"/></div>
                        <CSelect value={f.fuente} onChange={v=>updFT(i,'fuente',v)} label="Fuente" options={FUENTES}/>
                        <div><label style={LBL}>Volumen</label><input value={f.volumen} onChange={e=>updFT(i,'volumen',e.target.value)} style={{...IPT}} placeholder="# eventos"/></div>
                        <CSelect value={f.repetitivo} onChange={v=>updFT(i,'repetitivo',v)} label="¿Repetitivo?" options={['Sí','No']}/>
                        <div style={{gridColumn:'1/-1'}}><label style={LBL}>Descripción</label><input value={f.descripcion} onChange={e=>updFT(i,'descripcion',e.target.value)} style={{...IPT}} placeholder="¿Qué genera el ruido?"/></div>
                        <CSelect value={f.recomendacion} onChange={v=>updFT(i,'recomendacion',v)} label="Recomendación" options={RECOMENDACIONES}/>
                        <div><label style={LBL}>Acción realizada</label><input value={f.accion} onChange={e=>updFT(i,'accion',e.target.value)} style={{...IPT}} placeholder="Acción ejecutada"/></div>
                        <CSelect value={f.aprobacion} onChange={v=>updFT(i,'aprobacion',v)} label="Aprobación cliente" options={['Sí','No']}/>
                        <div><label style={LBL}>Notas</label><input value={f.notas} onChange={e=>updFT(i,'notas',e.target.value)} style={{...IPT}} placeholder="Observaciones"/></div>
                      </div>
                    )}
                  </div>
                );
              })}
              <button onClick={()=>{setFineTuning(p=>[...p,emptyFT()]);setExpandedFTs(p=>({...Object.fromEntries(Object.keys(p).map(k=>[k,false])),[fineTuning.length]:true}));}} style={{padding:'6px 14px',marginBottom:12,cursor:'pointer',fontSize:13,color:C.accent,border:`1px solid ${C.accent}`,background:'transparent',borderRadius:6}}>+ Agregar regla</button>
              <Nav from="pendientes" to="cierre"/>
            </div>
          )}

          {/* CIERRE */}
          {seccion==='cierre'&&(
            <div>
              {/* Notas generales — múltiples, retráctiles */}
              <div style={CARD}>
                <p style={H2S}>📝 Notas generales</p>
                <NotasBlock notas={notas} setNotas={setNotas} notasExpanded={notasExpanded} setNotasExpanded={setNotasExpanded}/>
              </div>
              <div style={CARD}>
                <p style={H2S}>🤝 Confirmación de entrega</p>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div style={{padding:'10px 14px',borderRadius:8,background:C.accentBg,border:`1px solid ${C.cardBorder}`,gridColumn:'1/-1'}}>
                    <div style={{fontSize:11,color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:8}}>Confirmación de analistas</div>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}>
                      <span><span style={{color:C.textMuted}}>Saliente: </span><strong style={{color:C.text}}>{saliente||'—'}</strong></span>
                      <span><span style={{color:C.textMuted}}>Entrante: </span><strong style={{color:C.text}}>{entrante||'—'}</strong></span>
                    </div>
                  </div>
                  <CustomTimePicker value={horaEntrega} onChange={setHoraEntrega} label="Hora de entrega" required/>
                  <CustomTimePicker value={horaRecepcion} onChange={setHoraRecepcion} label="Hora de recepción" required/>
                </div>
              </div>
              <div style={CARD}>
                <p style={H2S}>📧 Cuerpo del correo</p>
                <textarea value={cuerpoCorreo||genCuerpo(turno,entrante)} onChange={e=>setCuerpoCorreo(e.target.value)} rows={7} style={{...IPT,resize:'vertical',fontFamily:'var(--font-mono)',fontSize:12,lineHeight:1.7}}/>
                <p style={{fontSize:11,color:C.textDim,marginTop:6}}>Se ajusta automáticamente según el turno y los analistas.</p>
                <div style={{marginTop:12}}>
                  <label style={LBL}>Para:</label>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:4,marginBottom:6}}>{allDestinosOpts.map(({email,nombre})=>(<button key={email} onClick={()=>toggleDest(email)} style={{...pill(destinosSel.includes(email),'#3B82F6',C.accentBg),fontSize:11}}>{nombre}{correosExtraTo.includes(email)&&<span onClick={e=>{e.stopPropagation();setCorreosExtraTo(p=>p.filter(x=>x!==email));setDestinosSel(p=>p.filter(x=>x!==email));}} style={{marginLeft:6,color:C.danger,fontWeight:700}}>×</span>}</button>))}</div>
                  <div style={{display:'flex',gap:6}}><input value={correoExtraTo} onChange={e=>setCorreoExtraTo(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addExtraTo()} style={{...IPT,flex:1}} placeholder="Agregar otro correo (Para:)"/><button onClick={addExtraTo} style={{padding:'6px 12px',cursor:'pointer',color:C.accent,border:`1px solid ${C.accent}`,background:'transparent',borderRadius:6,whiteSpace:'nowrap'}}>+ Agregar</button></div>
                  {destinosSel.length>0&&<div style={{marginTop:6,fontSize:11,color:C.textDim}}>Seleccionados: {destinosSel.join(', ')}</div>}
                </div>
                <div style={{marginTop:12}}>
                  <label style={LBL}>CC:</label>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:4,marginBottom:6}}>{allCcOpts.map(({email,nombre})=>(<button key={email} onClick={()=>toggleCc(email)} style={{...pill(ccSel.includes(email),'#10B981','#052E1C'),fontSize:11}}>{nombre}{correosExtraCc.includes(email)&&<span onClick={e=>{e.stopPropagation();setCorreosExtraCc(p=>p.filter(x=>x!==email));setCcSel(p=>p.filter(x=>x!==email));}} style={{marginLeft:6,color:C.danger,fontWeight:700}}>×</span>}</button>))}</div>
                  <div style={{display:'flex',gap:6}}><input value={correoExtraCc} onChange={e=>setCorreoExtraCc(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addExtraCc()} style={{...IPT,flex:1}} placeholder="Agregar otro correo (CC:)"/><button onClick={addExtraCc} style={{padding:'6px 12px',cursor:'pointer',color:'#10B981',border:'1px solid #10B981',background:'transparent',borderRadius:6,whiteSpace:'nowrap'}}>+ Agregar</button></div>
                  {ccSel.length>0&&<div style={{marginTop:6,fontSize:11,color:C.textDim}}>Seleccionados: {ccSel.join(', ')}</div>}
                </div>
              </div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <button onClick={()=>setSeccion('pendientes')} style={{...IPT,width:'auto',padding:'7px 16px',cursor:'pointer',color:C.textMuted}}>← Atrás</button>
                <button onClick={generarReporte} style={{padding:'8px 24px',cursor:'pointer',background:C.accentDim,border:'none',color:'#fff',fontWeight:600,fontSize:14,borderRadius:6}}>🚀 Generar reporte</button>
              </div>
            </div>
          )}

          {/* REPORTE */}
          {seccion==='reporte'&&reporte&&ReportePreview({
            reporte,turno,TURNOS,fecha,saliente,entrante,supervisor,canal,
            clientesSel,checksI,checksC,analistas,incConf,incCont,eventos,escalados,slaRiesgo,
            incidentes,pendientes,fineTuning,
            notas,setNotas,notasExpanded,setNotasExpanded,
            cuerpoCorreo:cuerpoCorreo||genCuerpo(turno,entrante),
            setCuerpoCorreo,genCuerpo:()=>genCuerpo(turno,entrante),
            horaEntrega,setHoraEntrega,horaRecepcion,setHoraRecepcion,
            toFinal,enviarCorreo,guardando,guardado,errorGuardado,nuevaBitacora,copiado,copiarTexto,
            enviarPorCorreoIntegrado,enviandoCorreo,correoExito,correoError,
            setFecha,setTurno,setSaliente,setEntrante,setSupervisor,setCanal,
            toggleCliente,toggleCheck,setChecksI,setChecksC,updA,updApc,updInc,soloNA,
            totalPor,pctChecks,setIncConf,setIncCont,setEventos,setEscalados,
            setIncidentes,CLIENTES_INC,CLIENTES_HEADER,CLIENTE_COLORS,SEVERIDADES,ESTATUS_INC,
            ANALISTAS_LIST,SUPERVISORES_LIST,CANALES,CHECK_INICIO,CHECK_CIERRE,
          })}
        </div>
      </div>
    </>
  );
}
