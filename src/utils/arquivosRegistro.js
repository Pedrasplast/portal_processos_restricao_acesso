import { gerarLinkArquivo } from '../services/registrosService';
import { tipoDoArquivo } from './registros';

/* PDF, imagens e texto simples o navegador mostra; o resto é baixado. */
const ABRE_NO_NAVEGADOR = new Set(['application/pdf', 'text/plain', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/*
 * Abre o arquivo em nova aba (ou baixa, se o navegador não mostra o tipo).
 * A aba é aberta ANTES de gerar o link para não cair no bloqueador de
 * pop-ups (o navegador só permite pop-up no momento do clique).
 */
export async function abrirArquivoRegistro(arquivo) {
  const mime = arquivo.tipo || tipoDoArquivo(arquivo.nome)?.mime;
  const abreNoNavegador = ABRE_NO_NAVEGADOR.has(mime);
  const aba = abreNoNavegador ? window.open('', '_blank') : null;

  try {
    const url = await gerarLinkArquivo(arquivo.storage_path, abreNoNavegador ? {} : { nomeDownload: arquivo.nome });

    if (aba) {
      aba.opener = null;
      aba.location.replace(url);
      return;
    }

    const link = document.createElement('a');
    link.href = url;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (error) {
    aba?.close();
    console.error('Erro ao abrir arquivo do registro:', error);
    throw new Error('Não foi possível abrir o arquivo. Atualize a página e tente novamente.');
  }
}
