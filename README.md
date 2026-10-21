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

Toda a configuração está em `supabase/migrations/20261021_seguranca_acesso.sql`
(rode no SQL Editor; pode ser executada mais de uma vez).

Tabelas:

| Tabela | Uso |
| --- | --- |
| `profiles` | Um por usuário (criado automaticamente no cadastro). `regra` = `usuario` ou `admin`. |
| `solicitacoes_acesso` | Um pedido por login, vinculado à sessão (`session_id`). |
| `pops` | Documentos: `titulo` (`01 - DESCRIÇÃO`), `setor`, `tipo_documento` (`POP`, `FLUXOGRAMA`, `MANUAL`), `storage_path`. |
| `usuarios_pops` | Legado, não usado pelo front (só admin acessa). |

Bucket `pops`: **privado**, só PDF, até 20 MB. O front gera links assinados
de 5 minutos para visualizar/baixar.

### Como o acesso é garantido

A regra fica no banco (RLS), não só na tela:

- Visitante sem login não lê nem grava nada.
- Usuário comum só lê documentos/PDFs se tiver uma solicitação **APROVADA
  para a sessão de login atual** e essa sessão ainda estiver aberta.
  Novo login = nova aprovação. Logout ou "Revogar acesso" cortam na hora.
- Só admin publica e exclui documentos e PDFs.
- Ninguém altera `profiles` pelo app (não dá para se promover a admin).
  Para tornar alguém admin:
  `update public.profiles set regra = 'admin' where email = '...';`

### Funções (RPC) usadas pelo front

| Função | Quem | O que faz |
| --- | --- | --- |
| `status_acesso()` | todos | Status do login atual (`ADMIN`, `APROVADO`, `PENDENTE`, `NEGADO`, `CANCELADO` ou nulo) |
| `solicitar_acesso()` | usuário | Cria/reaproveita o pedido desta sessão |
| `cancelar_minha_solicitacao()` | usuário | Cancela o pedido pendente |
| `contar_pendentes()` | admin | Número de pedidos pendentes |
| `decidir_solicitacao(id, status)` | admin | Aprova ou nega |
| `listar_usuarios_admin()` | admin | Usuários com situação de acesso |
| `revogar_acesso_usuario(user_id)` | admin | Corta o acesso do usuário |

### Economia de chamadas (plano free)

- Verificações periódicas só rodam com a aba visível
  (espera de aprovação: 5 s; selo de pendentes no admin: 10 s) e retornam
  um único valor.
- A lista de solicitações só recarrega quando a contagem muda.
- Perfil e status são carregados uma vez por login (não a cada troca de
  página ou renovação de token).
- Download vai direto do Storage, sem passar pela memória do navegador.
- Limpeza diária (`pg_cron`, 03:00): cancela pedidos de sessões encerradas
  e apaga pedidos finalizados com mais de 90 dias.

## Rotas

- `/login`, `/cadastro` — públicas
- `/` e `/pops` — exigem acesso aprovado
- `/admin` — exige `profiles.regra = 'admin'`
