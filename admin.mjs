import { getSuppliers, setSuppliers, getSettings, setSettings, verify, bearer, enc, dec, json } from './_lib.mjs';

export default async (req) => {
  const tok = verify(bearer(req));
  if(!tok || tok.role !== 'admin') return json({ error: 'apenas o admin pode acessar' }, 403);

  if(req.method === 'GET'){
    const sups = await getSuppliers();
    const list = Object.keys(sups).sort().map(name => ({
      name,
      login: sups[name].login || name,
      senha: dec(sups[name].senhaEnc),
      sheetUrl: sups[name].sheetUrl || '',
      accessCount: sups[name].accessCount || 0,
      lastAccess: sups[name].lastAccess || ''
    }));
    const settings = await getSettings();
    return json({ suppliers: list, settings });
  }

  if(req.method === 'POST'){
    const body = await req.json().catch(() => ({}));
    const sups = await getSuppliers();

    if(body.action === 'settings'){
      const settings = await getSettings();
      settings.comprasProtected = !!body.comprasProtected;
      if(typeof body.comprasPass === 'string' && body.comprasPass !== '') settings.comprasPass = body.comprasPass;
      await setSettings(settings);
      return json({ ok: true, settings });
    }

    if(body.action === 'save'){
      const name = (body.name || '').trim();
      if(!name) return json({ error: 'nome do fornecedor é obrigatório' }, 400);
      if(!(body.sheetUrl || '').trim()) return json({ error: 'link do Google Sheets é obrigatório' }, 400);
      const prev = sups[name] || {};
      sups[name] = {
        login: (body.login || name).trim(),
        senhaEnc: body.senha ? enc(body.senha) : (prev.senhaEnc || enc('123456')),
        sheetUrl: (body.sheetUrl || '').trim(),
        accessCount: prev.accessCount || 0,
        lastAccess: prev.lastAccess || ''
      };
      await setSuppliers(sups);
      return json({ ok: true });
    }

    if(body.action === 'delete'){
      delete sups[(body.name || '').trim()];
      await setSuppliers(sups);
      return json({ ok: true });
    }

    return json({ error: 'ação desconhecida' }, 400);
  }

  return json({ error: 'método inválido' }, 405);
};

export const config = { path: '/api/admin' };
