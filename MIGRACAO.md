# Migração para a versão refatorada

1. Faça backup do projeto atual.
2. Copie o conteúdo desta pasta para uma nova branch.
3. Crie `.env` a partir de `.env.example`.
4. Execute `supabase/solicitacoes_acesso.sql`.
5. Confirme que a tabela `profiles` possui os administradores com `regra = admin`.
6. Confirme que `usuarios_pops` possui nome, email e descricao (descricao pode ser nula).
7. Confirme que o bucket `pops` e as políticas RLS existentes permitem as operações necessárias.
8. Rode `npm install`, `npm run dev` e depois `npm run build`.

## Rotas mantidas

- `/` — Home, protegida por aprovação do acesso.
- `/pops` — Repositório, protegido por aprovação do acesso.
- `/login` — Login.
- `/admin` — Painel administrativo.
- `/admin/pops` — redireciona para `/admin` para manter compatibilidade.

## Importante

Usuários comuns precisam existir em `usuarios_pops` e recebem uma nova solicitação a cada login. Administradores (`profiles.regra = admin`) entram diretamente no painel sem solicitar aprovação.
