import { getSuppliers, verify, bearer, fetchWorkbook, parseWorkbook, json } from './_lib.mjs';

export default async (req) => {
  const tok = verify(bearer(req));
  if(!tok) return json({ error: 'sessão inválida ou expirada' }, 401);

  const url = new URL(req.url);
  let name = tok.name;
  if(tok.role === 'admin' || tok.role === 'compras') name = url.searchParams.get('name') || name; // admin/compras podem escolher o fornecedor
  if(!name) return json({ error: 'fornecedor não informado' }, 400);

  const sups = await getSuppliers();
  const cfg = sups[name];
  if(!cfg) return json({ error: 'fornecedor não encontrado' }, 404);

  try{
    const wb = await fetchWorkbook(cfg.sheetUrl);        // <-- leitura AO VIVO a cada acesso
    const sup = parseWorkbook(wb);
    sup.name = name;                                     // mantém o nome cadastrado
    return json({ supplier: sup, meta: { accessCount: cfg.accessCount || 0, lastAccess: cfg.lastAccess || '' } });
  }catch(e){
    return json({ error: e.message || 'erro ao ler a planilha' }, 502);
  }
};

export const config = { path: '/api/data' };
