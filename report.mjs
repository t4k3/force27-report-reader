// The imported HTML is never executed or inserted into the DOM. Only its
// versioned JSON snapshot is read; rendering uses our bundled trusted template.
import { TEMPLATE } from './template.mjs';

export const MAX_FILE_BYTES = 24 * 1024 * 1024;
const JOINTS = new Set(['nose','neck','root','leftShoulder','rightShoulder','leftElbow','rightElbow','leftWrist','rightWrist','leftHip','rightHip','leftKnee','rightKnee','leftAnkle','rightAnkle']);
const bad = () => { throw new Error('Il report contiene dati incompleti o non validi. Genera nuovamente l’HTML da Force27.'); };
const object = v => { if (!v || typeof v !== 'object' || Array.isArray(v)) bad(); return v; };
const text = (v, max = 2000) => { if (typeof v !== 'string' || v.length > max) bad(); return v; };
const number = (v, low, high) => { if (typeof v !== 'number' || !Number.isFinite(v) || v < low || v > high) bad(); return v; };
const array = (v, max) => { if (!Array.isArray(v) || v.length > max) bad(); return v; };
const nullableText = (v, max) => v == null ? null : text(v, max);

export function checkFile(file) {
  if (!file || !/\.html?$/i.test(file.name)) throw new Error('Scegli il file HTML ricevuto dal tuo professionista. PDF, video e immagini non sono report interattivi.');
  if (file.size > MAX_FILE_BYTES) throw new Error('Il file supera 24 MB. Chiedi al professionista di esportare un report più piccolo.');
  if (!file.size) throw new Error('Questo file è vuoto. Salva di nuovo l’allegato e riprova.');
}

export function parseReport(html) {
  if (typeof html !== 'string' || html.length > MAX_FILE_BYTES) bad();
  let payload, found = 0;
  // Parse only a script's attribute list and JSON text. DOMParser on arbitrary
  // HTML is deliberately avoided: even inert parsing can load remote images.
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const attributes = Object.create(null);
    for (const a of match[1].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)) {
      attributes[a[1].toLowerCase()] = a[2] ?? a[3] ?? a[4];
    }
    if (attributes.id === 'report-data' && attributes.type?.toLowerCase() === 'application/json') {
      found++;
      try { payload = JSON.parse(match[2]); } catch { bad(); }
    }
  }
  if (found !== 1) throw new Error('Questo HTML non è un report Jump di Force27. Scegli il file esportato con “Report”.');
  return validateReport(payload);
}

export function validateReport(input) {
  const d = object(input);
  if (d.schemaVersion !== 1) throw new Error('Questa versione del report non è supportata dal lettore.');
  const duration = number(d.duration, .001, 86400);
  const signals = array(d.signals, 3).map(s => {
    object(s);
    const color = text(s.color, 7);
    if (!/^#[0-9a-f]{6}$/i.test(color)) bad();
    let last = -Infinity;
    const points = array(s.points, 40000).map(p => {
      object(p); const t = number(p.t, 0, duration + .001), y = number(p.y, -1e12, 1e12);
      if (t < last) bad(); last = t;
      return {t, y};
    });
    return {name: text(s.name, 100), color, points};
  });
  let last = -Infinity;
  const poses = array(d.poses, 60000).map(p => {
    object(p); const t = number(p.t, -1, duration + 1);
    if (t < last) bad(); last = t;
    const joints = {};
    for (const [key, value] of Object.entries(object(p.joints))) {
      if (!JOINTS.has(key)) continue;
      if (!Array.isArray(value) || value.length !== 2) bad();
      joints[key] = [number(value[0], 0, 1), number(value[1], 0, 1)];
    }
    return {t, joints};
  });
  const metrics = array(d.metrics, 100).map(m => {
    object(m);
    return {id:text(m.id,100),title:text(m.title,300),measurement:text(m.measurement,300),explanation:text(m.explanation,4000),comparison:nullableText(m.comparison,1000)};
  });
  if (!metrics.length) bad();
  const logo = nullableText(d.logoBase64, 10 * 1024 * 1024);
  if (logo && (!logo.startsWith('iVBORw0KGgo') || !/^[A-Za-z0-9+/]+={0,2}$/.test(logo))) bad();
  if (typeof d.isDemo !== 'boolean') bad();
  return {
    schemaVersion:1, athlete:text(d.athlete,1000), organization:text(d.organization,1000),
    dateLabel:text(d.dateLabel,200), protocolName:text(d.protocolName,200),
    appVersion:text(d.appVersion,100), algorithmVersion:text(d.algorithmVersion,200),
    comment:text(d.comment,30000), warnings:array(d.warnings,100).map(w=>text(w,4000)),
    metrics, signals, duration, poses, poseTolerance:number(d.poseTolerance,.001,1),
    poseAspectRatio:number(d.poseAspectRatio,.05,20), skeletonStatus:text(d.skeletonStatus,4000),
    comparisonStatus:text(d.comparisonStatus,4000), logoBase64:logo, isDemo:d.isDemo
  };
}

export const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const jsonText = d => JSON.stringify(d).replace(/[<>&\u2028\u2029]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));

function chartSVG(signals) {
  let end = .001, low = 0, high = 1;
  for (const s of signals) for (const p of s.points) {end=Math.max(end,p.t);low=Math.min(low,p.y);high=Math.max(high,p.y);}
  const span=Math.max(1,high-low), f=n=>n.toFixed(2); let svg='';
  for(let i=0;i<=4;i++) {const y=24+i*58;svg+=`<line x1="58" y1="${f(y)}" x2="880" y2="${f(y)}" class="gridline"/><text x="48" y="${f(y+4)}" text-anchor="end" class="axis">${(high-i*span/4).toFixed(0)}</text>`;}
  for(const s of signals) {let path='',previous;
    for(const p of s.points) {const command=previous===undefined||p.t-previous>.05?'M':'L';path+=`${command}${f(58+p.t/end*822)},${f(256-(p.y-low)/span*232)} `;previous=p.t;}
    svg+=`<path d="${path}" stroke="${s.color}" fill="none" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
  }
  for(let i=0;i<=4;i++){const t=end*i/4;svg+=`<text x="${f(58+t/end*822)}" y="282" text-anchor="middle" class="axis">${f(t)} s</text>`;}
  return svg;
}

export function renderReport(input) {
  const d = validateReport(input), e = escapeHTML;
  const preferred=['height','rj-height-best','flight','contact','rsi','peak','velocity'];
  const rank=m=>{const i=preferred.indexOf(m.id);return i<0?100:i;};
  const card=m=>`<article class="metric"><p class="metric-title">${e(m.title)}</p><p class="metric-value">${e(m.measurement)}</p><p class="metric-description">${e(m.explanation)}</p>${m.comparison?`<p class="delta">${e(m.comparison)}</p>`:''}</article>`;
  const tokens={ATHLETE:e(d.athlete),ORGANIZATION:e(d.organization),DATE:e(d.dateLabel),PROTOCOL:e(d.protocolName),
    METRICS:[...d.metrics].sort((a,b)=>rank(a)-rank(b)).slice(0,4).map(card).join(''),DETAILS:d.metrics.map(card).join(''),DATA:jsonText(d),
    COMMENT_SECTION:d.comment.trim()?`<section class="note"><div><div class="eyebrow">Il prossimo passo</div><h2>Il commento del professionista</h2></div><p class="comment">${e(d.comment)}</p></section>`:'',
    WARNINGS:d.warnings.length?`<aside class="notice"><strong>Da leggere insieme al risultato</strong><ul>${d.warnings.map(w=>`<li>${e(w)}</li>`).join('')}</ul></aside>`:'',
    COMPARISON:e(d.comparisonStatus),SKELETON_STATUS:e(d.skeletonStatus),
    LOGO:d.logoBase64?`<img class="logo" alt="Logo del professionista" src="data:image/png;base64,${e(d.logoBase64)}">`:'<span class="monogram" aria-hidden="true">F27</span>',
    CHART:chartSVG(d.signals),VERSION:e(d.appVersion),ALGORITHM:e(d.algorithmVersion),DEMO:d.isDemo?'<div class="demo">ESEMPIO DIMOSTRATIVO · DATI SIMULATI</div>':''};
  return TEMPLATE.replace(/\{\{([A-Z_]+)\}\}/g,(_,key)=>tokens[key]??'');
}
