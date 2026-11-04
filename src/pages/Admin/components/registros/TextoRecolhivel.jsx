import { useLayoutEffect, useRef } from 'react';

/*
 * Mostra só as primeiras `linhas` do conteúdo; com `aberto`, mostra tudo.
 * Não tem botão próprio: avisa por `onCortado(chave, true/false)` se o
 * conteúdo passa do limite (medido na tela, funciona em qualquer largura),
 * e quem usa decide onde fica o "Ver mais" (ver LinhaRegistro).
 *
 * - Texto: passe `texto` (corta com "…" na última linha).
 * - Etiquetas (setores etc.): passe `children` e `variante="etiquetas"`
 *   (limita a N fileiras de etiquetas).
 */
function TextoRecolhivel({
  texto,
  children,
  linhas = 2,
  variante = 'texto',
  className = '',
  aberto = false,
  chave,
  onCortado,
}) {
  const caixa = useRef(null);
  const conteudo = children ?? texto;
  const vazio = !conteudo || (Array.isArray(conteudo) && conteudo.length === 0);

  useLayoutEffect(() => {
    const elemento = caixa.current;
    if (!elemento) {
      onCortado?.(chave, false);
      return undefined;
    }
    /* Aberto, tudo aparece: mantém a última medição para o botão continuar visível. */
    if (aberto) return undefined;

    const medir = () => onCortado?.(chave, elemento.scrollHeight > elemento.clientHeight + 1);
    medir();

    const observador = new ResizeObserver(medir);
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [conteudo, linhas, aberto, chave, onCortado]);

  if (vazio) return <span className="rg-vazio-cel">—</span>;

  const Tag = variante === 'texto' ? 'p' : 'div';

  return (
    <Tag
      ref={caixa}
      className={`rg-recolhivel rg-recolhivel--${variante}${aberto ? ' aberto' : ''} ${className}`.trim()}
      style={{ '--linhas': linhas }}
    >
      {conteudo}
    </Tag>
  );
}

export default TextoRecolhivel;
