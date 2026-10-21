import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiCheck, FiEdit2, FiGrid, FiPlus, FiPower, FiRefreshCw, FiTrash2, FiX } from 'react-icons/fi';

import AppLayout from '../../components/layout/AppLayout';
import { useFeedback } from '../../hooks/useFeedback';
import {
  criarSetor,
  definirSetorAtivo,
  excluirSetor,
  listarSetoresAdmin,
  renomearSetor,
} from '../../services/setoresService';
import './Admin.css';

function SetoresConteudo() {
  const { notificar, confirmar } = useFeedback();
  const [setores, setSetores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processandoId, setProcessandoId] = useState(null);
  const [novoNome, setNovoNome] = useState('');
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState({ id: null, nome: '' });

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      setSetores(await listarSetoresAdmin());
    } catch (error) {
      notificar('erro', `Não foi possível carregar os setores. ${error.message || ''}`.trim());
    } finally {
      setLoading(false);
    }
  }, [notificar]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const resumo = useMemo(() => {
    const ativos = setores.filter((s) => s.ativo).length;
    return { ativos, desativados: setores.length - ativos };
  }, [setores]);

  async function adicionar(event) {
    event.preventDefault();
    const nome = novoNome.trim();
    if (nome.length < 2) {
      notificar('aviso', 'Informe o nome do setor com pelo menos 2 caracteres.');
      return;
    }

    setCriando(true);
    try {
      await criarSetor(nome);
      notificar('sucesso', `Setor ${nome.toLocaleUpperCase('pt-BR')} adicionado.`);
      setNovoNome('');
      await carregar();
    } catch (error) {
      notificar('erro', error.message || 'Não foi possível adicionar o setor.');
    } finally {
      setCriando(false);
    }
  }

  async function salvarNome(setor) {
    const nome = editando.nome.trim();
    if (!nome || nome.toLocaleUpperCase('pt-BR') === setor.nome) {
      setEditando({ id: null, nome: '' });
      return;
    }

    if (setor.documentos > 0) {
      const ok = await confirmar({
        titulo: 'Renomear setor',
        mensagem: `${setor.nome} passará a se chamar ${nome.toLocaleUpperCase('pt-BR')}.`,
        detalhe: `Os ${setor.documentos} documento(s) deste setor também serão atualizados.`,
        textoConfirmar: 'Renomear',
      });
      if (!ok) return;
    }

    setProcessandoId(setor.id);
    try {
      await renomearSetor(setor.id, nome);
      notificar('sucesso', 'Setor renomeado.');
      setEditando({ id: null, nome: '' });
      await carregar();
    } catch (error) {
      notificar('erro', error.message || 'Não foi possível renomear o setor.');
    } finally {
      setProcessandoId(null);
    }
  }

  async function alternarAtivo(setor) {
    const desativar = setor.ativo;
    const ok = await confirmar({
      titulo: desativar ? 'Desativar setor' : 'Reativar setor',
      mensagem: desativar
        ? setor.documentos > 0
          ? `Os ${setor.documentos} documento(s) de ${setor.nome} deixarão de aparecer no Início e no Repositório para todos os usuários.`
          : `${setor.nome} deixará de aparecer no cadastro de novos documentos.`
        : setor.documentos > 0
          ? `Os ${setor.documentos} documento(s) de ${setor.nome} voltarão a aparecer no Início e no Repositório.`
          : `${setor.nome} voltará a aparecer no cadastro de novos documentos.`,
      detalhe: desativar
        ? 'Nada é apagado: os documentos continuam salvos, visíveis só em Gerenciar documentos, e voltam ao reativar o setor.'
        : undefined,
      textoConfirmar: desativar ? 'Desativar' : 'Reativar',
      perigo: desativar,
    });
    if (!ok) return;

    setProcessandoId(setor.id);
    try {
      await definirSetorAtivo(setor.id, !setor.ativo);
      notificar('sucesso', desativar ? `${setor.nome} desativado.` : `${setor.nome} reativado.`);
      await carregar();
    } catch (error) {
      notificar('erro', error.message || 'Não foi possível alterar o setor.');
    } finally {
      setProcessandoId(null);
    }
  }

  async function excluir(setor) {
    if (setor.documentos > 0) {
      notificar(
        'aviso',
        `${setor.nome} tem ${setor.documentos} documento(s) e não pode ser excluído. Use "Desativar" para ocultá-lo sem apagar nada.`,
        { titulo: 'Setor com documentos' },
      );
      return;
    }

    const ok = await confirmar({
      titulo: 'Excluir setor',
      mensagem: `O setor ${setor.nome} será excluído.`,
      detalhe: 'Ele não tem documentos. Esta ação não pode ser desfeita.',
      textoConfirmar: 'Excluir setor',
      perigo: true,
    });
    if (!ok) return;

    setProcessandoId(setor.id);
    try {
      await excluirSetor(setor.id);
      notificar('sucesso', `Setor ${setor.nome} excluído.`);
      await carregar();
    } catch (error) {
      notificar('erro', error.message || 'Não foi possível excluir o setor.');
    } finally {
      setProcessandoId(null);
    }
  }

  return (
    <div className="setores-layout">
      <section className="painel" aria-labelledby="setores-titulo">
        <div className="painel__cabecalho">
          <div>
            <h2 id="setores-titulo">
              <FiGrid aria-hidden="true" /> Setores
            </h2>
            <p>
              {resumo.ativos} {resumo.ativos === 1 ? 'ativo' : 'ativos'}
              {resumo.desativados > 0 && ` e ${resumo.desativados} ${resumo.desativados === 1 ? 'desativado' : 'desativados'}`}.
              Setores desativados e seus documentos não aparecem para quem consulta o portal.
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => carregar()} disabled={loading}>
            <FiRefreshCw /> Atualizar
          </button>
        </div>

        <div className="table-wrapper">
          <table className="data-table tabela-setores">
            <thead>
              <tr>
                <th>Setor</th>
                <th>Situação</th>
                <th>Conteúdo</th>
                <th><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {loading && setores.length === 0 ? (
                <tr><td colSpan="4" className="empty-state">Carregando setores...</td></tr>
              ) : setores.length === 0 ? (
                <tr><td colSpan="4" className="empty-state">Nenhum setor cadastrado. Adicione o primeiro ao lado.</td></tr>
              ) : (
                setores.map((setor) => {
                  const processando = processandoId === setor.id;
                  const emEdicao = editando.id === setor.id;

                  return (
                    <tr key={setor.id} className={setor.ativo ? undefined : 'linha-inativa'}>
                      <td data-label="Setor">
                        {emEdicao ? (
                          <form
                            className="setor-edicao"
                            onSubmit={(event) => {
                              event.preventDefault();
                              void salvarNome(setor);
                            }}
                          >
                            <input
                              className="form-control"
                              value={editando.nome}
                              onChange={(event) => setEditando({ id: setor.id, nome: event.target.value })}
                              onKeyDown={(event) => event.key === 'Escape' && setEditando({ id: null, nome: '' })}
                              maxLength={60}
                              autoFocus
                              aria-label={`Novo nome para ${setor.nome}`}
                            />
                            <button type="submit" className="btn btn-primary btn-sm" disabled={processando} aria-label="Salvar nome">
                              <FiCheck />
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => setEditando({ id: null, nome: '' })}
                              aria-label="Cancelar"
                            >
                              <FiX />
                            </button>
                          </form>
                        ) : (
                          <strong className="setor-nome">{setor.nome}</strong>
                        )}
                      </td>
                      <td data-label="Situação">
                        <span className={`status-badge status-badge--${setor.ativo ? 'aprovado' : 'cancelado'}`}>
                          {setor.ativo ? 'Ativo' : 'Desativado'}
                        </span>
                      </td>
                      <td className="setor-conteudo numero">
                        {setor.documentos === 0
                          ? 'Sem documentos'
                          : `${setor.processos} ${setor.processos === 1 ? 'processo' : 'processos'}, ${setor.documentos} ${setor.documentos === 1 ? 'documento' : 'documentos'}`}
                      </td>
                      <td className="celula-acoes">
                        {!emEdicao && (
                          <div className="request-actions">
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm btn-icone"
                              onClick={() => setEditando({ id: setor.id, nome: setor.nome })}
                              disabled={processando}
                              aria-label={`Renomear ${setor.nome}`}
                              title="Renomear"
                            >
                              <FiEdit2 />
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => alternarAtivo(setor)}
                              disabled={processando}
                            >
                              <FiPower /> {setor.ativo ? 'Desativar' : 'Reativar'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm btn-icone"
                              onClick={() => excluir(setor)}
                              disabled={processando}
                              aria-label={`Excluir ${setor.nome}`}
                              title={setor.documentos > 0 ? 'Setor com documentos: use Desativar' : 'Excluir setor'}
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="setores-lateral">
        <form className="painel" onSubmit={adicionar} aria-labelledby="novo-setor-titulo">
          <div className="painel__cabecalho">
            <div>
              <h2 id="novo-setor-titulo">
                <FiPlus aria-hidden="true" /> Adicionar setor
              </h2>
              <p>O novo setor aparece na hora no cadastro de documentos e no repositório.</p>
            </div>
          </div>
          <div className="painel__corpo setores-form">
            <div className="form-group">
              <label htmlFor="novo-setor">Nome do setor</label>
              <input
                id="novo-setor"
                className="form-control"
                value={novoNome}
                onChange={(event) => setNovoNome(event.target.value)}
                placeholder="Ex.: MANUTENÇÃO"
                maxLength={60}
                disabled={criando}
              />
              <p className="form-ajuda">O nome é salvo em letras maiúsculas.</p>
            </div>
            <button type="submit" className="btn btn-primary" disabled={criando}>
              <FiPlus /> {criando ? 'Adicionando...' : 'Adicionar setor'}
            </button>
          </div>
        </form>

        <div className="setores-dica">
          <strong>Desativar ou excluir?</strong>
          <p>
            <b>Desativar</b> oculta o setor e os documentos dele do Início e do Repositório para todos,
            sem apagar nada; ao reativar, tudo volta. <b>Excluir</b> só é possível quando o setor não
            tem nenhum documento.
          </p>
        </div>
      </aside>
    </div>
  );
}

function SetoresAdmin() {
  return (
    <AppLayout titulo="Administração">
      <header className="page-header">
        <div>
          <h1>Gerenciar setores</h1>
          <p>Adicione, renomeie ou desative os setores usados para organizar os documentos.</p>
        </div>
      </header>

      <SetoresConteudo />
    </AppLayout>
  );
}

export default SetoresAdmin;
