const deg = d => d * Math.PI / 180;
const radToDeg = r => r * 180 / Math.PI;
const cplx = (mag, angle = 0) => ({ re: mag * Math.cos(deg(angle)), im: mag * Math.sin(deg(angle)) });
const add = (a,b) => ({ re: a.re + b.re, im: a.im + b.im });
const scale = (a,k) => ({ re: a.re * k, im: a.im * k });
const mult = (a,b) => ({ re: a.re*b.re - a.im*b.im, im: a.re*b.im + a.im*b.re });
const conj = a => ({ re: a.re, im: -a.im });
const mag = a => Math.hypot(a.re, a.im);
const angle = a => radToDeg(Math.atan2(a.im, a.re));
const normalizeAngle = value => {
  let a = Number(value) || 0;
  while (a > 180) a -= 360;
  while (a <= -180) a += 360;
  return a;
};

function channelPhasor(ch) {
  return cplx(Number(ch?.mag) || 0, Number(ch?.angle) || 0);
}

export function negativeSequence(channels) {
  if (!channels || channels.length < 3) return 0;
  const a = cplx(1, 120);
  const a2 = cplx(1, 240);
  const A = channelPhasor(channels[0]);
  const B = channelPhasor(channels[1]);
  const C = channelPhasor(channels[2]);
  return mag(scale(add(add(A, mult(a2, B)), mult(a, C)), 1/3));
}

export function residualMagnitude(channels) {
  if (!channels || channels.length < 3) return 0;
  return mag(add(add(channelPhasor(channels[0]), channelPhasor(channels[1])), channelPhasor(channels[2])));
}

export function iecOperateTime(curve, multiple, tms) {
  if (curve === 'dt') return multiple >= 1 ? Math.max(0, Number(tms) || 0) : Infinity;
  if (multiple <= 1) return Infinity;
  const constants = {
    si: [0.14, 0.02],
    vi: [13.5, 1],
    ei: [80, 2]
  };
  const [k, alpha] = constants[curve] || constants.si;
  return (Number(tms) || 0) * k / (Math.pow(multiple, alpha) - 1);
}

export function threePhaseRealPower(voltages, currents) {
  let p = 0;
  for (let i = 0; i < 3; i++) {
    const v = channelPhasor(voltages[i]);
    const current = channelPhasor(currents[i]);
    p += mult(v, conj(current)).re;
  }
  return p;
}

export function genericDifferential(currents, settings = {}) {
  const slope = (Number(settings.slopePct) || 30) / 100;
  const minPickup = Math.max(0, Number(settings.pickup) || 0);
  const phases = [];
  for (let i = 0; i < 3; i++) {
    const side1 = channelPhasor(currents[i]);
    const side2 = channelPhasor(currents[i+3]);
    const idiff = mag(add(side1, side2));
    const ibias = (mag(side1) + mag(side2)) / 2;
    const threshold = minPickup + slope * ibias;
    phases.push({ phase: ['A','B','C'][i], idiff, ibias, threshold, margin: idiff - threshold });
  }
  const worst = phases.reduce((a,b) => b.margin > a.margin ? b : a, phases[0]);
  return { phases, worst, picked: worst.margin >= 0 };
}

function phaseWithMaxCurrent(signal) {
  const mags = signal.currents.slice(0,3).map(x => Number(x.mag) || 0);
  const idx = mags.indexOf(Math.max(...mags));
  return { idx, mag: mags[idx] };
}

function unsupported(reason, unit = '—') {
  return { supported: false, picked: false, measured: NaN, expected: Infinity, reason, unit, stage: null, details: {} };
}

export function evaluateFunction(fn, signal, settings = {}) {
  const phaseI = signal.currents.slice(0,3).map(x => Number(x.mag) || 0);
  const phaseV = signal.voltages.slice(0,3).map(x => Number(x.mag) || 0);
  const iMax = Math.max(...phaseI);
  const vMin = Math.min(...phaseV);
  const vMax = Math.max(...phaseV);
  const freq = Number(signal.frequency) || 0;
  const pickup = Number(settings.pickup) || 0;

  let measured = 0;
  let picked = false;
  let expected = Infinity;
  let reason = '';
  let unit = 'A';
  let stage = fn;
  let details = {};

  switch (fn) {
    case '51': { 
      measured = iMax;
      const p51 = measured >= pickup;
      const t51 = p51 ? iecOperateTime(settings.curve || 'si', measured / Math.max(pickup, 1e-9), settings.tms) : Infinity;
      const highEnabled = !!settings.parallel50Enabled;
      const highPickup = Number(settings.parallel50Pickup) || 5;
      const p50 = highEnabled && measured >= highPickup;
      const t50 = p50 ? Math.max(0.001, Number(settings.parallel50Delay) || 0.03) : Infinity;
      picked = p51 || p50;
      if (t50 < t51) {
        expected = t50;
        stage = '50';
        reason = `Parallel 50 high-set controls: Imax ${measured.toFixed(3)} A ≥ I>> ${highPickup.toFixed(3)} A. 51 is also evaluated independently.`;
      } else if (p51) {
        expected = t51;
        stage = '51';
        reason = `51 pickup: Imax ${measured.toFixed(3)} A ≥ I> ${pickup.toFixed(3)} A. IEC ${(settings.curve || 'si').toUpperCase()} timer active.`;
      } else {
        reason = `Imax ${measured.toFixed(3)} A is below I> ${pickup.toFixed(3)} A${highEnabled ? ` and I>> ${highPickup.toFixed(3)} A` : ''}.`;
      }
      details = { p51, t51, p50, t50, parallel50Enabled: highEnabled, highPickup };
      break;
    }

    case '50': {
      measured = iMax;
      picked = measured >= pickup;
      expected = picked ? Math.max(0.001, Number(settings.tms) || 0.02) : Infinity;
      reason = picked ? `50 pickup: Imax ${measured.toFixed(3)} A ≥ I>> ${pickup.toFixed(3)} A.` : `Imax ${measured.toFixed(3)} A is below high-set ${pickup.toFixed(3)} A.`;
      break;
    }

    case '50N':
    case '51N': {
      measured = residualMagnitude(signal.currents.slice(0,3));
      picked = measured >= pickup;
      if (fn === '50N') expected = picked ? Math.max(0.001, Number(settings.tms) || 0.02) : Infinity;
      else expected = picked ? iecOperateTime(settings.curve || 'si', measured / Math.max(pickup, 1e-9), settings.tms) : Infinity;
      reason = picked
        ? `${fn} pickup: calculated residual |IA+IB+IC| = ${measured.toFixed(3)} A exceeds ${pickup.toFixed(3)} A.`
        : `Calculated residual |IA+IB+IC| = ${measured.toFixed(3)} A remains below ${pickup.toFixed(3)} A.`;
      details = { basis: 'calculated residual 3I0; measured neutral input is a separate future channel mode' };
      break;
    }

    case '67': {
      const { idx, mag: currentMag } = phaseWithMaxCurrent(signal);
      measured = currentMag;
      const v = signal.voltages[idx] || signal.voltages[0];
      const i = signal.currents[idx] || signal.currents[0];
      const mta = Number(settings.mtaDeg) || 0;
      const torqueAngle = normalizeAngle((Number(i.angle) || 0) - (Number(v.angle) || 0) - mta);
      const forward = Math.cos(deg(torqueAngle)) > 0;
      const overcurrent = measured >= pickup;
      picked = overcurrent && forward;
      expected = picked ? iecOperateTime(settings.curve || 'dt', measured / Math.max(pickup, 1e-9), settings.tms) : Infinity;
      reason = `${forward ? 'Forward' : 'Reverse/block'} generic directional decision on phase ${['A','B','C'][idx]} (torque angle ${torqueAngle.toFixed(1)}°); I=${measured.toFixed(3)} A ${overcurrent ? 'exceeds' : 'does not exceed'} pickup ${pickup.toFixed(3)} A.`;
      details = { phase: ['A','B','C'][idx], torqueAngle, mta, forward, genericDirectionalModel: true };
      break;
    }

    case '27': {
      unit = 'V';
      measured = vMin;
      picked = measured <= pickup;
      expected = picked ? Math.max(0, Number(settings.tms) || 0) : Infinity;
      reason = picked ? `Minimum phase voltage ${measured.toFixed(2)} V ≤ U< ${pickup.toFixed(2)} V.` : `All measured phase voltages remain above U< ${pickup.toFixed(2)} V.`;
      break;
    }

    case '59': {
      unit = 'V';
      measured = vMax;
      picked = measured >= pickup;
      expected = picked ? Math.max(0, Number(settings.tms) || 0) : Infinity;
      reason = picked ? `Maximum phase voltage ${measured.toFixed(2)} V ≥ U> ${pickup.toFixed(2)} V.` : `Maximum phase voltage remains below U> ${pickup.toFixed(2)} V.`;
      break;
    }

    case '59N': {
      unit = 'V';
      measured = residualMagnitude(signal.voltages.slice(0,3));
      picked = measured >= pickup;
      expected = picked ? Math.max(0, Number(settings.tms) || 0) : Infinity;
      reason = picked ? `Calculated residual |VA+VB+VC| = ${measured.toFixed(2)} V exceeds ${pickup.toFixed(2)} V.` : `Calculated residual voltage ${measured.toFixed(2)} V remains below ${pickup.toFixed(2)} V.`;
      details = { basis: 'calculated residual 3V0; broken-delta measured input is not implied' };
      break;
    }

    case '81U': {
      unit = 'Hz';
      measured = freq;
      picked = measured <= pickup;
      expected = picked ? Math.max(0, Number(settings.tms) || 0) : Infinity;
      reason = picked ? `Frequency ${measured.toFixed(2)} Hz ≤ f< ${pickup.toFixed(2)} Hz.` : `Frequency remains above f< ${pickup.toFixed(2)} Hz.`;
      break;
    }

    case '81O': {
      unit = 'Hz';
      measured = freq;
      picked = measured >= pickup;
      expected = picked ? Math.max(0, Number(settings.tms) || 0) : Infinity;
      reason = picked ? `Frequency ${measured.toFixed(2)} Hz ≥ f> ${pickup.toFixed(2)} Hz.` : `Frequency remains below f> ${pickup.toFixed(2)} Hz.`;
      break;
    }

    case '46': {
      measured = negativeSequence(signal.currents);
      picked = measured >= pickup;
      expected = picked ? Math.max(0, Number(settings.tms) || 0) : Infinity;
      reason = picked ? `Negative-sequence current I2 ${measured.toFixed(3)} A ≥ ${pickup.toFixed(3)} A.` : `I2 ${measured.toFixed(3)} A remains below ${pickup.toFixed(3)} A.`;
      break;
    }

    case '24': {
      unit = 'pu';
      const nominalV = Math.max(0.001, Number(settings.nominalV) || 63.5);
      const nominalF = Math.max(0.001, Number(settings.nominalF) || 50);
      const fpu = freq / nominalF;
      measured = fpu > 0 ? (vMax / nominalV) / fpu : Infinity;
      picked = measured >= pickup;
      expected = picked ? Math.max(0, Number(settings.tms) || 0) : Infinity;
      reason = picked ? `V/Hz = ${measured.toFixed(3)} pu ≥ ${pickup.toFixed(3)} pu.` : `V/Hz = ${measured.toFixed(3)} pu remains below ${pickup.toFixed(3)} pu.`;
      details = { nominalV, nominalF, vMax, freq };
      break;
    }

    case '25': {
      unit = '—';
      const source = signal.voltages[0];
      const bus = signal.voltages[3];
      const sourceMag = Number(source?.mag) || 0;
      const busMag = Number(bus?.mag) || 0;
      const dvPct = Math.max(sourceMag, busMag) > 0 ? Math.abs(sourceMag - busMag) / Math.max(sourceMag, busMag) * 100 : 100;
      const dAngle = Math.abs(normalizeAngle((Number(source?.angle)||0) - (Number(bus?.angle)||0)));
      const refF = Number(settings.remoteFrequency) || freq;
      const df = Math.abs(freq - refF);
      const maxDv = Number(settings.syncMaxDvPct) || 10;
      const maxDf = Number(settings.syncMaxDfHz) || 0.2;
      const maxAngle = Number(settings.syncMaxAngleDeg) || 10;
      const closeRequest = !!signal.binary?.CLOSE_REQUEST;
      picked = closeRequest && dvPct <= maxDv && df <= maxDf && dAngle <= maxAngle;
      measured = dAngle;
      expected = picked ? Math.max(0, Number(settings.tms) || 0.05) : Infinity;
      reason = `25 generic check: close request ${closeRequest ? 'present' : 'absent'}, ΔV=${dvPct.toFixed(2)}% (≤${maxDv}%), Δf=${df.toFixed(3)} Hz (≤${maxDf}), Δφ=${dAngle.toFixed(2)}° (≤${maxAngle}°).`;
      details = { dvPct, df, dAngle, closeRequest, maxDv, maxDf, maxAngle };
      stage = '25 permissive';
      break;
    }

    case '32R': {
      unit = 'W(sec)';
      const p = threePhaseRealPower(signal.voltages, signal.currents);
      measured = p;
      const reverseThreshold = Math.abs(pickup);
      picked = p <= -reverseThreshold;
      expected = picked ? Math.max(0, Number(settings.tms) || 0) : Infinity;
      reason = picked ? `Reverse real power ${p.toFixed(2)} W(sec) ≤ -${reverseThreshold.toFixed(2)} W threshold.` : `Real power ${p.toFixed(2)} W(sec) has not crossed the reverse-power threshold -${reverseThreshold.toFixed(2)} W.`;
      details = { signConvention: 'positive = export from modeled source to system' };
      break;
    }

    case '63': {
      unit = 'BI';
      measured = signal.binary?.SENSOR63 ? 1 : 0;
      picked = !!signal.binary?.SENSOR63;
      expected = picked ? Math.max(0, Number(settings.tms) || 0.05) : Infinity;
      reason = picked ? '63 mechanical/process contact is ACTIVE; debounce/qualification timer started.' : '63 mechanical/process contact is inactive.';
      break;
    }

    case '87T': {
      const diff = genericDifferential(signal.currents, settings);
      measured = diff.worst.idiff;
      picked = diff.picked;
      const highEnabled = !!settings.diffHighsetEnabled;
      const highPickup = Number(settings.diffHighset) || 5;
      const high = highEnabled && measured >= highPickup;
      expected = picked ? Math.max(0, high ? Number(settings.diffHighsetDelay) || 0.02 : Number(settings.tms) || 0.1) : Infinity;
      stage = high ? '87U' : '87T';
      reason = `${stage} generic compensated-input model: phase ${diff.worst.phase} Idiff=${diff.worst.idiff.toFixed(3)} A, Ibias=${diff.worst.ibias.toFixed(3)} A, operating threshold=${diff.worst.threshold.toFixed(3)} A.${picked ? ' Operating region entered.' : ' Stable/restraint region.'}`;
      details = { ...diff, assumption: 'IA/IB/IC and IX/IY/IZ are treated as already ratio/phase-compensated currents, all positive into the zone.' };
      break;
    }

    case '21':
      return unsupported('21 distance is mapped but not executable yet because mho/quadrilateral geometry, loops, k0 and polarization are not implemented.', 'Ω');
    case '49':
      return unsupported('49 thermal model is mapped but not executable yet because thermal memory, heating/cooling and asset-specific state are not implemented.', 'pu');
    case '40':
      return unsupported('40 loss-of-excitation is mapped but not executable yet because the impedance/admittance trajectory model is not implemented.', 'Ω');
    case '48':
    case '66':
      return unsupported(`${fn} is mapped for the motor state engine but the persistent STARTING/RUNNING/STOPPED model is not executable in this build.`);
    case '50BF':
    case '86':
      return unsupported(`${fn} is a scheme/actuator function in this architecture. Exercise it through the trip-logic options rather than as a standalone measurement element.`);
    default:
      return unsupported('Function is mapped but not executable in the current generic engine.');
  }

  return {
    supported: true,
    picked,
    measured,
    expected,
    reason,
    unit,
    stage,
    details,
    iMax,
    vMin,
    vMax,
    freq
  };
}

export function functionDefaultSettings(fn) {
  const common = {
    pickup: 1,
    curve: 'si',
    tms: 0.1,
    parallel50Enabled: false,
    parallel50Pickup: 5,
    parallel50Delay: 0.03,
    mtaDeg: 0,
    nominalV: 63.5,
    nominalF: 50,
    remoteFrequency: 50,
    syncMaxDvPct: 10,
    syncMaxDfHz: 0.2,
    syncMaxAngleDeg: 10,
    slopePct: 30,
    diffHighsetEnabled: false,
    diffHighset: 5,
    diffHighsetDelay: 0.02
  };
  const map = {
    '51': { pickup: 1, curve: 'si', tms: 0.1, parallel50Enabled: true, parallel50Pickup: 5, parallel50Delay: 0.03 },
    '50': { pickup: 5, curve: 'dt', tms: 0.03 },
    '50N': { pickup: 0.5, curve: 'dt', tms: 0.03 },
    '51N': { pickup: 0.3, curve: 'si', tms: 0.1 },
    '67': { pickup: 1, curve: 'dt', tms: 0.1, mtaDeg: 0 },
    '27': { pickup: 55, curve: 'dt', tms: 0.2 },
    '59': { pickup: 70, curve: 'dt', tms: 0.2 },
    '59N': { pickup: 15, curve: 'dt', tms: 0.2 },
    '81U': { pickup: 48, curve: 'dt', tms: 0.2 },
    '81O': { pickup: 52, curve: 'dt', tms: 0.2 },
    '46': { pickup: 0.2, curve: 'dt', tms: 0.5 },
    '24': { pickup: 1.10, curve: 'dt', tms: 1.0, nominalV: 63.5, nominalF: 50 },
    '25': { pickup: 10, curve: 'dt', tms: 0.05, remoteFrequency: 50, syncMaxDvPct: 10, syncMaxDfHz: 0.2, syncMaxAngleDeg: 10 },
    '32R': { pickup: 50, curve: 'dt', tms: 0.5 },
    '63': { pickup: 1, curve: 'dt', tms: 0.05 },
    '87T': { pickup: 0.2, curve: 'dt', tms: 0.1, slopePct: 30, diffHighsetEnabled: true, diffHighset: 5, diffHighsetDelay: 0.02 }
  };
  return { ...common, ...(map[fn] || {}) };
}

export { normalizeAngle };
