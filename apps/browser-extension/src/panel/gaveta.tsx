import { useState } from "react";
import type { EstadoGaveta, LeadAmpliado, Temperatura } from "../shared/types";
import { chegadaTexto, dataCurta, formatarValor, iniciais, rotuloTemperatura } from "./formatos";

export type Objetivo = "ASK_MISSING_FIELD" | "CONTINUE_ATTENDANCE";

export type AcoesGaveta = {
  abrirNoCrm(leadId: string): void;
  respostas(lead: LeadAmpliado, objetivo: Objetivo): Promise<string[]>;
  inserir(texto: string): void;
  conectar(): void;
  tentarNovamente(): void;
  fechar(): void;
};

// Arco do anel por temperatura: fração do círculo preenchida (sem dados = só o trilho).
const FRACAO: Record<Temperatura, number> = { quente: 1, morno: 0.6, frio: 0.3, "sem-dados": 0 };
const RAIO = 24;
const PERIMETRO = 2 * Math.PI * RAIO;

function Anel({ temperatura }: { temperatura?: Temperatura }) {
  const t = temperatura ?? "sem-dados";
  const arco = PERIMETRO * FRACAO[t];
  return (
    <svg className="anel" viewBox="0 0 56 56" role="img" aria-label={`Temperatura: ${rotuloTemperatura(t)}`} data-t={t}>
      <circle className="trilho" cx="28" cy="28" r={RAIO} />
      <circle className="arco" cx="28" cy="28" r={RAIO} strokeLinecap="round" strokeDasharray={`${arco} ${PERIMETRO}`} transform="rotate(-90 28 28)" />
    </svg>
  );
}

function VisaoLead({ lead, acoes }: { lead: LeadAmpliado; acoes: AcoesGaveta }) {
  const [sugestoes, setSugestoes] = useState<string[] | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function sugerir(objetivo: Objetivo) {
    setOcupado(true);
    setSugestoes(await acoes.respostas(lead, objetivo));
    setOcupado(false);
  }

  const prazo = lead.proximoPasso?.prazo;
  return (
    <>
      <section className="identidade" aria-label="Lead">
        <span className="avatar" aria-hidden="true">{iniciais(lead.name)}</span>
        <div>
          <strong>{lead.name}</strong>
          <span>{lead.phoneMasked}</span>
        </div>
      </section>

      <section className="temperatura">
        <Anel temperatura={lead.temperatura} />
        <div>
          <span className="rotulo">Temperatura</span>
          <strong>{rotuloTemperatura(lead.temperatura)}</strong>
          <span className="muted">{lead.etapa}</span>
        </div>
      </section>

      <dl className="grade">
        <div><dt>Plano</dt><dd>{lead.plano ?? "—"}</dd></div>
        <div><dt>Vidas</dt><dd>{lead.vidas ?? "—"}</dd></div>
        <div><dt>Valor mensal</dt><dd>{formatarValor(lead.valorMensal)}</dd></div>
        <div><dt>Fila</dt><dd>{lead.fila ?? "—"}</dd></div>
        <div><dt>Plantão</dt><dd>{lead.plantao ?? "—"}</dd></div>
        <div><dt>Chegou</dt><dd>{chegadaTexto(lead.chegouEm)}</dd></div>
      </dl>

      <section className="bloco" aria-label="Próximo passo">
        <h2>Próximo passo</h2>
        <p>{lead.proximoPasso?.titulo ?? "Sem ação pendente"}</p>
        {prazo ? <span className="muted">{dataCurta(prazo)}</span> : null}
      </section>

      <section className="bloco" aria-label="Histórico">
        <h2>Histórico</h2>
        {lead.historico?.length ? (
          <ul>
            {lead.historico.slice(0, 5).map((item, indice) => (
              <li key={`${item.data}-${indice}`}><span>{item.tipo}</span><time>{dataCurta(item.data)}</time></li>
            ))}
          </ul>
        ) : (
          <p className="muted">Sem interações registradas.</p>
        )}
      </section>

      <section className="bloco" aria-label="Respostas rápidas">
        <h2>Respostas rápidas</h2>
        <div className="acoes">
          <button className="seco" type="button" disabled={ocupado} onClick={() => sugerir("ASK_MISSING_FIELD")}>Pedir dado</button>
          <button className="seco" type="button" disabled={ocupado} onClick={() => sugerir("CONTINUE_ATTENDANCE")}>Retomar conversa</button>
        </div>
        {sugestoes ? (
          sugestoes.length ? (
            <div className="sugestoes">
              {sugestoes.map((texto) => (
                <button key={texto} className="sugestao" type="button" onClick={() => acoes.inserir(texto)}>{texto}</button>
              ))}
            </div>
          ) : (
            <p className="muted">Não foi possível preparar uma sugestão agora.</p>
          )
        ) : null}
        <p className="dica">As sugestões só preenchem a mensagem. Você revisa e envia.</p>
      </section>

      <button className="primario" type="button" onClick={() => acoes.abrirNoCrm(lead.id)}>Abrir no CRM</button>
      <p className="dica">Nenhuma mensagem é enviada automaticamente.</p>
    </>
  );
}

function Conteudo({ estado, acoes }: { estado: EstadoGaveta; acoes: AcoesGaveta }) {
  switch (estado.tipo) {
    case "carregando":
      return (
        <>
          <p className="aviso" role="status">Carregando o lead…</p>
          <div className="esqueleto" aria-hidden="true" />
        </>
      );
    case "sem-lead":
      return <p className="aviso">Este contato não está entre os seus leads.</p>;
    case "sem-conexao":
      return (
        <>
          <p className="aviso">Conecte a extensão ao CRM para ver o contexto do lead.</p>
          <button className="primario" type="button" onClick={acoes.conectar}>Conectar ao CRM</button>
        </>
      );
    case "erro":
      return (
        <>
          <p className="aviso" role="alert">Não foi possível carregar agora.</p>
          <button className="seco" type="button" onClick={acoes.tentarNovamente}>Tentar de novo</button>
        </>
      );
    case "desligada":
      return <p className="aviso">Este recurso está desligado para a sua empresa.</p>;
    case "lead":
      return <VisaoLead lead={estado.lead} acoes={acoes} />;
  }
}

/** Gaveta direita no estilo "Dados do contato", com o Lite do corretor. Não envia nada sozinha. */
export function Gaveta({ estado, acoes }: { estado: EstadoGaveta; acoes: AcoesGaveta }) {
  return (
    <aside className="gaveta" aria-label="Resumo do lead">
      <header className="cabeca">
        <span className="marca" aria-hidden="true">A</span>
        <div className="titulo">
          <strong>AncoraHub</strong>
          <span>Contexto do atendimento</span>
        </div>
        <button className="fechar" type="button" aria-label="Fechar resumo" onClick={acoes.fechar}>×</button>
      </header>
      <div className="corpo">
        <Conteudo estado={estado} acoes={acoes} />
      </div>
    </aside>
  );
}
