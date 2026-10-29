import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiFolder, FiPlus } from 'react-icons/fi';

import AppLayout from '../../components/layout/AppLayout';
import { BotaoCancelar, BotaoEditar, BotaoExcluir, BotaoSalvar } from '../../components/ui/BotaoAcao';
import { useFeedback } from '../../hooks/useFeedback';
import {
  criarSetor,
  definirSetorAtivo,
  excluirSetor,
  listarSetoresAdmin,
  renomearSetor,
} from '../../services/setoresService';
import './Admin.css';

/* ---------- vínculos do setor (documentos e registros) ---------- */

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

const temVinculo = (setor) => setor.documentos > 0 || setor.registros > 0;

/* Texto do cartão: "4 documentos · 2 registros" */
function textoVinculos(setor) {
  const partes = [];
  if (setor.documentos > 0) partes.push(plural(setor.documentos, 'documento', 'documentos'));
  if (setor.registros > 0) partes.push(plural(setor.registros, 'registro', 'registros'));
  return partes.length ? partes.join(' · ') : 'Sem documentos ou registros';
}

/* Aviso de exclusão: "4 documentos em Documentos e 2 registros em Registros" */
function ondeEstaoVinculos(setor) {
  const partes = [];
  if (setor.documentos > 0) partes.push(`${plural(setor.documentos, 'documento', 'documentos')} em Documentos`);
  if (setor.registros > 0) partes.push(`${plural(setor.registros, 'registro', 'registros')} em Registros`);
  return partes.join(' e ');
}

/* Cartão "Novo setor": vira um campo ao clicar. */
function NovoSetor({ onCriado }) {
  const { notificar } = useFeedback();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const botao = useRef(null);

  function fechar() {
    setAberto(false);
    setNome('');
    setTimeout(() => botao.current?.focus(), 0);
  }

  async function adicionar(event) {
    event.preventDefault();
    const limpo = nome.trim();
    if (limpo.length < 2) {
      notificar('aviso', 'Informe o nome do setor com pelo menos 2 caracteres.');
      return;
    }

    setSalvando(true);
    try {
      await criarSetor(limpo);
      notificar('sucesso', `Setor ${limpo.toLocaleUpperCase('pt-BR')} adicionado.`);
      setNome('');
      setAberto(false);
      await onCriado();
    } catch (error) {
      notificar('erro', error.message || 'Não foi possível adicionar o setor.');
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return (
      <button ref={botao} type="button" className="st-novo" onClick={() => setAberto(true)}>
        <FiPlus aria-hidden="true" /> Novo setor
      </button>
    );
  }

  return (
    <form className="st-novo-form" onSubmit={adicionar}>
      <label htmlFor="st-novo-nome">Nome do novo setor</label>
      <input
        id="st-novo-nome"
        className="form-control"
        value={nome}
        onChange={(e) => setNome(e.target.value.toLocaleUpperCase('pt-BR'))}
        onKeyDown={(e) => e.key === 'Escape' && !salvando && fechar()}
        placeholder="EX.: MANUTENÇÃO"
        maxLength={60}
        disabled={salvando}
        autoFocus
      />
      <div className="st-novo-form__botoes">
        <button type="submit" className="btn btn-primary btn-sm" disabled={salvando}>
          <FiPlus /> {salvando ? 'Adicionando...' : 'Adicionar'}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={fechar} disabled={salvando}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function SetoresConteudo() {
  const { notificar, confirmar } = useFeedback();
  const [setores, setSetores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processandoId, setProcessandoId] = useState(null);
  const [editando, setEditando] = useState({ id: null, nome: '' });
  const [verAtivos, setVerAtivos] = useState(false);
  const [verDesativados, setVerDesativados] = useState(false);

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

  const totalAtivos = useMemo(() => setores.filter((s) => s.ativo).length, [setores]);
  const totalDesativados = setores.length - totalAtivos;

  /* Nenhuma (ou as duas) caixas marcadas: mostra todos. */
  const filtrando = verAtivos !== verDesativados;
  const visiveis = filtrando ? setores.filter((s) => (verAtivos ? s.ativo : !s.ativo)) : setores;

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
      titulo: desativar ? 'Desativar setor' : 'Ativar setor',
      mensagem: desativar
        ? setor.documentos > 0
          ? `Os ${setor.documentos} documento(s) de ${setor.nome} deixarão de aparecer no Início e no Repositório para todos os usuários.`
          : `${setor.nome} deixará de aparecer no cadastro de novos documentos.`
        : setor.documentos > 0
          ? `Os ${setor.documentos} documento(s) de ${setor.nome} voltarão a aparecer no Início e no Repositório.`
          : `${setor.nome} voltará a aparecer no cadastro de novos documentos.`,
      detalhe: desativar && setor.documentos > 0
        ? 'Nada é apagado: os documentos continuam salvos, visíveis só em Gerenciar documentos, e voltam ao ativar o setor.'
        : undefined,
      textoConfirmar: desativar ? 'Desativar' : 'Ativar',
      perigo: desativar,
    });
    if (!ok) return;

    setProcessandoId(setor.id);
    try {
      await definirSetorAtivo(setor.id, !setor.ativo);
      notificar('sucesso', desativar ? `${setor.nome} desativado.` : `${setor.nome} ativado.`);
      await carregar();
    } catch (error) {
      notificar('erro', error.message || 'Não foi possível alterar o setor.');
    } finally {
      setProcessandoId(null);
    }
  }

  async function excluir(setor) {
    if (temVinculo(setor)) {
      notificar(
        'aviso',
        `${setor.nome} não pode ser excluído porque tem ${ondeEstaoVinculos(setor)}. Desative o setor para ocultá-lo sem apagar nada.`,
        { titulo: 'Setor em uso' },
      );
      return;
    }

    const ok = await confirmar({
      titulo: 'Excluir setor',
      mensagem: `O setor ${setor.nome} será excluído.`,
      detalhe: 'Ele não tem documentos nem registros. Esta ação não pode ser desfeita.',
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
    <>
      <div className="st-filtros" role="group" aria-label="Filtrar setores">
        <span className="st-filtros__rotulo">Mostrar:</span>
        <label>
          <input type="checkbox" checked={verAtivos} onChange={(e) => setVerAtivos(e.target.checked)} />
          Ativos <b className="numero">{totalAtivos}</b>
        </label>
        <label>
          <input type="checkbox" checked={verDesativados} onChange={(e) => setVerDesativados(e.target.checked)} />
          Desativados <b className="numero">{totalDesativados}</b>
        </label>
        <span className="st-filtros__info" aria-live="polite">
          {filtrando ? `Mostrando ${visiveis.length} de ${setores.length}` : `Mostrando todos (${setores.length})`}
        </span>
      </div>

      <div className="st-grade">
        <NovoSetor onCriado={carregar} />

        {loading && setores.length === 0 ? (
          <p className="st-vazio">Carregando setores...</p>
        ) : visiveis.length === 0 ? (
          <p className="st-vazio">
            {setores.length === 0 ? 'Nenhum setor cadastrado ainda.' : 'Nenhum setor neste filtro.'}
          </p>
        ) : (
          visiveis.map((setor) => {
            const processando = processandoId === setor.id;
            const emEdicao = editando.id === setor.id;
            const emUso = temVinculo(setor);

            return (
              <article key={setor.id} className={`st-card${setor.ativo ? '' : ' off'}`} aria-label={setor.nome}>
                <div className="st-card__topo">
                  {!emEdicao && <span className="st-card__icone" aria-hidden="true"><FiFolder /></span>}

                  {emEdicao ? (
                    <form
                      className="st-card__nome st-card__edicao"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void salvarNome(setor);
                      }}
                    >
                      <input
                        className="form-control"
                        value={editando.nome}
                        onChange={(e) => setEditando({ id: setor.id, nome: e.target.value.toLocaleUpperCase('pt-BR') })}
                        onKeyDown={(e) => e.key === 'Escape' && setEditando({ id: null, nome: '' })}
                        maxLength={60}
                        autoFocus
                        aria-label={`Novo nome para ${setor.nome}`}
                      />
                      <BotaoSalvar rotulo="Salvar nome" disabled={processando} />
                      <BotaoCancelar onClick={() => setEditando({ id: null, nome: '' })} />
                    </form>
                  ) : (
                    <div className="st-card__nome">
                      <strong title={setor.nome}>{setor.nome}</strong>
                      <span className="st-card__situacao">{setor.ativo ? 'Ativo' : 'Desativado'}</span>
                    </div>
                  )}
                </div>

                <p className={`st-card__docs numero${emUso ? '' : ' zero'}`}>{textoVinculos(setor)}</p>

                <div className="st-card__rodape">
                  <button
                    type="button"
                    className="st-chave"
                    role="switch"
                    aria-checked={setor.ativo}
                    onClick={() => alternarAtivo(setor)}
                    disabled={processando}
                  >
                    <span className="st-chave__trilho" aria-hidden="true" />
                    {setor.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                  <BotaoEditar
                    rotulo={`Editar ${setor.nome}`}
                    dica="Editar nome"
                    onClick={() => setEditando({ id: setor.id, nome: setor.nome })}
                    disabled={processando || emEdicao}
                  />
                  <BotaoExcluir
                    rotulo={`Excluir ${setor.nome}`}
                    dica={emUso ? `Em uso (${textoVinculos(setor)}): só pode ser desativado` : 'Excluir setor'}
                    travado={emUso}
                    onClick={() => excluir(setor)}
                    disabled={processando}
                  />
                </div>
              </article>
            );
          })
        )}
      </div>
    </>
  );
}

function SetoresAdmin() {
  return (
    <AppLayout titulo="Administração">
      <header className="page-header">
        <div>
          <h1>Gerenciar setores</h1>
          <p>Crie, edite, ative ou exclua os setores.</p>
        </div>
      </header>

      <SetoresConteudo />
    </AppLayout>
  );
}

export default SetoresAdmin;
