import { supabase } from '../lib/supabase';
import { tipoDoArquivo, validarArquivo } from '../utils/registros';
import { sanitizarNomeArquivo } from '../utils/texto';

/*
 * Registros de reuniões (somente admin).
 *
 *  - Registro + setores são gravados juntos pela função salvar_registro.
 *  - Arquivos ficam no bucket privado "registros"; a tabela
 *    registros_arquivos guarda nome, tipo e caminho de cada um.
 *  - Para abrir/baixar, o front gera um link assinado de 5 minutos.
 */

const BUCKET = 'registros';
const VALIDADE_LINK_SEGUNDOS = 300;

const CONSULTA = `
  id, data, pauta, participantes, criado_em, atualizado_em,
  tema:temas_registro ( id, nome, ativo ),
  setores:registros_setores ( setor:setores ( id, nome, ativo ) ),
  arquivos:registros_arquivos ( id, nome, tipo, tamanho, storage_path, criado_em )
`;

/* Deixa o formato vindo do banco mais simples de usar na tela. */
function montarRegistro(linha) {
  return {
    ...linha,
    setores: (linha.setores || [])
      .map((item) => item.setor)
      .filter(Boolean)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    arquivos: [...(linha.arquivos || [])].sort((a, b) => a.criado_em.localeCompare(b.criado_em)),
  };
}

export async function listarRegistros() {
  const { data, error } = await supabase
    .from('registros')
    .select(CONSULTA)
    .order('data', { ascending: false })
    .order('criado_em', { ascending: false });

  if (error) throw error;
  return (data || []).map(montarRegistro);
}

/** Cria (sem id) ou atualiza (com id). Retorna o id do registro. */
export async function salvarRegistro({ id = null, temaId, data, pauta, participantes, setorIds }) {
  const { data: registroId, error } = await supabase.rpc('salvar_registro', {
    p_id: id,
    p_tema_id: temaId,
    p_data: data,
    p_pauta: pauta,
    p_participantes: participantes,
    p_setor_ids: setorIds,
  });

  if (error) throw error;
  return registroId;
}

function montarCaminho(registroId, nomeArquivo) {
  const identificador =
    globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `registros/${registroId}/${identificador}-${sanitizarNomeArquivo(nomeArquivo)}`;
}

async function enviarArquivo(registroId, arquivo) {
  const erroValidacao = validarArquivo(arquivo);
  if (erroValidacao) throw new Error(erroValidacao);

  const { mime } = tipoDoArquivo(arquivo.name);
  const caminho = montarCaminho(registroId, arquivo.name);

  const { error: erroUpload } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, arquivo, { contentType: mime, upsert: false });

  if (erroUpload) throw erroUpload;

  const { error: erroInsert } = await supabase.from('registros_arquivos').insert({
    registro_id: registroId,
    storage_path: caminho,
    nome: arquivo.name.slice(0, 255),
    tipo: mime,
    tamanho: arquivo.size,
  });

  if (erroInsert) {
    await supabase.storage.from(BUCKET).remove([caminho]);
    throw erroInsert;
  }
}

/*
 * Envia os arquivos um por vez (mais leve no plano free).
 * Não para no primeiro erro: retorna quais falharam.
 */
export async function enviarArquivos(registroId, arquivos = []) {
  const falhas = [];

  for (const arquivo of arquivos) {
    try {
      await enviarArquivo(registroId, arquivo);
    } catch (error) {
      console.error('Erro ao enviar arquivo do registro:', error);
      falhas.push({ nome: arquivo.name, erro: error.message || 'Falha no envio.' });
    }
  }

  return { enviados: arquivos.length - falhas.length, falhas };
}

/* Remove primeiro a linha (o que aparece na tela) e depois o arquivo. */
export async function excluirArquivo(arquivo) {
  const { error } = await supabase.from('registros_arquivos').delete().eq('id', arquivo.id);
  if (error) throw error;

  const { error: erroStorage } = await supabase.storage.from(BUCKET).remove([arquivo.storage_path]);
  if (erroStorage) console.warn('Arquivo removido do registro, mas não do Storage:', erroStorage);
}

/* Apagar o registro apaga setores e arquivos (cascade); depois limpa o Storage. */
export async function excluirRegistro(registro) {
  const { error } = await supabase.from('registros').delete().eq('id', registro.id);
  if (error) throw error;

  const caminhos = registro.arquivos.map((a) => a.storage_path).filter(Boolean);
  if (caminhos.length) {
    const { error: erroStorage } = await supabase.storage.from(BUCKET).remove(caminhos);
    if (erroStorage) console.warn('Registro excluído, mas arquivos ficaram no Storage:', erroStorage);
  }
}

/* Link temporário. Com nomeDownload, o navegador baixa em vez de abrir. */
export async function gerarLinkArquivo(storagePath, { nomeDownload } = {}) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, VALIDADE_LINK_SEGUNDOS, nomeDownload ? { download: nomeDownload } : undefined);

  if (error) throw error;
  return data.signedUrl;
}
