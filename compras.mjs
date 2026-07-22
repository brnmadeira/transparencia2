import { getSuppliers, verify, bearer, json } from './_lib.mjs';

export default async (req) => {
  const tok = verify(bearer(req));
  if(!tok || (tok.role !== 'admin' && tok.role !== 'compras')) return json({ error: 'acesso restrito ao Painel de Compras' }, 403);

  const sups = await getSuppliers();
  const list = Object.keys(sups).sort().map(name => ({ name, sheetUrl: sups[name].sheetUrl || '' }));
  return json({ suppliers: list });
};

export const config = { path: '/api/compras' };
