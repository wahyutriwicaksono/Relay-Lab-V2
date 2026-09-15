import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { functionCatalog } from '../js/core/profiles.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'css/styles.css'),'utf8');
const results=[];
const assert=(name,ok,detail='')=>{results.push({name,ok:!!ok,detail}); if(!ok) console.error('FAIL',name,detail)};

const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
const dup=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
assert('no duplicate HTML ids',dup.length===0,dup.join(','));

const requiredViews=['bench','logic','evidence','principles','ansi','equipment','library'];
for(const v of requiredViews){
  assert(`navigation button ${v}`,html.includes(`data-view="${v}"`));
  assert(`view section ${v}`,html.includes(`data-view-section="${v}"`));
}

const requiredControls=[
  'outputToggle','injectorTabs','channelArea','fineMinus','finePlus','fineStep','frequencyInput',
  'functionSelect','methodSelect','pickupInput','curveSelect','tmsInput','ctPrimary','ctSecondary','vtPrimary','vtSecondary',
  'endpointSelect','toleranceInput','maxDurationInput','startBtn','stopBtn','resetBtn','testProgress',
  'eventTable','sessionNotes','exportCsvBtn','exportJsonBtn','clearReportBtn','reportTable',
  'elementResetBtn','lockoutResetBtn','breakerCloseBtn','enable86','enableBF','blockOutput','breakerFail'
];
for(const id of requiredControls) assert(`required control #${id}`,ids.includes(id));

for(const preset of ['normal','fault2','fault5','dropout','biDisconnected']) assert(`V1 preset ${preset}`,html.includes(`data-preset="${preset}"`));
for(const key of ['meter','setting','event','reset']) assert(`V1 facekey ${key}`,html.includes(`data-facekey="${key}"`));

const baselineFunctions=['51','24','25','27','46','50','59','63','67','51N','50N','87T','59N','81U','81O','32R'];
const catalogIds=new Set(functionCatalog.map(f=>f.id));
for(const fn of baselineFunctions) assert(`V1 function catalog ${fn}`,catalogIds.has(fn));

const localRefs=[...html.matchAll(/(?:src|href)="(\.\/[^"?#]+)"/g)].map(m=>m[1]);
for(const ref of localRefs){
  const p=path.join(root,ref.replace(/^\.\//,''));
  assert(`local asset exists ${ref}`,fs.existsSync(p),p);
}

assert('app wires navigation',app.includes("$$('.nav-item')") && app.includes('navigate(btn.dataset.view)'));
assert('app separates predicted and injected signal',app.includes('predictedSignal()') && app.includes('tester.getInjectedSignal()'));
assert('app supports CSV report',app.includes('recordsToCsv'));
assert('app supports evidence JSON',app.includes('exportEvidence'));
assert('CSS has responsive breakpoints',css.includes('@media(max-width:760px)') && css.includes('@media(max-width:500px)'));

const passed=results.filter(r=>r.ok).length;
console.log(`UI STATIC TESTS: ${passed}/${results.length} PASS`);
for(const r of results) console.log(`${r.ok?'PASS':'FAIL'} | ${r.name}${r.detail?' | '+r.detail:''}`);
if(passed!==results.length) process.exit(1);
