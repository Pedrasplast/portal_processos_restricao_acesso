import { supabase } from '../lib/supabase';
import { analisarTituloDocumento, normalizarTipoDocumento } from '../utils/documentos';
import { sanitizarNomeArquivo } from '../utils/arquivos';
import { normalizarTexto } from '../utils/texto';

const BUCKET = 'pops';

export async function listarDocumentos({ admin = false } = {}) {
  const campos = admin
    ? 'id, titulo, setor, tipo_documento, arquivo_url, storage_path'
    : 'id, titulo, setor, tipo_documento, arquivo_url';

  const { data, error } = await supabase
    .from('pops')
    .select(campos)
    .order('titulo', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function validarDuplicidade({ setor, tipoDocumento, codigo }) {
  const { data, error } = await supabase
    .from('pops')
    .select('id, titulo, tipo_documento')
    .eq('setor', setor);

  if (error) throw error;

  const numero = Number(codigo);
  const duplicado = (data || []).some((documento) => {
    const titulo = analisarTituloDocumento(documento.titulo);
    if (!titulo) return false;

    const tipo = normalizarTipoDocumento(documento.tipo_documento) || titulo.tipo;
    return titulo.numero === numero && tipo === tipoDocumento;
  });

  if (duplicado) {
    throw new Error(`${tipoDocumento}-${codigo} já está cadastrado no setor ${setor}.`);
  }
}

export async function publicarDocumento({
  setor,
  tipoDocumento,
  codigo,
  descricao,
  arquivo,
}) {
  await validarDuplicidade({ setor, tipoDocumento, codigo });

  const ehPdf =
    arquivo?.type === 'application/pdf' || arquivo?.name?.toLowerCase().endsWith('.pdf');

  if (!ehPdf) throw new Error('O arquivo selecionado deve estar em PDF.');

  const titulo = `${tipoDocumento}-${codigo} | ${normalizarTexto(descricao)}`;
  const identificador =
    globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const caminho = `pdfs/${setor}/${codigo}/${tipoDocumento}/${identificador}-${sanitizarNomeArquivo(
    arquivo.name,
  )}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(caminho, arquivo, {
    contentType: 'application/pdf',
    upsert: false,
  });

  if (uploadError) throw uploadError;

  try {
    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(caminho);

    const { error: insertError } = await supabase.from('pops').insert([
      {
        titulo,
        arquivo_url: publicUrl,
        storage_path: caminho,
        setor,
        tipo_documento: tipoDocumento,
      },
    ]);

    if (insertError) throw insertError;
    return titulo;
  } catch (error) {
    await supabase.storage.from(BUCKET).remove([caminho]);
    throw error;
  }
}

export async function excluirDocumento(documento) {
  if (documento.storage_path) {
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([documento.storage_path]);

    if (storageError) throw storageError;
  }

  const { error } = await supabase.from('pops').delete().eq('id', documento.id);
  if (error) throw error;
}
