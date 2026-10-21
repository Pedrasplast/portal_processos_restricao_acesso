import { supabase } from '../lib/supabase';
import {
  analisarTituloDocumento,
  formatarCodigo,
  formatarTituloProcesso,
  normalizarDescricaoDocumento,
  normalizarDocumentos,
  normalizarTipoDocumento,
} from '../utils/documentos';
import { normalizarChave, sanitizarNomeArquivo } from '../utils/texto';

const BUCKET = 'pops';

const ORDEM_TIPOS = {
  POP: 1,
  FLUXOGRAMA: 2,
  'MANUAL': 3,
};

/*
 * O bucket "pops" é privado. O front recebe só o storage_path e gera um
 * link assinado (temporário) na hora de visualizar/baixar. O banco
 * (RLS) só devolve linhas para quem tem acesso aprovado na sessão.
 */
const VALIDADE_LINK_SEGUNDOS = 300;

export async function listarDocumentos() {
  const { data, error } = await supabase
    .from('pops')
    .select('id, titulo, setor, tipo_documento, storage_path, criado_em')
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
    .select('id, titulo, setor, tipo_documento')
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
    const { error: insertError } = await supabase
      .from('pops')
      .insert([
        {
          titulo: publicacao.titulo,
          storage_path: caminho,
          setor: publicacao.setor,
          tipo_documento: publicacao.tipoDocumento,
        },
      ]);

    if (insertError) {
      if (insertError.code === '23505') {
        throw new Error(
          `${publicacao.tipoDocumento} já está cadastrado na linha ${publicacao.codigo} do setor ${publicacao.setor}. Atualize a página.`,
        );
      }
      throw insertError;
    }

    return publicacao;
  } catch (error) {
    await supabase.storage.from(BUCKET).remove([caminho]);
    throw error;
  }
}

/*
 * Remove primeiro a linha do banco (o que o usuário vê) e depois o PDF.
 * Se a remoção do arquivo falhar, sobra só um arquivo órfão, nunca uma
 * linha apontando para um PDF inexistente.
 */
export async function excluirDocumento(documento) {
  const { error } = await supabase
    .from('pops')
    .delete()
    .eq('id', documento.id);

  if (error) throw error;

  if (documento.storage_path) {
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([documento.storage_path]);

    if (storageError) {
      console.warn('Documento removido, mas o PDF não foi apagado:', storageError);
    }
  }
}

/*
 * Gera um link temporário para o PDF. Com `nomeDownload`, o navegador
 * baixa o arquivo com esse nome em vez de abri-lo.
 */
export async function gerarLinkDocumento(storagePath, { nomeDownload } = {}) {
  if (!storagePath) throw new Error('Documento sem arquivo vinculado.');

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(
      storagePath,
      VALIDADE_LINK_SEGUNDOS,
      nomeDownload ? { download: nomeDownload } : undefined,
    );

  if (error) throw error;
  return data.signedUrl;
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
