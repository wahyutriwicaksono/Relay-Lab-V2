const deg = d => d * Math.PI / 180;
const cplx = (mag, angle) => ({re:mag*Math.cos(deg(angle)), im:mag*Math.sin(deg(angle))});
const add=(a,b)=>({re:a.re+b.re,im:a.im+b.im});
const scale=(a,k)=>({re:a.re*k,im:a.im*k});
const mag=a=>Math.hypot(a.re,a.im);

export const functionCatalog = [
  {id:'51', name:'51 · Time Overcurrent', unit:'A', implemented:true},
  {id:'50', name:'50 · Instantaneous Overcurrent', unit:'A', implemented:true},
  {id:'27', name:'27 · Undervoltage', unit:'V', implemented:true},
  {id:'59', name:'59 · Overvoltage', unit:'V', implemented:true},
  {id:'81U', name:'81U · Underfrequency', unit:'Hz', implemented:true},
  {id:'81O', name:'81O · Overfrequency', unit:'Hz', implemented:true},
  {id:'46', name:'46 · Negative Sequence Current', unit:'A', implemented:true},
  {id:'50N', name:'50N · Instantaneous Earth Fault', unit:'A', implemented:false},
  {id:'51N', name:'51N · Earth-Fault Overcurrent', unit:'A', implemented:false},
  {id:'67', name:'67 · Directional Overcurrent', unit:'A', implemented:false},
  {id:'87T', name:'87T · Transformer Differential', unit:'A', implemented:false},
  {id:'21', name:'21 · Distance', unit:'Ω', implemented:false},
  {id:'32R', name:'32R · Reverse Power', unit:'%', implemented:false},
  {id:'24', name:'24 · Overexcitation V/Hz', unit:'pu', implemented:false},
  {id:'25', name:'25 · Synchronism Check', unit:'—', implemented:false}
];

export function negativeSequence(currents){
  const a=cplx(1,120), a2=cplx(1,240);
  const A=cplx(currents[0].mag,currents[0].angle), B=cplx(currents[1].mag,currents[1].angle), C=cplx(currents[2].mag,currents[2].angle);
  const mult=(x,y)=>({re:x.re*y.re-x.im*y.im, im:x.re*y.im+x.im*y.re});
  return mag(scale(add(add(A,mult(a2,B)),mult(a,C)),1/3));
}

export function iecOperateTime(curve, multiple, tms){
  if(multiple<=1) return Infinity;
  if(curve==='dt') return tms;
  const constants={si:[0.14,0.02],vi:[13.5,1],ei:[80,2]};
  const [k,alpha]=constants[curve]||constants.si;
  return tms*k/(Math.pow(multiple,alpha)-1);
}

export function evaluateFunction(fn, state, settings){
  const phaseI=state.currents.slice(0,3).map(x=>x.mag);
  const phaseV=state.voltages.slice(0,3).map(x=>x.mag);
  const iMax=Math.max(...phaseI), vMin=Math.min(...phaseV), vMax=Math.max(...phaseV), freq=state.frequency;
  const pickup=settings.pickup;
  let measured=0, picked=false, expected=Infinity, reason='', unit='A';
  switch(fn){
    case '51':
      measured=iMax; picked=measured>=pickup; expected=picked?iecOperateTime(settings.curve, measured/pickup, settings.tms):Infinity; reason=picked?`Imax ${measured.toFixed(3)} A exceeds I> ${pickup.toFixed(3)} A. IEC ${settings.curve.toUpperCase()} timing started.`:`Imax ${measured.toFixed(3)} A is below I> ${pickup.toFixed(3)} A.`;break;
    case '50':
      measured=iMax; picked=measured>=pickup; expected=picked?Math.max(0.02,settings.tms):Infinity; reason=picked?`Imax exceeds high-set pickup. Definite high-set delay is active.`:`High-set threshold has not been crossed.`;break;
    case '27':
      unit='V'; measured=vMin; picked=measured<=pickup; expected=picked?settings.tms:Infinity; reason=picked?`Minimum phase voltage ${measured.toFixed(2)} V is below U< ${pickup.toFixed(2)} V.`:`All measured phase voltages remain above U<.`;break;
    case '59':
      unit='V'; measured=vMax; picked=measured>=pickup; expected=picked?settings.tms:Infinity; reason=picked?`Maximum phase voltage ${measured.toFixed(2)} V exceeds U> ${pickup.toFixed(2)} V.`:`Overvoltage threshold has not been crossed.`;break;
    case '81U':
      unit='Hz'; measured=freq; picked=measured<=pickup; expected=picked?settings.tms:Infinity; reason=picked?`Frequency ${measured.toFixed(2)} Hz is below f< ${pickup.toFixed(2)} Hz.`:`Frequency remains above underfrequency pickup.`;break;
    case '81O':
      unit='Hz'; measured=freq; picked=measured>=pickup; expected=picked?settings.tms:Infinity; reason=picked?`Frequency ${measured.toFixed(2)} Hz exceeds f> ${pickup.toFixed(2)} Hz.`:`Frequency remains below overfrequency pickup.`;break;
    case '46':
      measured=negativeSequence(state.currents); picked=measured>=pickup; expected=picked?settings.tms:Infinity; reason=picked?`Negative-sequence current I2 ${measured.toFixed(3)} A exceeds pickup.`:`I2 ${measured.toFixed(3)} A remains below pickup.`;break;
    default: return {supported:false, picked:false, measured:NaN, expected:Infinity, reason:'Function is mapped but not executable in this V2 build.', unit};
  }
  return {supported:true,picked,measured,expected,reason,unit,iMax,vMin,vMax,freq};
}
