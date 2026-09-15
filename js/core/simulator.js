import {evaluateFunction} from './protection.js';

export class Simulator {
  constructor(callbacks={}){
    this.cb=callbacks; this.timer=null; this.reset();
  }
  reset(){
    if(this.timer) clearInterval(this.timer);
    this.timer=null; this.running=false; this.time=0; this.lastReal=0;
    this.states={pickup:false,operate:false,scheme:false,bo:false,bi:false,coil:false,lockout:false,breakerOpen:false,currentZero:false,bfInitiate:false,bfOperate:false,upstreamTrip:false};
    this.events=[]; this.result=null; this.pickupAt=null; this.operateAt=null; this.endpointAt=null; this.faultApplied=false;
    this.cb.onReset?.(this.snapshot());
  }
  snapshot(){ return {time:this.time, states:{...this.states}, events:[...this.events], result:this.result}; }
  log(name, detail, evidence='SIM'){
    const e={time:this.time,name,detail,evidence}; this.events.push(e); this.cb.onEvent?.(e,this.snapshot());
  }
  start(config){
    this.reset(); this.config=config; this.running=true; this.lastReal=performance.now(); this.log('TEST START',`${config.method} · ${config.physics.toUpperCase()} LOOP`,'TEST CONTRACT');
    this.timer=setInterval(()=>this.tick(),20); this.cb.onStart?.(this.snapshot());
  }
  stop(reason='Operator stop'){
    if(!this.running)return; this.running=false; if(this.timer)clearInterval(this.timer); this.timer=null; this.log('TEST STOP',reason,'TEST CONTROL'); this.finish(); this.cb.onStop?.(this.snapshot());
  }
  finish(){
    const c=this.config; if(!c) return;
    if(c.unsupported){this.result={verdict:'UNSUPPORTED',detail:c.unsupported};return;}
    if(c.method==='ramp'){ this.result={verdict:this.pickupMeasured==null?'FAIL':'INCONCLUSIVE', detail:this.pickupMeasured==null?'Pickup was not found during the configured ramp.':`Pickup observed at ${this.pickupMeasured.toFixed(4)}. Configure a pickup-value tolerance contract before assigning PASS/FAIL.`}; return; }
    const endpointMap={operate:'operate',bo:'bo',bi:'bi',breaker:'breakerOpen',currentZero:'currentZero'};
    const key=endpointMap[c.endpoint]; const occurred=this.states[key];
    if(!occurred){this.result={verdict:'FAIL',detail:`Expected endpoint ${c.endpoint} was not observed.`};return;}
    const expectedMs=((this.pickupAt ?? 0) + c.expectedOperate + c.endpointDelay)*1000;
    const actualMs=this.endpointAt*1000;
    const error=actualMs-expectedMs;
    const pass=Math.abs(error)<=c.toleranceMs;
    this.result={verdict:pass?'PASS':'FAIL',expectedMs,actualMs,error,detail:pass?'Observed endpoint is within configured tolerance.':'Observed endpoint is outside configured tolerance.'};
  }
  tick(){
    if(!this.running)return;
    const now=performance.now(); const dtReal=(now-this.lastReal)/1000; this.lastReal=now;
    const dt=dtReal*this.config.speed; this.time+=dt;
    this.applyMethod();
    const evalResult=evaluateFunction(this.config.fn,this.config.signal(),this.config.settings);
    this.cb.onEvaluate?.(evalResult,this.snapshot());
    if(!evalResult.supported){this.config.unsupported=evalResult.reason; this.stop('Unsupported function/test combination'); return;}
    if(evalResult.picked && !this.states.pickup){this.states.pickup=true;this.pickupAt=this.time;this.pickupMeasured=evalResult.measured;this.log('ELEMENT PICKUP',evalResult.reason,'ELEMENT');}
    if(!evalResult.picked && this.states.pickup && !this.states.operate){this.states.pickup=false;this.log('ELEMENT RESET','Pickup condition removed before operate.','ELEMENT');}
    if(this.states.pickup && !this.states.operate && this.time-this.pickupAt>=evalResult.expected){this.states.operate=true;this.operateAt=this.time;this.log('ELEMENT OPERATE',`Element timer completed after ${(this.time-this.pickupAt).toFixed(4)} s.`,'ELEMENT');}
    this.progressTripChain();
    this.cb.onTick?.(evalResult,this.snapshot());
    if(this.time>=this.config.maxDuration) this.stop('Maximum test duration reached');
    if(this.endpointAt!=null && this.config.stopOnEndpoint && this.time>this.endpointAt+0.05) this.stop('Expected endpoint observed');
  }
  applyMethod(){
    const c=this.config;
    if(c.physics==='closed' && (this.states.breakerOpen || this.states.upstreamTrip)){ c.forceCurrentZero(); return; }
    if(c.method==='sequence'){
      if(this.time<0.25){c.applyPrefault();}
      else if(this.time<c.maxDuration-0.4){if(!this.faultApplied){this.faultApplied=true;this.log('FAULT STATE','State 2 applied.','TEST GENERATOR');}c.applyFault();}
      else c.applyPostfault();
    } else if(c.method==='ramp'){
      const ratio=Math.min(1,this.time/Math.max(.5,c.maxDuration*.65)); c.applyRamp(ratio);
    } else { if(!this.faultApplied){this.faultApplied=true;this.log('FAULT / SHOT','Single-shot stimulus applied.','TEST GENERATOR');}c.applyFault(); }
  }
  at(offset){return this.operateAt!=null && this.time>=this.operateAt+offset;}
  progressTripChain(){
    const c=this.config;
    if(this.states.operate && !this.states.scheme && this.at(.005)){this.states.scheme=true;this.log('SCHEME OPERATE','Protection element accepted by scheme logic.','SCHEME');}
    if(this.states.scheme && !this.states.bo && this.at(.013)){
      if(c.blockOutput){this.log('BO BLOCKED','Internal operate exists, but physical BO is blocked.','SCHEME');}
      else {this.states.bo=true;this.log('RELAY BO1','Physical relay output model changed state.','RELAY OUTPUT');}
    }
    if(this.states.bo && !this.states.bi && this.at(.023)){
      if(c.biDisconnected){this.log('BI1 NOT SEEN','Tester BI is disconnected; BO transition is not observed at BI1.','TESTER BI');}
      else {this.states.bi=true;this.log('TESTER BI1','Binary input detected relay output contact.','TESTER BI');}
    }
    if(this.states.bo && !this.states.lockout && c.enable86 && this.at(.030)){this.states.lockout=true;this.log('86 LOCKOUT','Master trip latch operated.','PANEL');}
    const routeReady=c.enable86?this.states.lockout:this.states.bo;
    if(routeReady && !this.states.coil && this.at(c.enable86?.040:.030)){this.states.coil=true;this.log('TRIP COIL ENERGIZED','DC trip path / virtual coil energized.','PANEL');}
    if(this.states.coil && c.enableBF && !this.states.bfInitiate && this.at(.035)){this.states.bfInitiate=true;this.log('50BF INITIATE','Breaker-failure supervision initiated.','BF');}
    if(this.states.coil && !this.states.breakerOpen && !c.breakerFail && this.at(.095)){this.states.breakerOpen=true;this.log('BREAKER OPEN','Virtual breaker mechanism opened.','BREAKER');this.log('52a / 52b','52a=0 · 52b=1','BREAKER AUX');this.captureEndpoint('breaker');}
    if(this.states.breakerOpen && c.physics==='closed' && !this.states.currentZero && this.at(.115)){this.states.currentZero=true;c.forceCurrentZero();this.log('CURRENT EXTINCTION','Closed-loop topology recalculated after breaker opening.','SYSTEM');this.captureEndpoint('currentZero');}
    if(this.states.breakerOpen && c.physics==='open' && !this.states.currentZero && this.at(.115)){this.logOnce('openLoopCurrent','OPEN-LOOP CURRENT RETAINED','Tester injection remains commanded although virtual breaker is open.','TEST PHYSICS');}
    if(this.states.bfInitiate && c.breakerFail && !this.states.bfOperate && this.operateAt!=null && this.time>=this.operateAt+.250){this.states.bfOperate=true;this.log('50BF OPERATE','Breaker did not clear within BF timer.','BF');}
    if(this.states.bfOperate && !this.states.upstreamTrip && this.operateAt!=null && this.time>=this.operateAt+.300){this.states.upstreamTrip=true;this.log('UPSTREAM TRIP','Backup breaker / zone trip issued.','BF BACKUP'); if(c.physics==='closed'){this.states.currentZero=true;c.forceCurrentZero();this.log('CURRENT EXTINCTION','Current cleared by backup trip in closed-loop model.','SYSTEM');this.captureEndpoint('currentZero');}}
    if(this.states.operate) this.captureEndpoint('operate');
    if(this.states.bo) this.captureEndpoint('bo');
    if(this.states.bi) this.captureEndpoint('bi');
  }
  logOnce(key,name,detail,evidence){this._once=this._once||{};if(this._once[key])return;this._once[key]=true;this.log(name,detail,evidence)}
  captureEndpoint(key){
    const map={operate:'operate',bo:'bo',bi:'bi',breaker:'breakerOpen',currentZero:'currentZero'};
    if(this.config.endpoint===key && this.endpointAt==null && this.states[map[key]]) this.endpointAt=this.time;
  }
}
