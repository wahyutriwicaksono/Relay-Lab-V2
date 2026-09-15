import {profiles,assetMeta,assetFunctions} from './core/profiles.js';
import {functionCatalog,evaluateFunction,iecOperateTime} from './core/protection.js';
import {Simulator} from './core/simulator.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const state={asset:'generic',level:'intermediate',physics:'open',fidelity:'ideal',output:false,activeTab:'current',visual:'phasor', currents:[],voltages:[], binary:{BI1:false,BI2:false,BI3:false,BI4:false,BO1:false,BO2:false,BO3:false,BO4:false},currentZero:false};
const channelAngles=[0,-120,120,180,60,-60];
state.currents=channelAngles.map((angle,i)=>({name:['IA','IB','IC','IX','IY','IZ'][i],mag:i===0?2:0,angle}));
state.voltages=channelAngles.map((angle,i)=>({name:['VA','VB','VC','VX','VY','VZ'][i],mag:i<3?63.5:0,angle}));

const sim=new Simulator({onEvent:renderEvent,onTick:(e,s)=>{renderLive(e,s);drawVisual()},onEvaluate:(e)=>renderWhy(e),onReset:()=>renderAll(),onStop:()=>{renderAll();renderResult();}});

function init(){
  functionCatalog.forEach(f=>$('#functionSelect').append(new Option(f.name+(f.implemented?'':' · mapped'),f.id)));
  wireUI(); selectAsset('generic'); renderChannels(); renderAll(); drawVisual(); renderEvidence();
}
function wireUI(){
  $$('#assetGrid button').forEach(b=>b.onclick=()=>selectAsset(b.dataset.asset));
  $$('#levelControl button').forEach(b=>b.onclick=()=>{state.level=b.dataset.level; setSegment('#levelControl',b); document.body.dataset.level=state.level;});
  $$('#physicsControl button').forEach(b=>b.onclick=()=>{state.physics=b.dataset.physics; setSegment('#physicsControl',b); renderConstraint();});
  $('#fidelitySelect').onchange=e=>{state.fidelity=e.target.value;renderConstraint();renderEvidence()};
  $('#profileSelect').onchange=()=>renderProfile();
  $$('#injectorTabs button').forEach(b=>b.onclick=()=>{state.activeTab=b.dataset.tab;setSegment('#injectorTabs',b);renderChannels()});
  $$('#visualTabs button').forEach(b=>b.onclick=()=>{state.visual=b.dataset.visual;setSegment('#visualTabs',b);drawVisual()});
  $('#outputToggle').onclick=()=>{state.output=!state.output;renderOutput()};
  $('#frequencyInput').oninput=e=>{renderAll();drawVisual()};
  ['pickupInput','curveSelect','tmsInput','ctPrimary','ctSecondary','endpointSelect','toleranceInput','maxDurationInput','methodSelect','boundarySelect'].forEach(id=>$('#'+id).oninput=()=>{renderAll();drawVisual();renderEvidence()});
  $('#functionSelect').onchange=()=>{applyFunctionDefaults(currentFn());renderAll();drawVisual();renderEvidence()};
  $('#startBtn').onclick=startSimulation; $('#stopBtn').onclick=()=>sim.stop(); $('#resetBtn').onclick=()=>sim.reset();
  $('#clearEvents').onclick=()=>{$('#eventTable').innerHTML='';sim.events=[]};
  $('#breakerFail').onchange=()=>renderEvidence(); $('#enable86').onchange=()=>renderEvidence(); $('#enableBF').onchange=()=>renderEvidence(); $('#blockOutput').onchange=()=>renderEvidence();
  $$('[data-preset]').forEach(b=>b.onclick=()=>applyPreset(b.dataset.preset));
  $('#exportBtn').onclick=exportEvidence;
  window.addEventListener('resize',drawVisual);
}
function setSegment(sel,btn){$$(sel+' button').forEach(x=>x.classList.remove('active'));btn.classList.add('active')}
function selectAsset(asset){state.asset=asset;$$('#assetGrid button').forEach(b=>b.classList.toggle('active',b.dataset.asset===asset));const m=assetMeta[asset];$('#assetTitle').textContent=m.title;$('#assetSubtitle').textContent=m.subtitle;const sel=$('#profileSelect');sel.innerHTML='';profiles[asset].forEach(p=>sel.append(new Option(p.name,p.id)));renderProfile();renderAssetFunctions();}
function renderProfile(){const p=profiles[state.asset].find(x=>x.id===$('#profileSelect').value)||profiles[state.asset][0];$('#relayName').textContent=p.name;$('#relayBadge').textContent=p.status;$('#relayBadge').className='badge reference';$('#profileStatus').innerHTML=`<b>${p.status}</b><br>${p.note}`;renderEvidence()}
function renderAssetFunctions(){const data=assetFunctions[state.asset];$('#assetCoverageTitle').textContent=assetMeta[state.asset].title.replace(' Lab','')+' · function map';$('#assetFunctionCards').innerHTML=data.map(([id,name,status])=>`<div class="function-card ${status==='planned'?'planned':''}"><strong>${id}</strong><p>${name}</p><em>${status.toUpperCase()}</em></div>`).join('')}
function renderChannels(){
  const area=$('#channelArea');
  if(state.activeTab==='binary') {area.innerHTML=`<div class="binary-grid">${Object.keys(state.binary).map(k=>`<div class="binary-card"><strong>${k}</strong><span class="binary-state ${state.binary[k]?'on':''}">${state.binary[k]?'ACTIVE':'INACTIVE'}</span></div>`).join('')}</div>`;return;}
  const arr=state.activeTab==='current'?state.currents:state.voltages;const unit=state.activeTab==='current'?'A':'V';
  area.innerHTML=arr.map((ch,i)=>`<div class="channel-row"><div class="channel-name">${ch.name}</div><label>Magnitude <input data-ch="${i}" data-prop="mag" type="number" min="0" step="0.01" value="${ch.mag}" /> ${unit}</label><label>Angle <input data-ch="${i}" data-prop="angle" type="number" step="1" value="${ch.angle}" /> °</label><div class="phase-pill">${i<3?'PHASE '+['A','B','C'][i]:'AUX'}</div><div class="link-dot"></div></div>`).join('');
  area.querySelectorAll('input').forEach(inp=>inp.oninput=e=>{const x=arr[+e.target.dataset.ch];x[e.target.dataset.prop]=+e.target.value;renderAll();drawVisual()});
}
function signal(){return {currents:state.currents,voltages:state.voltages,frequency:+$('#frequencyInput').value}}
function settings(){return {pickup:+$('#pickupInput').value,curve:$('#curveSelect').value,tms:+$('#tmsInput').value}}
function currentFn(){return $('#functionSelect').value}
function applyFunctionDefaults(fn){
  const defaults={
    '51':{pickup:1,tms:.1,curve:'si'},'50':{pickup:5,tms:.03,curve:'dt'},
    '27':{pickup:55,tms:.2,curve:'dt'},'59':{pickup:70,tms:.2,curve:'dt'},
    '81U':{pickup:48,tms:.2,curve:'dt'},'81O':{pickup:52,tms:.2,curve:'dt'},
    '46':{pickup:.2,tms:.5,curve:'dt'}
  };
  const d=defaults[fn]; if(!d)return; $('#pickupInput').value=d.pickup; $('#tmsInput').value=d.tms; $('#curveSelect').value=d.curve;
}
function renderAll(){
  renderOutput();renderConstraint();renderRelay();renderPrediction();renderLogic(sim.states||{});renderEvidence();
}
function renderOutput(){$('#outputToggle').textContent=state.output?'OUTPUT ON':'OUTPUT OFF';$('#outputToggle').classList.toggle('on',state.output)}
function renderConstraint(){const el=$('#constraintStatus');if(state.fidelity==='ideal'){el.textContent='IDEAL VIRTUAL TESTER · capability check passed';el.style.color='';return;}el.textContent='HARDWARE MODE · exact tester profile not loaded → feasibility verdict limited';el.style.color='#f0b35a'}
function renderRelay(){const e=evaluateFunction(currentFn(),signal(),settings());$('#lcdFunction').textContent=currentFn();$('#lcdImax').textContent=`${Math.max(...state.currents.slice(0,3).map(x=>x.mag)).toFixed(3)} A`;$('#lcdVmin').textContent=`${Math.min(...state.voltages.slice(0,3).map(x=>x.mag)).toFixed(2)} V`;$('#lcdFreq').textContent=`${(+$('#frequencyInput').value).toFixed(2)} Hz`;$('#lcdStatus').textContent=sim.running?(sim.states.operate?'OPERATE':sim.states.pickup?'PICKUP':'RUNNING'):'READY';
  const map={pickup:'pickup',operate:'operate',bo:'bo',bi:'bi',coil:'coil',lockout:'lockout'};Object.entries(map).forEach(([lamp,key])=>$(`[data-lamp="${lamp}"]`).classList.toggle('active',!!sim.states[key]));
  $('#breakerState').textContent=sim.states.breakerOpen?'OPEN':'CLOSED';$('#breakerAux').textContent=sim.states.breakerOpen?'52a=0 · 52b=1':'52a=1 · 52b=0';$('#breakerSymbol').classList.toggle('open',!!sim.states.breakerOpen);
  state.binary.BO1=!!sim.states.bo;state.binary.BI1=!!sim.states.bi;
}
function renderPrediction(){const e=evaluateFunction(currentFn(),signal(),settings());const fn=functionCatalog.find(f=>f.id===currentFn());$('#metricInput').textContent=Number.isFinite(e.measured)?`${e.measured.toFixed(3)} ${e.unit}`:'—';$('#metricThreshold').textContent=`${settings().pickup.toFixed(3)} ${fn?.unit||''}`;$('#metricExpected').textContent=Number.isFinite(e.expected)?`${(e.expected*1000).toFixed(1)} ms`:'—';const ctRatio=(+$('#ctPrimary').value)/(+$('#ctSecondary').value);$('#metricPrimary').textContent=Number.isFinite(e.measured)?`${(e.measured*ctRatio).toFixed(1)} ${e.unit==='A'?'A':'equiv.'}`:'—';}
function renderWhy(e){$('#whyBox').innerHTML=`<b>Why?</b><span>${e.reason}${state.physics==='open'?' Open-loop mode keeps tester I/V independent from breaker position.':' Closed-loop mode recalculates current after breaker opening.'}</span>`}
function renderLogic(st){const active={signal:state.output||sim.running,pickup:st.pickup,operate:st.operate,scheme:st.scheme,bo:st.bo,coil:st.coil||st.lockout,breaker:st.breakerOpen,extinction:st.currentZero};Object.entries(active).forEach(([k,v])=>$(`[data-node="${k}"]`)?.classList.toggle('active',!!v))}
function renderEvent(e){const tr=document.createElement('tr');tr.innerHTML=`<td>${(e.time*1000).toFixed(1)}</td><td>${e.name}</td><td>${e.detail}</td><td>${e.evidence}</td>`;$('#eventTable').append(tr);$('#eventTable').parentElement.scrollTop=99999}
function renderLive(e,s){$('#clockValue').textContent=`${s.time.toFixed(3)} s`;renderRelay();renderLogic(s.states);$('#metricActual').textContent=sim.endpointAt!=null?`${(sim.endpointAt*1000).toFixed(1)} ms`:'—';if(sim.result?.error!=null)$('#metricError').textContent=`${sim.result.error>=0?'+':''}${sim.result.error.toFixed(1)} ms`;}
function endpointDelay(){const en86=$('#enable86').checked;const endpoint=$('#endpointSelect').value;const base={operate:0,bo:.013,bi:.023,breaker:.095,currentZero:state.physics==='closed'?.115:.115};let d=base[endpoint]??0;if(en86 && ['breaker','currentZero'].includes(endpoint)) d+=.01;return d}
function startSimulation(){
  $('#verdictBadge').textContent='RUNNING'; $('#verdictBadge').className='verdict pending'; $('#metricError').textContent='—'; $('#metricActual').textContent='—';
  state.output=true;renderOutput();$('#eventTable').innerHTML='';
  const fn=currentFn(),e=evaluateFunction(fn,signal(),settings());const method=$('#methodSelect').value;const original=JSON.parse(JSON.stringify({currents:state.currents,voltages:state.voltages,frequency:+$('#frequencyInput').value}));
  const applyFrom=(src)=>{state.currents.forEach((x,i)=>{x.mag=src.currents[i].mag;x.angle=src.currents[i].angle});state.voltages.forEach((x,i)=>{x.mag=src.voltages[i].mag;x.angle=src.voltages[i].angle});$('#frequencyInput').value=src.frequency;renderChannels()};
  const fault=JSON.parse(JSON.stringify(original)); const pref=JSON.parse(JSON.stringify(original));
  pref.currents.slice(0,3).forEach(x=>x.mag=Math.min(x.mag,settings().pickup*.5));
  if(fn==='27'){pref.voltages.slice(0,3).forEach(x=>x.mag=Math.max(settings().pickup*1.2,63.5));}
  if(fn==='59'){pref.voltages.slice(0,3).forEach(x=>x.mag=Math.min(settings().pickup*.8,63.5));}
  if(fn==='81U')pref.frequency=Math.max(settings().pickup+2,50); if(fn==='81O')pref.frequency=Math.min(settings().pickup-2,50);
  const config={fn,settings:settings(),method,physics:state.physics,speed:+$('#speedSelect').value,maxDuration:+$('#maxDurationInput').value,endpoint:$('#endpointSelect').value,toleranceMs:+$('#toleranceInput').value,stopOnEndpoint:true,expectedOperate:e.expected,endpointDelay:endpointDelay(),enable86:$('#enable86').checked,enableBF:$('#enableBF').checked,blockOutput:$('#blockOutput').checked,breakerFail:$('#breakerFail').checked,biDisconnected:state.biDisconnected||false,signal,applyFault:()=>applyFrom(fault),applyPrefault:()=>applyFrom(pref),applyPostfault:()=>applyFrom(pref),applyRamp:(r)=>{const x=JSON.parse(JSON.stringify(pref));if(['51','50','46'].includes(fn)){x.currents[0].mag=settings().pickup*(.5+1.7*r)}else if(fn==='27'){x.voltages.forEach(v=>v.mag=settings().pickup*(1.2-.5*r))}else if(fn==='59'){x.voltages.forEach(v=>v.mag=settings().pickup*(.7+.8*r))}else if(fn==='81U'){x.frequency=settings().pickup+2-4*r}else if(fn==='81O'){x.frequency=settings().pickup-2+4*r}applyFrom(x)},forceCurrentZero:()=>{state.currents.forEach(x=>x.mag=0);state.currentZero=true;renderChannels()}};
  if(state.fidelity==='hardware') config.unsupported='Exact hardware tester profile is not loaded. The current build refuses to claim physical feasibility.';
  sim.start(config);renderAll();
}
function renderResult(){const r=sim.result; if(!r)return;const b=$('#verdictBadge');b.textContent=r.verdict;b.className='verdict '+r.verdict.toLowerCase();if(r.actualMs!=null){$('#metricActual').textContent=`${r.actualMs.toFixed(1)} ms`;$('#metricError').textContent=`${r.error>=0?'+':''}${r.error.toFixed(1)} ms`;}renderEvidence()}
function applyPreset(p){state.biDisconnected=false;const pick=+$('#pickupInput').value; if(p==='normal'){state.currents.forEach((x,i)=>x.mag=i<3?pick*.5:0)}if(p==='fault2'){state.currents.forEach((x,i)=>x.mag=i===0?pick*2:0)}if(p==='fault5'){state.currents.forEach((x,i)=>x.mag=i===0?pick*5:0)}if(p==='dropout'){state.currents.forEach((x,i)=>x.mag=i===0?pick*1.2:0);$('#methodSelect').value='ramp'}if(p==='biDisconnected'){state.currents.forEach((x,i)=>x.mag=i===0?pick*2:0);state.biDisconnected=true}renderChannels();renderAll();drawVisual()}
function drawVisual(){const c=$('#visualCanvas'),ctx=c.getContext('2d'),w=c.width,h=c.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#07131c';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#173144';ctx.lineWidth=1;for(let x=40;x<w;x+=50){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}for(let y=30;y<h;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
  if(state.visual==='phasor')drawPhasor(ctx,w,h);else if(state.visual==='waveform')drawWaveform(ctx,w,h);else drawCurve(ctx,w,h);
}
function drawPhasor(ctx,w,h){const arr=state.activeTab==='voltage'?state.voltages:state.currents;const max=Math.max(1,...arr.map(x=>x.mag)),cx=w/2,cy=h/2,r=Math.min(w,h)*.38;ctx.strokeStyle='#486275';ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(cx-r,cy);ctx.lineTo(cx+r,cy);ctx.moveTo(cx,cy-r);ctx.lineTo(cx,cy+r);ctx.stroke();const palette=['#70d8ff','#f4b45c','#7ce7a8','#d88eff','#ff7786','#d8e76f'];arr.forEach((p,i)=>{const ang=p.angle*Math.PI/180,len=r*(p.mag/max);ctx.strokeStyle=palette[i];ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+len*Math.cos(ang),cy-len*Math.sin(ang));ctx.stroke();ctx.fillStyle=palette[i];ctx.fillText(p.name,cx+len*Math.cos(ang)+5,cy-len*Math.sin(ang)-5)});$('#visualLegend').textContent=`Phasor · normalized to ${max.toFixed(2)} ${state.activeTab==='voltage'?'V':'A'} max · angles are canonical channel setpoints.`}
function drawWaveform(ctx,w,h){const arr=state.activeTab==='voltage'?state.voltages:state.currents;const max=Math.max(1,...arr.slice(0,3).map(x=>x.mag));const palette=['#70d8ff','#f4b45c','#7ce7a8'];arr.slice(0,3).forEach((p,i)=>{ctx.strokeStyle=palette[i];ctx.lineWidth=2;ctx.beginPath();for(let x=0;x<w;x++){const t=x/w*2*Math.PI*2;const y=h/2-(p.mag/max)*(h*.34)*Math.sin(t+p.angle*Math.PI/180);if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.stroke()});$('#visualLegend').textContent=`Waveform preview · ${(+$('#frequencyInput').value).toFixed(2)} Hz · sinusoidal RMS setpoints.`}
function drawCurve(ctx,w,h){const fn=currentFn();if(fn!=='51'){ctx.fillStyle='#7895a8';ctx.font='14px sans-serif';ctx.fillText('Curve view is executable for 51 in this build. Other function plots remain mapped for future engines.',30,50);return}ctx.strokeStyle='#6fb4ff';ctx.lineWidth=2;ctx.beginPath();let first=true;for(let x=50;x<w-20;x++){const logM=-.3+(x-50)/(w-70)*1.6;const m=Math.pow(10,logM);const t=iecOperateTime($('#curveSelect').value,m,+$('#tmsInput').value);if(!Number.isFinite(t))continue;const logT=Math.log10(Math.max(.01,Math.min(100,t)));const y=h-35-(logT+2)/4*(h-55);if(first){ctx.moveTo(x,y);first=false}else ctx.lineTo(x,y)}ctx.stroke();ctx.fillStyle='#7895a8';ctx.fillText('IEC 51 characteristic · log current multiple vs log operate time',25,22);$('#visualLegend').textContent='Curve visualization uses the generic IEC inverse-time equation selected in Settings.'}
function renderEvidence(){const p=profiles[state.asset].find(x=>x.id===$('#profileSelect').value)||profiles[state.asset][0];const items={Model:'Relay Lab V2',Asset:state.asset.toUpperCase(),Profile:p.name,'Profile status':p.status,Function:currentFn(),Method:$('#methodSelect').selectedOptions[0]?.textContent||'',Physics:state.physics.toUpperCase()+' LOOP',Fidelity:state.fidelity.toUpperCase(),Boundary:$('#boundarySelect').value,Endpoint:$('#endpointSelect').value,Tolerance:$('#toleranceInput').value+' ms','86 routing':$('#enable86').checked?'Enabled':'Bypassed','50BF':$('#enableBF').checked?'Enabled':'Disabled'};$('#evidenceGrid').innerHTML=Object.entries(items).map(([k,v])=>`<div class="evidence-item"><span>${k}</span><strong>${v}</strong></div>`).join('')}
function exportEvidence(){const data={version:'Relay Lab V2',timestamp:new Date().toISOString(),asset:state.asset,profile:$('#profileSelect').value,profileLabel:$('#profileSelect').selectedOptions[0]?.textContent,function:currentFn(),settings:settings(),method:$('#methodSelect').value,physics:state.physics,fidelity:state.fidelity,boundary:$('#boundarySelect').value,endpoint:$('#endpointSelect').value,toleranceMs:+$('#toleranceInput').value,signal:signal(),events:sim.events,result:sim.result};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`relay-lab-evidence-${Date.now()}.json`;a.click();URL.revokeObjectURL(a.href)}

init();
