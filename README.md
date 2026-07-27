# Portal de Processos — versão refatorada

Refatoração do projeto React/Vite/Supabase do Portal de Processos.

## O que mudou

- `GerenciarPops.jsx` foi dividido em componentes menores.
- Acesso ao Supabase foi centralizado em `services/`.
- Regras de documento/código foram centralizadas em `utils/documentos.js`.
- Sessão e perfil foram centralizados em `AuthContext`.
- Existem duas proteções de rota:
  - usuário comum: precisa de aprovação do administrador a cada login;
  - administrador: precisa possuir `profiles.regra = 'admin'`.
- O painel administrativo possui:
  - documentos;
  - usuários autorizados;
  - solicitações de acesso.
- A listagem pública autenticada mantém POP, Fluxograma e Mapa Visual agrupados por setor + número.

## Instalação

```bash
npm install
cp .env.example .env
npm run dev
```

Preencha `.env` com as variáveis do Supabase.

## Banco de dados

Execute `supabase/solicitacoes_acesso.sql` no SQL Editor do Supabase.

As tabelas já usadas pelo projeto são:

- `pops`
- `profiles`
- `usuarios_pops`
- `solicitacoes_acesso`

O bucket `pops` deve continuar configurado conforme o projeto atual.

## Fluxo de acesso

1. Usuário informa e-mail e senha.
2. Se `profiles.regra = 'admin'`, entra direto no painel administrativo.
3. Usuário comum precisa existir em `usuarios_pops`.
4. Uma solicitação `PENDENTE` é criada em `solicitacoes_acesso`.
5. O administrador aprova ou nega no painel.
6. Quando aprovada, a sessão atual recebe acesso à Home e ao Repositório.
7. Em um novo login, uma nova aprovação é solicitada.

## Observação de segurança

A proteção de rota do React melhora o fluxo da interface, mas a segurança dos dados também deve ser garantida com RLS no Supabase. O arquivo SQL inclui políticas para `solicitacoes_acesso`; revise as políticas das tabelas existentes (`pops`, `profiles`, `usuarios_pops`) de acordo com seu ambiente.
