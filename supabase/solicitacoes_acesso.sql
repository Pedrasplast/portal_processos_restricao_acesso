-- =====================================================
-- SOLICITAÇÕES DE ACESSO
-- =====================================================

create table if not exists public.solicitacoes_acesso (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  status text not null default 'PENDENTE'
    check (status in ('PENDENTE', 'APROVADO', 'NEGADO', 'CANCELADO')),
  criado_em timestamptz not null default now(),
  aprovado_em timestamptz
);

create index if not exists idx_solicitacoes_acesso_user_id
  on public.solicitacoes_acesso(user_id);

create index if not exists idx_solicitacoes_acesso_status
  on public.solicitacoes_acesso(status);

alter table public.solicitacoes_acesso enable row level security;

-- Usuário autenticado enxerga apenas as próprias solicitações.
drop policy if exists "usuario le proprias solicitacoes" on public.solicitacoes_acesso;
create policy "usuario le proprias solicitacoes"
on public.solicitacoes_acesso
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.regra = 'admin'
  )
);

-- Usuário autenticado cria somente solicitação para si próprio e pendente.
drop policy if exists "usuario cria propria solicitacao" on public.solicitacoes_acesso;
create policy "usuario cria propria solicitacao"
on public.solicitacoes_acesso
for insert
to authenticated
with check (
  user_id = auth.uid()
  and status = 'PENDENTE'
);

-- Usuário pode cancelar a própria solicitação pendente.
-- Administrador pode aprovar/recusar qualquer solicitação.
drop policy if exists "usuario cancela ou admin decide" on public.solicitacoes_acesso;
create policy "usuario cancela ou admin decide"
on public.solicitacoes_acesso
for update
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.regra = 'admin'
  )
)
with check (
  (
    user_id = auth.uid()
    and status = 'CANCELADO'
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.regra = 'admin'
  )
);

-- Recomendação para usuarios_pops:
-- crie uma política que permita ao usuário autenticado consultar apenas
-- o próprio e-mail e ao administrador gerenciar todos os registros.
