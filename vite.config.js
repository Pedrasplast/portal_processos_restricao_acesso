import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/*
 * Versão desta publicação. Na Vercel usa o commit (ex.: "a1b2c3d");
 * fora dela, a data/hora do build. Republicar o mesmo commit não gera
 * aviso de "nova versão".
 */
const VERSAO = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || new Date().toISOString();

/*
 * Versão mostrada no rodapé, vinda do package.json ("1.0.0" -> "1.0.00").
 * Para subir: "npm run versao" (1.0.00 -> 1.0.01 -> 1.0.02...).
 */
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const [maior = 1, menor = 0, correcao = 0] = String(version).split('.').map(Number);
const VERSAO_EXIBICAO = `${maior}.${menor}.${String(correcao).padStart(2, '0')}`;

/* Grava dist/version.json no build. O site compara com a versão que carregou. */
function arquivoDeVersao() {
  let pastaSaida = 'dist';

  return {
    name: 'arquivo-de-versao',
    apply: 'build',
    configResolved(config) {
      pastaSaida = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      writeFileSync(
        resolve(pastaSaida, 'version.json'),
        JSON.stringify({ versao: VERSAO, publicadoEm: new Date().toISOString() }),
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), arquivoDeVersao()],
  define: {
    'import.meta.env.VITE_VERSAO_APP': JSON.stringify(VERSAO),
    'import.meta.env.VITE_VERSAO_EXIBICAO': JSON.stringify(VERSAO_EXIBICAO),
  },
});
