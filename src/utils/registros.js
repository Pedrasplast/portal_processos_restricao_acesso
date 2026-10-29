import { LIMITE_ARQUIVO_MB, TIPOS_ARQUIVO } from '../config/registros';
import { normalizarChave } from './texto';

/* ---------- arquivos ---------- */

export function extensaoDoArquivo(nome = '') {
  const partes = String(nome).toLowerCase().split('.');
  return partes.length > 1 ? partes.pop() : '';
}

/** { mime, categoria } da extensão, ou null se o tipo não é aceito. */
export function tipoDoArquivo(nome = '') {
  return TIPOS_ARQUIVO[extensaoDoArquivo(nome)] || null;
}

/** Mensagem de erro do arquivo, ou '' se ele pode ser enviado. */
export function validarArquivo(arquivo) {
  if (!arquivo) return 'Arquivo inválido.';
  if (!tipoDoArquivo(arquivo.name)) return `${arquivo.name}: tipo de arquivo não aceito.`;
  if (arquivo.size === 0) return `${arquivo.name}: o arquivo está vazio.`;
  if (arquivo.size > LIMITE_ARQUIVO_MB * 1024 * 1024) {
    return `${arquivo.name}: passa de ${LIMITE_ARQUIVO_MB} MB.`;
  }
  return '';
}

export function formatarTamanho(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/* ---------- datas (coluna "date": AAAA-MM-DD, sem fuso horário) ---------- */

export function hojeISO() {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

/** "2026-10-29" -> "29/10/2026" */
export function formatarDataRegistro(dataISO = '') {
  const [ano, mes, dia] = String(dataISO).split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : '';
}

/* ---------- filtros da lista ---------- */

export const FILTROS_VAZIOS = {
  busca: '',
  setorId: '',
  temaId: '',
};

export function temFiltroAtivo(filtros) {
  return Object.keys(FILTROS_VAZIOS).some((chave) => Boolean(filtros[chave]));
}

export function filtrarRegistros(registros, filtros) {
  const termo = normalizarChave(filtros.busca);

  return registros.filter((registro) => {
    if (filtros.temaId && registro.tema?.id !== filtros.temaId) return false;
    if (filtros.setorId && !registro.setores.some((s) => s.id === filtros.setorId)) return false;

    if (termo) {
      const texto = normalizarChave(
        [
          registro.tema?.nome,
          registro.pauta,
          registro.participantes,
          ...registro.setores.map((s) => s.nome),
          ...registro.arquivos.map((a) => a.nome),
        ]
          .filter(Boolean)
          .join(' '),
      );
      if (!texto.includes(termo)) return false;
    }

    return true;
  });
}

/* ---------- indicadores ---------- */

/** "2026-10" (mês atual, no horário do computador). */
export function mesAtualISO() {
  return hojeISO().slice(0, 7);
}

/** "2026-10" -> "outubro de 2026" */
export function nomeDoMes(anoMes) {
  const [ano, mes] = String(anoMes).split('-').map(Number);
  if (!ano || !mes) return '';
  return new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

/** Quantos registros têm data no mês informado ("2026-10"). */
export function contarNoMes(registros, anoMes) {
  return registros.filter((registro) => String(registro.data).startsWith(anoMes)).length;
}

/** Quantos setores diferentes aparecem nos registros. */
export function contarSetoresDistintos(registros) {
  return new Set(registros.flatMap((registro) => registro.setores.map((s) => s.id))).size;
}
