import { useMemo, useState } from 'react';
import { FiPlus, FiSearch, FiTag } from 'react-icons/fi';

import { BotaoEditar, BotaoExcluir } from '../../../../components/ui/BotaoAcao';
import { useFeedback } from '../../../../hooks/useFeedback';
import { useRegistros } from '../../../../hooks/useRegistros';
import { useSetores } from '../../../../hooks/useSetores';
import { useTemasRegistro } from '../../../../hooks/useTemasRegistro';
import { excluirRegistro } from '../../../../services/registrosService';
import {
  contarNoMes,
  contarSetoresDistintos,
  FILTROS_VAZIOS,
  filtrarRegistros,
  formatarDataRegistro,
  mesAtualISO,
  nomeDoMes,
  temFiltroAtivo,
} from '../../../../utils/registros';
import ArquivosRegistro from './ArquivosRegistro';
import CardIndicador from './CardIndicador';
import RegistroDialog from './RegistroDialog';
import TemasDialog from './TemasDialog';
import TextoRecolhivel from './TextoRecolhivel';

/* Administração > Registros: lista no formato da planilha + filtros. */
function RegistrosPanel() {
  const { notificar, confirmar } = useFeedback();
  const { registros, loading, erro, recarregar } = useRegistros();
  const { temas, recarregar: recarregarTemas } = useTemasRegistro();
  const { setores, loading: carregandoSetores } = useSetores();

  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [dialogo, setDialogo] = useState(null); // { tipo: 'registro', registro } | { tipo: 'temas' }
  const [excluindoId, setExcluindoId] = useState(null);

  const visiveis = useMemo(() => filtrarRegistros(registros, filtros), [registros, filtros]);

  /* Indicadores: contam o que está visível (respeitam busca e filtros). */
  const mesAtual = mesAtualISO();
  const noMes = useMemo(() => contarNoMes(visiveis, mesAtual), [visiveis, mesAtual]);
  const setoresComRegistro = useMemo(() => contarSetoresDistintos(visiveis), [visiveis]);
  const totalSetoresAtivos = setores.filter((s) => s.ativo).length;
  const filtrando = temFiltroAtivo(filtros);
  const carregando = loading || carregandoSetores;

  function mudarFiltro(campo, valor) {
    setFiltros((atual) => ({ ...atual, [campo]: valor }));
  }

  async function excluir(registro) {
    const qtd = registro.arquivos.length;
    const ok = await confirmar({
      titulo: 'Excluir registro',
      mensagem: `O registro de ${formatarDataRegistro(registro.data)} (${registro.tema?.nome}) será excluído.`,
      detalhe: qtd ? `${qtd} arquivo(s) também serão apagados. Esta ação não pode ser desfeita.` : 'Esta ação não pode ser desfeita.',
      textoConfirmar: 'Excluir registro',
      perigo: true,
    });
    if (!ok) return;

    setExcluindoId(registro.id);
    try {
      await excluirRegistro(registro);
      notificar('sucesso', 'Registro excluído.');
      await recarregar();
    } catch (error) {
      notificar('erro', error.message || 'Não foi possível excluir o registro.');
    } finally {
      setExcluindoId(null);
    }
  }

  async function aoSalvar() {
    setDialogo(null);
    await recarregar();
  }

  /* Renomear/desativar tema muda o que aparece na lista. */
  async function aoAlterarTemas() {
    await Promise.all([recarregarTemas(), recarregar()]);
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Registros</h1>
          <p>Reuniões, treinamentos e diagnósticos por setor, com ata, slides e demais arquivos.</p>
        </div>
        <div className="rg-cab-acoes">
          <button type="button" className="btn btn-secondary" onClick={() => setDialogo({ tipo: 'temas' })}>
            <FiTag /> Temas
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setDialogo({ tipo: 'registro', registro: null })}>
            <FiPlus /> Novo registro
          </button>
        </div>
      </header>

      {!carregando && registros.length > 0 && (
        <div className="rg-indicadores">
          <CardIndicador
            titulo="Registros"
            valor={visiveis.length}
            complemento={visiveis.length === 1 ? 'registro' : 'registros'}
            legenda={filtrando ? 'com os filtros atuais' : 'no total'}
            cor="marinho"
          />
          <CardIndicador
            titulo="Neste mês"
            valor={noMes}
            complemento={noMes === 1 ? 'registro' : 'registros'}
            legenda={nomeDoMes(mesAtual)}
            cor="verde"
          />
          <CardIndicador
            titulo="Setores com registro"
            valor={setoresComRegistro}
            complemento={`de ${totalSetoresAtivos}`}
            legenda={setoresComRegistro === 1 ? 'setor aparece nesta lista' : 'setores aparecem nesta lista'}
            cor="azul"
          />
        </div>
      )}

      <section className="painel rg-painel" aria-labelledby="rg-titulo">
        <h2 id="rg-titulo" className="sr-only">Lista de registros</h2>

        <div className="rg-filtros" role="search">
          <label className="campo-busca rg-filtros__busca">
            <FiSearch aria-hidden="true" />
            <span className="sr-only">Buscar</span>
            <input
              type="search"
              value={filtros.busca}
              onChange={(e) => mudarFiltro('busca', e.target.value)}
              placeholder="Buscar pauta, participante, arquivo..."
            />
          </label>

          <select className="form-control rg-filtros__select" value={filtros.setorId} onChange={(e) => mudarFiltro('setorId', e.target.value)} aria-label="Filtrar por setor">
            <option value="">Todos os setores</option>
            {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>

          <select className="form-control rg-filtros__select" value={filtros.temaId} onChange={(e) => mudarFiltro('temaId', e.target.value)} aria-label="Filtrar por tema">
            <option value="">Todos os temas</option>
            {temas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>

          {filtrando && (
            <button type="button" className="btn btn-ghost btn-sm rg-filtros__limpar" onClick={() => setFiltros(FILTROS_VAZIOS)}>
              Limpar filtros
            </button>
          )}
        </div>

        <p className="rg-contagem" aria-live="polite">
          {carregando ? 'Carregando...' : `${visiveis.length} de ${registros.length} registro(s)`}
        </p>

        {erro && (
          <div className="estado-erro rg-erro" role="alert">
            <span>{erro}</span>
            <button type="button" className="btn btn-secondary" onClick={recarregar}>Tentar novamente</button>
          </div>
        )}

        {!carregando && !erro && visiveis.length === 0 ? (
          <p className="rg-vazio">
            {filtrando ? 'Nenhum registro encontrado com esses filtros.' : 'Nenhum registro ainda. Clique em "Novo registro" para começar.'}
          </p>
        ) : (
          <div className="rg-tabela-wrap">
            <table className="rg-tabela">
              <thead>
                <tr>
                  <th scope="col">Setor(es)</th>
                  <th scope="col">Tema</th>
                  <th scope="col">Pauta</th>
                  <th scope="col">Participantes</th>
                  <th scope="col">Data</th>
                  <th scope="col">Registro</th>
                  <th scope="col"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((registro) => (
                  <tr key={registro.id}>
                    <td data-rotulo="Setor(es)">
                      <span className="rg-setores">
                        {registro.setores.map((s) => <span key={s.id} className="rg-setor">{s.nome}</span>)}
                      </span>
                    </td>
                    <td data-rotulo="Tema"><span className="rg-tema-tag">{registro.tema?.nome}</span></td>
                    <td data-rotulo="Pauta" className="rg-texto"><TextoRecolhivel texto={registro.pauta} linhas={3} /></td>
                    <td data-rotulo="Participantes" className="rg-texto"><TextoRecolhivel texto={registro.participantes} linhas={2} /></td>
                    <td data-rotulo="Data" className="numero rg-data">{formatarDataRegistro(registro.data)}</td>
                    <td data-rotulo="Registro"><ArquivosRegistro arquivos={registro.arquivos} /></td>
                    <td className="rg-acoes">
                      <div className="rg-acoes__botoes">
                        <BotaoEditar
                          rotulo="Editar registro"
                          onClick={() => setDialogo({ tipo: 'registro', registro })}
                          disabled={excluindoId === registro.id}
                        />
                        <BotaoExcluir
                          rotulo="Excluir registro"
                          onClick={() => excluir(registro)}
                          disabled={excluindoId === registro.id}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {dialogo?.tipo === 'registro' && (
        <RegistroDialog
          registro={dialogo.registro}
          setores={setores}
          temas={temas}
          onFechar={() => setDialogo(null)}
          onSalvo={aoSalvar}
        />
      )}

      {dialogo?.tipo === 'temas' && (
        <TemasDialog temas={temas} onFechar={() => setDialogo(null)} onAlterado={aoAlterarTemas} />
      )}
    </>
  );
}

export default RegistrosPanel;
