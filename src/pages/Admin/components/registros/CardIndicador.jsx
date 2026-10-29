/*
 * Card de indicador (KPI): título, número grande e legenda.
 *
 *   titulo      -> o que o card mede ("Neste mês")
 *   valor       -> o número
 *   complemento -> texto pequeno ao lado do número ("de 14", "registros")
 *   legenda     -> contexto embaixo ("outubro de 2026")
 *   cor         -> 'marinho' | 'verde' | 'azul' (faixa à esquerda)
 */
function CardIndicador({ titulo, valor, complemento, legenda, cor = 'marinho' }) {
  return (
    <section className={`painel rg-indicador rg-indicador--${cor}`} aria-label={titulo}>
      <h2 className="rg-indicador__titulo">{titulo}</h2>
      <p className="rg-indicador__valor numero" aria-live="polite">
        {valor}
        {complemento && <span className="rg-indicador__complemento">{complemento}</span>}
      </p>
      {legenda && <p className="rg-indicador__legenda" title={legenda}>{legenda}</p>}
    </section>
  );
}

export default CardIndicador;
