import { getSuppliers, setSuppliers, getSettings, dec, sign, json, ADMIN_PASSWORD } from './_lib.mjs';

export default async (req) => {
  if(req.method !== 'POST') return json({ error: 'método inválido' }, 405);
  const { user, pass } = await req.json().catch(() => ({}));
  if(!user) return json({ error: 'informe o usuário' }, 400);

  const exp = Date.now() + 1000 * 60 * 60 * 8; // 8 horas

  if(String(user).toLowerCase() === 'admin'){
    if(pass === ADMIN_PASSWORD) return json({ token: sign({ role: 'admin', exp }), role: 'admin' });
    return json({ error: 'senha de admin incorreta' }, 401);
  }

  if(String(user).toLowerCase() === 'compras'){
    const settings = await getSettings();
    if(!settings.comprasProtected) return json({ token: sign({ role: 'compras', exp }), role: 'compras' });
    if(pass === settings.comprasPass) return json({ token: sign({ role: 'compras', exp }), role: 'compras' });
    return json({ error: 'senha do Painel de Compras incorreta' }, 401);
  }

  const sups = await getSuppliers();
  const name = Object.keys(sups).find(n => (sups[n].login || n).toLowerCase() === String(user).toLowerCase());
  if(name && dec(sups[name].senhaEnc) === pass){
    sups[name].accessCount = (sups[name].accessCount || 0) + 1;
    sups[name].lastAccess = new Date().toISOString();
    await setSuppliers(sups);
    return json({ token: sign({ role: 'industry', name, exp }), role: 'industry', name });
  }
  return json({ error: 'usuário ou senha inválidos' }, 401);
};

export const config = { path: '/api/login' };
