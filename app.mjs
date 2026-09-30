import {checkFile, parseReport, renderReport} from './report.mjs';

const $=id=>document.getElementById(id);
const input=$('report-file'),home=$('home'),viewer=$('viewer'),host=$('frame-host'),status=$('status'),error=$('error');
let generation=0;

function clearReport() {
  generation++;
  host.replaceChildren(); // Destroys the player and its in-memory report.
  $('report-name').textContent='';
  input.value='';input.disabled=false;
  viewer.hidden=true;home.hidden=false;$('reader-footer').hidden=false;
  document.body.classList.remove('report-open');
  status.textContent='';error.hidden=true;error.textContent='';
}

input.addEventListener('change',async()=>{
  const file=input.files?.[0];
  if(!file)return;
  clearReport();
  const current=generation;
  input.disabled=true;status.textContent='Apertura del report…';
  try {
    checkFile(file);
    const report=parseReport(await file.text());
    if(current!==generation)return;
    const frame=document.createElement('iframe');
    frame.title=`Report Jump di ${report.athlete}`;
    frame.setAttribute('sandbox','allow-scripts');
    frame.setAttribute('referrerpolicy','no-referrer');
    frame.srcdoc=renderReport(report);
    $('report-name').textContent=file.name;
    host.replaceChildren(frame);
    home.hidden=true;viewer.hidden=false;$('reader-footer').hidden=true;
    document.body.classList.add('report-open');
    status.textContent='';window.scrollTo(0,0);
  } catch(e) {
    if(current!==generation)return;
    error.textContent=e instanceof Error?e.message:'Non riesco ad aprire il file. Salvalo di nuovo e riprova.';
    error.hidden=false;status.textContent='';
  } finally {
    if(current===generation){input.value='';input.disabled=false;}
  }
});
$('close-report').addEventListener('click',()=>{clearReport();input.focus();});
// Do not retain a client's report in the browser's back/forward page cache.
window.addEventListener('pagehide',clearReport);
