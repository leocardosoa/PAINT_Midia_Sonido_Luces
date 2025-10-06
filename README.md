# Escala — Equipes & Tarefas (PT/ES/EN)

App React (Vite) para controle de escala com múltiplas **equipes** e **tarefas**, dias selecionáveis (Domingo fixo), validação para impedir a mesma pessoa no mesmo dia em equipes/tarefas diferentes, i18n PT/ES/EN, logo configurável, salvar local, exportar/importar JSON.

## Rodar localmente
```bash
npm install
npm run dev
```

## Build e publicar
```bash
npm run build
# dist/ contém os arquivos estáticos para publicar em Netlify/Vercel/GitHub Pages
```

## Observações
- Não há backend; tudo persiste no localStorage do navegador.
- Para bloquear edições em um site público, avalie criar uma flag de "modo leitura" com query-string (?readonly=1).
