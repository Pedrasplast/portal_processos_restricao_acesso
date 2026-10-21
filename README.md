# Portal de Processos — Pedrasplast

Repositório interno de POPs, Fluxogramas e Manuais por setor.
React + Vite, Supabase (Auth, Postgres, Storage), publicado na Vercel.

## Instalação

```bash
npm install
cp .env.example .env   # preencha a chave anon/publishable do Supabase
npm run dev
```

## Banco de dados (Supabase "Gestão de Processos")

A configuração está em `supabase/migrations/`, para rodar no SQL Editor nesta ordem
(cada arquivo pode ser executado mais de uma vez):

1. `20261021_seguranca_acesso.sql` — RLS, bucket privado, RPCs
2. `20261021b_aprovacao_unica.sql` — aprovação única + bloqueio
3. `20261021c_convites.sql` — convites por link

Tabelas:

| Tabela | Uso |
| --- | --- |
| `profiles` | Um por usuário (criado automaticamente no cadastro). `regra` = `usuario` ou `admin`; `acesso_liberado`, `bloqueado`. |
| `solicitacoes_acesso` | Pedidos de acesso (histórico). No máximo um pendente por usuário. |
| `pops` | Documentos: `titulo` (`01 - DESCRIÇÃO`), `setor`, `tipo_documento` (`POP`, `FLUXOGRAMA`, `MANUAL`), `storage_path`. |
| `convites` | Links de convite (uso único, com validade). Sem acesso direto: só via funções. |
| `usuarios_pops` | Legado, não usado pelo front (só admin acessa). |

Bucket `pops`: **privado**, só PDF, até 20 MB. O front gera links assinados
de 5 minutos para visualizar/baixar.

### Como o acesso é garantido

A regra fica no banco (RLS), não só na tela:

- Visitante sem login não lê nem grava nada.
- **Aprovação única:** o usuário comum pede acesso no primeiro login; quando
  o admin aprova (ou clica em "Liberar" na aba Usuários), ele passa a entrar
  em qualquer login/dispositivo sem nova aprovação.
- "Revogar" tira o acesso na hora (o usuário pode pedir de novo).
  "Bloquear" tira o acesso e impede novos pedidos até "Desbloquear".
- **Convites:** na aba Usuários, "Gerar link de convite" cria um link
  `/cadastro?convite=...` de uso único (1, 7 ou 30 dias, opcionalmente
  preso a um e-mail). Quem se cadastra por ele já entra liberado.
- Só admin publica e exclui documentos e PDFs.
- Ninguém altera `profiles` pelo app (não dá para se promover a admin).
  Para tornar alguém admin:
  `update public.profiles set regra = 'admin' where email = '...';`

### Funções (RPC) usadas pelo front

| Função | Quem | O que faz |
| --- | --- | --- |
| `status_acesso()` | todos | `ADMIN`, `APROVADO`, `BLOQUEADO`, `PENDENTE`, `NEGADO`, `CANCELADO` ou nulo |
| `solicitar_acesso()` | usuário | Cria/reaproveita o pedido (ou responde `APROVADO`/`BLOQUEADO`) |
| `cancelar_minha_solicitacao()` | usuário | Cancela o pedido pendente |
| `contar_pendentes()` | admin | Número de pedidos pendentes |
| `decidir_solicitacao(id, status)` | admin | Aprova (libera o usuário) ou nega o pedido |
| `listar_usuarios_admin()` | admin | Usuários com situação de acesso |
| `definir_acesso_usuario(user_id, acao)` | admin | `LIBERAR`, `REVOGAR`, `BLOQUEAR`, `DESBLOQUEAR` |
| `criar_convite(email, dias)` | admin | Gera um link de convite |
| `listar_convites()` / `cancelar_convite(id)` | admin | Lista / cancela convites |
| `validar_convite(token)` | público | Diz se o link é válido (tela de cadastro) |

### Economia de chamadas (plano free)

- Verificações periódicas só rodam com a aba visível
  (espera de aprovação: 5 s; selo de pendentes no admin: 10 s) e retornam
  um único valor.
- A lista de solicitações só recarrega quando a contagem muda.
- Perfil e status são carregados uma vez por login (não a cada troca de
  página ou renovação de token).
- Download vai direto do Storage, sem passar pela memória do navegador.
- Limpeza diária (`pg_cron`, 03:00): apaga pedidos finalizados com mais de 90 dias.

## Rotas

- `/login`, `/cadastro` — públicas
- `/` e `/pops` — exigem acesso liberado
- `/admin` — exige `profiles.regra = 'admin'`
