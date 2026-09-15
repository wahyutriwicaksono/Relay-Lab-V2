import { TesterModel } from '../js/core/tester.js';
import { testerProfiles } from '../js/core/profiles.js';
import { evaluateFunction, functionDefaultSettings, iecOperateTime, residualMagnitude, negativeSequence } from '../js/core/protection.js';
import { Simulator } from '../js/core/simulator.js';

const results=[];
function assert(name, cond, detail='') {
  results.push({name, pass:!!cond, detail});
  if(!cond) console.error('FAIL',name,detail);
}
function near(a,b,tol=1e-6){return Math.abs(a-b)<=tol}
function signalFromTester(t){return t.getInjectedSignal()}

const tester=new TesterModel(testerProfiles[0]);
assert('tester output off => zero injected current', tester.getInjectedSignal().currents[0].mag===0);
tester.setOutput(true);
assert('tester output on => command injected', near(tester.getInjectedSignal().currents[0].mag,2));
tester.toggleLink('current',0);
assert('disconnected channel => zero actual', tester.getInjectedSignal().currents[0].mag===0);
tester.toggleLink('current',0);
tester.setClosedLoopFactor(0);
assert('closed-loop factor => zero actual current', tester.getInjectedSignal().currents[0].mag===0);
tester.setClosedLoopFactor(1);

const t51=iecOperateTime('si',2,0.1);
assert('IEC SI 2x TMS .1 ≈ 1.0029 s', near(t51,1.002902702,1e-6),t51);

const balanced=[{mag:1,angle:0},{mag:1,angle:-120},{mag:1,angle:120}];
assert('balanced residual ≈0', residualMagnitude(balanced)<1e-9, residualMagnitude(balanced));
assert('balanced negative sequence ≈0', negativeSequence(balanced)<1e-9, negativeSequence(balanced));
const onePhase=[{mag:2,angle:0},{mag:0,angle:-120},{mag:0,angle:120}];
assert('single-phase I2 = 2/3 A', near(negativeSequence(onePhase),2/3,1e-9),negativeSequence(onePhase));

function baseSignal(){
 return {
  currents:[{mag:2,angle:0},{mag:0,angle:-120},{mag:0,angle:120},{mag:0,angle:180},{mag:0,angle:60},{mag:0,angle:-60}],
  voltages:[{mag:63.5,angle:0},{mag:63.5,angle:-120},{mag:63.5,angle:120},{mag:0,angle:180},{mag:0,angle:60},{mag:0,angle:-60}],
  frequency:50,binary:{SENSOR63:false,CLOSE_REQUEST:false}
 }
}
let s=baseSignal();
let e=evaluateFunction('51',s,functionDefaultSettings('51'));
assert('51 picks at 2x',e.picked && e.stage==='51' && near(e.expected,t51,1e-6),JSON.stringify(e));

let st=functionDefaultSettings('51'); st.parallel50Enabled=true; st.parallel50Pickup=1.5; st.parallel50Delay=.03;
e=evaluateFunction('51',s,st);
assert('parallel 50 controls faster stage',e.picked && e.stage==='50' && near(e.expected,.03,1e-9),JSON.stringify(e));

let e67=evaluateFunction('67',s,{...functionDefaultSettings('67'),pickup:1,mtaDeg:0});
assert('67 generic forward picks',e67.picked,JSON.stringify(e67));
s.currents[0].angle=180;
e67=evaluateFunction('67',s,{...functionDefaultSettings('67'),pickup:1,mtaDeg:0});
assert('67 generic reverse blocks',!e67.picked,JSON.stringify(e67));

s=baseSignal(); s.voltages.forEach((v,i)=>{if(i<3)v.mag=70}); s.frequency=45;
let e24=evaluateFunction('24',s,{...functionDefaultSettings('24'),pickup:1.1,nominalV:63.5,nominalF:50});
assert('24 V/Hz picks on high V/f',e24.picked,JSON.stringify(e24));

s=baseSignal(); s.voltages[3]={mag:63,angle:5}; s.binary.CLOSE_REQUEST=true;
let e25=evaluateFunction('25',s,functionDefaultSettings('25'));
assert('25 synchronism permissive in limits',e25.picked,JSON.stringify(e25));

s=baseSignal(); s.currents=[{mag:1,angle:180},{mag:1,angle:60},{mag:1,angle:-60},...s.currents.slice(3)];
let e32=evaluateFunction('32R',s,{...functionDefaultSettings('32R'),pickup:50});
assert('32R reverse power picks',e32.picked && e32.measured<0,JSON.stringify(e32));

s=baseSignal(); s.binary.SENSOR63=true;
let e63=evaluateFunction('63',s,functionDefaultSettings('63'));
assert('63 binary contact picks',e63.picked,JSON.stringify(e63));

s=baseSignal();
s.currents=[
 {mag:1,angle:0},{mag:1,angle:-120},{mag:1,angle:120},
 {mag:1,angle:180},{mag:1,angle:60},{mag:1,angle:-60}
];
let e87=evaluateFunction('87T',s,{...functionDefaultSettings('87T'),pickup:.2,slopePct:30});
assert('87T through current stable',!e87.picked,JSON.stringify(e87));
s.currents[3].mag=0;
e87=evaluateFunction('87T',s,{...functionDefaultSettings('87T'),pickup:.2,slopePct:30});
assert('87T internal differential operates',e87.picked,JSON.stringify(e87));


// Additional V1 baseline function coverage.
s=baseSignal();
let e50=evaluateFunction('50',s,{...functionDefaultSettings('50'),pickup:1,tms:.03});
assert('50 instantaneous/high-set operates',e50.picked && near(e50.expected,.03,1e-9),JSON.stringify(e50));

s=baseSignal(); s.currents[0].mag=.6; s.currents[1].mag=0; s.currents[2].mag=0;
let e50n=evaluateFunction('50N',s,{...functionDefaultSettings('50N'),pickup:.5});
assert('50N residual current operates',e50n.picked,JSON.stringify(e50n));
let e51n=evaluateFunction('51N',s,{...functionDefaultSettings('51N'),pickup:.3,curve:'si',tms:.1});
assert('51N residual IDMT operates',e51n.picked && Number.isFinite(e51n.expected),JSON.stringify(e51n));

s=baseSignal(); s.voltages.slice(0,3).forEach(v=>v.mag=40);
let e27=evaluateFunction('27',s,{...functionDefaultSettings('27'),pickup:55});
assert('27 undervoltage operates',e27.picked,JSON.stringify(e27));
s.voltages.slice(0,3).forEach(v=>v.mag=80);
let e59=evaluateFunction('59',s,{...functionDefaultSettings('59'),pickup:70});
assert('59 overvoltage operates',e59.picked,JSON.stringify(e59));
s=baseSignal(); s.voltages[0].mag=25;s.voltages[1].mag=0;s.voltages[2].mag=0;
let e59n=evaluateFunction('59N',s,{...functionDefaultSettings('59N'),pickup:15});
assert('59N residual overvoltage operates',e59n.picked,JSON.stringify(e59n));

s=baseSignal(); s.frequency=47;
let e81u=evaluateFunction('81U',s,{...functionDefaultSettings('81U'),pickup:48});
assert('81U underfrequency operates',e81u.picked,JSON.stringify(e81u));
s.frequency=53;
let e81o=evaluateFunction('81O',s,{...functionDefaultSettings('81O'),pickup:52});
assert('81O overfrequency operates',e81o.picked,JSON.stringify(e81o));

s=baseSignal(); s.currents[0].mag=1;s.currents[1].mag=0;s.currents[2].mag=0;
let e46=evaluateFunction('46',s,{...functionDefaultSettings('46'),pickup:.2});
assert('46 negative-sequence operates',e46.picked,JSON.stringify(e46));

assert('IEC VI finite above pickup',Number.isFinite(iecOperateTime('vi',2,.1)));
assert('IEC EI finite above pickup',Number.isFinite(iecOperateTime('ei',2,.1)));
assert('Definite time operates at exact pickup',near(iecOperateTime('dt',1,.2),.2,1e-9));
assert('Inverse curve stays infinite at exact pickup',!Number.isFinite(iecOperateTime('si',1,.1)));

let e21=evaluateFunction('21',baseSignal(),{...functionDefaultSettings('21'),pickup:5});
assert('21 is explicitly unsupported, not faked',e21.supported===false);
let e49=evaluateFunction('49',baseSignal(),{...functionDefaultSettings('49'),pickup:1});
assert('49 is explicitly unsupported until thermal-state engine exists',e49.supported===false);

function makeSim({physics='open',endpoint='breaker',enable86=false,enableBF=true,breakerFail=false,biDisconnected=false,blockOutput=false,bfClearCriterion='52'}={}){
 const t=new TesterModel(testerProfiles[0]);
 t.command.currents[0].mag=2;t.command.currents[1].mag=0;t.command.currents[2].mag=0;t.setOutput(true);
 const sim=new Simulator({onSystemFactor:f=>t.setClosedLoopFactor(f)});
 const settings={...functionDefaultSettings('51'),parallel50Enabled:false};
 const eval0=evaluateFunction('51',t.getInjectedSignal(),settings);
 const config={fn:'51',settings,method:'shot',physics,speed:20,maxDuration:3,endpoint,toleranceMs:5,pickupTolerancePct:5,expectedOperate:eval0.expected,enable86,enableBF,blockOutput,breakerFail,biDisconnected,bfClearCriterion,forbiddenStates:breakerFail?[]:['upstreamTrip'],signal:()=>t.getInjectedSignal(),applyFault:()=>{},applyPrefault:()=>{},applyPostfault:()=>{},applyRamp:()=>{},setSystemCurrentFactor:f=>t.setClosedLoopFactor(f)};
 sim.start(config); clearInterval(sim.timer); sim.timer=null;
 let guard=0; while(sim.running && guard<10000){sim.step(.001);guard++;}
 return {sim,t};
}

let r=makeSim({physics:'open',endpoint:'breaker'});
assert('open-loop 51 breaker endpoint PASS',r.sim.result?.verdict==='PASS',JSON.stringify(r.sim.result));
assert('open-loop breaker opens but current retained',r.sim.states.breakerOpen && !r.sim.states.currentZero && r.t.getInjectedSignal().currents[0].mag>0,JSON.stringify(r.sim.states));

r=makeSim({physics:'closed',endpoint:'currentZero'});
assert('closed-loop current-zero PASS',r.sim.result?.verdict==='PASS' && r.sim.states.currentZero,JSON.stringify(r.sim.result));
assert('closed-loop actual current zero only after event',r.t.getInjectedSignal().currents[0].mag===0);

r=makeSim({physics:'open',endpoint:'breaker',enable86:true});
assert('86 route PASS and lockout operates',r.sim.result?.verdict==='PASS' && r.sim.states.lockout,JSON.stringify(r.sim.result));
assert('86 adds route delay consistently',near(r.sim.result.actualMs,r.sim.result.expectedMs,1.1),JSON.stringify(r.sim.result));

r=makeSim({physics:'closed',endpoint:'upstreamTrip',breakerFail:true,enableBF:true});
assert('breaker failure drives 50BF and upstream trip',r.sim.states.bfOperate && r.sim.states.upstreamTrip && r.sim.result?.verdict==='PASS',JSON.stringify({states:r.sim.states,result:r.sim.result}));

r=makeSim({physics:'open',endpoint:'bi',biDisconnected:true});
assert('BI disconnected => BI endpoint FAIL',r.sim.result?.verdict==='FAIL' && !r.sim.states.bi,JSON.stringify(r.sim.result));
assert('BI disconnected does not prevent breaker trip',r.sim.states.breakerOpen,JSON.stringify(r.sim.states));

r=makeSim({physics:'open',endpoint:'breaker',blockOutput:true});
assert('BO blocked => breaker endpoint FAIL',r.sim.result?.verdict==='FAIL' && !r.sim.states.bo && !r.sim.states.coil && !r.sim.states.breakerOpen,JSON.stringify(r.sim.result));
assert('BO blocked event logged once',r.sim.events.filter(x=>x.name==='BO BLOCKED').length===1,r.sim.events.filter(x=>x.name==='BO BLOCKED').length);


// Ramp pickup/dropout search using the deterministic 1 ms engine.
{
 const t=new TesterModel(testerProfiles[0]); t.setOutput(true);
 const simRamp=new Simulator({onSystemFactor:f=>t.setClosedLoopFactor(f)});
 const st={...functionDefaultSettings('51'),pickup:1,curve:'si',tms:.5,parallel50Enabled:false};
 const cfg={fn:'51',settings:st,method:'ramp',physics:'open',speed:20,maxDuration:1.5,endpoint:'pickup',toleranceMs:20,pickupTolerancePct:5,expectedOperate:Infinity,enable86:false,enableBF:false,blockOutput:false,breakerFail:false,biDisconnected:false,bfClearCriterion:'52',forbiddenStates:[],signal:()=>t.getInjectedSignal(),applyFault:()=>{},applyPrefault:()=>{},applyPostfault:()=>{},applyRamp:(triangle)=>{t.command.currents[0].mag=.5+triangle;t.command.currents[1].mag=0;t.command.currents[2].mag=0;},setSystemCurrentFactor:f=>t.setClosedLoopFactor(f)};
 simRamp.start(cfg); clearInterval(simRamp.timer); simRamp.timer=null; let guard=0; while(simRamp.running&&guard<10000){simRamp.step(.001);guard++;}
 assert('linear ramp finds pickup near setting',simRamp.pickupMeasured!=null && Math.abs(simRamp.pickupMeasured-1)<=.01,simRamp.pickupMeasured);
 assert('linear ramp observes dropout on falling ramp',simRamp.dropoutMeasured!=null,simRamp.dropoutMeasured);
 assert('ramp verdict uses pickup-value tolerance',simRamp.result?.verdict==='PASS',JSON.stringify(simRamp.result));
}

// State sequence must establish a prefault interval before fault inception.
{
 const t=new TesterModel(testerProfiles[0]); t.setOutput(true); t.command.currents[0].mag=.2;
 const simSeq=new Simulator({onSystemFactor:f=>t.setClosedLoopFactor(f)});
 const st={...functionDefaultSettings('50'),pickup:1,tms:.03};
 const cfg={fn:'50',settings:st,method:'sequence',physics:'open',speed:20,maxDuration:1.2,endpoint:'operate',toleranceMs:5,pickupTolerancePct:5,expectedOperate:.03,enable86:false,enableBF:false,blockOutput:false,breakerFail:false,biDisconnected:false,bfClearCriterion:'52',forbiddenStates:[],signal:()=>t.getInjectedSignal(),applyPrefault:()=>{t.command.currents[0].mag=.2;},applyFault:()=>{t.command.currents[0].mag=2;},applyPostfault:()=>{t.command.currents[0].mag=.2;},applyRamp:()=>{},setSystemCurrentFactor:f=>t.setClosedLoopFactor(f)};
 simSeq.start(cfg); clearInterval(simSeq.timer); simSeq.timer=null; let guard=0; while(simSeq.running&&guard<10000){simSeq.step(.001);guard++;}
 assert('state sequence fault begins after prefault',simSeq.timestamps.stimulus>=.25,simSeq.timestamps.stimulus);
 assert('state sequence operate endpoint PASS',simSeq.result?.verdict==='PASS',JSON.stringify(simSeq.result));
}

// Distinct reset semantics.
{
 const {sim}=makeSim({physics:'open',endpoint:'breaker',enable86:true});
 const breakerWasOpen=sim.states.breakerOpen;
 sim.resetElement();
 assert('element reset does not close breaker',breakerWasOpen && sim.states.breakerOpen && !sim.states.operate);
 const lockoutWas=sim.states.lockout;
 const reset86=sim.resetLockout();
 assert('86 reset is separate from element reset',lockoutWas && reset86 && !sim.states.lockout);
 const closed=sim.closeBreaker();
 assert('breaker can close after 86 reset',closed && !sim.states.breakerOpen);
}

const passed=results.filter(r=>r.pass).length;
console.log(`CORE TESTS: ${passed}/${results.length} PASS`);
for(const x of results) console.log(`${x.pass?'PASS':'FAIL'} | ${x.name}${x.detail?' | '+x.detail:''}`);
if(passed!==results.length) process.exit(1);
