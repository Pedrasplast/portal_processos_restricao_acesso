import { useEffect, useRef, useState } from 'react';
import { FiEye, FiEyeOff, FiPlus, FiX } from 'react-icons/fi';

import {
  BotaoAcao,
  BotaoCancelar,
  BotaoEditar,
  BotaoExcluir,
  BotaoSalvar,
} from '../../../../components/ui/BotaoAcao';
import { useFeedback } from '../../../../hooks/useFeedback';
import {
  criarTema,
  definirTemaAtivo,
  excluirTema,
  renomearTema,
} from '../../../../services/temasRegistroService';

/* Janela "Temas": criar, renomear, desativar/reativar e excluir. */
function TemasDialog({ temas, onFechar, onAlterado }) {
  const { notificar, confirmar } = useFeedback();
  const [novoNome, setNovoNome] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [nomeEdicao, setNomeEdicao] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const campoNovo = useRef(null);

  useEffect(() => {
    campoNovo.current?.focus();
    const aoTeclar = (event) => event.key === 'Escape' && !ocupado && !editandoId && onFechar();
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onFechar, ocupado, editandoId]);

  /* Executa uma ação, avisa o resultado e recarrega a lista. */
  async function executar(acao, mensagemSucesso) {
    setOcupado(true);
    try {
      await acao();
      notificar('sucesso', mensagemSucesso);
      await onAlterado();
      return true;
    } catch (error) {
      notificar('erro', error.message || 'Não foi possível concluir a ação.');
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function adicionar(event) {
    event.preventDefault();
    const nome = novoNome.trim();
    if (nome.length < 2) return notificar('aviso', 'Informe o nome do tema (mínimo de 2 letras).');
    if (await executar(() => criarTema(nome), `Tema ${nome.toLocaleUpperCase('pt-BR')} criado.`)) setNovoNome('');
  }

  async function salvarNome(tema) {
    const nome = nomeEdicao.trim();
    if (nome.length < 2) return notificar('aviso', 'Informe o nome do tema (mínimo de 2 letras).');
    if (nome.toLocaleUpperCase('pt-BR') === tema.nome) return setEditandoId(null);
    if (await executar(() => renomearTema(tema.id, nome), 'Tema renomeado.')) setEditandoId(null);
  }

  async function alternarAtivo(tema) {
    await executar(
      () => definirTemaAtivo(tema.id, !tema.ativo),
      tema.ativo ? `Tema ${tema.nome} desativado.` : `Tema ${tema.nome} reativado.`,
    );
  }

  async function excluir(tema) {
    const ok = await confirmar({
      titulo: 'Excluir tema',
      mensagem: `O tema ${tema.nome} será excluído.`,
      detalhe: 'Só é possível excluir temas que não estão em nenhum registro.',
      textoConfirmar: 'Excluir tema',
      perigo: true,
    });
    if (ok) await executar(() => excluirTema(tema.id), `Tema ${tema.nome} excluído.`);
  }

  return (
    <div className="dialogo-fundo" onMouseDown={(e) => e.target === e.currentTarget && !ocupado && onFechar()}>
      <div className="dialogo rg-dialogo rg-dialogo--temas" role="dialog" aria-modal="true" aria-labelledby="rg-temas-titulo">
        <div className="rg-dialogo__cab">
          <h2 id="rg-temas-titulo">Temas</h2>
          <button type="button" className="btn btn-ghost btn-sm btn-icone" onClick={onFechar} aria-label="Fechar" disabled={ocupado}>
            <FiX />
          </button>
        </div>

        <div className="rg-dialogo__corpo">
          <form className="rg-tema-novo" onSubmit={adicionar}>
            <label htmlFor="rg-tema-novo" className="sr-only">Novo tema</label>
            <input
              id="rg-tema-novo"
              ref={campoNovo}
              className="form-control"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value.toLocaleUpperCase('pt-BR'))}
              placeholder="NOVO TEMA (EX.: AUDITORIA)"
              maxLength={40}
              disabled={ocupado}
            />
            <button type="submit" className="btn btn-primary" disabled={ocupado}>
              <FiPlus /> Adicionar
            </button>
          </form>

          <ul className="rg-temas">
            {temas.map((tema) => (
              <li key={tema.id} className={`rg-tema${tema.ativo ? '' : ' inativo'}`}>
                {editandoId === tema.id ? (
                  <form
                    className="rg-tema__edicao"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void salvarNome(tema);
                    }}
                  >
                    <input
                      className="form-control"
                      value={nomeEdicao}
                      onChange={(e) => setNomeEdicao(e.target.value.toLocaleUpperCase('pt-BR'))}
                      onKeyDown={(e) => e.key === 'Escape' && setEditandoId(null)}
                      maxLength={40}
                      aria-label={`Novo nome para ${tema.nome}`}
                      disabled={ocupado}
                      autoFocus
                    />
                    <BotaoSalvar rotulo="Salvar nome" disabled={ocupado} />
                    <BotaoCancelar onClick={() => setEditandoId(null)} disabled={ocupado} />
                  </form>
                ) : (
                  <>
                    <span className="rg-tema__nome">
                      {tema.nome}
                      {!tema.ativo && <small>desativado</small>}
                    </span>
                    <span className="rg-tema__acoes">
                      <BotaoEditar
                        rotulo={`Renomear ${tema.nome}`}
                        dica="Renomear"
                        onClick={() => {
                          setEditandoId(tema.id);
                          setNomeEdicao(tema.nome);
                        }}
                        disabled={ocupado}
                      />
                      <BotaoAcao
                        icone={tema.ativo ? FiEyeOff : FiEye}
                        rotulo={`${tema.ativo ? 'Desativar' : 'Reativar'} ${tema.nome}`}
                        dica={tema.ativo ? 'Desativar (não aparece em novos registros)' : 'Reativar'}
                        onClick={() => alternarAtivo(tema)}
                        disabled={ocupado}
                      />
                      <BotaoExcluir rotulo={`Excluir ${tema.nome}`} onClick={() => excluir(tema)} disabled={ocupado} />
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>

          <p className="form-ajuda">Tema desativado continua nos registros antigos, mas não aparece em novos.</p>
        </div>
      </div>
    </div>
  );
}

export default TemasDialog;
