export const VERSION = '2.2.0-rebuild';

export const assetMeta = {
  generic: {
    title: 'Generic Protection Lab',
    subtitle: 'Vendor-neutral secondary-injection workbench and protection scheme simulator.'
  },
  transformer: {
    title: 'Transformer Protection Lab',
    subtitle: 'Transformer differential, backup overcurrent, earth-fault and mechanical-protection learning workspace.'
  },
  generator: {
    title: 'Generator Protection Lab',
    subtitle: 'Generator protection, trip philosophy, breaker, field and prime-mover interaction workspace.'
  },
  motor: {
    title: 'Motor Protection Lab',
    subtitle: 'Motor start, overload, unbalance, stall and stateful protection learning workspace.'
  },
  feeder: {
    title: 'MCC / Feeder Protection Lab',
    subtitle: 'Feeder protection, coordination, breaker supervision and MCC scheme workspace.'
  },
  line: {
    title: 'Line Protection Lab',
    subtitle: 'Line protection, directional, distance and breaker-failure architecture workspace.'
  }
};

const genericNote = 'Generic / educational model. No proprietary firmware emulation is claimed.';
const referenceNote = 'Reference device profile. Exact behavior requires the applicable manual, order code, firmware, I/O mapping and approved settings.';

export const profiles = {
  generic: [
    { id: 'generic-mf', name: 'Generic Multifunction Relay', vendor: 'Generic', status: 'GENERIC MODEL', fidelity: 'generic', note: genericNote }
  ],
  transformer: [
    { id: 'generic-transformer', name: 'Generic Transformer Relay', vendor: 'Generic', status: 'GENERIC MODEL', fidelity: 'generic', note: genericNote },
    { id: 'nr-pcs9671s-ref', name: 'NR PCS-9671S', vendor: 'NR Electric', status: 'REFERENCE PROFILE', fidelity: 'reference', note: referenceNote },
    { id: 'nr-pcs985-ref', name: 'NR PCS-985 Family', vendor: 'NR Electric', status: 'REFERENCE PROFILE', fidelity: 'reference', note: referenceNote },
    { id: 'beckwith-m3311a-ref', name: 'Beckwith M-3311A', vendor: 'Beckwith Electric', status: 'REFERENCE PROFILE', fidelity: 'reference', note: referenceNote },
    { id: 'siprotec-7ut85-ref', name: 'Siemens SIPROTEC 7UT85', vendor: 'Siemens', status: 'REFERENCE PROFILE', fidelity: 'reference', note: referenceNote }
  ],
  generator: [
    { id: 'generic-generator', name: 'Generic Generator Relay', vendor: 'Generic', status: 'GENERIC MODEL', fidelity: 'generic', note: genericNote },
    { id: 'nr-pcs985-gen-ref', name: 'NR PCS-985 Family', vendor: 'NR Electric', status: 'REFERENCE PROFILE', fidelity: 'reference', note: referenceNote },
    { id: 'beckwith-m3425a-ref', name: 'Beckwith M-3425A', vendor: 'Beckwith Electric', status: 'REFERENCE PROFILE', fidelity: 'reference', note: referenceNote },
    { id: 'siprotec-7um85-ref', name: 'Siemens SIPROTEC 7UM85', vendor: 'Siemens', status: 'REFERENCE PROFILE', fidelity: 'reference', note: referenceNote }
  ],
  motor: [
    { id: 'generic-motor', name: 'Generic Motor Relay', vendor: 'Generic', status: 'GENERIC MODEL', fidelity: 'generic', note: genericNote },
    { id: 'nr-pcs9641s-ref', name: 'NR PCS-9641S', vendor: 'NR Electric', status: 'REFERENCE PROFILE', fidelity: 'reference', note: referenceNote },
    { id: 'siprotec-7sj81-motor-ref', name: 'Siemens SIPROTEC 7SJ81', vendor: 'Siemens', status: 'REFERENCE PROFILE', fidelity: 'reference', note: referenceNote }
  ],
  feeder: [
    { id: 'generic-feeder', name: 'Generic MCC / Feeder Relay', vendor: 'Generic', status: 'GENERIC MODEL', fidelity: 'generic', note: genericNote },
    { id: 'siprotec-7sj81-feeder-ref', name: 'Siemens SIPROTEC 7SJ81', vendor: 'Siemens', status: 'REFERENCE PROFILE', fidelity: 'reference', note: referenceNote },
    { id: 'nr-feeder-ref', name: 'NR Feeder Family', vendor: 'NR Electric', status: 'REFERENCE PROFILE', fidelity: 'reference', note: referenceNote }
  ],
  line: [
    { id: 'generic-line', name: 'Generic Line Relay', vendor: 'Generic', status: 'GENERIC MODEL', fidelity: 'generic', note: genericNote },
    { id: 'siprotec-7sl87-ref', name: 'Siemens SIPROTEC 7SL87', vendor: 'Siemens', status: 'REFERENCE PROFILE', fidelity: 'reference', note: referenceNote },
    { id: 'nr-line-ref', name: 'NR Line Protection Family', vendor: 'NR Electric', status: 'REFERENCE PROFILE', fidelity: 'reference', note: referenceNote }
  ]
};

export const functionCatalog = [
  { id: '51', name: '51 · Time Overcurrent', unit: 'A', implemented: true, family: 'current', assets: ['generic','transformer','generator','motor','feeder','line'] },
  { id: '50', name: '50 · Instantaneous Overcurrent', unit: 'A', implemented: true, family: 'current', assets: ['generic','transformer','generator','motor','feeder','line'] },
  { id: '50N', name: '50N · Instantaneous Earth Fault', unit: 'A', implemented: true, family: 'residual-current', assets: ['generic','transformer','generator','motor','feeder'] },
  { id: '51N', name: '51N · Earth-Fault Overcurrent', unit: 'A', implemented: true, family: 'residual-current', assets: ['generic','transformer','generator','motor','feeder'] },
  { id: '67', name: '67 · Directional Overcurrent', unit: 'A', implemented: true, family: 'directional-current', assets: ['generic','transformer','generator','feeder','line'] },
  { id: '27', name: '27 · Undervoltage', unit: 'V', implemented: true, family: 'voltage', assets: ['generic','transformer','generator','motor','feeder','line'] },
  { id: '59', name: '59 · Overvoltage', unit: 'V', implemented: true, family: 'voltage', assets: ['generic','transformer','generator','motor','feeder','line'] },
  { id: '59N', name: '59N · Residual Overvoltage', unit: 'V', implemented: true, family: 'residual-voltage', assets: ['generic','transformer','generator','feeder'] },
  { id: '81U', name: '81U · Underfrequency', unit: 'Hz', implemented: true, family: 'frequency', assets: ['generic','generator','motor','feeder','line'] },
  { id: '81O', name: '81O · Overfrequency', unit: 'Hz', implemented: true, family: 'frequency', assets: ['generic','generator','motor','feeder','line'] },
  { id: '46', name: '46 · Negative-Sequence Current', unit: 'A', implemented: true, family: 'sequence-current', assets: ['generic','transformer','generator','motor','feeder'] },
  { id: '24', name: '24 · Overexcitation V/Hz', unit: 'pu', implemented: true, family: 'v-hz', assets: ['generic','transformer','generator'] },
  { id: '25', name: '25 · Synchronism Check', unit: '—', implemented: true, family: 'synch-check', assets: ['generic','generator','line'] },
  { id: '32R', name: '32R · Reverse Power', unit: 'W(sec)', implemented: true, family: 'power', assets: ['generic','generator'] },
  { id: '63', name: '63 · Mechanical Contact Logic', unit: 'BI', implemented: true, family: 'binary', assets: ['generic','transformer'] },
  { id: '87T', name: '87T · Biased Differential', unit: 'A', implemented: true, family: 'differential', assets: ['generic','transformer'] },
  { id: '21', name: '21 · Distance', unit: 'Ω', implemented: false, family: 'impedance', assets: ['generic','line'] },
  { id: '49', name: '49 · Thermal Model', unit: 'pu', implemented: false, family: 'thermal', assets: ['transformer','generator','motor','feeder'] },
  { id: '40', name: '40 · Loss of Excitation', unit: 'Ω', implemented: false, family: 'impedance', assets: ['generator'] },
  { id: '48', name: '48 / 51LR · Stall / Locked Rotor', unit: 'A', implemented: false, family: 'motor-state', assets: ['motor'] },
  { id: '66', name: '66 · Starts / Restart Restriction', unit: 'count', implemented: false, family: 'motor-state', assets: ['motor'] },
  { id: '50BF', name: '50BF · Breaker Failure', unit: 'logic', implemented: true, family: 'scheme', assets: ['generic','transformer','generator','motor','feeder','line'] },
  { id: '86', name: '86 · Lockout / Master Trip', unit: 'logic', implemented: true, family: 'scheme', assets: ['generic','transformer','generator','motor','feeder','line'] }
];

export const assetFunctions = {
  generic: ['50','51','50N','51N','67','27','59','59N','81U','81O','46','24','25','32R','63','87T','21','50BF','86'],
  transformer: ['87T','50','51','50N','51N','59N','24','63','49','50BF','86'],
  generator: ['50','51','27','59','81U','81O','46','24','25','32R','40','50BF','86'],
  motor: ['50','51','50N','51N','46','49','48','66','27','59','50BF','86'],
  feeder: ['50','51','50N','51N','67','27','59','50BF','86'],
  line: ['21','67','50','51','27','59','25','50BF','86']
};

export const testerProfiles = [
  {
    id: 'generic-ideal',
    name: 'Generic Ideal Virtual Tester',
    status: 'IDEALIZED',
    currentChannels: 6,
    voltageChannels: 6,
    maxCurrent: 40,
    maxVoltage: 125,
    binaryInputs: 4,
    binaryOutputs: 4,
    physical: false,
    verified: true,
    note: 'Educational abstraction. No VA, burden, compliance or calibration limits are claimed.'
  },
  {
    id: 'onlly-photo-ref',
    name: 'ONLLY Photo Reference',
    status: 'REFERENCE ONLY',
    currentChannels: 6,
    voltageChannels: 6,
    maxCurrent: null,
    maxVoltage: null,
    binaryInputs: 4,
    binaryOutputs: 4,
    physical: true,
    verified: false,
    note: 'Visible panel layout only. Exact model, limits, burden, wet/dry BI and firmware are not yet verified.'
  }
];

export const methodCatalog = [
  { id: 'shot', name: 'Single Shot · Operating Time', implemented: true, evidence: 'Operate time at one selected point.' },
  { id: 'ramp', name: 'Linear Ramp · Pickup / Dropout', implemented: true, evidence: 'Pickup and reset threshold search.' },
  { id: 'sequence', name: 'State Sequence', implemented: true, evidence: 'Prefault → fault → postfault state behavior.' },
  { id: 'pulseRamp', name: 'Pulse Ramp', implemented: false, evidence: 'High-set search while avoiding slower overlapping stage.' },
  { id: 'binarySearch', name: 'Binary Search', implemented: false, evidence: 'Adaptive threshold search.' },
  { id: 'sweep', name: 'Characteristic Sweep', implemented: false, evidence: 'Multiple operating points across a characteristic.' }
];

export const endpointCatalog = [
  { id: 'pickup', label: 'Element pickup', proves: 'Pickup threshold crossed', boundary: 'element' },
  { id: 'operate', label: 'Element operate', proves: 'Element timing / internal logic completed', boundary: 'element' },
  { id: 'scheme', label: 'Trip-matrix / scheme output', proves: 'Cause is routed to the trip path', boundary: 'relay' },
  { id: 'bo', label: 'Relay BO', proves: 'Physical relay-output model changed state', boundary: 'relay' },
  { id: 'bi', label: 'Tester BI', proves: 'Relay output contact observed by test set', boundary: 'relay' },
  { id: 'lockout', label: '86 lockout', proves: 'Master trip latch operated', boundary: 'panel' },
  { id: 'coil', label: 'Trip coil energized', proves: 'DC trip path and coil energized', boundary: 'panel' },
  { id: 'breaker', label: 'Breaker 52 open', proves: 'Breaker mechanism / aux contact changed state', boundary: 'breaker' },
  { id: 'currentZero', label: 'Current extinction', proves: 'Current interrupted at modeled measurement point', boundary: 'breaker' },
  { id: 'bfOperate', label: '50BF operate', proves: 'Breaker-failure timer and criteria completed', boundary: 'system' },
  { id: 'upstreamTrip', label: 'Upstream backup trip', proves: 'Backup isolation command issued', boundary: 'system' }
];

export const principleCards = [
  {
    title: 'Pickup ≠ Operate ≠ Trip',
    body: 'Pickup starts or qualifies an element. Operate means the element logic/timer completed. Scheme logic can still block or redirect the result before any physical output changes.'
  },
  {
    title: 'BO ≠ Breaker Open ≠ Current Zero',
    body: 'Relay binary output, tester binary input, trip-coil current, breaker auxiliary contacts and current interruption are different observations with different test boundaries.'
  },
  {
    title: 'Open Loop vs Closed Loop',
    body: 'In open-loop secondary injection the test set remains the source, so virtual breaker opening does not automatically remove injected current. Closed-loop mode recalculates system response after topology changes.'
  },
  {
    title: 'Vendor Profile ≠ Firmware Emulator',
    body: 'A reference profile maps terminology and device context. Exact OEM behavior needs the exact manual revision, hardware/order code, firmware, settings and I/O routing.'
  },
  {
    title: 'PASS Needs a Boundary',
    body: 'A PASS at element operate does not prove relay BO, DC wiring, trip coil, breaker mechanism, current interruption or primary CT/VT path.'
  },
  {
    title: 'Commanded ≠ Measured',
    body: 'Tester setpoints are stored separately from injected/measured quantities. OUTPUT OFF, disconnected channels and future burden/compliance limits can make them different.'
  }
];
