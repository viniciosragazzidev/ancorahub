// Remove um arquivo temporário sem derrubar o build: falha na limpeza (ex.: EPERM no Windows) só gera aviso.
export async function removerTemporario(caminho, remover, avisar = (mensagem) => console.warn(mensagem)) {
  try {
    await remover(caminho);
    return true;
  } catch (erro) {
    avisar(`[extensão] Não foi possível remover o temporário ${caminho}: ${erro?.code ?? erro?.message ?? erro}`);
    return false;
  }
}
