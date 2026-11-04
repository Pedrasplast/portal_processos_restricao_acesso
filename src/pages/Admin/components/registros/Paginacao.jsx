import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

/*
 * Números a mostrar: todos se forem poucos; senão 1 … vizinhos da atual … última.
 * Ex.: atual 6 de 12 -> [1, '…', 5, 6, 7, '…', 12]
 */
function paginasVisiveis(atual, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const inicio = Math.max(2, Math.min(atual - 1, total - 4));
  const fim = Math.min(total - 1, Math.max(atual + 1, 5));
  const meio = Array.from({ length: fim - inicio + 1 }, (_, i) => inicio + i);

  return [1, ...(inicio > 2 ? ['…'] : []), ...meio, ...(fim < total - 1 ? ['…'] : []), total];
}

/* Rodapé da lista: "1–8 de 23" + botões de página. Some quando tudo cabe numa página. */
function Paginacao({ pagina, totalItens, porPagina, onMudar }) {
  const totalPaginas = Math.ceil(totalItens / porPagina);
  if (totalPaginas <= 1) return null;

  const primeiro = (pagina - 1) * porPagina + 1;
  const ultimo = Math.min(pagina * porPagina, totalItens);

  return (
    <nav className="rg-paginacao" aria-label="Paginação dos registros">
      <span className="rg-paginacao__info">
        Mostrando <b>{primeiro}–{ultimo}</b> de <b>{totalItens}</b>
      </span>

      <div className="rg-paginacao__botoes">
        <button
          type="button"
          className="rg-pagina rg-pagina--seta"
          onClick={() => onMudar(pagina - 1)}
          disabled={pagina === 1}
          aria-label="Página anterior"
        >
          <FiChevronLeft aria-hidden="true" />
        </button>

        {paginasVisiveis(pagina, totalPaginas).map((item, indice) =>
          item === '…' ? (
            <span key={`reticencias-${indice}`} className="rg-pagina rg-pagina--reticencias" aria-hidden="true">…</span>
          ) : (
            <button
              key={item}
              type="button"
              className={`rg-pagina${item === pagina ? ' atual' : ''}`}
              onClick={() => onMudar(item)}
              aria-label={`Página ${item}`}
              aria-current={item === pagina ? 'page' : undefined}
            >
              {item}
            </button>
          ),
        )}

        <button
          type="button"
          className="rg-pagina rg-pagina--seta"
          onClick={() => onMudar(pagina + 1)}
          disabled={pagina === totalPaginas}
          aria-label="Próxima página"
        >
          <FiChevronRight aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

export default Paginacao;
