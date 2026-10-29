/*
 * Regras dos Registros de reuniões (Administração > Registros).
 * Os limites abaixo precisam bater com o bucket "registros" no Supabase
 * (migração 20261029b_registros.sql).
 */

export const LIMITE_ARQUIVO_MB = 50;
export const MAX_ARQUIVOS_POR_REGISTRO = 10;
export const LIMITE_PAUTA = 4000;
export const LIMITE_PARTICIPANTES = 2000;

/* Categorias usadas para ícone e cor de cada arquivo. */
export const CATEGORIAS_ARQUIVO = {
  pdf: 'PDF',
  texto: 'Texto',
  apresentacao: 'Apresentação',
  planilha: 'Planilha',
  imagem: 'Foto',
};

/* Extensões aceitas -> tipo (MIME) enviado ao Storage + categoria. */
export const TIPOS_ARQUIVO = {
  pdf: { mime: 'application/pdf', categoria: 'pdf' },

  doc: { mime: 'application/msword', categoria: 'texto' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', categoria: 'texto' },
  odt: { mime: 'application/vnd.oasis.opendocument.text', categoria: 'texto' },
  rtf: { mime: 'application/rtf', categoria: 'texto' },
  txt: { mime: 'text/plain', categoria: 'texto' },

  ppt: { mime: 'application/vnd.ms-powerpoint', categoria: 'apresentacao' },
  pptx: { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', categoria: 'apresentacao' },
  ppsx: { mime: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow', categoria: 'apresentacao' },
  pps: { mime: 'application/vnd.ms-powerpoint', categoria: 'apresentacao' },
  odp: { mime: 'application/vnd.oasis.opendocument.presentation', categoria: 'apresentacao' },

  xls: { mime: 'application/vnd.ms-excel', categoria: 'planilha' },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', categoria: 'planilha' },
  ods: { mime: 'application/vnd.oasis.opendocument.spreadsheet', categoria: 'planilha' },
  csv: { mime: 'text/csv', categoria: 'planilha' },

  jpg: { mime: 'image/jpeg', categoria: 'imagem' },
  jpeg: { mime: 'image/jpeg', categoria: 'imagem' },
  png: { mime: 'image/png', categoria: 'imagem' },
  webp: { mime: 'image/webp', categoria: 'imagem' },
  gif: { mime: 'image/gif', categoria: 'imagem' },
  heic: { mime: 'image/heic', categoria: 'imagem' },
};

/* Valor para o atributo "accept" do <input type="file">. */
export const ACCEPT_ARQUIVOS = Object.keys(TIPOS_ARQUIVO)
  .map((extensao) => `.${extensao}`)
  .join(',');
