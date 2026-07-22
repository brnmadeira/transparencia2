# Portal de Transparência — Way Suplementos (produção)

Portal onde cada fornecedor entra com login próprio e vê suas pendências com a Way Suplementos.
Os dados vêm **ao vivo** de um Google Sheets no molde de pendências — você edita a planilha e o
fornecedor vê atualizado no próximo acesso, sem tocar em nenhum painel.

Roda 100% na **Netlify**: site estático + funções de servidor + armazenamento embutido (Netlify Blobs).
**Não usa Firebase nem Google Cloud.**

---

## O que você precisa

- Uma conta na Netlify (gratuita serve para começar).
- As planilhas de cada fornecedor no molde de pendências, cada uma compartilhada como
  **"qualquer pessoa com o link (leitor)"** (ou publicada na web).

---

## Passo a passo do deploy

### 1. Suba o projeto para a Netlify
Duas opções:

**Opção A — arrastar a pasta (mais rápido):**
1. Acesse app.netlify.com → **Add new site** → **Deploy manually**.
2. Arraste esta pasta inteira (`portal-producao`) para a área de upload.

**Opção B — via GitHub (recomendado para atualizar depois):**
1. Suba esta pasta para um repositório no GitHub.
2. Na Netlify: **Add new site** → **Import from Git** → selecione o repositório.
3. A Netlify lê o `netlify.toml` sozinha (publish = `public`, functions = `netlify/functions`).

### 2. Configure as variáveis de ambiente
No painel do site: **Site configuration → Environment variables → Add a variable**. Crie duas:

| Variável | Valor | Para quê |
|---|---|---|
| `SESSION_SECRET` | uma frase longa e aleatória sua | assina os logins e protege as senhas |
| `ADMIN_PASS` | a senha que **você** usará como admin | seu acesso ao painel |

Depois de criar/alterar variáveis, faça um **redeploy** (Deploys → Trigger deploy → Deploy site).

### 3. Pronto
Abra o endereço do site (algo como `https://seu-portal.netlify.app`).

- **Você (admin):** usuário `admin` + a senha que definiu em `ADMIN_PASS`.
- Cadastre cada fornecedor: nome, link do Google Sheets, usuário e senha.
- Clique em **Copiar acesso** e mande o usuário/senha para o fornecedor.

---

## Como funciona no dia a dia

1. Você edita a planilha do fornecedor no Google Sheets — quando quiser.
2. O fornecedor entra no portal com o usuário e a senha que você deu.
3. O portal lê a planilha **naquele momento** e monta o dashboard (RESUMO + abas).
4. O contador de acessos sobe a cada login do fornecedor.

O dashboard do topo lê a aba **RESUMO** da planilha. Para os números baterem sempre,
deixe o RESUMO por fórmula (somando as abas de detalhe).

---

## Painel de Compras (visão interna, por setor)

Além do login do fornecedor e do admin, agora existe um terceiro acesso:

- **Usuário:** `compras`
- **Senha:** opcional — configurável em **Área administrativa → card "Painel de Compras"**.
  Se a caixa "Proteger com senha" ficar desmarcada, qualquer um que souber o endereço do
  site entra digitando só `compras`, sem senha nenhuma.

O que ele mostra, pra cada fornecedor cadastrado (com link direto pra planilha no menu):

- **Cartões-resumo:** Trade (valor + plano), Ações (valor + tipo), Rebate (valor + tipo),
  Danificados (qtd + valor) e Vencidos (qtd + valor) — cada um com uma "pilulazinha" de status
  (ex.: "2 vencidos", "em dia").
- **Abas por setor:**
  - **Comercial:** Acordos, Rebaixa, Vencidos, Danificados, Outlet
  - **Trade:** a mesma aba TRADE que o fornecedor já vê
  - **Marketing:** TRADE (só pra acompanhar/transparência) + Eventos (feitos e futuros)

### Importante: essas informações vêm **direto das abas de detalhe**, não da aba RESUMO

Pra não duplicar trabalho de preenchimento, o Painel de Compras **não lê a aba RESUMO** — ele
soma e classifica direto as abas que já existem (TRADE, DANIFICADO, VENCIDOS, REBATE) e as novas
abas abaixo. Isso significa que cada aba precisa ter certas colunas com esses nomes (o resto das
colunas pode ser o que você quiser, elas continuam aparecendo no detalhamento):

| Aba | Colunas que o Painel de Compras procura | Observação |
|---|---|---|
| `TRADE` (já existe) | `Valor`, `Plano`, `Status` | Se já existir, só confira os nomes das colunas |
| `REBATE` (já existe) | `Tipo`, `Valor`, `Status` | |
| `DANIFICADO` (já existe) | `Qtd`, `Valor`, `Status` | |
| `VENCIDOS` (já existe) | `Qtd`, `Valor`, `Status` | |
| `AÇÕES` (nova) | `Tipo`, `Valor`, `Status` | Pode escrever com ou sem acento/maiúscula — o portal reconhece do mesmo jeito |
| `OUTLET` (nova) | `Qtd`, `Valor`, `Status` | |
| `ACORDOS` (nova) | `Valor`, `Status` | |
| `REBAIXA` (nova) | `Valor`, `Status` | |
| `EVENTOS` (nova) | livre (ex.: Evento, Data, Situação) | Não entra nos cartões-resumo, só aparece no detalhamento do setor Marketing |

Toda aba nova segue o mesmo molde das antigas: uma linha de cabeçalho começando em **"Nº"**,
com as colunas que quiser depois. Se uma aba ainda não existir numa planilha de um fornecedor,
o painel simplesmente mostra "sem registros" nela — não quebra nada.

## Domínio próprio (opcional)
Em **Domain management** você aponta algo como `portal.redeloureiro.com.br` para o site.

## Planilhas privadas (opcional, mais seguro)
Hoje o servidor lê a planilha via link "qualquer pessoa com o link". Se quiser manter as
planilhas totalmente privadas, dá para trocar por uma conta de serviço do Google (Service Account)
compartilhada em cada planilha — é um upgrade que pode ser feito depois, sem mudar a experiência.

## Arquivos
```
portal-producao/
  netlify.toml               configuração da Netlify
  package.json               dependências do servidor
  public/index.html          o portal (login, admin, visão do fornecedor)
  netlify/functions/
    _lib.mjs                 núcleo: storage, login assinado, leitura do Sheets, parser
    login.mjs                POST /api/login
    data.mjs                 GET  /api/data   (leitura ao vivo)
    admin.mjs                GET/POST /api/admin (gestão de fornecedores)
```
