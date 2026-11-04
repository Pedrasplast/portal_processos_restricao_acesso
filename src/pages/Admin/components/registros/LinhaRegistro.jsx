import { useCallback, useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';

import { BotaoEditar, BotaoExcluir } from '../../../../components/ui/BotaoAcao';
import { formatarDataRegistro } from '../../../../utils/registros';
import ArquivosRegistro, { ARQUIVOS_VISIVEIS } from './ArquivosRegistro';
import TextoRecolhivel from './TextoRecolhivel';

/*
 * Uma linha da tabela de registros.
 * Cada coluna mostra no máximo 2 linhas; um único "Ver mais", na primeira
 * coluna, aparece se QUALQUER coluna estiver cortada e abre a linha inteira.
 */
function LinhaRegistro({ registro, onEditar, onExcluir, excluindo }) {
  const [aberto, setAberto] = useState(false);
  const [cortes, setCortes] = useState({});

  const marcarCorte = useCallback((chave, cortado) => {
    setCortes((atual) => (atual[chave] === cortado ? atual : { ...atual, [chave]: cortado }));
  }, []);

  const temArquivosEscondidos = registro.arquivos.length > ARQUIVOS_VISIVEIS;
  const algumCortado = temArquivosEscondidos || Object.values(cortes).some(Boolean);

  const recolhivel = { aberto, onCortado: marcarCorte, linhas: 2 };

  return (
    <tr className={aberto ? 'rg-linha-aberta' : undefined}>
      <td data-rotulo="Setor(es)" className="rg-col-setores">
        <TextoRecolhivel {...recolhivel} chave="setores" variante="etiquetas" className="rg-setores">
          {registro.setores.map((s) => <span key={s.id} className="rg-setor">{s.nome}</span>)}
        </TextoRecolhivel>
        {(algumCortado || aberto) && (
          <button
            type="button"
            className="rg-ver-mais"
            onClick={() => setAberto((valor) => !valor)}
            aria-expanded={aberto}
          >
            {aberto ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
            {aberto ? 'Ver menos' : 'Ver mais'}
          </button>
        )}
      </td>
      <td data-rotulo="Tema" className="rg-col-tema">
        <TextoRecolhivel {...recolhivel} chave="tema" className="rg-tema-linhas">
          {registro.tema?.nome ? <span className="rg-tema-tag">{registro.tema.nome}</span> : null}
        </TextoRecolhivel>
      </td>
      <td data-rotulo="Pauta" className="rg-texto">
        <TextoRecolhivel {...recolhivel} chave="pauta" texto={registro.pauta} />
      </td>
      <td data-rotulo="Participantes" className="rg-texto">
        <TextoRecolhivel {...recolhivel} chave="participantes" texto={registro.participantes} />
      </td>
      <td data-rotulo="Data" className="numero rg-data">{formatarDataRegistro(registro.data)}</td>
      <td data-rotulo="Registro">
        <ArquivosRegistro arquivos={registro.arquivos} aberto={aberto} />
      </td>
      <td className="rg-acoes">
        <div className="rg-acoes__botoes">
          <BotaoEditar rotulo="Editar registro" onClick={onEditar} disabled={excluindo} />
          <BotaoExcluir rotulo="Excluir registro" onClick={onExcluir} disabled={excluindo} />
        </div>
      </td>
    </tr>
  );
}

export default LinhaRegistro;
