# Escala — Supabase agrupado por equipe

## 1️⃣ Criar tabela no Supabase
```sql
create table if not exists public.state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamp with time zone default now()
);
alter table public.state enable row level security;
create policy "anon read" on public.state for select using (true);
create policy "anon insert" on public.state for insert with check (true);
create policy "anon update" on public.state for update using (true);
```

Ative **Realtime**: em `Database → Replication → Publications`, adicione `public.state`.

## 2️⃣ Configurar `.env.local`
Na raiz do projeto:
```
VITE_SUPABASE_URL=https://SEU-PROJ.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon
VITE_SPACE_ID=pic-demo
```
> ⚠️ O arquivo deve se chamar `.env.local` (não `local.env`).

## 3️⃣ Rodar localmente
```bash
npm install
npm run dev
```

Se aparecer "Sem Supabase" no topo, verifique:
- URL e chave corretas.
- `.env.local` salvo e servidor reiniciado.
- Variáveis também configuradas no Netlify/Vercel em caso de deploy.
