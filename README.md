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
4. `20261021d_excluir_usuario.sql` — excluir usuário pelo painel
5. `20261021e_negar_pedido.sql` — negar pedido pela aba Usuários
6. `20261021f_setores.sql` — cadastro de setores
7. `20261021g_setor_desativado_oculta.sql` — setor desativado oculta seus documentos
8. `20261022_substituir_pdf.sql` — admin pode substituir o PDF de um documento
9. `20261029_renomear_processo.sql` — admin pode editar o nome (descrição) de um processo
10. `20261029b_registros.sql` — aba Registros (temas, registros, setores, arquivos e bucket `registros`)
11. `20261029c_setores_vinculos.sql` — setores mostram e bloqueiam exclusão por documentos e registros

Tabelas:

| Tabela | Uso |
| --- | --- |
| `profiles` | Um por usuário (criado automaticamente no cadastro). `regra` = `usuario` ou `admin`; `acesso_liberado`, `bloqueado`. |
| `solicitacoes_acesso` | Pedidos de acesso (histórico). No máximo um pendente por usuário. |
| `pops` | Documentos: `titulo` (`01 - DESCRIÇÃO`), `setor`, `tipo_documento` (`POP`, `FLUXOGRAMA`, `MANUAL`), `storage_path`. |
| `setores` | Setores (nome único, ativo). Gerenciados em Administração > Setores. Setor desativado: documentos ocultos no Início/Repositório (só admin vê, em Gerenciar documentos). |
| `temas_registro` | Temas dos registros (Reunião, Treinamento, Diagnóstico...). Cadastráveis em Administração > Registros > Temas. |
| `registros` | Registros de reuniões: tema, data, pauta e participantes (opcionais). Só admin. |
| `registros_setores` | Setores de cada registro (um ou mais). |
| `registros_arquivos` | Arquivos de cada registro (bucket privado `registros`, até 50 MB, PDF/Office/TXT/fotos). |
| `convites` | Links de convite (uso único, com validade). Sem acesso direto: só via funções. |
| `usuarios_pops` | Legado, não usado pelo front (só admin acessa). |

Bucket `pops`: **privado**, só PDF, até 20 MB. O front gera links assinados
de 5 minutos para visualizar/baixar.

### Como o acesso é garantido

A regra fica no banco (RLS), não só na tela:

- Visitante sem login não lê nem grava nada.
- **Aprovação única:** o usuário comum pede acesso no primeiro login; o pedido
  aparece no topo da aba Usuários (com contador na aba) para "Aprovar" ou
  "Negar". Aprovado (ou "Liberar"), ele entra em qualquer login/dispositivo
  sem nova aprovação.
- "Revogar" tira o acesso na hora (o usuário pode pedir de novo).
  "Excluir" apaga a conta (perfil e pedidos saem junto); se a pessoa se
  cadastrar de novo, precisa de nova aprovação. Administradores não podem
  ser excluídos pelo painel.
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
| `definir_acesso_usuario(user_id, acao)` | admin | `LIBERAR`, `NEGAR`, `REVOGAR`, `BLOQUEAR`, `DESBLOQUEAR` |
| `criar_setor(nome)` / `renomear_setor(id, nome)` | admin | Adiciona / renomeia (renomear atualiza os documentos) |
| `definir_setor_ativo(id, ativo)` / `excluir_setor(id)` | admin | Desativa/reativa; exclui só setor sem documentos |
| `listar_setores_admin()` | admin | Setores com contagem de processos, documentos e registros |
| `renomear_processo(ids, numero, descricao)` | admin | Troca a descrição do processo em todos os documentos da linha |
| `salvar_registro(id, tema_id, data, pauta, participantes, setor_ids)` | admin | Cria/edita um registro e seus setores de uma vez |
| `excluir_usuario(user_id)` | admin | Apaga a conta (não vale para admin nem para si mesmo) |
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

## Versão do portal

A versão aparece no rodapé de todas as páginas (ex.: **Versão 1.0.00**) e vem
do campo `version` do `package.json` (`1.0.0` é exibido como `1.0.00`).

Antes de publicar uma atualização, suba a versão:

```bash
npm run versao   # 1.0.00 -> 1.0.01 -> 1.0.02 ...
```

Para uma mudança grande, edite o `package.json` à mão (ex.: `1.1.0` → `1.1.00`).

O aviso "Nova versão disponível" não depende desse número: ele compara o
commit publicado (`version.json`), então avisa mesmo se a versão não for subida.

## Mensagens e confirmações

O site não usa `alert`/`confirm` do navegador. Use o hook `useFeedback()`:

```js
const { notificar, confirmar } = useFeedback();
notificar('sucesso' | 'erro' | 'aviso' | 'info', 'Texto');
if (await confirmar({ titulo, mensagem, detalhe, textoConfirmar, perigo: true })) { ... }
```

## Rotas

- `/login`, `/cadastro` — públicas
- `/` (Início: panorama e documentos recentes por tipo, só visual) e `/pops` (Repositório em formato explorador por setor; aceita `?setor=`, `?busca=` e `?tipo=`) — exigem acesso liberado
- `/admin/documentos`, `/admin/setores`, `/admin/registros` e `/admin/usuarios` — exigem `profiles.regra = 'admin'` (`/admin` redireciona)

## Visual

- Cores da marca (marinho `#04154A`, verde `#25A55C`) e uma cor fixa por tipo de
  documento: POP marinho, Fluxograma verde, Manual azul-aço. Tokens em
  `src/styles/global.css`.
- Fonte: Archivo (Google Fonts), com a largura variável marcando a hierarquia.
