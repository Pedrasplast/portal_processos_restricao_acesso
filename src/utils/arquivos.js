import { removerAcentos } from './texto';

export function sanitizarNomeArquivo(nome = '') {
  return removerAcentos(nome).replace(
    /[^a-zA-Z0-9._-]/g,
    '_',
  );
}

export function visualizarDocumento(arquivo) {
  if (!arquivo?.url) return;

  const link = document.createElement('a');

  link.href = arquivo.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';

  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function baixarDocumento(arquivo) {
  if (!arquivo?.url) return;

  try {
    const resposta = await fetch(arquivo.url);

    if (!resposta.ok) {
      throw new Error(
        'Falha ao baixar arquivo.',
      );
    }

    const blob = await resposta.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const nome = `${
      arquivo.tipo
    } - ${arquivo.descricao}.pdf`.replace(
      /[\\/:*?"<>|]/g,
      '-',
    );

    link.href = url;
    link.download = nome;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  } catch {
    visualizarDocumento(arquivo);
  }
}