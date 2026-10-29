import { useEffect, useState } from 'react';
import { FiRefreshCw, FiX } from 'react-icons/fi';

import { useNovaVersao } from '../../hooks/useNovaVersao';
import './AvisoNovaVersao.css';

/*
 * Faixa "Nova versão disponível". Aparece em todas as telas quando uma
 * atualização é publicada. "Atualizar agora" recarrega a página (o login
 * continua). "Depois" esconde até a pessoa sair e voltar para a aba.
 */
function AvisoNovaVersao() {
  const novaVersao = useNovaVersao();
  const [dispensada, setDispensada] = useState(false);

  useEffect(() => {
    const aoVoltar = () => document.visibilityState === 'visible' && setDispensada(false);
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, []);

  if (!novaVersao || dispensada) return null;

  return (
    <div className="aviso-versao" role="status">
      <FiRefreshCw className="aviso-versao__icone" aria-hidden="true" />
      <span className="aviso-versao__texto">
        <strong>Nova versão do portal disponível.</strong> Atualize para ver as novidades.
      </span>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>
        Atualizar agora
      </button>
      <button
        type="button"
        className="aviso-versao__fechar"
        onClick={() => setDispensada(true)}
        aria-label="Lembrar depois"
        title="Lembrar depois"
      >
        <FiX />
      </button>
    </div>
  );
}

export default AvisoNovaVersao;
