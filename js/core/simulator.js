import { evaluateFunction } from './protection.js';

export class Simulator {
  constructor(callbacks = {}) {
    this.cb = callbacks;
    this.timer = null;

    // IMPORTANT:
    // Initial reset must be silent because the Simulator object
    // has not finished being assigned to `sim` inside app.js yet.
    this.reset({ notify: false });
  }

  reset({ notify = true } = {}) {
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = null;
    this.running = false;

    this.time = 0;
    this.lastReal = 0;

    this.states = {
      pickup: false,
      operate: false,
      scheme: false,

      bo: false,
      bi: false,

      coil: false,
      lockout: false,

      breakerOpen: false,
      currentZero: false,

      bfInitiate: false,
      bfOperate: false,
      upstreamTrip: false
    };

    this.events = [];
    this.result = null;

    this.pickupAt = null;
    this.pickupMeasured = null;

    this.operateAt = null;
    this.endpointAt = null;

    this.faultApplied = false;

    // Reset one-shot event memory between tests.
    this._once = {};

    if (notify) {
      this.cb.onReset?.(this.snapshot());
    }
  }

  snapshot() {
    return {
      time: this.time,
      states: { ...this.states },
      events: [...this.events],
      result: this.result
    };
  }

  log(name, detail, evidence = 'SIM') {
    const event = {
      time: this.time,
      name,
      detail,
      evidence
    };

    this.events.push(event);

    this.cb.onEvent?.(
      event,
      this.snapshot()
    );
  }

  logOnce(key, name, detail, evidence) {
    if (this._once[key]) return;

    this._once[key] = true;

    this.log(
      name,
      detail,
      evidence
    );
  }

  start(config) {
    // Normal reset is safe now because Simulator has already
    // completed construction before Start can be pressed.
    this.reset();

    this.config = config;
    this.running = true;
    this.lastReal = performance.now();

    this.log(
      'TEST START',
      `${config.method} · ${config.physics.toUpperCase()} LOOP`,
      'TEST CONTRACT'
    );

    this.timer = setInterval(
      () => this.tick(),
      20
    );

    this.cb.onStart?.(
      this.snapshot()
    );
  }

  stop(reason = 'Operator stop') {
    if (!this.running) return;

    this.running = false;

    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = null;

    this.log(
      'TEST STOP',
      reason,
      'TEST CONTROL'
    );

    this.finish();

    this.cb.onStop?.(
      this.snapshot()
    );
  }

  finish() {
    const c = this.config;

    if (!c) return;

    /*
     * Unsupported test / hardware / function combination.
     */
    if (c.unsupported) {
      this.result = {
        verdict: 'UNSUPPORTED',
        detail: c.unsupported
      };

      return;
    }

    /*
     * Ramp currently reports pickup discovery.
     *
     * A proper pickup tolerance contract will later determine
     * PASS / FAIL. Until then successful pickup search remains
     * INCONCLUSIVE instead of pretending commissioning acceptance.
     */
    if (c.method === 'ramp') {
      this.result = {
        verdict:
          this.pickupMeasured == null
            ? 'FAIL'
            : 'INCONCLUSIVE',

        detail:
          this.pickupMeasured == null
            ? 'Pickup was not found during the configured ramp.'
            : `Pickup observed at ${this.pickupMeasured.toFixed(
                4
              )}. Configure a pickup-value tolerance contract before assigning PASS/FAIL.`
      };

      return;
    }

    const endpointMap = {
      operate: 'operate',
      bo: 'bo',
      bi: 'bi',
      breaker: 'breakerOpen',
      currentZero: 'currentZero'
    };

    const key = endpointMap[c.endpoint];

    const occurred =
      key != null
        ? this.states[key]
        : false;

    if (!occurred) {
      this.result = {
        verdict: 'FAIL',
        detail: `Expected endpoint ${c.endpoint} was not observed.`
      };

      return;
    }

    const expectedMs =
      (
        (this.pickupAt ?? 0) +
        c.expectedOperate +
        c.endpointDelay
      ) * 1000;

    const actualMs =
      this.endpointAt * 1000;

    const error =
      actualMs - expectedMs;

    const pass =
      Math.abs(error) <= c.toleranceMs;

    this.result = {
      verdict: pass
        ? 'PASS'
        : 'FAIL',

      expectedMs,
      actualMs,
      error,

      detail: pass
        ? 'Observed endpoint is within configured tolerance.'
        : 'Observed endpoint is outside configured tolerance.'
    };
  }

  tick() {
    if (!this.running) return;

    const now =
      performance.now();

    const dtReal =
      (now - this.lastReal) / 1000;

    this.lastReal = now;

    const dt =
      dtReal * this.config.speed;

    this.time += dt;

    /*
     * Apply test-generator behavior first.
     *
     * Example:
     * - shot
     * - ramp
     * - state sequence
     * - closed-loop topology response
     */
    this.applyMethod();

    /*
     * Evaluate current protection element.
     */
    const evalResult =
      evaluateFunction(
        this.config.fn,
        this.config.signal(),
        this.config.settings
      );

    this.cb.onEvaluate?.(
      evalResult,
      this.snapshot()
    );

    /*
     * Function exists in mapping but is not executable.
     */
    if (!evalResult.supported) {
      this.config.unsupported =
        evalResult.reason;

      this.stop(
        'Unsupported function/test combination'
      );

      return;
    }

    /*
     * ELEMENT PICKUP
     */
    if (
      evalResult.picked &&
      !this.states.pickup
    ) {
      this.states.pickup = true;

      this.pickupAt =
        this.time;

      this.pickupMeasured =
        evalResult.measured;

      this.log(
        'ELEMENT PICKUP',
        evalResult.reason,
        'ELEMENT'
      );
    }

    /*
     * ELEMENT RESET before operate.
     */
    if (
      !evalResult.picked &&
      this.states.pickup &&
      !this.states.operate
    ) {
      this.states.pickup = false;

      this.pickupAt = null;

      this.log(
        'ELEMENT RESET',
        'Pickup condition removed before operate.',
        'ELEMENT'
      );
    }

    /*
     * ELEMENT OPERATE
     */
    if (
      this.states.pickup &&
      !this.states.operate &&
      this.pickupAt != null &&
      this.time - this.pickupAt >=
        evalResult.expected
    ) {
      this.states.operate = true;

      this.operateAt =
        this.time;

      this.log(
        'ELEMENT OPERATE',
        `Element timer completed after ${(
          this.time -
          this.pickupAt
        ).toFixed(4)} s.`,
        'ELEMENT'
      );
    }

    /*
     * Progress external protection / trip chain.
     */
    this.progressTripChain();

    /*
     * Update UI.
     */
    this.cb.onTick?.(
      evalResult,
      this.snapshot()
    );

    /*
     * Test duration timeout.
     */
    if (
      this.time >=
      this.config.maxDuration
    ) {
      this.stop(
        'Maximum test duration reached'
      );

      return;
    }

    /*
     * Automatically finish shortly after selected
     * observation endpoint is reached.
     */
    if (
      this.endpointAt != null &&
      this.config.stopOnEndpoint &&
      this.time >
        this.endpointAt + 0.05
    ) {
      this.stop(
        'Expected endpoint observed'
      );
    }
  }

  applyMethod() {
    const c =
      this.config;

    /*
     * CLOSED LOOP
     *
     * Once the protected breaker or backup breaker clears
     * the system, topology drives current toward zero.
     */
    if (
      c.physics === 'closed' &&
      (
        this.states.breakerOpen ||
        this.states.upstreamTrip
      )
    ) {
      c.forceCurrentZero();

      return;
    }

    /*
     * STATE SEQUENCE
     *
     * State 1:
     * prefault
     *
     * State 2:
     * fault
     *
     * State 3:
     * postfault
     */
    if (
      c.method === 'sequence'
    ) {
      if (
        this.time < 0.25
      ) {
        c.applyPrefault();
      }

      else if (
        this.time <
        c.maxDuration - 0.4
      ) {
        if (
          !this.faultApplied
        ) {
          this.faultApplied = true;

          this.log(
            'FAULT STATE',
            'State 2 applied.',
            'TEST GENERATOR'
          );
        }

        c.applyFault();
      }

      else {
        c.applyPostfault();
      }

      return;
    }

    /*
     * PICKUP RAMP
     */
    if (
      c.method === 'ramp'
    ) {
      const ratio =
        Math.min(
          1,
          this.time /
            Math.max(
              0.5,
              c.maxDuration * 0.65
            )
        );

      c.applyRamp(ratio);

      return;
    }

    /*
     * SINGLE SHOT
     */
    if (
      !this.faultApplied
    ) {
      this.faultApplied = true;

      this.log(
        'FAULT / SHOT',
        'Single-shot stimulus applied.',
        'TEST GENERATOR'
      );
    }

    c.applyFault();
  }

  at(offset) {
    return (
      this.operateAt != null &&
      this.time >=
        this.operateAt + offset
    );
  }

  progressTripChain() {
    const c =
      this.config;

    /*
     * -------------------------------------------------------
     * 1. ELEMENT OPERATE
     *        ↓
     * 2. PROTECTION SCHEME OPERATE
     * -------------------------------------------------------
     */
    if (
      this.states.operate &&
      !this.states.scheme &&
      this.at(0.005)
    ) {
      this.states.scheme = true;

      this.log(
        'SCHEME OPERATE',
        'Protection element accepted by scheme logic.',
        'SCHEME'
      );
    }

    /*
     * -------------------------------------------------------
     * SCHEME
     *    ↓
     * RELAY BINARY OUTPUT
     * -------------------------------------------------------
     */
    if (
      this.states.scheme &&
      !this.states.bo &&
      this.at(0.013)
    ) {
      if (
        c.blockOutput
      ) {
        this.logOnce(
          'boBlocked',
          'BO BLOCKED',
          'Internal operate exists, but physical BO is blocked.',
          'SCHEME'
        );
      }

      else {
        this.states.bo = true;

        this.log(
          'RELAY BO1',
          'Physical relay output model changed state.',
          'RELAY OUTPUT'
        );
      }
    }

    /*
     * -------------------------------------------------------
     * RELAY BO
     *    ↓
     * TESTER BINARY INPUT
     * -------------------------------------------------------
     */
    if (
      this.states.bo &&
      !this.states.bi &&
      this.at(0.023)
    ) {
      if (
        c.biDisconnected
      ) {
        this.logOnce(
          'biDisconnected',
          'BI1 NOT SEEN',
          'Tester BI is disconnected; BO transition is not observed at BI1.',
          'TESTER BI'
        );
      }

      else {
        this.states.bi = true;

        this.log(
          'TESTER BI1',
          'Binary input detected relay output contact.',
          'TESTER BI'
        );
      }
    }

    /*
     * -------------------------------------------------------
     * OPTIONAL 86 LOCKOUT
     * -------------------------------------------------------
     */
    if (
      this.states.bo &&
      !this.states.lockout &&
      c.enable86 &&
      this.at(0.030)
    ) {
      this.states.lockout = true;

      this.log(
        '86 LOCKOUT',
        'Master trip latch operated.',
        'PANEL'
      );
    }

    /*
     * Trip path is allowed either:
     *
     * BO → Trip Coil
     *
     * OR
     *
     * BO → 86 → Trip Coil
     */
    const routeReady =
      c.enable86
        ? this.states.lockout
        : this.states.bo;

    /*
     * -------------------------------------------------------
     * TRIP COIL
     * -------------------------------------------------------
     */
    const coilDelay =
      c.enable86
        ? 0.040
        : 0.030;

    if (
      routeReady &&
      !this.states.coil &&
      this.at(coilDelay)
    ) {
      this.states.coil = true;

      this.log(
        'TRIP COIL ENERGIZED',
        'DC trip path / virtual coil energized.',
        'PANEL'
      );
    }

    /*
     * -------------------------------------------------------
     * BREAKER FAILURE INITIATE
     * -------------------------------------------------------
     */
    if (
      this.states.coil &&
      c.enableBF &&
      !this.states.bfInitiate &&
      this.at(0.035)
    ) {
      this.states.bfInitiate = true;

      this.log(
        '50BF INITIATE',
        'Breaker-failure supervision initiated.',
        'BF'
      );
    }

    /*
     * -------------------------------------------------------
     * NORMAL CIRCUIT BREAKER OPENING
     * -------------------------------------------------------
     */
    if (
      this.states.coil &&
      !this.states.breakerOpen &&
      !c.breakerFail &&
      this.at(0.095)
    ) {
      this.states.breakerOpen = true;

      this.log(
        'BREAKER OPEN',
        'Virtual breaker mechanism opened.',
        'BREAKER'
      );

      this.log(
        '52a / 52b',
        '52a=0 · 52b=1',
        'BREAKER AUX'
      );

      this.captureEndpoint(
        'breaker'
      );
    }

    /*
     * -------------------------------------------------------
     * CLOSED LOOP CURRENT EXTINCTION
     * -------------------------------------------------------
     */
    if (
      this.states.breakerOpen &&
      c.physics === 'closed' &&
      !this.states.currentZero &&
      this.at(0.115)
    ) {
      this.states.currentZero = true;

      c.forceCurrentZero();

      this.log(
        'CURRENT EXTINCTION',
        'Closed-loop topology recalculated after breaker opening.',
        'SYSTEM'
      );

      this.captureEndpoint(
        'currentZero'
      );
    }

    /*
     * -------------------------------------------------------
     * OPEN LOOP
     *
     * Secondary-injection tester continues injecting even
     * though the virtual breaker has opened.
     * -------------------------------------------------------
     */
    if (
      this.states.breakerOpen &&
      c.physics === 'open' &&
      !this.states.currentZero &&
      this.at(0.115)
    ) {
      this.logOnce(
        'openLoopCurrent',
        'OPEN-LOOP CURRENT RETAINED',
        'Tester injection remains commanded although virtual breaker is open.',
        'TEST PHYSICS'
      );
    }

    /*
     * -------------------------------------------------------
     * BREAKER FAILURE OPERATE
     * -------------------------------------------------------
     */
    if (
      this.states.bfInitiate &&
      c.breakerFail &&
      !this.states.bfOperate &&
      this.operateAt != null &&
      this.time >=
        this.operateAt + 0.250
    ) {
      this.states.bfOperate = true;

      this.log(
        '50BF OPERATE',
        'Breaker did not clear within BF timer.',
        'BF'
      );
    }

    /*
     * -------------------------------------------------------
     * BREAKER FAILURE BACKUP / UPSTREAM TRIP
     * -------------------------------------------------------
     */
    if (
      this.states.bfOperate &&
      !this.states.upstreamTrip &&
      this.operateAt != null &&
      this.time >=
        this.operateAt + 0.300
    ) {
      this.states.upstreamTrip = true;

      this.log(
        'UPSTREAM TRIP',
        'Backup breaker / zone trip issued.',
        'BF BACKUP'
      );

      /*
       * In CLOSED LOOP, backup isolation clears current.
       */
      if (
        c.physics === 'closed'
      ) {
        this.states.currentZero = true;

        c.forceCurrentZero();

        this.log(
          'CURRENT EXTINCTION',
          'Current cleared by backup trip in closed-loop model.',
          'SYSTEM'
        );

        this.captureEndpoint(
          'currentZero'
        );
      }
    }

    /*
     * Capture selectable observation endpoints.
     */
    if (
      this.states.operate
    ) {
      this.captureEndpoint(
        'operate'
      );
    }

    if (
      this.states.bo
    ) {
      this.captureEndpoint(
        'bo'
      );
    }

    if (
      this.states.bi
    ) {
      this.captureEndpoint(
        'bi'
      );
    }
  }

  captureEndpoint(key) {
    const map = {
      operate: 'operate',
      bo: 'bo',
      bi: 'bi',
      breaker: 'breakerOpen',
      currentZero: 'currentZero'
    };

    const stateKey =
      map[key];

    if (
      this.config.endpoint === key &&
      this.endpointAt == null &&
      this.states[stateKey]
    ) {
      this.endpointAt =
        this.time;
    }
  }
}
