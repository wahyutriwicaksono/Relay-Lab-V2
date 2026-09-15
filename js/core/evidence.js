export function stableHash(input) {
  const text = typeof input === 'string' ? input : JSON.stringify(input, Object.keys(input || {}).sort());
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function downloadText(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function csvEscape(value) {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function recordsToCsv(records) {
  const headers = [
    'timestamp','asset','profile','function','stage','method','physics','boundary','endpoint',
    'setting','pickupMeasured','dropoutMeasured','expectedMs','actualMs','errorMs','verdict','notes'
  ];
  const rows = records.map(r => [
    r.timestamp,r.asset,r.profile,r.function,r.stage,r.method,r.physics,r.boundary,r.endpoint,
    r.setting,r.pickupMeasured,r.dropoutMeasured,r.expectedMs,r.actualMs,r.errorMs,r.verdict,r.notes
  ]);
  return [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\n');
}

export function loadSessionRecords() {
  try {
    const raw = sessionStorage.getItem('relayLabV2SessionRecords');
    const value = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function saveSessionRecords(records) {
  try {
    sessionStorage.setItem('relayLabV2SessionRecords', JSON.stringify(records));
  } catch {
    // Session evidence still remains in memory if storage is unavailable.
  }
}
