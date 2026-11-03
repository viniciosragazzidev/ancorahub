// Regras para a extensão nunca rolar a página do WhatsApp Web. A página usa overflow oculto em contêineres:
// focus(), scrollIntoView() e um elemento que estoura a barra fazem o navegador rolar esses contêineres
// e a tela sai do lugar (piloto 03/11). Por isso: focus sem rolar, rolagem só dentro da lista da gaveta.

/** Foco sem rolar: quem chama nunca move a tela do WhatsApp. */
export function focarSemRolar(elemento: HTMLElement) {
  elemento.focus({ preventScroll: true });
}

/** Cabe na seção sem estourar? Se não couber, o chamador não insere o elemento. */
export function cabeNaSecao(secao: Element): boolean {
  return secao.scrollHeight <= secao.clientHeight + 1 && secao.scrollWidth <= secao.clientWidth + 1;
}

/** Centraliza o item só dentro da lista (nunca rola o documento). */
export function centralizarNaLista(lista: HTMLElement, item: HTMLElement) {
  const deslocamento = item.getBoundingClientRect().top - lista.getBoundingClientRect().top
    - (lista.clientHeight - item.offsetHeight) / 2;
  lista.scrollTop = Math.max(0, lista.scrollTop + deslocamento);
}
