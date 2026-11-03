import { useEffect, useState } from "react";
import type { Temperatura } from "../shared/types";
import type { ResultadoAberturaOferta } from "./ofertas";

/** Lead atribuído ao corretor que ainda não teve o atendimento iniciado. */
export type LeadAguardandoInicio = { id: string; primeiroNome: string; phoneMasked: string; temperatura: Temperatura; atribuidoEm: string | null };
export type ResultadoListaAguardando = { ok: true; leads: LeadAguardandoInicio[] } | { ok: false; retryAfter?: number };
export type ResultadoInicioLead =
  | { ok: true; phone: string; greeting: string; whatsappUrl: string }
  | { ok: false; message: string };
export type AcoesAguardando = {
  carregarAguardando(): Promise<ResultadoListaAguardando>;
  iniciarLead(leadId: string): Promise<ResultadoInicioLead>;
  abrirConversa(input: { phone: string; greeting: string }): Promise<ResultadoAberturaOferta>;
  abrirReserva(url: string): void;
};

type Tentativa = { phone: string; greeting: string; whatsappUrl: string; nome: string };

function temperatura(temperature: Temperatura) {
  return ({ quente: "Quente", morno: "Morno", frio: "Frio", "sem-dados": "Sem dados" })[temperature];
}

/** Leads do próprio corretor sem início: o servidor decide; a lista só mostra e chama o mesmo início do CRM. */
export function AguardandoInicio({ acoes, refreshKey, ativa }: { acoes: AcoesAguardando; refreshKey: number; ativa: boolean }) {
  const [leads, setLeads] = useState<LeadAguardandoInicio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [tentativa, setTentativa] = useState<Tentativa | null>(null);

  async function atualizar() {
    setCarregando(true);
    setErro("");
    let resultado: ResultadoListaAguardando;
    try { resultado = await acoes.carregarAguardando(); }
    catch {
      setErro("Não foi possível atualizar os leads aguardando início.");
      setCarregando(false);
      return;
    }
    if (!resultado.ok) {
      setErro(resultado.retryAfter ? `Aguarde ${resultado.retryAfter} segundos e tente de novo.` : "Não foi possível atualizar os leads aguardando início.");
      setCarregando(false);
      return;
    }
    setLeads(resultado.leads);
    setCarregando(false);
  }

  useEffect(() => { if (ativa) void atualizar(); }, [refreshKey, ativa]);

  async function abrir(dados: Tentativa) {
    setOcupado("abrir");
    let resultado: ResultadoAberturaOferta;
    try { resultado = await acoes.abrirConversa({ phone: dados.phone, greeting: dados.greeting }); }
    catch { resultado = { ok: false, reason: "OPEN_FAILED" }; }
    setOcupado(null);
    if (resultado.ok) {
      setTentativa(null);
      setMensagem(`Atendimento iniciado. Saudação preenchida para ${dados.nome}; revise antes de enviar.`);
    } else {
      setTentativa(dados);
      setMensagem("Atendimento iniciado. Não consegui confirmar a conversa no WhatsApp.");
    }
  }

  async function iniciar(lead: LeadAguardandoInicio) {
    setOcupado(lead.id);
    setMensagem("");
    let resultado: ResultadoInicioLead;
    try { resultado = await acoes.iniciarLead(lead.id); }
    catch { resultado = { ok: false, message: "Não foi possível iniciar agora. Tente novamente." }; }
    if (!resultado.ok) {
      setOcupado(null);
      setMensagem(resultado.message);
      // Outro corretor ou o CRM já iniciou: a lista se corrige sozinha.
      void atualizar();
      return;
    }
    setLeads((atuais) => atuais.filter((item) => item.id !== lead.id));
    await abrir({ phone: resultado.phone, greeting: resultado.greeting, whatsappUrl: resultado.whatsappUrl, nome: lead.primeiroNome });
  }

  return (
    <section className="secao secao-ofertas" aria-labelledby="titulo-aguardando">
      <header className="cabeca-ofertas">
        <h2 id="titulo-aguardando">Aguardando início</h2>
        <span className="contagem-ofertas" aria-label={`${leads.length} leads aguardando início`}>{leads.length}</span>
      </header>
      {carregando ? <p className="estado-ofertas" role="status">Buscando leads…</p> : null}
      {!carregando && erro ? <div className="estado-ofertas" role="alert"><p>{erro}</p><button className="seco" type="button" onClick={() => void atualizar()}>Tentar de novo</button></div> : null}
      {!carregando && !erro && leads.length === 0 ? <p className="estado-ofertas muted">Nenhum lead aguardando início.</p> : null}
      <ul className="lista-ofertas">
        {leads.map((lead) => (
          <li className="oferta" key={lead.id} data-lead-id={lead.id}>
            <div className="oferta-cabeca">
              <strong>{lead.primeiroNome}</strong>
              <span className="temperatura-oferta" data-t={lead.temperatura}>{temperatura(lead.temperatura)}</span>
            </div>
            <p className="oferta-contato">{lead.phoneMasked}</p>
            <div className="acoes-oferta">
              <button className="primario" type="button" disabled={Boolean(ocupado)} onClick={() => void iniciar(lead)}>
                {ocupado === lead.id ? "Iniciando…" : "Iniciar e abrir"}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {tentativa ? (
        <div className="retentar-abertura" role="status">
          <p>{mensagem}</p>
          <button className="seco" type="button" disabled={Boolean(ocupado)} onClick={() => void abrir(tentativa)}>Tentar abrir</button>
          <button className="link-reserva" type="button" onClick={() => acoes.abrirReserva(tentativa.whatsappUrl)}>Abrir link reserva</button>
        </div>
      ) : null}
      {mensagem && !tentativa ? <p className="estado-ofertas" role="status">{mensagem}</p> : null}
    </section>
  );
}
