-- =====================================================================
-- PORTAL DE PROCESSOS — SUBSTITUIR O PDF DE UM DOCUMENTO
-- Projeto Supabase: "Gestão de Processos"
-- Requer as migrações anteriores.
--
-- Permite ao admin trocar o arquivo de um documento já publicado
-- (botão "Substituir PDF" em Gerenciar documentos). Só as colunas do
-- arquivo e da data de publicação podem ser alteradas.
--
-- Idempotente. Compatível com o site já publicado.
-- =====================================================================

grant update (storage_path, criado_em) on public.pops to authenticated;

drop policy if exists pops_update_admin on public.pops;
create policy pops_update_admin on public.pops
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
