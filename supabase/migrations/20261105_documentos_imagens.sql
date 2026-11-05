-- =====================================================================
-- PORTAL DE PROCESSOS — DOCUMENTOS ACEITAM IMAGENS
-- Projeto Supabase: "Gestão de Processos"
--
-- O bucket "pops" (POP, Fluxograma, Manual) passa a aceitar, além de PDF,
-- imagens JPG, PNG e WEBP. Continua privado e com limite de 20 MB.
-- As regras de acesso (quem lê / quem envia) não mudam.
--
-- Idempotente. Compatível com o site já publicado.
-- =====================================================================

update storage.buckets
   set allowed_mime_types = array[
         'application/pdf',
         'image/jpeg',
         'image/png',
         'image/webp'
       ],
       file_size_limit = 20 * 1024 * 1024,
       public = false
 where id = 'pops';

-- Conferência: deve listar os 4 tipos.
select id, public, file_size_limit / 1024 / 1024 as limite_mb, allowed_mime_types
  from storage.buckets
 where id = 'pops';
