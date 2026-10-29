import './Rodape.css';

/* Versão do portal (package.json, formatada no vite.config.js). */
const VERSAO = import.meta.env.VITE_VERSAO_EXIBICAO || '1.0.00';
const ANO = new Date().getFullYear();

/* Rodapé de todas as páginas internas. */
function Rodape() {
  return (
    <footer className="rodape">
      <span>
        © {ANO} <strong>Pedrasplast</strong> · Portal de Processos
      </span>
      <span className="rodape__versao numero">Versão {VERSAO}</span>
    </footer>
  );
}

export default Rodape;
