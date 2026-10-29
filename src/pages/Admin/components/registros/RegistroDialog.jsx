import { useEffect, useMemo, useRef, useState } from 'react';
import { FiSave, FiUploadCloud, FiX } from 'react-icons/fi';

import {
  ACCEPT_ARQUIVOS,
  LIMITE_ARQUIVO_MB,
  LIMITE_PARTICIPANTES,
  LIMITE_PAUTA,
  MAX_ARQUIVOS_POR_REGISTRO,
} from '../../../../config/registros';
import { useFeedback } from '../../../../hooks/useFeedback';
import { enviarArquivos, excluirArquivo, salvarRegistro } from '../../../../services/registrosService';
import { hojeISO, validarArquivo } from '../../../../utils/registros';
import { ArquivoRemovivel } from './ArquivosRegistro';

/*
 * Janela "Novo registro" / "Editar registro".
 * Ordem ao salvar: registro + setores -> remove arquivos marcados -> envia novos.
 */
function RegistroDialog({ registro, setores, temas, onFechar, onSalvo }) {
  const { notificar } = useFeedback();
  const editando = Boolean(registro);

  const [temaId, setTemaId] = useState(registro?.tema?.id || '');
  const [data, setData] = useState(registro?.data || hojeISO());
  const [setorIds, setSetorIds] = useState(() => new Set(registro?.setores.map((s) => s.id) || []));
  const [pauta, setPauta] = useState(registro?.pauta || '');
  const [participantes, setParticipantes] = useState(registro?.participantes || '');
  const [removidos, setRemovidos] = useState(() => new Set());
  const [novos, setNovos] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const primeiroCampo = useRef(null);

  /* Ativos + os que já eram do registro ao abrir (mesmo se desativados). */
  const [setoresIniciais] = useState(() => new Set(registro?.setores.map((s) => s.id) || []));
  const setoresVisiveis = useMemo(
    () => setores.filter((s) => s.ativo || setoresIniciais.has(s.id)),
    [setores, setoresIniciais],
  );
  const temasVisiveis = temas.filter((t) => t.ativo || t.id === registro?.tema?.id);

  const existentes = registro?.arquivos.filter((a) => !removidos.has(a.id)) || [];
  const totalArquivos = existentes.length + novos.length;

  useEffect(() => {
    primeiroCampo.current?.focus();
    const aoTeclar = (event) => event.key === 'Escape' && !salvando && onFechar();
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onFechar, salvando]);

  function alternarSetor(id) {
    setSetorIds((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  function adicionarArquivos(event) {
    const escolhidos = Array.from(event.target.files || []);
    event.target.value = '';

    const erros = [];
    const validos = [];
    escolhidos.forEach((arquivo) => {
      const erro = validarArquivo(arquivo);
      if (erro) erros.push(erro);
      else validos.push(arquivo);
    });

    const vagas = MAX_ARQUIVOS_POR_REGISTRO - totalArquivos;
    if (validos.length > vagas) {
      erros.push(`Máximo de ${MAX_ARQUIVOS_POR_REGISTRO} arquivos por registro.`);
      validos.splice(Math.max(0, vagas));
    }

    if (erros.length) notificar('aviso', erros.join(' '));
    if (validos.length) setNovos((atual) => [...atual, ...validos]);
  }

  async function salvar(event) {
    event.preventDefault();
    if (!temaId) return notificar('aviso', 'Escolha o tema.');
    if (!data) return notificar('aviso', 'Informe a data.');
    if (setorIds.size === 0) return notificar('aviso', 'Escolha pelo menos um setor.');

    setSalvando(true);
    let registroId;
    try {
      registroId = await salvarRegistro({
        id: registro?.id || null,
        temaId,
        data,
        pauta,
        participantes,
        setorIds: [...setorIds],
      });
    } catch (error) {
      notificar('erro', error.message || 'Não foi possível salvar o registro.');
      setSalvando(false);
      return;
    }

    /* O registro já está salvo: daqui em diante, avisa o que falhou e fecha. */
    const problemas = [];

    for (const arquivo of registro?.arquivos.filter((a) => removidos.has(a.id)) || []) {
      try {
        await excluirArquivo(arquivo);
      } catch (error) {
        console.error(error);
        problemas.push(`não removeu ${arquivo.nome}`);
      }
    }

    const { falhas } = await enviarArquivos(registroId, novos);
    falhas.forEach((f) => problemas.push(`não enviou ${f.nome}`));

    if (problemas.length) {
      notificar('aviso', `Registro salvo, mas ${problemas.join('; ')}. Tente de novo em Editar.`);
    } else {
      notificar('sucesso', editando ? 'Registro atualizado.' : 'Registro criado.');
    }

    await onSalvo();
  }

  return (
    <div className="dialogo-fundo" onMouseDown={(e) => e.target === e.currentTarget && !salvando && onFechar()}>
      <form className="dialogo rg-dialogo" role="dialog" aria-modal="true" aria-labelledby="rg-dialogo-titulo" onSubmit={salvar}>
        <div className="rg-dialogo__cab">
          <h2 id="rg-dialogo-titulo">{editando ? 'Editar registro' : 'Novo registro'}</h2>
          <button type="button" className="btn btn-ghost btn-sm btn-icone" onClick={onFechar} aria-label="Fechar" disabled={salvando}>
            <FiX />
          </button>
        </div>

        <div className="rg-dialogo__corpo">
          <div className="rg-linha">
            <div className="form-group">
              <label htmlFor="rg-tema">Tema</label>
              <select
                id="rg-tema"
                ref={primeiroCampo}
                className="form-control"
                value={temaId}
                onChange={(e) => setTemaId(e.target.value)}
                disabled={salvando}
              >
                <option value="" disabled>Selecione o tema</option>
                {temasVisiveis.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome}{t.ativo ? '' : ' (desativado)'}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="rg-data">Data</label>
              <input
                id="rg-data"
                type="date"
                className="form-control"
                value={data}
                onChange={(e) => setData(e.target.value)}
                disabled={salvando}
              />
            </div>
          </div>

          <fieldset className="rg-setores-escolha" disabled={salvando}>
            <legend>Setor(es) <small>{setorIds.size ? `${setorIds.size} selecionado(s)` : ''}</small></legend>
            <div className="rg-setores-escolha__lista">
              {setoresVisiveis.map((s) => (
                <label key={s.id} className={`rg-chip${setorIds.has(s.id) ? ' marcado' : ''}${s.ativo ? '' : ' inativo'}`}>
                  <input type="checkbox" checked={setorIds.has(s.id)} onChange={() => alternarSetor(s.id)} />
                  <span>{s.nome}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="form-group">
            <label htmlFor="rg-pauta">Pauta <small className="rg-opcional">opcional</small></label>
            <textarea
              id="rg-pauta"
              className="form-control rg-textarea"
              value={pauta}
              onChange={(e) => setPauta(e.target.value)}
              maxLength={LIMITE_PAUTA}
              rows={3}
              disabled={salvando}
            />
          </div>

          <div className="form-group">
            <label htmlFor="rg-participantes">Participantes <small className="rg-opcional">opcional</small></label>
            <textarea
              id="rg-participantes"
              className="form-control rg-textarea"
              value={participantes}
              onChange={(e) => setParticipantes(e.target.value)}
              maxLength={LIMITE_PARTICIPANTES}
              rows={2}
              placeholder="Ex.: João, Maria, equipe do turno A"
              disabled={salvando}
            />
          </div>

          <div className="form-group">
            <span className="rg-rotulo">
              Registro (ata, slide, planilha, foto) <small className="rg-opcional">{totalArquivos}/{MAX_ARQUIVOS_POR_REGISTRO}</small>
            </span>

            {(existentes.length > 0 || novos.length > 0) && (
              <ul className="rg-arquivos rg-arquivos--form">
                {existentes.map((a) => (
                  <ArquivoRemovivel
                    key={a.id}
                    nome={a.nome}
                    tamanho={a.tamanho}
                    disabled={salvando}
                    onRemover={() => setRemovidos((atual) => new Set(atual).add(a.id))}
                  />
                ))}
                {novos.map((arquivo, indice) => (
                  <ArquivoRemovivel
                    key={`${arquivo.name}-${indice}`}
                    nome={arquivo.name}
                    tamanho={arquivo.size}
                    disabled={salvando}
                    onRemover={() => setNovos((atual) => atual.filter((_, i) => i !== indice))}
                  />
                ))}
              </ul>
            )}

            {totalArquivos < MAX_ARQUIVOS_POR_REGISTRO && (
              <label className="upload rg-upload">
                <FiUploadCloud aria-hidden="true" />
                <span>
                  <strong>Adicionar arquivos</strong>
                  <small>PDF, Word, PowerPoint, Excel, TXT ou foto · até {LIMITE_ARQUIVO_MB} MB cada</small>
                </span>
                <input
                  className="sr-only"
                  type="file"
                  multiple
                  accept={ACCEPT_ARQUIVOS}
                  onChange={adicionarArquivos}
                  disabled={salvando}
                />
              </label>
            )}
            {removidos.size > 0 && (
              <p className="form-ajuda">{removidos.size} arquivo(s) será(ão) apagado(s) ao salvar.</p>
            )}
          </div>
        </div>

        <div className="dialogo__acoes rg-dialogo__rodape">
          <button type="button" className="btn btn-secondary" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            <FiSave /> {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default RegistroDialog;
