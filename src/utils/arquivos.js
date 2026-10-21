import { gerarLinkDocumento } from '../services/documentosService';

function nomeParaDownload(arquivo) {
  const base = [arquivo.tipo, arquivo.descricao].filter(Boolean).join(' - ') || 'documento';
  return `${base}.pdf`.replace(/[\\/:*?"<>|]/g, '-');
}

/*
 * Abre o PDF em nova aba usando um link assinado (temporário).
 * A aba é aberta ANTES de gerar o link para não ser bloqueada pelo
 * bloqueador de pop-ups (o navegador só permite pop-up no clique).
 */
export async function visualizarDocumento(arquivo) {
  if (!arquivo?.storage_path) return;

  const aba = window.open('', '_blank');

  try {
    const url = await gerarLinkDocumento(arquivo.storage_path);

    if (aba) {
      aba.opener = null;
      aba.location.replace(url);
    } else {
      window.location.assign(url);
    }
  } catch (error) {
    aba?.close();
    console.error('Erro ao abrir documento:', error);
    window.alert('Não foi possível abrir o documento. Atualize a página e tente novamente.');
  }
}

/*
 * Baixa o PDF direto do Storage (o link já vem com o nome do arquivo),
 * sem carregar o arquivo inteiro na memória do navegador.
 */
export async function baixarDocumento(arquivo) {
  if (!arquivo?.storage_path) return;

  try {
    const url = await gerarLinkDocumento(arquivo.storage_path, {
      nomeDownload: nomeParaDownload(arquivo),
    });

    const link = document.createElement('a');
    link.href = url;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (error) {
    console.error('Erro ao baixar documento:', error);
    window.alert('Não foi possível baixar o documento. Atualize a página e tente novamente.');
  }
}
