# Escala — Equipes (Supabase, PT/ES/EN)

Persistência **compartilhada** via Supabase, i18n, modo Semanal & Datas, roster por equipe, XLSX export.

## 1) Criar tabela no Supabase (SQL)
No Supabase (projeto > SQL Editor), execute:
```sql
create table if not exists public.state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamp with time zone default now()
);

alter table public.state enable row level security;

-- POLÍTICAS (DEMO: abertas; para produção, restrinja!)
create policy "anon can read" on public.state
  for select using (true);

create policy "anon can insert" on public.state
  for insert with check (true);

create policy "anon can update" on public.state
  for update using (true);
```

> ⚠️ **Segurança**: As políticas acima permitem leitura/escrita anônimas (úteis para protótipo). Para produção, use autenticação (Auth) e políticas mais restritivas.

## 2) Variáveis de ambiente
Crie `.env.local` na raiz do projeto:
```
VITE_SUPABASE_URL=SEU_URL
VITE_SUPABASE_ANON_KEY=SUA_ANON_KEY
VITE_SPACE_ID=pic-demo
```

## 3) Rodar e publicar
```bash
npm install
npm run dev

# Build para Netlify/Vercel/GH Pages
npm run build
# Publicar a pasta dist/
```

## 4) Como compartilhar
Use o campo **Space** (ex.: `pic-panama`). Todos que acessarem o site com `?space=pic-panama`
carregarão/guardarão no mesmo registro da tabela `state`.
