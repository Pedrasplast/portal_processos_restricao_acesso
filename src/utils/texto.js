export function removerAcentos(valor = '') {
  return String(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function normalizarTexto(valor = '') {
  return removerAcentos(valor).trim().replace(/\s+/g, ' ').toUpperCase();
}

export function normalizarChave(valor = '') {
  return normalizarTexto(valor).toLowerCase();
}

export function nomePorEmail(email = '') {
  const usuario = String(email).split('@')[0];

  return usuario
    .split(/[._-]+/)
    .filter(Boolean)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1).toLowerCase())
    .join(' ');
}

export function sanitizarNomeArquivo(nome = '') {
  return removerAcentos(nome).replace(/[^a-zA-Z0-9._-]/g, '_');
}

const PARTICULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

/** "maria carolina da silva" -> "Maria Carolina da Silva" */
export function nomeExibicao(nome = '') {
  return String(nome)
    .trim()
    .toLocaleLowerCase('pt-BR')
    .split(/\s+/)
    .filter(Boolean)
    .map((parte, i) => (i > 0 && PARTICULAS.has(parte) ? parte : parte.charAt(0).toLocaleUpperCase('pt-BR') + parte.slice(1)))
    .join(' ');
}
