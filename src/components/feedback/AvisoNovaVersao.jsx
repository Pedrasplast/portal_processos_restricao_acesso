import { useEffect, useState } from 'react';
import { FiRefreshCw } from 'react-icons/fi';

import { useNovaVersao } from '../../hooks/useNovaVersao';
import './AvisoNovaVersao.css';

/*
 * Aviso "Nova versão disponível". Aparece em todas as telas quando uma
 * atualização é publicada. "Atualizar" recarrega a página (o login
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
      <span className="aviso-versao__icone" aria-hidden="true">
        <FiRefreshCw />
      </span>
      <span className="aviso-versao__texto">
        <strong>Nova versão disponível</strong>
        <small>Atualize para ver as novidades.</small>
      </span>
      <span className="aviso-versao__acoes">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDispensada(true)}>
          Depois
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>
          Atualizar
        </button>
      </span>
    </div>
  );
}

export default AvisoNovaVersao;
