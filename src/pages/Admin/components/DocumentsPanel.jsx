import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FiEdit2,
  FiFolder,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiUploadCloud,
  FiX,
} from 'react-icons/fi';
import { useSearchParams } from 'react-router-dom';

import { TIPOS_DOCUMENTO } from '../../../config/documentos';
import { useFeedback } from '../../../hooks/useFeedback';
import { useSetores } from '../../../hooks/useSetores';
import {
  excluirDocumento,
  publicarDocumento,
  renomearProcesso,
  substituirDocumento,
} from '../../../services/documentosService';
import { agruparDocumentos, obterNumeracaoDocumento } from '../../../utils/documentos';
import { normalizarChave } from '../../../utils/texto';

const COR_TIPO = {
  POP: 'var(--tipo-pop)',
  FLUXOGRAMA: 'var(--tipo-fluxograma)',
  MANUAL: 'var(--tipo-manual)',
};

const nomeTipo = (valor) => TIPOS_DOCUMENTO.find((t) => t.valor === valor)?.nome || valor;

function formatarData(valor) {
  if (!valor) return '';
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? '' : data.toLocaleDateString('pt-BR');
}

const tamanho = (bytes) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/* ------------------------------------------------------------------
   Janela "Novo processo": setor, descrição, tipo e PDF.
------------------------------------------------------------------- */
function NovoProcesso({ documentos, setoresAtivos, setorInicial, onFechar, onPublicado }) {
  const { notificar } = useFeedback();
  const [setor, setSetor] = useState(setorInicial || '');
  const [descricao, setDescricao] = useState('');
  const [tipo, setTipo] = useState('POP');
  const [arquivo, setArquivo] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const primeiroCampo = useRef(null);
  const campoDescricao = useRef(null);
  /* Aberto a partir de um setor: o setor já vem definido, sem lista. */
  const setorFixo = Boolean(setorInicial);

  const proximoCodigo = setor ? obterNumeracaoDocumento(documentos, setor).proximoCodigo : '--';

  useEffect(() => {
    (setorFixo ? campoDescricao : primeiroCampo).current?.focus();
    const aoTeclar = (event) => event.key === 'Escape' && !salvando && onFechar();
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onFechar, salvando, setorFixo]);

  async function publicar(event) {
    event.preventDefault();
    if (!setor) return notificar('aviso', 'Escolha o setor.');
    if (descricao.trim().length < 3) return notificar('aviso', 'Informe a descrição do processo (mínimo de 3 letras).');
    if (!arquivo) return notificar('aviso', 'Escolha o arquivo PDF.');

    setSalvando(true);
    try {
      const publicacao = await publicarDocumento({
        setor,
        tipoDocumento: tipo,
        codigo: proximoCodigo,
        descricao,
        arquivo,
      });
      notificar('sucesso', `Processo ${publicacao.titulo} criado com o ${nomeTipo(tipo)}.`);
      await onPublicado(setor);
    } catch (error) {
      notificar('erro', error.message || 'Não foi possível publicar o documento.');
      setSalvando(false);
    }
  }

  return (
    <div className="dialogo-fundo" onMouseDown={(e) => e.target === e.currentTarget && !salvando && onFechar()}>
      <form className="dialogo gd-novo" role="dialog" aria-modal="true" aria-labelledby="gd-novo-titulo" onSubmit={publicar}>
        <div className="gd-novo__cab">
          <h2 id="gd-novo-titulo">Novo processo</h2>
          <button type="button" className="btn btn-ghost btn-sm btn-icone" onClick={onFechar} aria-label="Fechar" disabled={salvando}>
            <FiX />
          </button>
        </div>

        <div className="gd-novo__corpo">
          {setorFixo ? (
            <div className="gd-novo__setor">
              <FiFolder aria-hidden="true" />
              <span>
                <small>Setor</small>
                <strong>{setor}</strong>
              </span>
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="gd-novo-setor">Setor</label>
              <select
                id="gd-novo-setor"
                ref={primeiroCampo}
                className="form-control"
                value={setor}
                onChange={(e) => setSetor(e.target.value)}
                disabled={salvando}
              >
                <option value="" disabled>Selecione o setor</option>
                {setoresAtivos.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
              </select>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="gd-novo-descricao">Descrição do processo</label>
            <div className="campo-descricao">
              <span className="campo-descricao__codigo numero" aria-label="Número automático">{proximoCodigo}</span>
              <input
                id="gd-novo-descricao"
                ref={campoDescricao}
                className="form-control"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value.toLocaleUpperCase('pt-BR'))}
                placeholder="EX.: TROCA DE MOLDE"
                maxLength={140}
                disabled={salvando}
              />
            </div>
            <p className="form-ajuda">O número é gerado automaticamente para o setor.</p>
          </div>

          <div className="form-group">
            <span className="gd-rotulo" id="gd-novo-tipo">Primeiro documento</span>
            <div className="tipo-escolha" role="radiogroup" aria-labelledby="gd-novo-tipo">
              {TIPOS_DOCUMENTO.map((t) => (
                <label
                  key={t.valor}
                  className={`tipo-escolha__opcao tipo--${t.valor.toLowerCase()}${tipo === t.valor ? ' marcada' : ''}`}
                >
                  <input
                    type="radio"
                    name="gd-novo-tipo"
                    value={t.valor}
                    checked={tipo === t.valor}
                    onChange={() => setTipo(t.valor)}
                    disabled={salvando}
                  />
                  <span>{t.nome}</span>
                </label>
              ))}
            </div>
          </div>

          <label className={`upload${arquivo ? ' com-arquivo' : ''}`}>
            <FiUploadCloud aria-hidden="true" />
            <span>
              <strong>{arquivo ? arquivo.name : 'Selecionar PDF'}</strong>
              <small>{arquivo ? tamanho(arquivo.size) : 'Somente PDF, até 20 MB'}</small>
            </span>
            <input
              className="sr-only"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setArquivo(e.target.files?.[0] || null)}
              disabled={salvando}
            />
          </label>
        </div>

        <div className="dialogo__acoes gd-novo__rodape">
          <button type="button" className="btn btn-secondary" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            <FiUploadCloud /> {salvando ? 'Publicando...' : 'Publicar'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------
   Janela "Editar processo": troca a descrição (o número não muda).
------------------------------------------------------------------- */
function EditarProcesso({ grupo, onFechar, onSalvo }) {
  const { notificar } = useFeedback();
  const [descricao, setDescricao] = useState(grupo.descricao || '');
  const [salvando, setSalvando] = useState(false);
  const campo = useRef(null);
  const qtdDocs = Object.keys(grupo.arquivos).length;

  useEffect(() => {
    campo.current?.focus();
    campo.current?.select();
    const aoTeclar = (event) => event.key === 'Escape' && !salvando && onFechar();
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onFechar, salvando]);

  async function salvar(event) {
    event.preventDefault();
    const nova = descricao.trim().replace(/\s+/g, ' ');
    if (nova.length < 3) return notificar('aviso', 'Informe a descrição do processo (mínimo de 3 letras).');
    if (nova === grupo.descricao) return onFechar();

    setSalvando(true);
    try {
      const titulo = await renomearProcesso(grupo, nova);
      notificar('sucesso', `Processo renomeado para ${titulo || nova}.`);
      await onSalvo();
    } catch (error) {
      notificar('erro', error.message || 'Não foi possível editar o processo.');
      setSalvando(false);
    }
  }

  return (
    <div className="dialogo-fundo" onMouseDown={(e) => e.target === e.currentTarget && !salvando && onFechar()}>
      <form className="dialogo gd-novo" role="dialog" aria-modal="true" aria-labelledby="gd-editar-titulo" onSubmit={salvar}>
        <div className="gd-novo__cab">
          <h2 id="gd-editar-titulo">Editar processo</h2>
          <button type="button" className="btn btn-ghost btn-sm btn-icone" onClick={onFechar} aria-label="Fechar" disabled={salvando}>
            <FiX />
          </button>
        </div>

        <div className="gd-novo__corpo">
          <div className="gd-novo__setor">
            <FiFolder aria-hidden="true" />
            <span>
              <small>Setor</small>
              <strong>{grupo.setor}</strong>
            </span>
          </div>

          <div className="form-group">
            <label htmlFor="gd-editar-descricao">Descrição do processo</label>
            <div className="campo-descricao">
              <span className="campo-descricao__codigo numero" aria-label="Número do processo">{grupo.codigo}</span>
              <input
                id="gd-editar-descricao"
                ref={campo}
                className="form-control"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value.toLocaleUpperCase('pt-BR'))}
                maxLength={140}
                disabled={salvando}
              />
            </div>
            <p className="form-ajuda">
              O número continua o mesmo. O novo nome vale para {qtdDocs === 1 ? 'o documento' : `os ${qtdDocs} documentos`} deste processo.
            </p>
          </div>
        </div>

        <div className="dialogo__acoes gd-novo__rodape">
          <button type="button" className="btn btn-secondary" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            <FiEdit2 /> {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------
   Gerenciar documentos: setores à esquerda, processos à direita.
------------------------------------------------------------------- */
function DocumentsPanel({ documentos, loading, erro, onReload }) {
  const { notificar, confirmar } = useFeedback();
  const { setores, ativos: setoresAtivos, loading: carregandoSetores } = useSetores();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busca, setBusca] = useState('');
  const [mostrarVazios, setMostrarVazios] = useState(false);
  const [ocupado, setOcupado] = useState(null);
  const [novo, setNovo] = useState(null);
  const [editando, setEditando] = useState(null);
  const inputArquivo = useRef(null);
  const acaoArquivo = useRef(null);

  const grupos = useMemo(() => agruparDocumentos(documentos), [documentos]);

  /* Situação de cada setor (todos os cadastrados + algum órfão). */
  const listaSetores = useMemo(() => {
    const mapa = new Map();
    setores.forEach((s) => mapa.set(normalizarChave(s.nome), { nome: s.nome, ativo: s.ativo, processos: 0, docs: 0 }));
    grupos.forEach((g) => {
      const chave = normalizarChave(g.setor);
      if (!mapa.has(chave)) mapa.set(chave, { nome: g.setor, ativo: true, processos: 0, docs: 0 });
      const item = mapa.get(chave);
      item.processos += 1;
      item.docs += Object.keys(g.arquivos).length;
    });
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [setores, grupos]);

  const comProcessos = listaSetores.filter((s) => s.processos > 0 || !s.ativo);
  const vazios = listaSetores.filter((s) => s.processos === 0 && s.ativo);

  const parametroSetor = searchParams.get('setor');
  const setorAtual =
    listaSetores.find((s) => normalizarChave(s.nome) === normalizarChave(parametroSetor || '')) ||
    comProcessos.find((s) => s.ativo) ||
    listaSetores[0] ||
    null;

  function escolherSetor(nome) {
    setBusca('');
    const params = new URLSearchParams(searchParams);
    params.set('setor', nome);
    setSearchParams(params, { replace: true });
  }

  const termo = normalizarChave(busca.trim());
  const processos = useMemo(() => {
    if (termo) {
      return grupos.filter((g) => normalizarChave(`${g.codigo} ${g.descricao} ${g.setor}`).includes(termo));
    }
    if (!setorAtual) return [];
    return grupos.filter((g) => normalizarChave(g.setor) === normalizarChave(setorAtual.nome));
  }, [grupos, termo, setorAtual]);

  const docsVisiveis = processos.reduce((soma, g) => soma + Object.keys(g.arquivos).length, 0);
  const setorDesativado = setorAtual && !setorAtual.ativo;
  const proximoCodigo = setorAtual ? obterNumeracaoDocumento(documentos, setorAtual.nome).proximoCodigo : '';

  function rotuloSetor(s) {
    if (!s.ativo) return { texto: 'desativado', classe: 'off' };
    if (s.processos === 0) return { texto: 'vazio', classe: '' };
    const faltando = s.processos * TIPOS_DOCUMENTO.length - s.docs;
    return faltando ? { texto: `${faltando} faltando`, classe: 'falta' } : { texto: 'completo', classe: 'ok' };
  }

  /* --- ações com arquivo (um único <input type=file> escondido) --- */

  function escolherArquivo(acao) {
    acaoArquivo.current = acao;
    if (inputArquivo.current) {
      inputArquivo.current.value = '';
      inputArquivo.current.click();
    }
  }

  async function aoEscolherArquivo(event) {
    const arquivo = event.target.files?.[0];
    const acao = acaoArquivo.current;
    acaoArquivo.current = null;
    if (!arquivo || !acao) return;

    if (acao.tipo === 'adicionar') await adicionar(acao.grupo, acao.tipoDoc, arquivo);
    if (acao.tipo === 'substituir') await substituir(acao.documento, acao.grupo, arquivo);
  }

  async function adicionar(grupo, tipoDoc, arquivo) {
    const ok = await confirmar({
      titulo: `Publicar ${nomeTipo(tipoDoc)}`,
      mensagem: `${arquivo.name} será publicado como ${nomeTipo(tipoDoc)} de ${grupo.titulo}.`,
      detalhe: `Setor ${grupo.setor}.`,
      textoConfirmar: 'Publicar',
    });
    if (!ok) return;

    setOcupado(`${grupo.id}:${tipoDoc}`);
    try {
      await publicarDocumento({
        setor: grupo.setor,
        tipoDocumento: tipoDoc,
        codigo: grupo.codigo,
        descricao: grupo.descricao,
        arquivo,
      });
      notificar('sucesso', `${nomeTipo(tipoDoc)} publicado em ${grupo.titulo}.`);
      await onReload();
    } catch (error) {
      notificar('erro', error.message || 'Não foi possível publicar o documento.');
    } finally {
      setOcupado(null);
    }
  }

  async function substituir(documento, grupo, arquivo) {
    const ok = await confirmar({
      titulo: 'Substituir PDF',
      mensagem: `O ${nomeTipo(documento.tipo)} de ${grupo.titulo} passará a ser ${arquivo.name}.`,
      detalhe: 'O arquivo anterior é apagado e a data de publicação é atualizada.',
      textoConfirmar: 'Substituir',
    });
    if (!ok) return;

    setOcupado(`${grupo.id}:${documento.tipo}`);
    try {
      await substituirDocumento(documento, arquivo);
      notificar('sucesso', `${nomeTipo(documento.tipo)} de ${grupo.titulo} substituído.`);
      await onReload();
    } catch (error) {
      notificar('erro', error.message || 'Não foi possível substituir o PDF.');
    } finally {
      setOcupado(null);
    }
  }

  async function excluir(documento, grupo) {
    const ok = await confirmar({
      titulo: 'Excluir documento',
      mensagem: `O ${nomeTipo(documento.tipo)} de ${grupo.titulo} será removido do repositório.`,
      detalhe: 'O PDF também é apagado. Esta ação não pode ser desfeita.',
      textoConfirmar: 'Excluir documento',
      perigo: true,
    });
    if (!ok) return;

    setOcupado(`${grupo.id}:${documento.tipo}`);
    try {
      await excluirDocumento(documento);
      notificar('sucesso', `${nomeTipo(documento.tipo)} excluído.`);
      await onReload();
    } catch (error) {
      notificar('erro', error.message || 'Não foi possível excluir o documento.');
    } finally {
      setOcupado(null);
    }
  }

  async function aoSalvarEdicao() {
    setEditando(null);
    await onReload();
  }

  function abrirNovo(setor) {
    if (setor && !setoresAtivos.some((n) => normalizarChave(n) === normalizarChave(setor))) {
      notificar('aviso', `O setor ${setor} está desativado. Reative-o em Setores para criar processos.`);
      return;
    }
    setNovo({ setor: setor || '' });
  }

  async function aoPublicarNovo(setor) {
    setNovo(null);
    await onReload();
    escolherSetor(setor);
  }

  const carregando = loading || carregandoSetores;

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Gerenciar documentos</h1>
          <p>Escolha o setor e publique, substitua ou exclua os PDFs de cada processo, ou edite o nome do processo.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => abrirNovo('')}>
          <FiPlus /> Novo processo
        </button>
      </header>

      <input
        ref={inputArquivo}
        className="sr-only"
        type="file"
        accept="application/pdf,.pdf"
        onChange={aoEscolherArquivo}
        tabIndex={-1}
        aria-hidden="true"
      />

      <div className="gd">
        {/* ---------------- setores ---------------- */}
        <section className="painel gd-setores" aria-labelledby="gd-setores-titulo">
          <div className="painel__cabecalho">
            <h2 id="gd-setores-titulo">Setores</h2>
          </div>

          <div className="gd-setores__busca">
            <label className="campo-busca">
              <FiSearch aria-hidden="true" />
              <span className="sr-only">Buscar processo</span>
              <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar processo" />
            </label>
          </div>

          <nav aria-label="Setores">
            <ul className="gd-setores__lista">
              {[...comProcessos, ...(mostrarVazios ? vazios : [])].map((s) => {
                const rotulo = rotuloSetor(s);
                const ativo = !termo && setorAtual?.nome === s.nome;
                return (
                  <li key={s.nome}>
                    <button
                      type="button"
                      className={`gd-setor${ativo ? ' ativo' : ''}${s.ativo ? '' : ' inativo'}`}
                      onClick={() => escolherSetor(s.nome)}
                      aria-current={ativo ? 'true' : undefined}
                    >
                      <FiFolder aria-hidden="true" />
                      <span>{s.nome}</span>
                      <b className={`gd-setor__rotulo ${rotulo.classe}`}>{rotulo.texto}</b>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {vazios.length > 0 && (
            <button type="button" className="gd-setores__mais" onClick={() => setMostrarVazios((v) => !v)}>
              {mostrarVazios ? 'Ocultar setores sem processos' : `+ ${vazios.length} ${vazios.length === 1 ? 'setor' : 'setores'} sem processos`}
            </button>
          )}
        </section>

        {/* ---------------- processos ---------------- */}
        <div className="gd-coluna">
          <section className="painel gd-conteudo" aria-labelledby="gd-titulo" aria-live="polite">
            <div className="painel__cabecalho gd-conteudo__cab">
              <h2 id="gd-titulo">
                {termo ? `Resultados para "${busca.trim()}"` : setorAtual?.nome || 'Setores'}
                <small className="numero">
                  {processos.length} {processos.length === 1 ? 'processo' : 'processos'}
                  {processos.length > 0 && `, ${docsVisiveis} de ${processos.length * TIPOS_DOCUMENTO.length} documentos`}
                </small>
              </h2>
              {!termo && setorAtual && !setorDesativado && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => abrirNovo(setorAtual.nome)}>
                  <FiPlus /> Processo neste setor
                </button>
              )}
            </div>

            {setorDesativado && !termo && (
              <div className="gd-aviso">
                Setor desativado: estes documentos não aparecem no Início nem no Repositório. Para publicar novos,
                reative o setor em Administração &gt; Setores.
              </div>
            )}

            {erro && (
              <div className="estado-erro gd-erro" role="alert">
                <span>{erro}</span>
                <button type="button" className="btn btn-secondary" onClick={onReload}>Tentar novamente</button>
              </div>
            )}

            <div className="gd-colunas" aria-hidden="true">
              <span>Processo</span>
              {TIPOS_DOCUMENTO.map((t) => <span key={t.valor}>{t.nome}</span>)}
            </div>

            {carregando ? (
              <p className="gd-vazio">Carregando documentos...</p>
            ) : processos.length === 0 ? (
              <p className="gd-vazio">
                {termo ? 'Nenhum processo encontrado.' : `Nenhum processo em ${setorAtual?.nome || 'este setor'} ainda.`}
              </p>
            ) : (
              <ul className="gd-processos">
                {processos.map((grupo) => (
                  <li key={grupo.id} className="gd-processo">
                    <div className="gd-processo__titulo">
                      <span className="gd-cod numero">{grupo.codigo}</span>
                      <span>
                        <strong>{grupo.descricao}</strong>
                        {termo && <small>{grupo.setor}</small>}
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-icone gd-processo__editar"
                        onClick={() => setEditando(grupo)}
                        disabled={Boolean(ocupado)}
                        aria-label={`Editar nome do processo ${grupo.titulo}`}
                        title="Editar nome do processo"
                      >
                        <FiEdit2 />
                      </button>
                    </div>

                    {TIPOS_DOCUMENTO.map((t) => {
                      const documento = grupo.arquivos[t.valor];
                      const chave = `${grupo.id}:${t.valor}`;
                      const emAndamento = ocupado === chave;

                      if (!documento) {
                        const setorGrupoAtivo = setoresAtivos.some(
                          (n) => normalizarChave(n) === normalizarChave(grupo.setor),
                        );
                        return (
                          <button
                            key={t.valor}
                            type="button"
                            className="gd-adicionar"
                            onClick={() => escolherArquivo({ tipo: 'adicionar', grupo, tipoDoc: t.valor })}
                            disabled={Boolean(ocupado) || !setorGrupoAtivo}
                            title={setorGrupoAtivo ? `Escolher o PDF do ${t.nome}` : 'Setor desativado'}
                          >
                            {emAndamento ? 'Publicando...' : <><FiPlus /> Adicionar {t.nome}</>}
                          </button>
                        );
                      }

                      return (
                        <div key={t.valor} className="gd-doc" style={{ '--cor-tipo': COR_TIPO[t.valor] }}>
                          <span className="gd-doc__info">
                            <b>{t.nome}</b>
                            <small>{emAndamento ? 'Processando...' : formatarData(documento.criado_em)}</small>
                          </span>
                          <span className="gd-doc__acoes">
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm btn-icone"
                              onClick={() => escolherArquivo({ tipo: 'substituir', documento, grupo })}
                              disabled={Boolean(ocupado)}
                              aria-label={`Substituir PDF do ${t.nome} de ${grupo.titulo}`}
                              title="Substituir PDF"
                            >
                              <FiRefreshCw />
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm btn-icone gd-doc__excluir"
                              onClick={() => excluir(documento, grupo)}
                              disabled={Boolean(ocupado)}
                              aria-label={`Excluir ${t.nome} de ${grupo.titulo}`}
                              title="Excluir"
                            >
                              <FiTrash2 />
                            </button>
                          </span>
                        </div>
                      );
                    })}
                  </li>
                ))}
              </ul>
            )}

            {!termo && setorAtual && !setorDesativado && !carregando && (
              <button type="button" className="gd-novo-linha" onClick={() => abrirNovo(setorAtual.nome)}>
                <span aria-hidden="true"><FiPlus /></span>
                Novo processo em {setorAtual.nome} (nº {proximoCodigo})
              </button>
            )}
          </section>

          <p className="gd-ajuda">
            Clique em &quot;Adicionar&quot; para escolher o PDF. O número do processo é gerado automaticamente.
          </p>
        </div>
      </div>

      {novo && (
        <NovoProcesso
          documentos={documentos}
          setoresAtivos={setoresAtivos}
          setorInicial={novo.setor}
          onFechar={() => setNovo(null)}
          onPublicado={aoPublicarNovo}
        />
      )}

      {editando && (
        <EditarProcesso
          grupo={editando}
          onFechar={() => setEditando(null)}
          onSalvo={aoSalvarEdicao}
        />
      )}
    </>
  );
}

export default DocumentsPanel;
