const currentNames = ['IA','IB','IC','IX','IY','IZ'];
const voltageNames = ['VA','VB','VC','VX','VY','VZ'];
const defaultAngles = [0,-120,120,180,60,-60];

const clone = value => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

export class TesterModel {
  constructor(profile) {
    this.profile = profile;
    this.outputEnabled = false;
    this.closedLoopFactor = 1;
    this.selectedType = 'current';
    this.selectedIndex = 0;
    this.frequency = 50;
    this.command = {
      currents: currentNames.map((name, i) => ({ name, mag: i === 0 ? 2 : 0, angle: defaultAngles[i], linked: true })),
      voltages: voltageNames.map((name, i) => ({ name, mag: i < 3 ? 63.5 : 0, angle: defaultAngles[i], linked: true })),
      binary: {
        BI1: false,
        BI2: false,
        BI3: false,
        BI4: false,
        BO1: false,
        BO2: false,
        BO3: false,
        BO4: false,
        SENSOR63: false,
        CLOSE_REQUEST: false
      }
    };
  }

  setProfile(profile) {
    this.profile = profile;
    this.enforceLimits();
  }

  resetSignals() {
    this.outputEnabled = false;
    this.closedLoopFactor = 1;
    this.frequency = 50;
    this.command.currents.forEach((ch, i) => {
      ch.mag = i === 0 ? 2 : 0;
      ch.angle = defaultAngles[i];
      ch.linked = true;
    });
    this.command.voltages.forEach((ch, i) => {
      ch.mag = i < 3 ? 63.5 : 0;
      ch.angle = defaultAngles[i];
      ch.linked = true;
    });
    Object.keys(this.command.binary).forEach(k => this.command.binary[k] = false);
  }

  setOutput(enabled) {
    this.outputEnabled = !!enabled;
  }

  select(type, index) {
    this.selectedType = type;
    this.selectedIndex = Math.max(0, Math.min(5, Number(index) || 0));
  }

  selectedChannel() {
    const arr = this.selectedType === 'voltage' ? this.command.voltages : this.command.currents;
    return arr[this.selectedIndex];
  }

  fineAdjust(step) {
    const ch = this.selectedChannel();
    if (!ch) return;
    ch.mag = Math.max(0, ch.mag + Number(step || 0));
    this.enforceLimits();
  }

  toggleLink(type, index) {
    const arr = type === 'voltage' ? this.command.voltages : this.command.currents;
    if (!arr[index]) return;
    arr[index].linked = !arr[index].linked;
  }

  setMagnitude(type, index, value) {
    const arr = type === 'voltage' ? this.command.voltages : this.command.currents;
    if (!arr[index]) return;
    arr[index].mag = Math.max(0, Number(value) || 0);
    this.enforceLimits();
  }

  setAngle(type, index, value) {
    const arr = type === 'voltage' ? this.command.voltages : this.command.currents;
    if (!arr[index]) return;
    let angle = Number(value) || 0;
    while (angle > 180) angle -= 360;
    while (angle <= -180) angle += 360;
    arr[index].angle = angle;
  }

  setFrequency(value) {
    this.frequency = clamp(value, 1, 100);
  }

  setBinary(name, value) {
    if (!(name in this.command.binary)) return;
    this.command.binary[name] = !!value;
  }

  setClosedLoopFactor(value) {
    this.closedLoopFactor = clamp(value, 0, 1);
  }

  enforceLimits() {
    const maxI = Number.isFinite(this.profile?.maxCurrent) ? this.profile.maxCurrent : Infinity;
    const maxV = Number.isFinite(this.profile?.maxVoltage) ? this.profile.maxVoltage : Infinity;
    this.command.currents.forEach(ch => ch.mag = clamp(ch.mag, 0, maxI));
    this.command.voltages.forEach(ch => ch.mag = clamp(ch.mag, 0, maxV));
  }

  getCommandedSignal() {
    return {
      currents: clone(this.command.currents),
      voltages: clone(this.command.voltages),
      frequency: this.frequency,
      binary: { ...this.command.binary },
      outputEnabled: this.outputEnabled
    };
  }

  getInjectedSignal() {
    const enabled = this.outputEnabled;
    const factor = enabled ? this.closedLoopFactor : 0;
    const currents = this.command.currents.map(ch => ({
      ...ch,
      mag: ch.linked ? ch.mag * factor : 0
    }));
    const voltages = this.command.voltages.map(ch => ({
      ...ch,
      mag: ch.linked ? ch.mag : 0
    }));
    return {
      currents,
      voltages,
      frequency: this.frequency,
      binary: { ...this.command.binary },
      outputEnabled: enabled,
      closedLoopFactor: this.closedLoopFactor
    };
  }

  capabilityCheck({ fidelity = 'ideal', functionId = null, endpoint = null, physics = 'open' } = {}) {
    const p = this.profile;
    if (!p) return { ok: false, status: 'UNSUPPORTED', reason: 'No tester profile is selected.' };
    if (fidelity === 'hardware' && !p.verified) {
      return {
        ok: false,
        status: 'UNSUPPORTED',
        reason: `${p.name} is not manual-validated. Exact output limits, burden/compliance and BI behavior are unknown.`
      };
    }
    if (physics === 'open' && endpoint === 'currentZero') {
      return {
        ok: false,
        status: 'UNSUPPORTED',
        reason: 'Current extinction is not a valid automatic endpoint for open-loop secondary injection. Breaker opening does not remove tester current.'
      };
    }
    if (functionId === '87T' && (p.currentChannels ?? 0) < 6) {
      return { ok: false, status: 'UNSUPPORTED', reason: '87T generic two-side test requires six current channels.' };
    }
    return { ok: true, status: 'SUPPORTED', reason: fidelity === 'ideal' ? 'Ideal virtual capability check passed.' : 'Selected hardware profile is validated for the declared capability set.' };
  }

  constraintSummary() {
    const p = this.profile;
    if (!p) return 'NO TESTER PROFILE';
    const i = Number.isFinite(p.maxCurrent) ? `${p.maxCurrent} A` : 'unverified I range';
    const v = Number.isFinite(p.maxVoltage) ? `${p.maxVoltage} V` : 'unverified V range';
    return `${p.status} · ${p.currentChannels ?? '?'}I / ${p.voltageChannels ?? '?'}V · ${i} · ${v}`;
  }
}

export const testerChannelNames = { currentNames, voltageNames };
