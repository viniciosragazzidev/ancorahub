import { useState } from "react";
import type { EstadoGaveta, LeadAmpliado, Temperatura } from "../shared/types";
import { chegadaTexto, dataCurta, formatarValor, iniciais, rotuloTemperatura } from "./formatos";
import { AcoesLead, type PedidoAcao, type ResultadoAcao } from "./acoes-lead";

export type Objetivo = "ASK_MISSING_FIELD" | "CONTINUE_ATTENDANCE";

export type AcoesGaveta = {
  abrirNoCrm(leadId: string): void;
  respostas(lead: LeadAmpliado, objetivo: Objetivo): Promise<string[]>;
  inserir(texto: string): void;
  /** Envia uma ação ao CRM (etapa, nota, tarefa, lembrete). Devolve conflito quando a versão mudou. */
  acao(lead: LeadAmpliado, pedido: PedidoAcao): Promise<ResultadoAcao>;
  conectar(): void;
  tentarNovamente(): void;
  fechar(): void;
};

// Anel do avatar: fração do círculo preenchida por temperatura (sem dados = só o trilho).
const FRACAO: Record<Temperatura, number> = { quente: 1, morno: 0.6, frio: 0.3, "sem-dados": 0 };
const RAIO = 52;
const PERIMETRO = 2 * Math.PI * RAIO;

/** Avatar com as iniciais dentro do anel de temperatura, como o avatar do Lite. */
function AvatarComAnel({ nome, temperatura }: { nome: string; temperatura?: Temperatura }) {
  const t = temperatura ?? "sem-dados";
  const arco = PERIMETRO * FRACAO[t];
  return (
    <div className="avatar-grande" role="img" aria-label={`${nome}. Temperatura: ${rotuloTemperatura(t)}`} data-t={t}>
      <svg viewBox="0 0 112 112" aria-hidden="true">
        <circle className="trilho" cx="56" cy="56" r={RAIO} />
        <circle className="arco" cx="56" cy="56" r={RAIO} strokeLinecap="round" strokeDasharray={`${arco} ${PERIMETRO}`} transform="rotate(-90 56 56)" />
      </svg>
      <span className="iniciais" aria-hidden="true">{iniciais(nome)}</span>
    </div>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="campo">
      <dt>{rotulo}</dt>
      <dd>{valor}</dd>
    </div>
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
        <AvatarComAnel nome={lead.name} temperatura={lead.temperatura} />
        <strong>{lead.name}</strong>
        <span>{lead.phoneMasked}</span>
      </section>

      <section className="secao" aria-label="Situação">
        <dl className="campos">
          <Campo rotulo="Temperatura" valor={rotuloTemperatura(lead.temperatura)} />
          <Campo rotulo="Etapa" valor={lead.etapa} />
          <Campo rotulo="Plano" valor={lead.plano ?? "—"} />
          <Campo rotulo="Vidas" valor={lead.vidas !== undefined ? String(lead.vidas) : "—"} />
          <Campo rotulo="Valor mensal" valor={formatarValor(lead.valorMensal)} />
          <Campo rotulo="Fila" valor={lead.fila ?? "—"} />
          <Campo rotulo="Plantão" valor={lead.plantao ?? "—"} />
          <Campo rotulo="Chegou" valor={chegadaTexto(lead.chegouEm)} />
        </dl>
      </section>

      <section className="secao" aria-label="Próximo passo">
        <h2>Próximo passo</h2>
        <p className="valor">{lead.proximoPasso?.titulo ?? "Sem ação pendente"}</p>
        {prazo ? <span className="muted">{dataCurta(prazo)}</span> : null}
      </section>

      <section className="secao" aria-label="Histórico">
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

      <section className="secao" aria-label="Respostas rápidas">
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

      <AcoesLead lead={lead} acao={(pedido) => acoes.acao(lead, pedido)} />

      <div className="rodape">
        <button className="primario" type="button" onClick={() => acoes.abrirNoCrm(lead.id)}>Abrir no CRM</button>
        <p className="dica">Nenhuma mensagem é enviada automaticamente.</p>
      </div>
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
        <div className="bloco-aviso">
          <p className="aviso">Conecte a extensão ao CRM para ver o contexto do lead.</p>
          <button className="primario" type="button" onClick={acoes.conectar}>Conectar ao CRM</button>
        </div>
      );
    case "erro":
      return (
        <div className="bloco-aviso">
          <p className="aviso" role="alert">Não foi possível carregar agora.</p>
          <button className="seco" type="button" onClick={acoes.tentarNovamente}>Tentar de novo</button>
        </div>
      );
    case "desligada":
      return <p className="aviso">Este recurso está desligado para a sua empresa.</p>;
    case "indisponivel":
      return <p className="aviso" role="status">A extensão não está disponível para a sua conta agora. Fale com o seu gestor.</p>;
    case "lead":
      return <VisaoLead lead={estado.lead} acoes={acoes} />;
  }
}

/** Coluna "Dados do lead" no padrão do WhatsApp Web. Não envia nada sozinha. */
export function Gaveta({ estado, acoes }: { estado: EstadoGaveta; acoes: AcoesGaveta }) {
  return (
    <aside className="gaveta" aria-label="Dados do lead">
      <header className="cabeca">
        <button className="fechar" type="button" aria-label="Fechar dados do lead" onClick={acoes.fechar}>×</button>
        <strong>Dados do lead</strong>
      </header>
      <div className="corpo">
        <Conteudo estado={estado} acoes={acoes} />
      </div>
    </aside>
  );
}
