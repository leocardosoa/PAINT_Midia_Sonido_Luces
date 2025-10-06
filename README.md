# Escala — Equipes (Supabase, modo Datas apenas)

Requisitos implementados:
- Selecionar **equipes por membro** (multi-select no painel de Membros).
- **Sem** modo semanal — somente **Datas específicas**.
- Tabela de escala mostra coluna **Dia da semana**.
- Botão para **Selecionar todos os domingos do mês atual**.
- **Supabase** para persistência compartilhada (tabela `state` com `{ id, payload }`).
- **XLSX export** (aba `Datas`).

## Setup Supabase (SQL)
No SQL Editor do seu projeto:
```sql
create table if not exists public.state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamp with time zone default now()
);

alter table public.state enable row level security;

-- Políticas abertas para protótipo (restrinja em prod):
create policy "anon can read" on public.state for select using (true);
create policy "anon can insert" on public.state for insert with check (true);
create policy "anon can update" on public.state for update using (true);
```

## Variáveis (.env.local)
```
VITE_SUPABASE_URL=SEU_URL
VITE_SUPABASE_ANON_KEY=SUA_ANON_KEY
VITE_SPACE_ID=pic-demo
```

## Rodar / Publicar
```bash
npm install
npm run dev

# Build (Netlify/Vercel/GH Pages)
npm run build
# Publicar a pasta dist/
```
