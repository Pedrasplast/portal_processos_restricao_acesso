import { useState } from 'react';
import { FiFileText, FiGrid, FiImage, FiMonitor, FiX } from 'react-icons/fi';

import { CATEGORIAS_ARQUIVO } from '../../../../config/registros';
import { useFeedback } from '../../../../hooks/useFeedback';
import { abrirArquivoRegistro } from '../../../../utils/arquivosRegistro';
import { formatarTamanho, tipoDoArquivo } from '../../../../utils/registros';

/* Quantos arquivos aparecem na tabela antes do "+ N arquivos". */
const ARQUIVOS_VISIVEIS = 2;

const ICONE_CATEGORIA = {
  pdf: FiFileText,
  texto: FiFileText,
  apresentacao: FiMonitor,
  planilha: FiGrid,
  imagem: FiImage,
};

export function categoriaDoArquivo(nome) {
  return tipoDoArquivo(nome)?.categoria || 'texto';
}

/* Ícone + nome de um arquivo (usado na lista e no formulário). */
export function RotuloArquivo({ nome, tamanho }) {
  const categoria = categoriaDoArquivo(nome);
  const Icone = ICONE_CATEGORIA[categoria];

  return (
    <>
      <Icone className={`rg-arquivo__icone rg-cat--${categoria}`} aria-hidden="true" />
      <span className="rg-arquivo__nome" title={nome}>{nome}</span>
      {tamanho ? <small className="rg-arquivo__tamanho">{formatarTamanho(tamanho)}</small> : null}
      <span className="sr-only">({CATEGORIAS_ARQUIVO[categoria]})</span>
    </>
  );
}

/* Arquivos de um registro na tabela: clicar abre ou baixa. */
function ArquivosRegistro({ arquivos }) {
  const { notificar } = useFeedback();
  const [abrindoId, setAbrindoId] = useState(null);
  const [verTodos, setVerTodos] = useState(false);

  if (!arquivos.length) return <span className="rg-sem-arquivo">sem arquivo</span>;

  async function abrir(arquivo) {
    if (abrindoId) return;
    setAbrindoId(arquivo.id);
    try {
      await abrirArquivoRegistro(arquivo);
    } catch (error) {
      notificar('erro', error.message);
    } finally {
      setAbrindoId(null);
    }
  }

  const escondidos = arquivos.length - ARQUIVOS_VISIVEIS;
  const lista = verTodos || escondidos <= 0 ? arquivos : arquivos.slice(0, ARQUIVOS_VISIVEIS);

  return (
    <>
      <ul className="rg-arquivos">
        {lista.map((arquivo) => (
          <li key={arquivo.id}>
            <button
              type="button"
              className="rg-arquivo"
              onClick={() => abrir(arquivo)}
              disabled={abrindoId === arquivo.id}
              title={`Abrir ${arquivo.nome}`}
            >
              <RotuloArquivo nome={arquivo.nome} />
            </button>
          </li>
        ))}
      </ul>
      {escondidos > 0 && (
        <button type="button" className="rg-ver-mais" onClick={() => setVerTodos((valor) => !valor)} aria-expanded={verTodos}>
          {verTodos ? 'Ver menos' : `+ ${escondidos} ${escondidos === 1 ? 'arquivo' : 'arquivos'}`}
        </button>
      )}
    </>
  );
}

/* Item de arquivo removível (formulário). */
export function ArquivoRemovivel({ nome, tamanho, onRemover, disabled, rotuloRemover = 'Remover' }) {
  return (
    <li className="rg-arquivo rg-arquivo--estatico">
      <RotuloArquivo nome={nome} tamanho={tamanho} />
      <button
        type="button"
        className="btn btn-ghost btn-sm btn-icone rg-arquivo__remover"
        onClick={onRemover}
        disabled={disabled}
        aria-label={`${rotuloRemover} ${nome}`}
        title={rotuloRemover}
      >
        <FiX />
      </button>
    </li>
  );
}

export default ArquivosRegistro;
