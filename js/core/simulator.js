import { evaluateFunction } from './protection.js';

const DEFAULT_DELAYS = Object.freeze({
  schemeMs: 5,
  boMs: 8,
  biMs: 10,
  lockoutMs: 10,
  coilMs: 10,
  breakerMs: 55,
  interruptionMs: 20,
  bfInitiateMs: 2,
  bfTimerMs: 200,
  bfBackupMs: 50
});

export class Simulator {
  constructor(callbacks = {}) {
    this.cb = callbacks;
    this.timer = null;
    this.config = null;
    this.reset({ notify: false });
  }

  reset({ notify = true } = {}) {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.running = false;
    this.time = 0;
    this.states = this.blankStates();
    this.events = [];
    this.timestamps = {};
    this.result = null;
    this.pickupMeasured = null;
    this.dropoutMeasured = null;
    this.pickupStage = null;
    this.faultApplied = false;
    this.postFaultApplied = false;
    this._once = {};
    this._lastEval = null;
    this._lastSignal = null;
    this._rampWasAbove = false;
    this.cb.onSystemFactor?.(1);
    if (notify) this.cb.onReset?.(this.snapshot());
  }

  blankStates() {
    return {
      pickup: false,
      operate: false,
      scheme: false,
      bo: false,
      bi: false,
      lockout: false,
      coil: false,
      breakerOpen: false,
      currentZero: false,
      bfInitiate: false,
      bfCleared: false,
      bfOperate: false,
      retrip: false,
      upstreamTrip: false
    };
  }

  snapshot() {
    return {
      time: this.time,
      running: this.running,
      states: { ...this.states },
      timestamps: { ...this.timestamps },
      events: [...this.events],
      result: this.result,
      pickupMeasured: this.pickupMeasured,
      dropoutMeasured: this.dropoutMeasured,
      pickupStage: this.pickupStage
    };
  }

  log(name, detail, evidence = 'SIM', meta = {}) {
    const event = { time: this.time, name, detail, evidence, ...meta };
    this.events.push(event);
    this.cb.onEvent?.(event, this.snapshot());
  }

  logOnce(key, name, detail, evidence = 'SIM', meta = {}) {
    if (this._once[key]) return;
    this._once[key] = true;
    this.log(name, detail, evidence, meta);
  }

  setTimestamp(key, value = this.time) {
    if (this.timestamps[key] == null) this.timestamps[key] = value;
  }

  start(config) {
    this.reset();
    this.config = {
      delays: { ...DEFAULT_DELAYS, ...(config.delays || {}) },
      speed: 5,
      maxDuration: 5,
      toleranceMs: 20,
      pickupTolerancePct: 5,
      stopOnEndpoint: true,
      bfClearCriterion: '52',
      ...config
    };
    if (this.config.method === 'ramp') this.config.stopOnEndpoint = false;

    if (this.config.unsupported) {
      this.result = { verdict: 'UNSUPPORTED', detail: this.config.unsupported };
      this.cb.onStop?.(this.snapshot());
      return;
    }

    this.running = true;
    this.log('TEST START', `${this.config.method.toUpperCase()} · ${this.config.physics.toUpperCase()} LOOP`, 'TEST CONTRACT');
    this.timer = setInterval(() => this.advanceBatch(), 20);
    this.cb.onStart?.(this.snapshot());
  }

  advanceBatch() {
    if (!this.running) return;
    const speed = Math.max(1, Number(this.config.speed) || 1);
    const iterations = Math.max(1, Math.round(20 * speed)); // 1 ms virtual substeps per 20 ms real tick.
    for (let i = 0; i < iterations && this.running; i++) this.step(0.001);
    if (this.running) this.cb.onTick?.(this._lastEval, this.snapshot());
  }

  step(dt) {
    if (!this.running) return;
    this.time = +(this.time + dt).toFixed(6);
    this.applyMethod();

    const signal = this.config.signal();
    this._lastSignal = signal;
    const evaluation = evaluateFunction(this.config.fn, signal, this.config.settings);
    this._lastEval = evaluation;
    this.cb.onEvaluate?.(evaluation, this.snapshot());

    if (!evaluation.supported) {
      this.config.unsupported = evaluation.reason;
      this.stop('Unsupported function/test combination');
      return;
    }

    this.evaluateElement(evaluation);
    this.progressTripChain();

    if (this.time >= this.config.maxDuration) {
      this.stop('Maximum test duration reached');
      return;
    }

    const endpointAt = this.timestamps[this.config.endpoint];
    if (endpointAt != null && this.config.stopOnEndpoint && this.time >= endpointAt + 0.05) {
      this.stop('Expected endpoint observed');
    }
  }

  applyMethod() {
    const c = this.config;

    if (c.method === 'sequence') {
      if (this.time < 0.25) {
        c.applyPrefault?.();
        return;
      }
      if (this.timestamps.stimulus == null) {
        this.setTimestamp('stimulus', this.time);
        this.log('FAULT STATE', 'State 2 applied.', 'TEST GENERATOR');
      }
      if (this.time < c.maxDuration - 0.4) {
        c.applyFault?.();
      } else {
        if (!this.postFaultApplied) {
          this.postFaultApplied = true;
          this.log('POSTFAULT STATE', 'State 3 applied.', 'TEST GENERATOR');
        }
        c.applyPostfault?.();
      }
      return;
    }

    if (c.method === 'ramp') {
      if (this.timestamps.stimulus == null) this.setTimestamp('stimulus', 0);
      const activeWindow = Math.max(0.5, c.maxDuration - 0.25);
      const p = Math.min(1, this.time / activeWindow);
      const triangle = p <= 0.55 ? p / 0.55 : Math.max(0, (1 - p) / 0.45);
      c.applyRamp?.(triangle, p);
      return;
    }

    if (!this.faultApplied) {
      this.faultApplied = true;
      this.setTimestamp('stimulus', this.time);
      this.log('FAULT / SHOT', 'Single-shot stimulus applied.', 'TEST GENERATOR');
    }
    c.applyFault?.();
  }

  evaluateElement(e) {
    if (e.picked && !this.states.pickup) {
      this.states.pickup = true;
      this.setTimestamp('pickup', this.time);
      this.pickupMeasured = e.measured;
      this.pickupStage = e.stage;
      this.timestamps.elementTimerStart = this.time;
      this.log('ELEMENT PICKUP', `${e.stage || this.config.fn}: ${e.reason}`, 'ELEMENT', { stage: e.stage });
    }

    if (e.picked && this.states.pickup && this.pickupStage !== e.stage && !this.states.operate) {
      // A faster overlapping stage (for example 50 inside a 51 test) can take control.
      this.pickupStage = e.stage;
      this.timestamps.elementTimerStart = this.time;
      this.log('ELEMENT STAGE CHANGE', `Timing control transferred to ${e.stage}. ${e.reason}`, 'ELEMENT', { stage: e.stage });
    }

    if (!e.picked && this.states.pickup) {
      this.states.pickup = false;
      if (this.config.method === 'ramp' && this.pickupMeasured != null && this.dropoutMeasured == null) {
        this.dropoutMeasured = this.lastMeasuredBeforeReset ?? e.measured;
        this.log('ELEMENT DROPOUT', `Element reset observed near ${Number(this.dropoutMeasured).toFixed(4)} ${e.unit}.`, 'ELEMENT');
      } else {
        this.log('ELEMENT RESET', 'Pickup condition removed before operate.', 'ELEMENT');
      }
      this.timestamps.elementTimerStart = null;
      this.pickupStage = null;
    }

    if (e.picked) this.lastMeasuredBeforeReset = e.measured;

    if (this.states.pickup && !this.states.operate) {
      const timerStart = this.timestamps.elementTimerStart ?? this.timestamps.pickup ?? this.time;
      if (Number.isFinite(e.expected) && this.time - timerStart >= e.expected) {
        this.states.operate = true;
        this.setTimestamp('operate', this.time);
        this.log('ELEMENT OPERATE', `${e.stage || this.config.fn} completed element timing after ${((this.time - timerStart) * 1000).toFixed(1)} ms.`, 'ELEMENT', { stage: e.stage });
      }
    }
  }

  progressTripChain() {
    const c = this.config;
    const d = c.delays;
    const t = key => this.timestamps[key];
    const elapsed = (from, ms) => t(from) != null && this.time >= t(from) + ms / 1000;

    if (this.states.operate && !this.states.scheme && elapsed('operate', d.schemeMs)) {
      this.states.scheme = true;
      this.setTimestamp('scheme');
      if (c.schemeRoute === 'permissive') {
        this.log('SCHEME PERMISSIVE', 'Element operate produced a permissive / control output, not a protection trip.', 'SCHEME');
      } else {
        this.log('SCHEME OPERATE', 'Protection element accepted by the trip matrix / scheme logic.', 'SCHEME');
      }
    }

    if (c.schemeRoute === 'permissive') return;

    if (this.states.scheme && !this.states.bo && elapsed('scheme', d.boMs)) {
      if (c.blockOutput) {
        this.logOnce('boBlocked', 'BO BLOCKED', 'Internal scheme operate exists, but physical BO is blocked.', 'SCHEME');
      } else {
        this.states.bo = true;
        this.setTimestamp('bo');
        this.log('RELAY BO1', 'Relay binary-output model changed state.', 'RELAY OUTPUT');
      }
    }

    if (this.states.scheme && c.enableBF && !this.states.bfInitiate && elapsed('scheme', d.bfInitiateMs)) {
      this.states.bfInitiate = true;
      this.setTimestamp('bfInitiate');
      this.log('50BF INITIATE', 'Breaker-failure supervision initiated by the trip scheme.', 'BF');
    }

    if (this.states.bo && !this.states.bi && elapsed('bo', d.biMs)) {
      if (c.biDisconnected) {
        this.logOnce('biDisconnected', 'BI1 NOT SEEN', 'Relay BO changed, but tester BI1 is disconnected.', 'TESTER BI');
      } else {
        this.states.bi = true;
        this.setTimestamp('bi');
        this.log('TESTER BI1', 'Tester binary input observed relay BO1 transition.', 'TESTER BI');
      }
    }

    if (this.states.bo && c.enable86 && !this.states.lockout && elapsed('bo', d.lockoutMs)) {
      this.states.lockout = true;
      this.setTimestamp('lockout');
      this.log('86 LOCKOUT', 'Master-trip latch operated.', 'PANEL');
    }

    const routeKey = c.enable86 ? 'lockout' : 'bo';
    const routeReady = c.enable86 ? this.states.lockout : this.states.bo;
    if (routeReady && !this.states.coil && elapsed(routeKey, d.coilMs)) {
      this.states.coil = true;
      this.setTimestamp('coil');
      this.log('TRIP COIL ENERGIZED', 'Virtual DC trip path / trip coil energized.', 'PANEL');
    }

    if (this.states.coil && !this.states.breakerOpen && !c.breakerFail && elapsed('coil', d.breakerMs)) {
      this.states.breakerOpen = true;
      this.setTimestamp('breaker');
      this.log('BREAKER OPEN', 'Virtual breaker main mechanism opened.', 'BREAKER');
      this.log('52a / 52b', '52a=0 · 52b=1', 'BREAKER AUX');
    }

    if (this.states.breakerOpen && c.enableBF && this.states.bfInitiate && !this.states.bfCleared) {
      const clearBy52 = c.bfClearCriterion === '52';
      if (clearBy52) {
        this.states.bfCleared = true;
        this.log('50BF RESET', 'Breaker-open feedback satisfied the selected BF clearing criterion.', 'BF');
      }
    }

    if (this.states.breakerOpen && c.physics === 'closed' && !this.states.currentZero && elapsed('breaker', d.interruptionMs)) {
      this.states.currentZero = true;
      this.setTimestamp('currentZero');
      c.setSystemCurrentFactor?.(0);
      this.log('CURRENT EXTINCTION', 'Closed-loop network response cleared modeled current after breaker opening.', 'SYSTEM');
      if (c.enableBF && c.bfClearCriterion === 'current' && !this.states.bfCleared) {
        this.states.bfCleared = true;
        this.log('50BF RESET', 'Current extinction satisfied the selected BF clearing criterion.', 'BF');
      }
    }

    if (this.states.breakerOpen && c.physics === 'open' && elapsed('breaker', d.interruptionMs)) {
      this.logOnce('openLoopRetained', 'OPEN-LOOP CURRENT RETAINED', 'Breaker is open, but tester current remains commanded because the test is open-loop.', 'TEST PHYSICS');
    }

    if (this.states.bfInitiate && !this.states.bfCleared && !this.states.bfOperate && elapsed('bfInitiate', d.bfTimerMs)) {
      this.states.bfOperate = true;
      this.setTimestamp('bfOperate');
      this.log('50BF OPERATE', 'Breaker-failure clearing criterion was not satisfied before BF timer expiry.', 'BF');
      if (c.bfRetrip !== false) {
        this.states.retrip = true;
        this.setTimestamp('retrip');
        this.log('50BF RETRIP', 'Retrip command issued to the local breaker path.', 'BF');
      }
    }

    if (this.states.bfOperate && !this.states.upstreamTrip && elapsed('bfOperate', d.bfBackupMs)) {
      this.states.upstreamTrip = true;
      this.setTimestamp('upstreamTrip');
      this.log('UPSTREAM TRIP', 'Backup isolation / upstream-zone trip issued.', 'BF BACKUP');
      if (c.physics === 'closed' && !this.states.currentZero) {
        c.setSystemCurrentFactor?.(0);
        this.states.currentZero = true;
        this.setTimestamp('currentZero');
        this.log('CURRENT EXTINCTION', 'Closed-loop current cleared after backup isolation.', 'SYSTEM');
      }
    }
  }

  expectedChainDelaySeconds(endpoint) {
    const c = this.config || {};
    const d = { ...DEFAULT_DELAYS, ...(c.delays || {}) };
    const sec = ms => ms / 1000;
    const scheme = sec(d.schemeMs);
    const bo = scheme + sec(d.boMs);
    const bi = bo + sec(d.biMs);
    const lockout = bo + sec(d.lockoutMs);
    const coil = (c.enable86 ? lockout : bo) + sec(d.coilMs);
    const breaker = coil + sec(d.breakerMs);
    const currentZero = breaker + sec(d.interruptionMs);
    const bfInitiate = scheme + sec(d.bfInitiateMs);
    const bfOperate = bfInitiate + sec(d.bfTimerMs);
    const upstreamTrip = bfOperate + sec(d.bfBackupMs);
    const map = { pickup: 0, operate: 0, scheme, bo, bi, lockout, coil, breaker, currentZero, bfOperate, upstreamTrip };
    return map[endpoint] ?? 0;
  }

  finish() {
    const c = this.config;
    if (!c) return;

    if (c.unsupported) {
      this.result = { verdict: 'UNSUPPORTED', detail: c.unsupported };
      return;
    }

    if (c.method === 'ramp') {
      if (this.pickupMeasured == null) {
        this.result = { verdict: 'FAIL', detail: 'Pickup was not found during the configured ramp.', pickupMeasured: null, dropoutMeasured: this.dropoutMeasured };
        return;
      }
      const reference = Number(c.settings.pickup) || 0;
      const errPct = reference ? (this.pickupMeasured - reference) / reference * 100 : 0;
      const tol = Number(c.pickupTolerancePct) || 0;
      const pass = Math.abs(errPct) <= tol;
      this.result = {
        verdict: tol > 0 ? (pass ? 'PASS' : 'FAIL') : 'INCONCLUSIVE',
        detail: tol > 0 ? `Pickup search error ${errPct.toFixed(2)}% against configured training tolerance ±${tol.toFixed(2)}%.` : 'Pickup observed, but no pickup-value tolerance was declared.',
        pickupMeasured: this.pickupMeasured,
        dropoutMeasured: this.dropoutMeasured,
        pickupErrorPct: errPct
      };
      return;
    }

    const endpoint = c.endpoint;
    const endpointAt = this.timestamps[endpoint];
    if (endpointAt == null) {
      this.result = { verdict: 'FAIL', detail: `Expected endpoint “${endpoint}” was not observed.` };
      return;
    }

    const forbidden = (c.forbiddenStates || []).filter(key => this.states[key]);
    if (forbidden.length) {
      this.result = { verdict: 'FAIL', detail: `Forbidden event/state occurred: ${forbidden.join(', ')}.`, forbidden };
      return;
    }

    const stimulusAt = this.timestamps.stimulus ?? 0;
    const actualMs = (endpointAt - stimulusAt) * 1000;
    let expectedElement = Number(c.expectedOperate);
    if (!Number.isFinite(expectedElement)) expectedElement = 0;
    if (endpoint === 'pickup') expectedElement = Math.max(0, (this.timestamps.pickup ?? stimulusAt) - stimulusAt);
    const expectedMs = (expectedElement + this.expectedChainDelaySeconds(endpoint)) * 1000;
    const error = actualMs - expectedMs;
    const toleranceMs = Number(c.toleranceMs) || 0;
    const pass = Math.abs(error) <= toleranceMs;
    this.result = {
      verdict: pass ? 'PASS' : 'FAIL',
      expectedMs,
      actualMs,
      error,
      detail: pass ? 'Observed endpoint is within the declared training tolerance.' : 'Observed endpoint is outside the declared training tolerance.'
    };
  }

  stop(reason = 'Operator stop') {
    if (!this.running) return;
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.log('TEST STOP', reason, 'TEST CONTROL');
    this.finish();
    this.cb.onStop?.(this.snapshot());
  }

  resetElement() {
    this.states.pickup = false;
    this.states.operate = false;
    this.timestamps.pickup = null;
    this.timestamps.operate = null;
    this.timestamps.elementTimerStart = null;
    this.pickupStage = null;
    this.log('ELEMENT RESET', 'Element pickup / operate state reset. External trip-chain states are unchanged.', 'RELAY CONTROL');
    this.cb.onTick?.(this._lastEval, this.snapshot());
  }

  resetLockout() {
    if (!this.states.lockout) {
      this.log('86 RESET', 'Lockout already reset.', 'PANEL');
      return true;
    }
    if (!this.states.breakerOpen && this.states.coil) {
      this.log('86 RESET BLOCKED', 'Reset denied while trip path is still active.', 'PANEL');
      return false;
    }
    this.states.lockout = false;
    this.timestamps.lockoutReset = this.time;
    this.log('86 RESET', 'Master-trip latch reset. Element indications are not automatically cleared.', 'PANEL');
    return true;
  }

  closeBreaker() {
    if (this.states.lockout) {
      this.log('CLOSE BLOCKED', 'Breaker close request blocked by active 86 lockout.', 'BREAKER CONTROL');
      return false;
    }
    this.states.breakerOpen = false;
    this.states.currentZero = false;
    this.timestamps.breakerClosed = this.time;
    this.cb.onSystemFactor?.(1);
    this.log('BREAKER CLOSE', 'Virtual breaker closed; 52a=1 · 52b=0.', 'BREAKER CONTROL');
    return true;
  }
}

export { DEFAULT_DELAYS };
