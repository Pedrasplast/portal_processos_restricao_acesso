/* Os setores ficam no banco (tabela setores) e são gerenciados em
   Administração > Setores. */

export const TIPOS_DOCUMENTO = [
  { valor: 'POP', nome: 'POP' },
  { valor: 'FLUXOGRAMA', nome: 'Fluxograma' },
  { valor: 'MANUAL', nome: 'Manual' },
];

/*
 * Arquivos aceitos nos documentos de processo (POP, Fluxograma, Manual).
 * Precisa bater com o bucket "pops" no Supabase
 * (migração 20261105_documentos_imagens.sql).
 */
export const LIMITE_DOCUMENTO_MB = 20;

/* extensão -> tipo (MIME) enviado ao Storage */
export const TIPOS_ARQUIVO_DOCUMENTO = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/* Valor do atributo "accept" do <input type="file">. */
export const ACCEPT_DOCUMENTO = Object.keys(TIPOS_ARQUIVO_DOCUMENTO)
  .map((extensao) => `.${extensao}`)
  .join(',');

/* Texto curto para a tela. */
export const TIPOS_DOCUMENTO_TEXTO = 'PDF ou imagem (JPG, PNG, WEBP)';
