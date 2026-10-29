import { FiCheck, FiEdit2, FiTrash2, FiX } from 'react-icons/fi';

import './BotaoAcao.css';

/*
 * Botão quadrado só com ícone, usado nas ações das listas do admin
 * (editar, excluir, salvar, cancelar...).
 *
 *   rotulo  -> texto lido pelo leitor de tela (obrigatório: o botão não tem texto)
 *   dica    -> balão ao passar o mouse (se omitido, usa o rótulo)
 *   perigo  -> vermelho (ações que apagam)
 *   travado -> aparência de bloqueado, mas continua clicável
 *              (útil para explicar por que a ação não pode ser feita)
 *
 * Demais props (onClick, disabled, type...) vão direto para o <button>.
 */
export function BotaoAcao({
  icone: Icone,
  rotulo,
  dica,
  perigo = false,
  travado = false,
  type = 'button',
  className = '',
  ...props
}) {
  const classes = [
    'botao-acao',
    perigo && 'botao-acao--perigo',
    travado && 'botao-acao--travado',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} aria-label={rotulo} title={dica || rotulo} {...props}>
      <Icone aria-hidden="true" />
    </button>
  );
}

/* Atalhos para as ações mais comuns. */

export function BotaoEditar({ rotulo = 'Editar', ...props }) {
  return <BotaoAcao icone={FiEdit2} rotulo={rotulo} {...props} />;
}

export function BotaoExcluir({ rotulo = 'Excluir', ...props }) {
  return <BotaoAcao icone={FiTrash2} rotulo={rotulo} perigo {...props} />;
}

export function BotaoSalvar({ rotulo = 'Salvar', type = 'submit', ...props }) {
  return <BotaoAcao icone={FiCheck} rotulo={rotulo} type={type} {...props} />;
}

export function BotaoCancelar({ rotulo = 'Cancelar', ...props }) {
  return <BotaoAcao icone={FiX} rotulo={rotulo} {...props} />;
}