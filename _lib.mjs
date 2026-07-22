import { getStore } from '@netlify/blobs';
import XLSX from 'xlsx';
import crypto from 'node:crypto';

const SECRET = process.env.SESSION_SECRET || 'troque-este-segredo-no-netlify';
export const ADMIN_PASSWORD = process.env.ADMIN_PASS || 'admin123';

/* ---------- storage (Netlify Blobs) ---------- */
export function store(){ return getStore('portal'); }
export async function getSuppliers(){ const v = await store().get('suppliers', { type: 'json' }); return v || {}; }
export async function setSuppliers(obj){ await store().setJSON('suppliers', obj); }

/* ---------- settings (ex.: proteção por senha do Painel de Compras) ---------- */
export async function getSettings(){
  const v = await store().get('settings', { type: 'json' });
  return Object.assign({ comprasProtected: false, comprasPass: '' }, v || {});
}
export async function setSettings(obj){ await store().setJSON('settings', obj); }

/* ---------- password encryption (retrievable so admin can view/share) ---------- */
const keyBuf = crypto.scryptSync(SECRET, 'portal-salt', 32);
export function enc(text){
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', keyBuf, iv);
  const ct = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}
export function dec(b64){
  try{
    const buf = Buffer.from(String(b64 || ''), 'base64');
    const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), ct = buf.subarray(28);
    const d = crypto.createDecipheriv('aes-256-gcm', keyBuf, iv); d.setAuthTag(tag);
    return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
  }catch(e){ return ''; }
}

/* ---------- signed session token (HMAC) ---------- */
function b64url(buf){ return Buffer.from(buf).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
export function sign(payload){
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac('sha256', SECRET).update(body).digest());
  return body + '.' + sig;
}
export function verify(token){
  if(!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = b64url(crypto.createHmac('sha256', SECRET).update(body).digest());
  if(expected !== sig) return null;
  try{
    const p = JSON.parse(Buffer.from(body.replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString());
    if(p.exp && Date.now() > p.exp) return null;
    return p;
  }catch(e){ return null; }
}
export function bearer(req){ const h = req.headers.get('authorization') || ''; return h.startsWith('Bearer ') ? h.slice(7) : ''; }

/* ---------- live Google Sheet read ---------- */
export function sheetExportUrl(url){
  url = String(url || '').trim();
  if(/export\?format=xlsx/.test(url)) return url;
  const id = (url.match(/\/spreadsheets\/d\/(?:e\/)?([a-zA-Z0-9-_]+)/) || [])[1];
  return id ? `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx` : url;
}
export async function fetchWorkbook(url){
  const res = await fetch(sheetExportUrl(url), { redirect: 'follow' });
  if(!res.ok) throw new Error('Não consegui ler a planilha (HTTP ' + res.status + '). Confira o compartilhamento do link.');
  const buf = Buffer.from(await res.arrayBuffer());
  if(!(buf[0] === 0x50 && buf[1] === 0x4B)) throw new Error('O link não retornou uma planilha. Compartilhe como "qualquer pessoa com o link".');
  return XLSX.read(buf, { type: 'buffer' });
}

/* ---------- parse the molde (ID + RESUMO + detail sheets) ---------- */
// abas "clássicas" (fornecedor vê no login dele) + abas novas do Painel de Compras
export const SECTIONS = ['TRADE','COMERCIAL','REBATE','DANIFICADO','VENCIDOS','OUTROS'];
export const COMPRAS_SECTIONS = ['TRADE','ACOES','REBATE','DANIFICADO','VENCIDOS','OUTLET','ACORDOS','REBAIXA','EVENTOS'];
// setor -> quais abas ele enxerga no Painel de Compras
export const SETOR_SECTIONS = {
  COMERCIAL: ['ACORDOS','REBAIXA','VENCIDOS','DANIFICADO','OUTLET'],
  TRADE: ['TRADE'],
  MARKETING: ['TRADE','EVENTOS']
};
// resistente a acento/maiúscula: 'AÇÕES', 'Ações', 'acoes' etc. todas acham a mesma aba
function normName(s){ return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase(); }
function findSheetName(wb, name){
  const target = normName(name);
  return wb.SheetNames.find(n => normName(n) === target) || null;
}
function aoaOf(wb, name){
  const key = findSheetName(wb, name); const ws = key ? wb.Sheets[key] : null; if(!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }).map(r => r.map(c => String(c == null ? '' : c).trim()));
}
export function parseWorkbook(wb){
  const idrows = aoaOf(wb, 'ID'); const id = {};
  idrows.slice(0, 30).forEach(r => {
    const ne = r.filter(c => c !== '');
    if(ne.length >= 2 && ne[0].endsWith(':')) id[ne[0].replace(/:$/,'').trim()] = ne[1];
    if(ne.length === 1 && /^ind[uú]stria/i.test(ne[0])) id.industria = ne[0].replace(/ind[uú]stria/i,'').trim();
  });
  const raw = id.industria || id['Fornecedor / Marca'] || 'Fornecedor';
  const name = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();

  const rr = aoaOf(wb, 'RESUMO'); const hi = rr.findIndex(r => r.includes('Tipo de Pendência'));
  const cats = []; let total = null, updated = '';
  if(hi >= 0){
    const c0 = rr[hi].indexOf('Tipo de Pendência');
    for(const r of rr.slice(hi + 1)){
      const tip = (r[c0] || '').trim();
      if(/^[uú]ltima/i.test(tip)){ updated = r[c0 + 1] || ''; continue; }
      if(tip === '') continue;
      if(/^total geral/i.test(tip)){ total = { total:r[c0+1], provisionar:r[c0+2], pendente:r[c0+3], pago:r[c0+4], resolvido:r[c0+5] }; continue; }
      cats.push({ tipo:tip, total:r[c0+1], provisionar:r[c0+2], pendente:r[c0+3], pago:r[c0+4], resolvido:r[c0+5] });
    }
    rr.slice(hi + 1).forEach(r => { const k = r.findIndex(c => /^[uú]ltima/i.test(c)); if(k >= 0 && r[k+1]) updated = r[k+1]; });
  }

  const ALL_SECTIONS = [...new Set([...SECTIONS, ...COMPRAS_SECTIONS])];
  const sections = {};
  ALL_SECTIONS.forEach(s => {
    const rows = aoaOf(wb, s); const h = rows.findIndex(r => r.includes('Nº'));
    if(h < 0){ sections[s] = { cols:[], rows:[] }; return; }
    const hc = rows[h].indexOf('Nº'); let cols = rows[h].slice(hc);
    while(cols.length && cols[cols.length - 1] === '') cols.pop();
    cols = cols.map(c => c.trim());
    const data = [];
    rows.slice(h + 1).forEach(r => {
      const first = (r[hc] || '').trim();
      if(first === '' || ['TOTAIS','TOTAL'].includes(first.toUpperCase())) return;
      const o = {}; cols.forEach((col, j) => o[col] = r[hc + j] || ''); data.push(o);
    });
    sections[s] = { cols, rows: data };
  });

  return {
    name, legalName: id['Fornecedor / Marca'] || '', cnpj: id['CNPJ'] || '',
    comercial: id['Contato comercial'] || '', sac: id['Contato SAC'] || '', telefone: id['Telefone'] || '',
    periodicidade: id['Periodicidade do trade'] || '', obs: id['Observações gerais'] || '',
    resumo: { categories: cats, total, updatedAt: updated }, sections
  };
}

export function json(obj, status = 200){ return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } }); }
