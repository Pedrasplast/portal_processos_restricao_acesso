import { useLayoutEffect, useRef, useState } from 'react';

/*
 * Mostra só as primeiras `linhas` do texto, com "Ver mais" / "Ver menos".
 * O botão só aparece quando o texto realmente passa do limite
 * (medido na tela, então funciona em qualquer largura).
 */
function TextoRecolhivel({ texto, linhas = 3 }) {
  const paragrafo = useRef(null);
  const [aberto, setAberto] = useState(false);
  const [cortado, setCortado] = useState(false);

  useLayoutEffect(() => {
    const elemento = paragrafo.current;
    if (!elemento || aberto) return undefined;

    const medir = () => setCortado(elemento.scrollHeight > elemento.clientHeight + 1);
    medir();

    const observador = new ResizeObserver(medir);
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [texto, linhas, aberto]);

  if (!texto) return <span className="rg-vazio-cel">—</span>;

  return (
    <>
      <p
        ref={paragrafo}
        className={`rg-recolhivel${aberto ? ' aberto' : ''}`}
        style={{ '--linhas': linhas }}
      >
        {texto}
      </p>
      {(cortado || aberto) && (
        <button
          type="button"
          className="rg-ver-mais"
          onClick={() => setAberto((valor) => !valor)}
          aria-expanded={aberto}
        >
          {aberto ? 'Ver menos' : 'Ver mais'}
        </button>
      )}
    </>
  );
}

export default TextoRecolhivel;
