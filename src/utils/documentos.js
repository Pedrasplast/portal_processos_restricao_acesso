import { normalizarChave, normalizarTexto } from './texto';

const ORDEM_TIPOS = {
  POP: 1,
  FLUXOGRAMA: 2,
  'MANUAL': 3,
};

export function normalizarTipoDocumento(tipo = '') {
  const tipoNormalizado = normalizarTexto(tipo)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

  if (tipoNormalizado === 'POP') return 'POP';
  if (tipoNormalizado === 'FLUXOGRAMA') return 'FLUXOGRAMA';
  if (tipoNormalizado === 'MANUAL') return 'MANUAL';

  return '';
}

export function normalizarDescricaoDocumento(descricao = '') {
  return String(descricao)
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('pt-BR');
}

export function formatarCodigo(numero) {
  const numeroConvertido = Number(numero);

  if (!Number.isInteger(numeroConvertido) || numeroConvertido <= 0) {
    return '';
  }

  return String(numeroConvertido).padStart(2, '0');
}

export function formatarTituloProcesso(numero, descricao) {
  const codigo = formatarCodigo(numero);
  const descricaoNormalizada = normalizarDescricaoDocumento(descricao);

  if (!codigo || !descricaoNormalizada) {
    return '';
  }

  return `${codigo} - ${descricaoNormalizada}`;
}

/*
 * Aceita os dois formatos:
 *
 * Novo:
 * 01 - DESCRIÇÃO ÚNICA
 *
 * Antigo:
 * POP-01 | DESCRIÇÃO
 * FLUXOGRAMA-01 | DESCRIÇÃO
 * MANUAL-01 | DESCRIÇÃO
 *
 * Dessa forma, os registros antigos continuam funcionando.
 */
export function analisarTituloDocumento(titulo = '', tipoDocumento = '') {
  const tituloAjustado = String(titulo)
    .trim()
    .replace(/\s+/g, ' ');

  const tipoDaColuna = normalizarTipoDocumento(tipoDocumento);

  const padraoNovo = tituloAjustado.match(
    /^(\d+)\s*-\s*(.+)$/i,
  );

  if (padraoNovo) {
    const numero = Number(padraoNovo[1]);
    const descricao = normalizarDescricaoDocumento(padraoNovo[2]);

    if (
      !Number.isInteger(numero) ||
      numero <= 0 ||
      !descricao
    ) {
      return null;
    }

    return {
      tipo: tipoDaColuna,
      numero,
      codigo: formatarCodigo(numero),
      descricao,
      formato: 'novo',
    };
  }

  const padraoAntigo = tituloAjustado.match(
    /^(POP|FLUXOGRAMA|MANUAL)-(\d+)\s*\|\s*(.+)$/i,
  );

  if (!padraoAntigo) {
    return null;
  }

  const tipoDoTitulo = normalizarTipoDocumento(padraoAntigo[1]);
  const numero = Number(padraoAntigo[2]);
  const descricao = normalizarDescricaoDocumento(padraoAntigo[3]);
  const tipo = tipoDaColuna || tipoDoTitulo;

  if (
    !tipo ||
    !Number.isInteger(numero) ||
    numero <= 0 ||
    !descricao
  ) {
    return null;
  }

  return {
    tipo,
    numero,
    codigo: formatarCodigo(numero),
    descricao,
    formato: 'antigo',
  };
}

export function extrairDescricaoDocumento(
  titulo = '',
  tipoDocumento = '',
) {
  return (
    analisarTituloDocumento(titulo, tipoDocumento)?.descricao ||
    String(titulo).trim() ||
    'Sem descrição'
  );
}

export function extrairCodigoDocumento(
  titulo = '',
  tipoDocumento = '',
) {
  return (
    analisarTituloDocumento(titulo, tipoDocumento)?.codigo ||
    null
  );
}

export function normalizarDocumentos(documentos = []) {
  return documentos
    .map((documento) => {
      const titulo = analisarTituloDocumento(
        documento.titulo,
        documento.tipo_documento,
      );

      if (!titulo) {
        return null;
      }

      const tipo =
        normalizarTipoDocumento(documento.tipo_documento) ||
        titulo.tipo;

      if (!tipo) {
        return null;
      }

      return {
        ...documento,
        tipo,
        numero: titulo.numero,
        codigo: titulo.codigo,
        descricao: titulo.descricao,
        formatoTitulo: titulo.formato,
      };
    })
    .filter(Boolean);
}

/*
 * Agrupa POP, Fluxograma e Manual pela combinação:
 *
 * setor + número
 *
 * Cada grupo possui somente uma descrição visível.
 */
export function agruparDocumentos(documentos = []) {
  const grupos = new Map();

  const normalizados = normalizarDocumentos(documentos)
    .sort((a, b) => {
      const setor = String(a.setor || '').localeCompare(
        String(b.setor || ''),
        'pt-BR',
      );

      if (setor !== 0) return setor;
      if (a.numero !== b.numero) return a.numero - b.numero;

      return (
        (ORDEM_TIPOS[a.tipo] || 99) -
        (ORDEM_TIPOS[b.tipo] || 99)
      );
    });

  normalizados.forEach((documento) => {
    const setor = documento.setor?.trim() || 'Geral';
    const chave = `${normalizarChave(setor)}::${documento.codigo}`;

    if (!grupos.has(chave)) {
      grupos.set(chave, {
        id: chave,
        numero: documento.numero,
        codigo: documento.codigo,
        setor,
        descricao: documento.descricao,
        titulo: formatarTituloProcesso(
          documento.numero,
          documento.descricao,
        ),
        arquivos: {},
      });
    }

    const grupo = grupos.get(chave);

    /*
     * Para registros antigos com descrições diferentes,
     * a descrição do POP tem prioridade. Na ausência do POP,
     * permanece a primeira descrição encontrada.
     */
    if (
      documento.tipo === 'POP' ||
      !grupo.descricao
    ) {
      grupo.descricao = documento.descricao;
      grupo.titulo = formatarTituloProcesso(
        documento.numero,
        documento.descricao,
      );
    }

    grupo.arquivos[documento.tipo] = {
      ...documento,
      url: documento.arquivo_url,
      tipo: documento.tipo,
      codigo: documento.codigo,
    };
  });

  const resultado = Array.from(grupos.values());

  resultado.forEach((grupo) => {
    Object.values(grupo.arquivos).forEach((arquivo) => {
      arquivo.descricao = grupo.descricao;
      arquivo.tituloProcesso = grupo.titulo;
    });
  });

  return resultado.sort((a, b) => {
    const setor = a.setor.localeCompare(b.setor, 'pt-BR');

    if (setor !== 0) return setor;

    return a.numero - b.numero;
  });
}

/*
 * A numeração agora é calculada somente pelo setor.
 * O tipo do documento não interfere mais no próximo número.
 */
export function obterNumeracaoDocumento(
  documentos = [],
  setor = '',
) {
  if (!setor) {
    return {
      processosExistentes: [],
      numerosExistentes: [],
      proximoNumero: 1,
      proximoCodigo: '01',
    };
  }

  const chaveSetor = normalizarChave(setor);

  const processosExistentes = agruparDocumentos(documentos)
    .filter(
      (grupo) =>
        normalizarChave(grupo.setor) === chaveSetor,
    )
    .sort((a, b) => a.numero - b.numero);

  const numerosExistentes = processosExistentes.map(
    (grupo) => grupo.numero,
  );

  const proximoNumero = numerosExistentes.length
    ? Math.max(...numerosExistentes) + 1
    : 1;

  return {
    processosExistentes,
    numerosExistentes,
    proximoNumero,
    proximoCodigo: formatarCodigo(proximoNumero),
  };
}

export function tiposDoNumero(
  documentos = [],
  setor = '',
  numero = null,
) {
  const numeroConvertido = Number(numero);

  if (
    !setor ||
    !Number.isInteger(numeroConvertido) ||
    numeroConvertido <= 0
  ) {
    return [];
  }

  const grupo = agruparDocumentos(documentos).find(
    (item) =>
      normalizarChave(item.setor) ===
        normalizarChave(setor) &&
      item.numero === numeroConvertido,
  );

  return grupo ? Object.keys(grupo.arquivos) : [];
}
