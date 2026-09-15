import {
  VERSION, assetMeta, profiles, functionCatalog, assetFunctions, testerProfiles,
  methodCatalog, endpointCatalog, principleCards
} from './core/profiles.js';
import { TesterModel } from './core/tester.js';
import { evaluateFunction, functionDefaultSettings, iecOperateTime } from './core/protection.js';
import { Simulator, DEFAULT_DELAYS } from './core/simulator.js';
import { stableHash, downloadText, recordsToCsv, loadSessionRecords, saveSessionRecords } from './core/evidence.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clone = value => JSON.parse(JSON.stringify(value));
const fmt = (value, digits = 3) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '—';
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

const state = {
  view: 'bench',
  asset: 'generic',
  level: 'intermediate',
  physics: 'open',
  fidelity: 'ideal',
  activeTab: 'current',
  visual: 'phasor',
  biDisconnected: false,
  sessionRecords: loadSessionRecords(),
  lastTestConfig: null,
  lastEvidence: null
};

const tester = new TesterModel(testerProfiles[0]);
const sim = new Simulator({
  onEvent: event => { renderEvent(event); renderEvidenceEvent(event); },
  onTick: () => { renderChannels(); renderLive(); drawVisual(); },
  onEvaluate: evaluation => renderWhy(evaluation),
  onReset: () => { renderAll(); },
  onSystemFactor: factor => tester.setClosedLoopFactor(factor),
  onStop: snapshot => {
    tester.setOutput(false);
    renderAll();
    renderResult();
    appendSessionRecord(snapshot);
  }
});

function init() {
  $('#versionText').textContent = VERSION;
  populateTesterProfiles();
  populateMethods();
  populateEndpoints();
  renderStaticViews();
  wireUI();
  selectAsset('generic');
  routeFromHash();
  renderChannels();
  renderAll();
  drawVisual();
  renderReport();
  if (new URLSearchParams(location.search).get('selftest') === '1') setTimeout(runSelfTest, 200);
}

function wireUI() {
  $$('.nav-item').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.view)));
  window.addEventListener('hashchange', routeFromHash);

  $$('#assetGrid button').forEach(btn => btn.onclick = () => selectAsset(btn.dataset.asset));
  $$('#levelControl button').forEach(btn => btn.onclick = () => {
    state.level = btn.dataset.level;
    setSegment('#levelControl', btn);
    document.body.dataset.level = state.level;
  });
  $$('#physicsControl button').forEach(btn => btn.onclick = () => {
    state.physics = btn.dataset.physics;
    setSegment('#physicsControl', btn);
    renderConstraint();
    renderEvidence();
  });

  $('#fidelitySelect').onchange = e => { state.fidelity = e.target.value; renderConstraint(); renderEvidence(); };
  $('#boundarySelect').onchange = () => renderEvidence();
  $('#testerProfileSelect').onchange = () => {
    const p = testerProfiles.find(x => x.id === $('#testerProfileSelect').value) || testerProfiles[0];
    tester.setProfile(p);
    renderChannels(); renderAll();
  };
  $('#profileSelect').onchange = () => renderProfile();

  $$('#injectorTabs button').forEach(btn => btn.onclick = () => {
    state.activeTab = btn.dataset.tab;
    setSegment('#injectorTabs', btn);
    if (state.activeTab !== 'binary') tester.select(state.activeTab, tester.selectedIndex);
    renderChannels(); drawVisual();
  });

  $$('#visualTabs button').forEach(btn => btn.onclick = () => {
    state.visual = btn.dataset.visual;
    setSegment('#visualTabs', btn);
    drawVisual();
  });

  $('#outputToggle').onclick = () => {
    tester.setOutput(!tester.outputEnabled);
    renderAll(); drawVisual();
  };
  $('#fineMinus').onclick = () => { tester.fineAdjust(-Number($('#fineStep').value)); renderChannels(); renderAll(); drawVisual(); };
  $('#finePlus').onclick = () => { tester.fineAdjust(Number($('#fineStep').value)); renderChannels(); renderAll(); drawVisual(); };
  $('#frequencyInput').oninput = e => { tester.setFrequency(e.target.value); renderAll(); drawVisual(); };

  $('#functionSelect').onchange = () => { applyFunctionDefaults(currentFn()); renderAll(); drawVisual(); };
  $('#methodSelect').onchange = () => { renderConstraint(); renderEvidence(); };
  [
    'pickupInput','curveSelect','tmsInput','ctPrimary','ctSecondary','vtPrimary','vtSecondary',
    'endpointSelect','toleranceInput','pickupToleranceInput','maxDurationInput','speedSelect',
    'parallel50Enabled','parallel50Pickup','parallel50Delay','enable86','enableBF','blockOutput',
    'breakerFail','bfClearCriterion'
  ].forEach(id => {
    const el = $('#' + id);
    if (el) el.addEventListener('input', () => { renderAll(); drawVisual(); });
  });

  $('#startBtn').onclick = startSimulation;
  $('#stopBtn').onclick = () => sim.stop();
  $('#resetBtn').onclick = () => {
    sim.reset();
    tester.setOutput(false);
    tester.setClosedLoopFactor(1);
    state.biDisconnected = false;
    renderChannels(); renderAll();
  };
  $('#elementResetBtn').onclick = () => { sim.resetElement(); renderAll(); };
  $('#lockoutResetBtn').onclick = () => { sim.resetLockout(); renderAll(); };
  $('#breakerCloseBtn').onclick = () => { sim.closeBreaker(); tester.setClosedLoopFactor(1); renderAll(); };

  $('#clearEvents').onclick = () => {
    $('#eventTable').innerHTML = '';
    $('#evidenceEventTable').innerHTML = '';
  };

  $$('[data-preset]').forEach(btn => btn.onclick = () => applyPreset(btn.dataset.preset));
  $$('[data-facekey]').forEach(btn => btn.onclick = () => handleFaceKey(btn.dataset.facekey));

  $('#exportCsvBtn').onclick = () => downloadText('relay-lab-session.csv', recordsToCsv(state.sessionRecords), 'text/csv');
  $('#exportJsonBtn').onclick = exportEvidence;
  $('#clearReportBtn').onclick = () => {
    state.sessionRecords = [];
    saveSessionRecords(state.sessionRecords);
    renderReport();
  };

  window.addEventListener('resize', drawVisual);
}

function navigate(view) {
  const valid = ['bench','logic','evidence','principles','ansi','equipment','library'];
  const target = valid.includes(view) ? view : 'bench';
  state.view = target;
  $$('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.view === target));
  $$('[data-view-section]').forEach(section => section.classList.toggle('active', section.dataset.viewSection === target));
  if (location.hash !== '#' + target) history.replaceState(null, '', '#' + target);
  if (target === 'evidence') renderEvidence();
}

function routeFromHash() {
  const hash = location.hash.replace('#','') || 'bench';
  navigate(hash === 'workbench' ? 'bench' : hash);
}

function setSegment(selector, activeBtn) {
  $$(selector + ' button').forEach(btn => btn.classList.toggle('active', btn === activeBtn));
}

function populateTesterProfiles() {
  const select = $('#testerProfileSelect');
  select.innerHTML = testerProfiles.map(p => `<option value="${p.id}">${escapeHtml(p.name)} · ${escapeHtml(p.status)}</option>`).join('');
}

function populateMethods() {
  $('#methodSelect').innerHTML = methodCatalog.map(m => `<option value="${m.id}">${escapeHtml(m.name)}${m.implemented ? '' : ' · MAPPED'}</option>`).join('');
}

function populateEndpoints() {
  $('#endpointSelect').innerHTML = endpointCatalog.map(e => `<option value="${e.id}"${e.id === 'breaker' ? ' selected' : ''}>${escapeHtml(e.label)}</option>`).join('');
}

function selectAsset(asset) {
  state.asset = asset;
  $$('#assetGrid button').forEach(btn => btn.classList.toggle('active', btn.dataset.asset === asset));
  const meta = assetMeta[asset];
  $('#assetTitle').textContent = meta.title;
  $('#assetSubtitle').textContent = meta.subtitle;

  const relaySelect = $('#profileSelect');
  relaySelect.innerHTML = profiles[asset].map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  renderProfile();

  const allowed = new Set(assetFunctions[asset]);
  const previous = currentFn();
  const options = functionCatalog.filter(f => allowed.has(f.id) && f.family !== 'scheme');
  $('#functionSelect').innerHTML = options.map(f => `<option value="${f.id}">${escapeHtml(f.name)}${f.implemented ? '' : ' · MAPPED'}</option>`).join('');
  if (options.some(f => f.id === previous)) $('#functionSelect').value = previous;
  else $('#functionSelect').value = options.find(f => f.implemented)?.id || options[0]?.id || '51';
  applyFunctionDefaults(currentFn());
  renderAssetFunctionCards();
  renderRelayLibrary();
  renderAll();
}

function renderProfile() {
  const p = currentRelayProfile();
  $('#relayName').textContent = p.name;
  $('#relayBadge').textContent = p.status;
  $('#profileStatus').innerHTML = `<b>${escapeHtml(p.status)}</b><br>${escapeHtml(p.note)}`;
  renderEvidence();
}

function currentRelayProfile() {
  return profiles[state.asset].find(p => p.id === $('#profileSelect').value) || profiles[state.asset][0];
}

function currentFn() {
  return $('#functionSelect')?.value || '51';
}

function currentFunctionMeta() {
  return functionCatalog.find(f => f.id === currentFn());
}

function currentMethodMeta() {
  return methodCatalog.find(m => m.id === $('#methodSelect').value);
}

function readDynamic(name, fallback) {
  const el = $(`[data-setting="${name}"]`);
  if (!el) return fallback;
  if (el.type === 'checkbox') return el.checked;
  return Number(el.value);
}

function settings() {
  return {
    pickup: Number($('#pickupInput').value),
    curve: $('#curveSelect').value,
    tms: Number($('#tmsInput').value),
    parallel50Enabled: $('#parallel50Enabled').checked,
    parallel50Pickup: Number($('#parallel50Pickup').value),
    parallel50Delay: Number($('#parallel50Delay').value),
    mtaDeg: readDynamic('mtaDeg', 0),
    nominalV: readDynamic('nominalV', 63.5),
    nominalF: readDynamic('nominalF', 50),
    remoteFrequency: readDynamic('remoteFrequency', 50),
    syncMaxDvPct: readDynamic('syncMaxDvPct', 10),
    syncMaxDfHz: readDynamic('syncMaxDfHz', 0.2),
    syncMaxAngleDeg: readDynamic('syncMaxAngleDeg', 10),
    slopePct: readDynamic('slopePct', 30),
    diffHighsetEnabled: readDynamic('diffHighsetEnabled', true),
    diffHighset: readDynamic('diffHighset', 5),
    diffHighsetDelay: readDynamic('diffHighsetDelay', 0.02)
  };
}

function applyFunctionDefaults(fn) {
  const d = functionDefaultSettings(fn);
  $('#pickupInput').value = d.pickup;
  $('#curveSelect').value = d.curve;
  $('#tmsInput').value = d.tms;
  $('#parallel50Enabled').checked = !!d.parallel50Enabled;
  $('#parallel50Pickup').value = d.parallel50Pickup;
  $('#parallel50Delay').value = d.parallel50Delay;
  renderDynamicSettings(fn, d);
  $('#parallel50Panel').classList.toggle('hidden', fn !== '51');
  const meta = functionCatalog.find(f => f.id === fn);
  $('#functionStatusBadge').textContent = meta?.implemented ? 'EXECUTABLE GENERIC' : 'MAPPED · NOT EXECUTABLE';
  $('#functionStatusBadge').className = 'badge ' + (meta?.implemented ? 'ok' : 'warning');
  $('#settingNote').textContent = functionSettingNote(fn);
}

function renderDynamicSettings(fn, d = functionDefaultSettings(fn)) {
  const host = $('#dynamicSettings');
  let html = '';
  if (fn === '67') {
    html = `<label>MTA / forward reference <input data-setting="mtaDeg" type="number" step="1" value="${d.mtaDeg}"> °</label><span class="dynamic-note">Generic torque-sign model only; OEM polarization is not implied.</span>`;
  } else if (fn === '24') {
    html = `<label>Nominal V <input data-setting="nominalV" type="number" step="0.1" value="${d.nominalV}"> V</label><label>Nominal f <input data-setting="nominalF" type="number" step="0.1" value="${d.nominalF}"> Hz</label>`;
  } else if (fn === '25') {
    html = `<label>Remote f <input data-setting="remoteFrequency" type="number" step="0.01" value="${d.remoteFrequency}"> Hz</label><label>Max ΔV <input data-setting="syncMaxDvPct" type="number" step="0.1" value="${d.syncMaxDvPct}"> %</label><label>Max Δf <input data-setting="syncMaxDfHz" type="number" step="0.01" value="${d.syncMaxDfHz}"> Hz</label><label>Max Δφ <input data-setting="syncMaxAngleDeg" type="number" step="0.1" value="${d.syncMaxAngleDeg}"> °</label>`;
  } else if (fn === '87T') {
    html = `<label>Slope <input data-setting="slopePct" type="number" step="1" value="${d.slopePct}"> %</label><label><input data-setting="diffHighsetEnabled" type="checkbox" ${d.diffHighsetEnabled ? 'checked' : ''}> 87U high-set</label><label>87U pickup <input data-setting="diffHighset" type="number" step="0.1" value="${d.diffHighset}"> A</label><label>87U delay <input data-setting="diffHighsetDelay" type="number" step="0.01" value="${d.diffHighsetDelay}"> s</label><span class="dynamic-note">IA–IC and IX–IZ are treated as already ratio/phase-compensated, positive into the zone.</span>`;
  }
  host.innerHTML = html;
  host.querySelectorAll('input').forEach(el => el.addEventListener('input', () => { renderAll(); drawVisual(); }));
}

function functionSettingNote(fn) {
  const notes = {
    '51': '51 generic IEC inverse/definite-time model. Parallel 50 is evaluated independently so the faster active stage controls operation.',
    '50N': 'Earth-fault current uses calculated residual |IA+IB+IC|. A measured neutral/CBCT input is not implied.',
    '51N': 'Earth-fault current uses calculated residual |IA+IB+IC|. A measured neutral/CBCT input is not implied.',
    '59N': 'Residual voltage uses calculated |VA+VB+VC|. Broken-delta hardware is a different measurement boundary.',
    '67': 'Generic directional training model using voltage/current phase relation. OEM memory voltage/polarization is not emulated.',
    '87T': 'Generic differential engine expects already compensated side currents. Raw CT ratio/vector-group compensation remains a later transformer module.',
    '25': 'Synchronism check is a permissive function; close request plus ΔV, Δf and Δφ must all be within limits.',
    '63': '63 uses the simulated SENSOR63 binary/process contact and a debounce/qualification delay.'
  };
  return notes[fn] || 'Generic training model. Tolerance is not an OEM acceptance criterion unless a validated source is loaded.';
}

function renderChannels() {
  const area = $('#channelArea');
  $('#frequencyInput').value = tester.frequency;
  if (state.activeTab === 'binary') {
    const injected = tester.getInjectedSignal();
    const keys = ['BI1','BI2','BI3','BI4','BO1','BO2','BO3','BO4','SENSOR63','CLOSE_REQUEST'];
    area.innerHTML = `<div class="binary-grid">${keys.map(key => {
      const active = injected.binary[key];
      const manual = ['SENSOR63','CLOSE_REQUEST','BI2','BI3','BI4'].includes(key);
      return `<div class="binary-card"><strong>${key}</strong><span class="binary-state ${active ? 'on' : ''}">${active ? 'ACTIVE' : 'INACTIVE'}</span>${manual ? `<button data-binary-toggle="${key}">${active ? 'Set OFF' : 'Set ON'}</button>` : '<small>simulation feedback</small>'}</div>`;
    }).join('')}</div>`;
    area.querySelectorAll('[data-binary-toggle]').forEach(btn => btn.onclick = () => {
      const key = btn.dataset.binaryToggle;
      tester.setBinary(key, !tester.command.binary[key]);
      renderChannels(); renderAll();
    });
    return;
  }

  const type = state.activeTab;
  const command = type === 'current' ? tester.command.currents : tester.command.voltages;
  const actual = type === 'current' ? tester.getInjectedSignal().currents : tester.getInjectedSignal().voltages;
  const unit = type === 'current' ? 'A' : 'V';
  area.innerHTML = command.map((ch, i) => `
    <div class="channel-row ${tester.selectedIndex === i && tester.selectedType === type ? 'selected' : ''}">
      <button class="channel-select" data-select-channel="${i}">${ch.name}</button>
      <label>Command <input data-ch="${i}" data-prop="mag" type="number" min="0" step="0.01" value="${ch.mag}"> ${unit}</label>
      <label>Angle <input data-ch="${i}" data-prop="angle" type="number" step="1" value="${ch.angle}"> °</label>
      <div class="actual-readout"><span>Injected</span><b>${fmt(actual[i].mag, type === 'current' ? 3 : 2)} ${unit}</b></div>
      <button class="link-button ${ch.linked ? 'linked' : 'disconnected'}" data-link="${i}">${ch.linked ? '● LINKED' : '○ DISCONNECTED'}</button>
    </div>`).join('');

  area.querySelectorAll('[data-select-channel]').forEach(btn => btn.onclick = () => {
    tester.select(type, Number(btn.dataset.selectChannel));
    $('#selectedChannelLabel').textContent = tester.selectedChannel()?.name || '—';
    renderChannels();
  });
  area.querySelectorAll('input[data-ch]').forEach(input => input.oninput = e => {
    const i = Number(e.target.dataset.ch);
    const prop = e.target.dataset.prop;
    if (prop === 'mag') tester.setMagnitude(type, i, e.target.value);
    else tester.setAngle(type, i, e.target.value);
    renderAll(); drawVisual();
  });
  area.querySelectorAll('[data-link]').forEach(btn => btn.onclick = () => {
    tester.toggleLink(type, Number(btn.dataset.link));
    renderChannels(); renderAll(); drawVisual();
  });
  $('#selectedChannelLabel').textContent = tester.selectedChannel()?.name || '—';
}

function predictedSignal() {
  const cmd = tester.getCommandedSignal();
  return {
    currents: cmd.currents.map(ch => ({ ...ch, mag: ch.linked ? ch.mag : 0 })),
    voltages: cmd.voltages.map(ch => ({ ...ch, mag: ch.linked ? ch.mag : 0 })),
    frequency: cmd.frequency,
    binary: { ...cmd.binary },
    outputEnabled: true,
    closedLoopFactor: 1
  };
}

function renderAll() {
  renderOutput();
  renderConstraint();
  renderRelay();
  renderPrediction();
  renderLogic();
  renderEvidence();
  renderProgress();
}

function renderOutput() {
  $('#outputToggle').textContent = tester.outputEnabled ? 'OUTPUT ON' : 'OUTPUT OFF';
  $('#outputToggle').classList.toggle('on', tester.outputEnabled);
}

function renderConstraint() {
  const check = tester.capabilityCheck({ fidelity: state.fidelity, functionId: currentFn(), endpoint: $('#endpointSelect').value, physics: state.physics });
  const method = currentMethodMeta();
  let text = `${tester.constraintSummary()} · ${check.reason}`;
  let ok = check.ok;
  if (method && !method.implemented) {
    ok = false;
    text = `${method.name} is mapped but not executable in this build.`;
  }
  $('#constraintStatus').textContent = text;
  $('#constraintStatus').classList.toggle('bad', !ok);
  $('#engineHealth').textContent = ok ? 'ENGINE READY' : 'CONTRACT BLOCKED';
  $('#engineHealth').className = 'status-chip ' + (ok ? 'ok' : 'warning');
}

function renderRelay() {
  const signal = tester.getInjectedSignal();
  const evaluation = evaluateFunction(currentFn(), signal, settings());
  $('#lcdFunction').textContent = currentFn();
  $('#lcdImax').textContent = `${fmt(Math.max(...signal.currents.slice(0,3).map(x => x.mag)), 3)} A`;
  $('#lcdVmax').textContent = `${fmt(Math.max(...signal.voltages.slice(0,3).map(x => x.mag)), 2)} V`;
  $('#lcdFreq').textContent = `${fmt(signal.frequency, 2)} Hz`;
  let status = 'READY';
  if (!tester.outputEnabled) status = 'OUTPUT OFF';
  if (sim.running) status = sim.states.operate ? 'OPERATE' : sim.states.pickup ? 'PICKUP' : 'RUNNING';
  if (!evaluation.supported) status = 'MAPPED';
  $('#lcdStatus').textContent = status;

  ['pickup','operate','bo','bi','coil','lockout'].forEach(key => $(`[data-lamp="${key}"]`)?.classList.toggle('active', !!sim.states[key]));
  $('#breakerState').textContent = sim.states.breakerOpen ? 'OPEN' : 'CLOSED';
  $('#breakerAux').textContent = sim.states.breakerOpen ? '52a=0 · 52b=1' : '52a=1 · 52b=0';
  $('#breakerSymbol').classList.toggle('open', !!sim.states.breakerOpen);

  tester.setBinary('BO1', !!sim.states.bo);
  tester.setBinary('BI1', !!sim.states.bi);
}

function renderPrediction() {
  const cmdSignal = predictedSignal();
  const liveSignal = tester.getInjectedSignal();
  const predicted = evaluateFunction(currentFn(), cmdSignal, settings());
  const live = evaluateFunction(currentFn(), liveSignal, settings());
  const meta = currentFunctionMeta();
  const commandMeasured = Number.isFinite(predicted.measured) ? predicted.measured : NaN;
  const liveMeasured = Number.isFinite(live.measured) ? live.measured : NaN;
  $('#metricCommanded').textContent = Number.isFinite(commandMeasured) ? `${fmt(commandMeasured,3)} ${predicted.unit}` : '—';
  $('#metricInput').textContent = Number.isFinite(liveMeasured) ? `${fmt(liveMeasured,3)} ${live.unit}` : '—';
  $('#metricThreshold').textContent = `${fmt(settings().pickup,3)} ${meta?.unit || ''}`;
  $('#metricExpected').textContent = Number.isFinite(predicted.expected) ? `${fmt(predicted.expected * 1000,1)} ms` : '—';
  $('#metricStage').textContent = predicted.stage || '—';

  const ctRatio = Number($('#ctPrimary').value) / Math.max(0.001, Number($('#ctSecondary').value));
  const vtRatio = Number($('#vtPrimary').value) / Math.max(0.001, Number($('#vtSecondary').value));
  let primaryText = '—';
  if (predicted.unit === 'A' && Number.isFinite(commandMeasured)) primaryText = `${fmt(commandMeasured * ctRatio,1)} A`;
  else if (predicted.unit === 'V' && Number.isFinite(commandMeasured)) primaryText = `${fmt(commandMeasured * vtRatio,1)} V`;
  else if (Number.isFinite(commandMeasured)) primaryText = `${fmt(commandMeasured,3)} ${predicted.unit}`;
  $('#metricPrimary').textContent = primaryText;
}

function renderWhy(evaluation) {
  const outputText = tester.outputEnabled
    ? (state.physics === 'open' ? ' Open-loop source remains independent of breaker position.' : ' Closed-loop current changes only when the system model reaches current-extinction.')
    : ' OUTPUT is OFF, so commanded setpoints are not injected.';
  $('#whyBox').innerHTML = `<b>Why?</b><span>${escapeHtml(evaluation.reason || 'No executable explanation.')}${escapeHtml(outputText)}</span>`;
}

function renderLive() {
  $('#clockValue').textContent = `${fmt(sim.time,3)} s`;
  renderRelay();
  renderLogic();
  renderProgress();
  const endpoint = $('#endpointSelect').value;
  const at = sim.timestamps[endpoint];
  const stim = sim.timestamps.stimulus ?? 0;
  $('#metricActual').textContent = at != null ? `${fmt((at - stim) * 1000,1)} ms` : '—';
}

function renderResult() {
  const r = sim.result;
  if (!r) return;
  const badge = $('#verdictBadge');
  badge.textContent = r.verdict;
  badge.className = 'verdict ' + String(r.verdict).toLowerCase();
  if (r.actualMs != null) $('#metricActual').textContent = `${fmt(r.actualMs,1)} ms`;
  if (r.error != null) $('#metricError').textContent = `${r.error >= 0 ? '+' : ''}${fmt(r.error,1)} ms`;
  else if (r.pickupErrorPct != null) $('#metricError').textContent = `${r.pickupErrorPct >= 0 ? '+' : ''}${fmt(r.pickupErrorPct,2)} %`;
  $('#whyBox').innerHTML = `<b>${escapeHtml(r.verdict)}</b><span>${escapeHtml(r.detail || '')}</span>`;
  renderEvidence();
}

function renderLogic() {
  const st = sim.states;
  const active = {
    signal: tester.outputEnabled || sim.running,
    pickup: st.pickup,
    operate: st.operate,
    scheme: st.scheme,
    bo: st.bo,
    lockout: st.lockout || (!$('#enable86').checked && st.bo),
    coil: st.coil,
    breaker: st.breakerOpen,
    currentZero: st.currentZero
  };
  Object.entries(active).forEach(([key, value]) => $(`[data-node="${key}"]`)?.classList.toggle('active', !!value));
}

function renderProgress() {
  const max = Math.max(0.1, Number($('#maxDurationInput').value) || 5);
  $('#testProgress').value = Math.min(100, sim.time / max * 100);
}

function renderEvent(event) {
  const row = document.createElement('tr');
  row.innerHTML = `<td>${fmt(event.time * 1000,1)}</td><td>${escapeHtml(event.name)}</td><td>${escapeHtml(event.detail)}</td><td>${escapeHtml(event.evidence)}</td>`;
  $('#eventTable').append(row);
  $('#eventTable').parentElement.scrollTop = 999999;
}

function renderEvidenceEvent(event) {
  const row = document.createElement('tr');
  row.innerHTML = `<td>${fmt(event.time * 1000,1)}</td><td>${escapeHtml(event.name)}</td><td>${escapeHtml(event.detail)}</td><td>${escapeHtml(event.evidence)}</td>`;
  $('#evidenceEventTable').append(row);
}

function renderEvidence() {
  const p = currentRelayProfile();
  const testerP = tester.profile;
  const model = {
    version: VERSION,
    asset: state.asset,
    profile: p.id,
    function: currentFn(),
    settings: settings(),
    method: $('#methodSelect').value,
    physics: state.physics,
    fidelity: state.fidelity,
    boundary: $('#boundarySelect').value,
    endpoint: $('#endpointSelect').value
  };
  const items = {
    'Model version': VERSION,
    'Asset': state.asset.toUpperCase(),
    'Relay profile': p.name,
    'Profile status': p.status,
    'Tester': testerP?.name || '—',
    'Tester status': testerP?.status || '—',
    'Function': currentFn(),
    'Method': currentMethodMeta()?.name || '—',
    'Physics': state.physics.toUpperCase() + ' LOOP',
    'Fidelity': state.fidelity.toUpperCase(),
    'Boundary': $('#boundarySelect').value,
    'Endpoint': $('#endpointSelect').selectedOptions[0]?.textContent || '—',
    'Tolerance': $('#toleranceInput').value + ' ms',
    'Config hash': stableHash(model)
  };
  $('#evidenceGrid').innerHTML = Object.entries(items).map(([k,v]) => `<div class="evidence-item"><span>${escapeHtml(k)}</span><strong>${escapeHtml(v)}</strong></div>`).join('');
}

function buildPrefaultSnapshot(fn, fault) {
  const pre = clone(fault);
  const s = settings();
  pre.binary.CLOSE_REQUEST = false;
  pre.binary.SENSOR63 = false;

  if (['51','50','46','67'].includes(fn)) pre.currents.slice(0,3).forEach(ch => ch.mag = Math.min(ch.mag, Math.max(0.05, s.pickup * 0.5)));
  if (['50N','51N'].includes(fn)) {
    pre.currents[0].mag = 0.1; pre.currents[1].mag = 0.1; pre.currents[2].mag = 0.1;
    pre.currents[0].angle = 0; pre.currents[1].angle = -120; pre.currents[2].angle = 120;
  }
  if (fn === '27') pre.voltages.slice(0,3).forEach(ch => ch.mag = Math.max(63.5, s.pickup * 1.2));
  if (['59','59N'].includes(fn)) pre.voltages.slice(0,3).forEach((ch,i) => { ch.mag = Math.min(63.5, s.pickup * 0.5); ch.angle = [0,-120,120][i]; });
  if (fn === '81U') pre.frequency = Math.max(50, s.pickup + 2);
  if (fn === '81O') pre.frequency = Math.min(50, s.pickup - 2);
  if (fn === '24') { pre.frequency = s.nominalF; pre.voltages.slice(0,3).forEach(ch => ch.mag = s.nominalV); }
  if (fn === '32R') { pre.currents.slice(0,3).forEach((ch,i) => ch.angle = [0,-120,120][i]); }
  if (fn === '63') pre.binary.SENSOR63 = false;
  if (fn === '87T') {
    const mags = [1,1,1];
    pre.currents.slice(0,3).forEach((ch,i) => { ch.mag = mags[i]; ch.angle = [0,-120,120][i]; });
    pre.currents.slice(3,6).forEach((ch,i) => { ch.mag = mags[i]; ch.angle = [180,60,-60][i]; });
  }
  return pre;
}

function applySnapshot(snapshot) {
  tester.command.currents.forEach((ch,i) => Object.assign(ch, snapshot.currents[i]));
  tester.command.voltages.forEach((ch,i) => Object.assign(ch, snapshot.voltages[i]));
  tester.frequency = snapshot.frequency;
  tester.command.binary = { ...tester.command.binary, ...snapshot.binary };
}

function isRampSupported(fn) {
  return ['51','50','50N','51N','67','27','59','59N','81U','81O','46','24','63','87T'].includes(fn);
}

function applyRampStimulus(fn, triangle) {
  const s = settings();
  const x = clone(state.lastTestConfig?.prefault || tester.getCommandedSignal());
  const level = 0.5 + 1.0 * triangle; // 0.5 to 1.5 of threshold.
  if (['51','50','46','67'].includes(fn)) {
    x.currents[0].mag = s.pickup * level;
    x.currents[1].mag = 0;
    x.currents[2].mag = 0;
  } else if (['50N','51N'].includes(fn)) {
    x.currents[0].mag = s.pickup * level;
    x.currents[1].mag = 0;
    x.currents[2].mag = 0;
  } else if (fn === '27') {
    x.voltages.slice(0,3).forEach(ch => ch.mag = s.pickup * (1.25 - 0.5 * triangle));
  } else if (fn === '59' || fn === '59N') {
    x.voltages[0].mag = s.pickup * level; x.voltages[1].mag = 0; x.voltages[2].mag = 0;
  } else if (fn === '81U') {
    x.frequency = s.pickup + 2 - 4 * triangle;
  } else if (fn === '81O') {
    x.frequency = s.pickup - 2 + 4 * triangle;
  } else if (fn === '24') {
    x.frequency = s.nominalF;
    x.voltages.slice(0,3).forEach(ch => ch.mag = s.nominalV * s.pickup * level);
  } else if (fn === '63') {
    x.binary.SENSOR63 = triangle >= 0.5;
  } else if (fn === '87T') {
    x.currents[0].mag = s.pickup * level + 1;
    x.currents[3].mag = 1;
    x.currents[0].angle = 0;
    x.currents[3].angle = 180;
  }
  applySnapshot(x);
}

function startSimulation() {
  const fn = currentFn();
  const method = currentMethodMeta();
  const meta = currentFunctionMeta();
  const endpoint = $('#endpointSelect').value;
  const capability = tester.capabilityCheck({ fidelity: state.fidelity, functionId: fn, endpoint, physics: state.physics });

  let unsupported = null;
  if (!meta?.implemented) unsupported = `${meta?.name || fn} is mapped but not executable in the current generic engine.`;
  if (method && !method.implemented) unsupported = `${method.name} is mapped but not executable yet.`;
  if (method?.id === 'ramp' && !isRampSupported(fn)) unsupported = `Ramp is not yet implemented for ${fn}.`;
  if (fn === '25' && !['pickup','operate'].includes(endpoint)) unsupported = '25 synchronism check is a close-permissive function. The breaker-close actuator path is not yet executable, so only pickup/operate endpoints are allowed.';
  if (!capability.ok) unsupported = capability.reason;

  $('#eventTable').innerHTML = '';
  $('#evidenceEventTable').innerHTML = '';
  $('#verdictBadge').textContent = unsupported ? 'UNSUPPORTED' : 'RUNNING';
  $('#verdictBadge').className = 'verdict ' + (unsupported ? 'unsupported' : 'pending');
  $('#metricActual').textContent = '—';
  $('#metricError').textContent = '—';

  state.biDisconnected = !!state.biDisconnected;
  tester.setClosedLoopFactor(1);
  tester.setOutput(true);

  const fault = tester.getCommandedSignal();
  const prefault = buildPrefaultSnapshot(fn, fault);
  const predicted = evaluateFunction(fn, predictedSignal(), settings());

  state.lastTestConfig = { fault: clone(fault), prefault: clone(prefault) };

  const forbiddenStates = [];
  if (!$('#breakerFail').checked) forbiddenStates.push('upstreamTrip');

  const config = {
    fn,
    settings: settings(),
    method: $('#methodSelect').value,
    physics: state.physics,
    speed: Number($('#speedSelect').value),
    maxDuration: Number($('#maxDurationInput').value),
    endpoint,
    schemeRoute: fn === '25' ? 'permissive' : 'trip',
    toleranceMs: Number($('#toleranceInput').value),
    pickupTolerancePct: Number($('#pickupToleranceInput').value),
    expectedOperate: predicted.expected,
    enable86: $('#enable86').checked,
    enableBF: $('#enableBF').checked,
    blockOutput: $('#blockOutput').checked,
    breakerFail: $('#breakerFail').checked,
    biDisconnected: state.biDisconnected,
    bfClearCriterion: $('#bfClearCriterion').value,
    forbiddenStates,
    unsupported,
    signal: () => tester.getInjectedSignal(),
    applyFault: () => applySnapshot(fault),
    applyPrefault: () => applySnapshot(prefault),
    applyPostfault: () => applySnapshot(prefault),
    applyRamp: triangle => applyRampStimulus(fn, triangle),
    setSystemCurrentFactor: factor => tester.setClosedLoopFactor(factor)
  };

  state.lastEvidence = buildEvidencePackage(config, predicted);
  sim.start(config);
  renderChannels(); renderAll(); drawVisual();
  if (unsupported) renderResult();
}

function buildEvidencePackage(config, predicted) {
  const relayProfile = currentRelayProfile();
  const commanded = tester.getCommandedSignal();
  const packageData = {
    modelVersion: VERSION,
    timestamp: new Date().toISOString(),
    asset: state.asset,
    relayProfile: { id: relayProfile.id, name: relayProfile.name, status: relayProfile.status },
    testerProfile: { id: tester.profile.id, name: tester.profile.name, status: tester.profile.status },
    function: config.fn,
    settings: clone(config.settings),
    method: config.method,
    physics: config.physics,
    fidelity: state.fidelity,
    boundary: $('#boundarySelect').value,
    endpoint: config.endpoint,
    toleranceMs: config.toleranceMs,
    pickupTolerancePct: config.pickupTolerancePct,
    commanded,
    predicted: { supported: predicted.supported, stage: predicted.stage, expected: predicted.expected, reason: predicted.reason },
    wiringMap: {
      currentLinks: commanded.currents.map(ch => ({ name: ch.name, linked: ch.linked })),
      voltageLinks: commanded.voltages.map(ch => ({ name: ch.name, linked: ch.linked })),
      bi1Disconnected: config.biDisconnected
    }
  };
  packageData.configHash = stableHash(packageData);
  return packageData;
}

function applyPreset(name) {
  state.biDisconnected = false;
  const fn = currentFn();
  const s = settings();
  tester.setClosedLoopFactor(1);
  tester.setOutput(false);
  tester.command.currents.forEach(ch => { ch.mag = 0; ch.linked = true; });
  tester.command.voltages.forEach((ch,i) => { ch.mag = i < 3 ? 63.5 : 0; ch.angle = [0,-120,120,180,60,-60][i]; ch.linked = true; });
  tester.frequency = 50;
  tester.setBinary('SENSOR63', false);
  tester.setBinary('CLOSE_REQUEST', false);

  const multiplier = name === 'fault5' ? 5 : 2;
  const normal = name === 'normal';

  if (['51','50','46','67'].includes(fn)) {
    tester.command.currents[0].mag = normal ? s.pickup * 0.5 : s.pickup * multiplier;
  } else if (['50N','51N'].includes(fn)) {
    tester.command.currents[0].mag = normal ? s.pickup * 0.3 : s.pickup * multiplier;
  } else if (fn === '27') {
    tester.command.voltages.slice(0,3).forEach(ch => ch.mag = normal ? Math.max(63.5, s.pickup * 1.2) : s.pickup * 0.7);
  } else if (fn === '59') {
    tester.command.voltages.slice(0,3).forEach(ch => ch.mag = normal ? Math.min(63.5, s.pickup * 0.8) : s.pickup * 1.3);
  } else if (fn === '59N') {
    if (!normal) { tester.command.voltages[0].mag = s.pickup * 1.5; tester.command.voltages[1].mag = 0; tester.command.voltages[2].mag = 0; }
  } else if (fn === '81U') tester.frequency = normal ? Math.max(50, s.pickup + 2) : s.pickup - 1;
  else if (fn === '81O') tester.frequency = normal ? Math.min(50, s.pickup - 2) : s.pickup + 1;
  else if (fn === '24') {
    tester.frequency = s.nominalF;
    tester.command.voltages.slice(0,3).forEach(ch => ch.mag = normal ? s.nominalV : s.nominalV * s.pickup * 1.1);
  } else if (fn === '32R') {
    tester.command.currents.slice(0,3).forEach((ch,i) => { ch.mag = 1; ch.angle = normal ? [0,-120,120][i] : [180,60,-60][i]; });
  } else if (fn === '25') {
    tester.command.voltages[0].mag = 63.5; tester.command.voltages[0].angle = 0;
    tester.command.voltages[3].mag = normal ? 40 : 63; tester.command.voltages[3].angle = normal ? 40 : 5;
    tester.setBinary('CLOSE_REQUEST', !normal);
  } else if (fn === '63') tester.setBinary('SENSOR63', !normal);
  else if (fn === '87T') {
    const m = normal ? 1 : Math.max(1, s.pickup * multiplier + 1);
    tester.command.currents.slice(0,3).forEach((ch,i) => { ch.mag = m; ch.angle = [0,-120,120][i]; });
    tester.command.currents.slice(3,6).forEach((ch,i) => { ch.mag = 1; ch.angle = [180,60,-60][i]; });
  }

  if (name === 'dropout') $('#methodSelect').value = 'ramp';
  if (name === 'biDisconnected') {
    state.biDisconnected = true;
    if (['51','50','46','67','50N','51N'].includes(fn)) tester.command.currents[0].mag = Math.max(s.pickup * 2, 1);
    $('#endpointSelect').value = 'bi';
  }

  renderChannels(); renderAll(); drawVisual();
}

function handleFaceKey(key) {
  if (key === 'meter') { navigate('bench'); $('.response-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  if (key === 'setting') { navigate('bench'); $('#settingsPanel')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  if (key === 'event') navigate('evidence');
  if (key === 'reset') { sim.resetElement(); renderAll(); }
}

function appendSessionRecord(snapshot) {
  if (!sim.config || !sim.result) return;
  const notes = $('#sessionNotes').value.trim();
  const result = sim.result;
  const record = {
    timestamp: new Date().toISOString(),
    asset: state.asset,
    profile: currentRelayProfile().name,
    function: currentFn(),
    stage: sim.pickupStage || state.lastEvidence?.predicted?.stage || '',
    method: $('#methodSelect').selectedOptions[0]?.textContent || $('#methodSelect').value,
    physics: state.physics,
    boundary: $('#boundarySelect').value,
    endpoint: $('#endpointSelect').selectedOptions[0]?.textContent || $('#endpointSelect').value,
    setting: `${settings().pickup} ${currentFunctionMeta()?.unit || ''}`,
    pickupMeasured: result.pickupMeasured ?? sim.pickupMeasured ?? '',
    dropoutMeasured: result.dropoutMeasured ?? sim.dropoutMeasured ?? '',
    expectedMs: result.expectedMs ?? '',
    actualMs: result.actualMs ?? '',
    errorMs: result.error ?? '',
    verdict: result.verdict,
    notes
  };
  state.sessionRecords.push(record);
  saveSessionRecords(state.sessionRecords);
  $('#sessionNotes').value = '';
  renderReport();
  state.lastEvidence = {
    ...(state.lastEvidence || {}),
    actual: { events: clone(sim.events), timestamps: clone(sim.timestamps), result: clone(sim.result), pickupMeasured: sim.pickupMeasured, dropoutMeasured: sim.dropoutMeasured }
  };
}

function renderReport() {
  $('#reportTable').innerHTML = state.sessionRecords.map((r,i) => `<tr><td>${i+1}</td><td>${escapeHtml(r.function)}</td><td>${escapeHtml(r.method)}</td><td>${escapeHtml(r.endpoint)}</td><td>${r.expectedMs === '' ? '—' : fmt(r.expectedMs,1)+' ms'}</td><td>${r.actualMs === '' ? '—' : fmt(r.actualMs,1)+' ms'}</td><td><span class="mini-verdict ${String(r.verdict).toLowerCase()}">${escapeHtml(r.verdict)}</span></td><td>${escapeHtml(r.notes)}</td></tr>`).join('');
}

function exportEvidence() {
  const evidence = {
    ...(state.lastEvidence || buildEvidencePackage({ fn: currentFn(), settings: settings(), method: $('#methodSelect').value, physics: state.physics, endpoint: $('#endpointSelect').value, toleranceMs: Number($('#toleranceInput').value), pickupTolerancePct: Number($('#pickupToleranceInput').value), biDisconnected: state.biDisconnected }, evaluateFunction(currentFn(), predictedSignal(), settings()))),
    currentEvents: clone(sim.events),
    currentResult: clone(sim.result),
    sessionReport: clone(state.sessionRecords)
  };
  downloadText(`relay-lab-evidence-${Date.now()}.json`, JSON.stringify(evidence, null, 2), 'application/json');
}

function drawVisual() {
  const canvas = $('#visualCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = '#07131c'; ctx.fillRect(0,0,w,h);
  ctx.strokeStyle = '#173144'; ctx.lineWidth = 1;
  for (let x=40; x<w; x+=50) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
  for (let y=30; y<h; y+=40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
  if (state.visual === 'phasor') drawPhasor(ctx,w,h);
  else if (state.visual === 'waveform') drawWaveform(ctx,w,h);
  else drawCurve(ctx,w,h);
}

function visualArray() {
  const signal = tester.getInjectedSignal();
  return state.activeTab === 'voltage' ? signal.voltages : signal.currents;
}

function drawPhasor(ctx,w,h) {
  if (state.activeTab === 'binary') {
    ctx.fillStyle = '#89a4b7'; ctx.font = '14px sans-serif'; ctx.fillText('Select Current or Voltage to display phasors.', 30, 50); return;
  }
  const arr = visualArray();
  const max = Math.max(1, ...arr.map(x => x.mag));
  const cx=w/2, cy=h/2, r=Math.min(w,h)*0.38;
  ctx.strokeStyle='#486275'; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx-r,cy); ctx.lineTo(cx+r,cy); ctx.moveTo(cx,cy-r); ctx.lineTo(cx,cy+r); ctx.stroke();
  const palette=['#70d8ff','#f4b45c','#7ce7a8','#d88eff','#ff7786','#d8e76f'];
  arr.forEach((p,i) => {
    const a=p.angle*Math.PI/180, len=r*(p.mag/max);
    ctx.strokeStyle=palette[i]; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+len*Math.cos(a),cy-len*Math.sin(a)); ctx.stroke();
    ctx.fillStyle=palette[i]; ctx.fillText(p.name,cx+len*Math.cos(a)+5,cy-len*Math.sin(a)-5);
  });
  $('#visualLegend').textContent = `Injected phasors · OUTPUT ${tester.outputEnabled ? 'ON' : 'OFF'} · normalized to ${max.toFixed(2)} ${state.activeTab === 'voltage' ? 'V' : 'A'} max.`;
}

function drawWaveform(ctx,w,h) {
  if (state.activeTab === 'binary') { ctx.fillStyle='#89a4b7'; ctx.fillText('Binary I/O has no sinusoidal waveform.',30,50); return; }
  const arr = visualArray();
  const max = Math.max(1, ...arr.slice(0,3).map(x => x.mag));
  const palette=['#70d8ff','#f4b45c','#7ce7a8'];
  arr.slice(0,3).forEach((p,i) => {
    ctx.strokeStyle=palette[i]; ctx.lineWidth=2; ctx.beginPath();
    for (let x=0; x<w; x++) {
      const t=x/w*4*Math.PI;
      const y=h/2-(p.mag/max)*(h*0.34)*Math.sin(t+p.angle*Math.PI/180);
      if (x===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();
  });
  $('#visualLegend').textContent = `Injected waveform preview · ${tester.frequency.toFixed(2)} Hz · sinusoidal RMS training source.`;
}

function drawCurve(ctx,w,h) {
  const fn = currentFn();
  if (!['51','51N'].includes(fn)) {
    ctx.fillStyle='#89a4b7'; ctx.font='14px sans-serif';
    ctx.fillText('Curve view currently plots the generic IEC inverse-time engine for 51 / 51N.', 30, 50);
    $('#visualLegend').textContent = 'Function-specific characteristic plots will be added with each validated engine.';
    return;
  }
  ctx.strokeStyle='#6fb4ff'; ctx.lineWidth=2; ctx.beginPath(); let first=true;
  for (let x=50; x<w-20; x++) {
    const logM=-0.3+(x-50)/(w-70)*1.6;
    const m=Math.pow(10,logM);
    const t=iecOperateTime($('#curveSelect').value,m,Number($('#tmsInput').value));
    if (!Number.isFinite(t)) continue;
    const logT=Math.log10(Math.max(0.01,Math.min(100,t)));
    const y=h-35-(logT+2)/4*(h-55);
    if (first) {ctx.moveTo(x,y); first=false;} else ctx.lineTo(x,y);
  }
  ctx.stroke();
  ctx.fillStyle='#89a4b7'; ctx.fillText('IEC inverse-time characteristic · log M vs log t',25,22);
  const pred=evaluateFunction(fn,predictedSignal(),settings());
  $('#visualLegend').textContent = `Generic IEC curve · predicted stage ${pred.stage || fn} · expected ${Number.isFinite(pred.expected) ? (pred.expected*1000).toFixed(1)+' ms' : 'no operate'}.`;
}

function renderStaticViews() {
  renderPrinciples();
  renderAnsiLibrary();
  renderEquipment();
  renderRelayLibrary();
  renderArchitecture();
  renderEndpointGuide();
}

function renderPrinciples() {
  $('#principleGrid').innerHTML = principleCards.map(c => `<article class="principle-card"><h3>${escapeHtml(c.title)}</h3><p>${escapeHtml(c.body)}</p></article>`).join('');
}

function renderAnsiLibrary() {
  $('#ansiFunctionCards').innerHTML = functionCatalog.map(f => `<article class="function-card ${f.implemented ? '' : 'planned'}"><div class="function-top"><strong>${escapeHtml(f.id)}</strong><span>${f.implemented ? 'EXECUTABLE / SCHEME' : 'MAPPED'}</span></div><h3>${escapeHtml(f.name.replace(/^.*·\s*/,''))}</h3><p>${escapeHtml(f.family)} · ${escapeHtml(f.assets.join(', '))}</p></article>`).join('');
}

function renderAssetFunctionCards() {
  // The ANSI library is global; sidebar asset selection controls the workbench and relay library.
}

function renderEquipment() {
  $('#equipmentCards').innerHTML = testerProfiles.map(p => `<article class="equipment-card"><div class="function-top"><strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(p.status)}</span></div><p>${escapeHtml(p.note)}</p><dl><dt>Analog</dt><dd>${p.currentChannels ?? '?'}I / ${p.voltageChannels ?? '?'}V</dd><dt>I range</dt><dd>${Number.isFinite(p.maxCurrent) ? p.maxCurrent+' A' : 'Not verified'}</dd><dt>V range</dt><dd>${Number.isFinite(p.maxVoltage) ? p.maxVoltage+' V' : 'Not verified'}</dd><dt>Binary</dt><dd>${p.binaryInputs ?? '?'} BI / ${p.binaryOutputs ?? '?'} BO</dd></dl></article>`).join('');
}

function renderRelayLibrary() {
  const assetOrder = ['generic','transformer','generator','motor','feeder','line'];
  $('#relayLibrary').innerHTML = assetOrder.map(asset => `<section class="library-group ${asset === state.asset ? 'selected' : ''}"><h3>${escapeHtml(assetMeta[asset].title)}</h3><div class="library-cards">${profiles[asset].map(p => `<article class="relay-card"><div class="function-top"><strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(p.status)}</span></div><p><b>${escapeHtml(p.vendor)}</b></p><p>${escapeHtml(p.note)}</p></article>`).join('')}</div></section>`).join('');
}

function renderArchitecture() {
  const layers = [
    ['M01','Asset & topology','Nodes, terminals, zones and sources'],
    ['M02–M03','Instrument + measurement','CT/VT basis, polarity, phasors, sequence and quality'],
    ['M04–M05','Element + qualifier','Pickup, timer, reset, direction, block and operating mode'],
    ['M06–M07','Scheme + trip matrix','AND/OR/timer/latch, target, delay and BF initiation'],
    ['M08','Actuator','BO, DC, coil, breaker mechanism, 52a/52b and interruption'],
    ['M09','Test generator','Shot, ramp, sequence; open-loop or closed-loop'],
    ['M10','Observation & verdict','Pickup, operate, BO, BI, 52, current-zero and expected/forbidden events'],
    ['M11–M13','Profiles, evidence & digital','Vendor/tester profile, settings hash, reproducibility and future GOOSE/SV']
  ];
  $('#architectureStack').innerHTML = layers.map(([id,name,body]) => `<div class="architecture-row"><span>${id}</span><strong>${escapeHtml(name)}</strong><p>${escapeHtml(body)}</p></div>`).join('');
  const d = DEFAULT_DELAYS;
  $('#delayTable').innerHTML = `<table class="mini-table"><tbody>${Object.entries(d).map(([k,v]) => `<tr><td>${escapeHtml(k)}</td><td>${v} ms</td></tr>`).join('')}</tbody></table><p class="microcopy">Generic training delays are explicit model parameters, not OEM acceptance values.</p>`;
  $('#physicsContract').innerHTML = `<div class="contract-card"><b>OPEN LOOP</b><p>Tester I/V follows the test plan. Breaker opening does not automatically remove the injected source. Current-zero is therefore not an automatic open-loop endpoint.</p></div><div class="contract-card"><b>CLOSED LOOP</b><p>The system model changes the measured current after breaker or backup isolation. Commanded test-set values remain stored separately.</p></div>`;
}

function renderEndpointGuide() {
  $('#endpointGuide').innerHTML = endpointCatalog.map(e => `<div class="endpoint-item"><b>${escapeHtml(e.label)}</b><span>${escapeHtml(e.proves)}</span><em>${escapeHtml(e.boundary)}</em></div>`).join('');
}

async function waitUntil(predicate, timeoutMs = 3000) {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    if (predicate()) return true;
    await new Promise(r => setTimeout(r, 25));
  }
  return false;
}

async function runSelfTest() {
  const panel = $('#selfTestPanel');
  panel.hidden = false;
  const results = [];
  const check = (name, ok, detail='') => results.push({name, ok: !!ok, detail});
  try {
    navigate('ansi'); check('navigation', $('[data-view-section="ansi"]').classList.contains('active'));
    navigate('bench');
    tester.resetSignals(); renderChannels(); renderAll();
    check('output-off-isolation', tester.getInjectedSignal().currents[0].mag === 0, `actual=${tester.getInjectedSignal().currents[0].mag}`);
    tester.setOutput(true); check('output-on-injection', tester.getInjectedSignal().currents[0].mag === tester.command.currents[0].mag);
    tester.select('current',0); const before=tester.command.currents[0].mag; tester.fineAdjust(0.1); check('fine-adjust', Math.abs(tester.command.currents[0].mag-(before+0.1))<1e-9);
    tester.toggleLink('current',0); check('channel-disconnect', tester.getInjectedSignal().currents[0].mag === 0); tester.toggleLink('current',0);
    $('#functionSelect').value='51'; applyFunctionDefaults('51'); applyPreset('fault2');
    const pred=evaluateFunction('51',predictedSignal(),settings()); check('51-prediction', pred.supported && pred.picked && Number.isFinite(pred.expected), pred.reason);
    $('#endpointSelect').value='breaker'; $('#speedSelect').value='20'; $('#maxDurationInput').value='2'; state.physics='open'; setSegment('#physicsControl',$('#physicsControl [data-physics="open"]')); startSimulation();
    await waitUntil(()=>!sim.running,2500); check('shot-breaker-verdict', sim.result?.verdict==='PASS', JSON.stringify(sim.result));
    state.physics='closed'; setSegment('#physicsControl',$('#physicsControl [data-physics="closed"]')); applyPreset('fault2'); $('#endpointSelect').value='currentZero'; startSimulation();
    await waitUntil(()=>!sim.running,2500); check('closed-loop-current-zero', sim.timestamps.currentZero!=null && sim.result?.verdict==='PASS', JSON.stringify(sim.result));
    state.physics='open'; setSegment('#physicsControl',$('#physicsControl [data-physics="open"]')); applyPreset('biDisconnected'); $('#maxDurationInput').value='1'; startSimulation();
    await waitUntil(()=>!sim.running,2500); check('bi-disconnected-fails-bi-endpoint', sim.result?.verdict==='FAIL' && sim.timestamps.bi==null, JSON.stringify(sim.result));
  } catch (error) {
    check('selftest-exception', false, error?.stack || String(error));
  }
  const pass = results.every(r=>r.ok);
  panel.dataset.selftest = pass ? 'PASS' : 'FAIL';
  panel.innerHTML = `<h2>SELF TEST ${pass ? 'PASS' : 'FAIL'}</h2><ul>${results.map(r=>`<li data-ok="${r.ok}">${r.ok?'PASS':'FAIL'} · ${escapeHtml(r.name)} ${r.detail?`— ${escapeHtml(r.detail)}`:''}</li>`).join('')}</ul>`;
  document.title = `Relay Lab V2 · SELFTEST ${pass ? 'PASS' : 'FAIL'}`;
}

init();
