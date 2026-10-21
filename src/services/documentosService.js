import { supabase } from '../lib/supabase';
import {
  analisarTituloDocumento,
  formatarCodigo,
  formatarTituloProcesso,
  normalizarDescricaoDocumento,
  normalizarDocumentos,
  normalizarTipoDocumento,
} from '../utils/documentos';
import { sanitizarNomeArquivo } from '../utils/arquivos';
import { normalizarChave } from '../utils/texto';

const BUCKET = 'pops';

const ORDEM_TIPOS = {
  POP: 1,
  FLUXOGRAMA: 2,
  'MANUAL': 3,
};

export async function listarDocumentos({
  admin = false,
} = {}) {
  const campos = admin
    ? 'id, titulo, setor, tipo_documento, arquivo_url, storage_path'
    : 'id, titulo, setor, tipo_documento, arquivo_url';

  const { data, error } = await supabase
    .from('pops')
    .select(campos)
    .order('setor', { ascending: true })
    .order('titulo', { ascending: true });

  if (error) throw error;

  return data || [];
}

function escolherDescricaoCanonica(documentos = []) {
  const ordenados = [...documentos].sort(
    (a, b) =>
      (ORDEM_TIPOS[a.tipo] || 99) -
      (ORDEM_TIPOS[b.tipo] || 99),
  );

  return ordenados[0]?.descricao || '';
}

async function prepararPublicacao({
  setor,
  tipoDocumento,
  codigo,
  descricao,
}) {
  const setorNormalizado = String(setor || '').trim();
  const tipoNormalizado =
    normalizarTipoDocumento(tipoDocumento);
  const numero = Number(codigo);
  const descricaoInformada =
    normalizarDescricaoDocumento(descricao);

  if (!setorNormalizado) {
    throw new Error('Selecione o setor.');
  }

  if (!tipoNormalizado) {
    throw new Error('Selecione o tipo do documento.');
  }

  if (
    !Number.isInteger(numero) ||
    numero <= 0
  ) {
    throw new Error('Número do documento inválido.');
  }

  const { data, error } = await supabase
    .from('pops')
    .select(
      'id, titulo, setor, tipo_documento, arquivo_url, storage_path',
    )
    .eq('setor', setorNormalizado);

  if (error) throw error;

  const documentosDoSetor = normalizarDocumentos(
    data || [],
  ).filter(
    (documento) =>
      normalizarChave(documento.setor) ===
      normalizarChave(setorNormalizado),
  );

  const documentosDoNumero = documentosDoSetor.filter(
    (documento) => documento.numero === numero,
  );

  const duplicado = documentosDoNumero.some(
    (documento) =>
      documento.tipo === tipoNormalizado,
  );

  if (duplicado) {
    throw new Error(
      `${tipoNormalizado} já está cadastrado na linha ${formatarCodigo(
        numero,
      )} do setor ${setorNormalizado}.`,
    );
  }

  if (documentosDoNumero.length > 0) {
    const descricaoExistente =
      escolherDescricaoCanonica(documentosDoNumero);

    return {
      setor: setorNormalizado,
      tipoDocumento: tipoNormalizado,
      numero,
      codigo: formatarCodigo(numero),
      descricao: descricaoExistente,
      titulo: formatarTituloProcesso(
        numero,
        descricaoExistente,
      ),
      novaLinha: false,
    };
  }

  if (descricaoInformada.length < 3) {
    throw new Error(
      'Informe uma descrição com pelo menos 3 caracteres.',
    );
  }

  const maiorNumero = documentosDoSetor.length
    ? Math.max(
        ...documentosDoSetor.map(
          (documento) => documento.numero,
        ),
      )
    : 0;

  const proximoNumero = maiorNumero + 1;

  if (numero !== proximoNumero) {
    throw new Error(
      `A próxima numeração disponível para ${setorNormalizado} é ${formatarCodigo(
        proximoNumero,
      )}. Atualize a página e tente novamente.`,
    );
  }

  return {
    setor: setorNormalizado,
    tipoDocumento: tipoNormalizado,
    numero,
    codigo: formatarCodigo(numero),
    descricao: descricaoInformada,
    titulo: formatarTituloProcesso(
      numero,
      descricaoInformada,
    ),
    novaLinha: true,
  };
}

export async function publicarDocumento({
  setor,
  tipoDocumento,
  codigo,
  descricao,
  arquivo,
}) {
  const ehPdf =
    arquivo?.type === 'application/pdf' ||
    arquivo?.name?.toLowerCase().endsWith('.pdf');

  if (!ehPdf) {
    throw new Error(
      'O arquivo selecionado deve estar em PDF.',
    );
  }

  const publicacao = await prepararPublicacao({
    setor,
    tipoDocumento,
    codigo,
    descricao,
  });

  const identificador =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`;

  const caminho = [
    'pdfs',
    publicacao.setor,
    publicacao.codigo,
    publicacao.tipoDocumento,
    `${identificador}-${sanitizarNomeArquivo(
      arquivo.name,
    )}`,
  ].join('/');

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, arquivo, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  try {
    const {
      data: { publicUrl },
    } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(caminho);

    const { error: insertError } = await supabase
      .from('pops')
      .insert([
        {
          titulo: publicacao.titulo,
          arquivo_url: publicUrl,
          storage_path: caminho,
          setor: publicacao.setor,
          tipo_documento:
            publicacao.tipoDocumento,
        },
      ]);

    if (insertError) throw insertError;

    return publicacao;
  } catch (error) {
    await supabase.storage
      .from(BUCKET)
      .remove([caminho]);

    throw error;
  }
}

export async function excluirDocumento(documento) {
  if (documento.storage_path) {
    const { error: storageError } =
      await supabase.storage
        .from(BUCKET)
        .remove([documento.storage_path]);

    if (storageError) throw storageError;
  }

  const { error } = await supabase
    .from('pops')
    .delete()
    .eq('id', documento.id);

  if (error) throw error;
}

/*
 * Exportado somente para facilitar testes e futuras migrações.
 */
export function interpretarDocumentoBanco(documento) {
  return analisarTituloDocumento(
    documento?.titulo,
    documento?.tipo_documento,
  );
}
