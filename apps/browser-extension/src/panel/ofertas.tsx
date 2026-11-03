import { useEffect, useRef, useState } from "react";
import type { OfertaExtensao, Temperatura } from "../shared/types";

export type ResultadoListaOfertas = { ok: true; ofertas: OfertaExtensao[] } | { ok: false; retryAfter?: number };
export type ResultadoAceiteOferta =
  | { ok: true; phone: string; greeting: string; whatsappUrl: string }
  | { ok: false; error: string; message: string; retryAfter?: number };
export type ResultadoRecusaOferta =
  | { ok: true; alreadyDeclined: boolean; contaComoPulo: boolean; message: string }
  | { ok: false; error: string; message: string; retryAfter?: number };
export type ResultadoAberturaOferta = { ok: true } | { ok: false; reason: string };
export type AcoesOfertas = {
  carregar(): Promise<ResultadoListaOfertas>;
  aceitar(offerId: string): Promise<ResultadoAceiteOferta>;
  recusar(offerId: string): Promise<ResultadoRecusaOferta>;
  abrirConversa(input: { phone: string; greeting: string }): Promise<ResultadoAberturaOferta>;
  abrirReserva(url: string): void;
  lerSom(): Promise<boolean>;
  definirSom(enabled: boolean): void;
};

type TentativaAbertura = { phone: string; greeting: string; whatsappUrl: string; nome: string };

function contagem(expiresAt: string, agora: number) {
  const seconds = Math.max(0, Math.ceil((Date.parse(expiresAt) - agora) / 1000));
  if (!seconds) return "Prazo encerrado";
  if (seconds < 60) return `${seconds}s para vencer`;
  const minutes = Math.ceil(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
}

function temperatura(temperature: Temperatura) {
  return ({ quente: "Quente", morno: "Morno", frio: "Frio", "sem-dados": "Sem dados" })[temperature];
}

function mensagemErro(error: string, fallback: string) {
  if (error === "expired") return "O prazo terminou. Esta oferta não pode mais ser aceita.";
  if (["already_assigned", "already_resolved", "offer_not_found", "UNAVAILABLE", "NOT_FOUND"].includes(error)) return "Este lead já foi atribuído ou deixou de estar disponível.";
  if (error === "outside_duty") return "Esta oferta só pode ser aceita durante o plantão indicado.";
  if (error === "RATE_LIMITED") return "Muitas tentativas. Aguarde e tente de novo.";
  return fallback;
}

export function OfertasPendentes({ acoes, refreshKey, destacarOfferId, ativa }: { acoes: AcoesOfertas; refreshKey: number; destacarOfferId: string | null; ativa: boolean }) {
  const [ofertas, setOfertas] = useState<OfertaExtensao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [confirmarRecusa, setConfirmarRecusa] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState<TentativaAbertura | null>(null);
  const [agora, setAgora] = useState(Date.now());
  const [somAtivo, setSomAtivo] = useState(false);
  const listaRef = useRef<HTMLElement>(null);

  async function atualizar() {
    setCarregando(true);
    setErro("");
    let resultado: ResultadoListaOfertas;
    try { resultado = await acoes.carregar(); }
    catch {
      setErro("Não foi possível atualizar as ofertas.");
      setCarregando(false);
      return;
    }
    if (!resultado.ok) {
      setErro(resultado.retryAfter ? `Aguarde ${resultado.retryAfter} segundos e tente de novo.` : "Não foi possível atualizar as ofertas.");
      setCarregando(false);
      return;
    }
    setOfertas(resultado.ofertas);
    setCarregando(false);
  }

  useEffect(() => { if (ativa) void atualizar(); }, [refreshKey, ativa]);
  useEffect(() => {
    if (!ativa) return;
    const timer = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [ativa]);
  useEffect(() => { void acoes.lerSom().then(setSomAtivo).catch(() => setSomAtivo(false)); }, []);
  useEffect(() => {
    if (!destacarOfferId) return;
    const item = listaRef.current?.querySelector<HTMLElement>(`[data-offer-id="${CSS.escape(destacarOfferId)}"]`);
    item?.scrollIntoView({ block: "center" });
  }, [destacarOfferId, ofertas]);

  async function abrir(offerId: string, dados: TentativaAbertura) {
    setOcupada(offerId);
    let resultado: ResultadoAberturaOferta;
    try { resultado = await acoes.abrirConversa({ phone: dados.phone, greeting: dados.greeting }); }
    catch { resultado = { ok: false, reason: "OPEN_FAILED" }; }
    setOcupada(null);
    if (resultado.ok) {
      setTentativa(null);
      setMensagem(`Contato conferido. Saudação preenchida para ${dados.nome}; revise antes de enviar.`);
    } else {
      setTentativa(dados);
      setMensagem("Lead aceito. Não consegui confirmar a conversa no WhatsApp.");
    }
  }

  async function aceitar(oferta: OfertaExtensao) {
    if (oferta.foraDoPlantao || Date.parse(oferta.expiresAt) <= agora) return;
    setOcupada(oferta.id);
    setMensagem("");
    let resultado: ResultadoAceiteOferta;
    try { resultado = await acoes.aceitar(oferta.id); }
    catch {
      setOcupada(null);
      setMensagem("Não foi possível aceitar agora. Tente novamente.");
      return;
    }
    if (!resultado.ok) {
      setOcupada(null);
      setMensagem(mensagemErro(resultado.error, resultado.message));
      if (resultado.error === "expired" || resultado.error === "already_assigned" || resultado.error === "already_resolved") void atualizar();
      return;
    }
    setOfertas((atuais) => atuais.filter((item) => item.id !== oferta.id));
    await abrir(oferta.id, { phone: resultado.phone, greeting: resultado.greeting, whatsappUrl: resultado.whatsappUrl, nome: oferta.primeiroNome });
  }

  async function recusar(oferta: OfertaExtensao) {
    setOcupada(oferta.id);
    let resultado: ResultadoRecusaOferta;
    try { resultado = await acoes.recusar(oferta.id); }
    catch {
      setOcupada(null);
      setConfirmarRecusa(null);
      setMensagem("Não foi possível recusar agora. Tente novamente.");
      return;
    }
    setOcupada(null);
    setConfirmarRecusa(null);
    if (!resultado.ok) {
      setMensagem(mensagemErro(resultado.error, resultado.message));
      if (resultado.error === "expired" || resultado.error === "already_assigned" || resultado.error === "already_resolved") void atualizar();
      return;
    }
    setOfertas((atuais) => atuais.filter((item) => item.id !== oferta.id));
    setMensagem(resultado.message);
  }

  return (
    <section className="secao secao-ofertas" aria-labelledby="titulo-ofertas" ref={listaRef}>
      <header className="cabeca-ofertas">
        <h2 id="titulo-ofertas">Ofertas pendentes</h2>
        <span className="contagem-ofertas" aria-label={`${ofertas.length} ofertas`}>{ofertas.length}</span>
      </header>
      <div className="linha-ofertas">
        <p className="muted">Aceite e confira o contato antes de chamar.</p>
        <button className="som-ofertas" type="button" aria-pressed={somAtivo} onClick={() => { const proximo = !somAtivo; setSomAtivo(proximo); acoes.definirSom(proximo); }}>
          Som {somAtivo ? "ativo" : "desativado"}
        </button>
      </div>
      {carregando ? <p className="estado-ofertas" role="status">Buscando ofertas…</p> : null}
      {!carregando && erro ? <div className="estado-ofertas" role="alert"><p>{erro}</p><button className="seco" type="button" onClick={() => void atualizar()}>Tentar de novo</button></div> : null}
      {!carregando && !erro && ofertas.length === 0 ? <p className="estado-ofertas muted">Nenhuma oferta pendente.</p> : null}
      <ul className="lista-ofertas">
        {ofertas.map((oferta) => {
          const restante = Date.parse(oferta.expiresAt) - agora;
          const vence = restante <= 60_000;
          return (
            <li className="oferta" key={oferta.id} data-offer-id={oferta.id}>
              <div className="oferta-cabeca">
                <strong>{oferta.primeiroNome}</strong>
                <span className="temperatura-oferta" data-t={oferta.temperatura}>{temperatura(oferta.temperatura)}</span>
              </div>
              <p className="oferta-contato">{oferta.phoneMasked}</p>
              <p className="oferta-contexto">{oferta.plantao ? `Plantão ${oferta.plantao}` : "Oferta da fila"}</p>
              {oferta.foraDoPlantao ? <p className="aviso-plantao" role="status">Aceite disponível durante este plantão.</p> : null}
              <p className={`prazo-oferta${vence ? " urgente" : ""}`} role="timer" aria-label={`Prazo: ${contagem(oferta.expiresAt, agora)}`} aria-live="off">
                {contagem(oferta.expiresAt, agora)}
              </p>
              {confirmarRecusa === oferta.id ? (
                <div className="confirmar-recusa" role="alert">
                  <p>A recusa conta como pulo do plantão.</p>
                  <div className="acoes-oferta">
                    <button className="seco" type="button" disabled={ocupada === oferta.id} onClick={() => setConfirmarRecusa(null)}>Voltar</button>
                    <button className="perigo-oferta" type="button" disabled={ocupada === oferta.id} onClick={() => void recusar(oferta)}>Confirmar recusa</button>
                  </div>
                </div>
              ) : (
                <div className="acoes-oferta">
                  <button className="primario" type="button" disabled={Boolean(ocupada) || oferta.foraDoPlantao || restante <= 0} onClick={() => void aceitar(oferta)}>
                    {ocupada === oferta.id ? "Aceitando…" : oferta.foraDoPlantao ? "Fora do plantão" : "Aceitar e abrir"}
                  </button>
                  <button className="seco" type="button" disabled={Boolean(ocupada)} onClick={() => setConfirmarRecusa(oferta.id)}>Recusar</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {tentativa ? (
        <div className="retentar-abertura" role="status">
          <p>{mensagem}</p>
          <button className="seco" type="button" disabled={Boolean(ocupada)} onClick={() => void abrir("accepted", tentativa)}>Tentar abrir</button>
          <button className="link-reserva" type="button" onClick={() => acoes.abrirReserva(tentativa.whatsappUrl)}>Abrir link reserva</button>
        </div>
      ) : null}
      {mensagem && !tentativa ? <p className="estado-ofertas" role="status">{mensagem}</p> : null}
    </section>
  );
}
