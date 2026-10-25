import type { Metadata } from "next";
import Link from "next/link";

import { AncoraLogo } from "@/components/ancora-logo";
import "@/components/arc/venancor-scope.css";

import styles from "./termos.module.css";

export const metadata: Metadata = {
  title: "Termos de uso e responsabilidade | Âncora Corretora",
  description: "Termos gerais de uso, responsabilidade e proteção de dados do CRM Âncora Corretora.",
};

const sections = [
  { id: "aceite", title: "1. Aceite e escopo", content: "Ao acessar o CRM Âncora Corretora, a corretora contratante e os usuários por ela autorizados concordam em utilizar o sistema exclusivamente para atividades comerciais, operacionais e administrativas compatíveis com sua contratação. Estes termos complementam o contrato aplicável e não substituem condições comerciais ou instrumentos específicos firmados entre as partes." },
  { id: "acesso", title: "2. Acesso e segurança", content: "Cada acesso é individual. A corretora é responsável por cadastrar somente pessoas autorizadas, definir papéis compatíveis com a função de cada usuário, proteger senhas e comunicar imediatamente qualquer suspeita de uso indevido. É proibido compartilhar credenciais, tentar acessar dados de outra corretora ou contornar controles de segurança." },
  { id: "uso-permitido", title: "3. Uso permitido do CRM", content: "O CRM Âncora Corretora organiza leads, atendimentos, documentos, cotações, vendas, comissões e rotinas de equipe. A plataforma não atua como corretora, operadora de saúde, consultoria jurídica ou financeira e não garante contratação, aprovação de proposta, cobertura, preço, comissão ou resultado comercial." },
  { id: "responsabilidades", title: "4. Responsabilidades da corretora", content: "A corretora responde pela origem legítima dos contatos, pelo conteúdo inserido no CRM, pelas comunicações enviadas a clientes e pela conferência das informações comerciais antes de apresentar uma cotação ou concluir uma venda. Também deve manter os dados corretos, atualizados e limitados ao necessário para sua operação." },
  { id: "privacidade", title: "5. Privacidade e proteção de dados", content: "O tratamento de dados pessoais deve observar a legislação aplicável, inclusive a LGPD. Cada corretora deve definir e documentar sua base legal, informar os titulares quando necessário, atender solicitações de direitos e limitar o acesso de sua equipe. Dados pessoais e informações de saúde exigem cuidado reforçado, finalidade legítima e acesso restrito ao trabalho necessário." },
  { id: "integracoes", title: "6. Integrações e comunicações", content: "Integrações, webhooks e canais de mensageria só podem ser utilizados com autorização adequada e em conformidade com as regras do fornecedor e da legislação. A corretora não deve usar o CRM para spam, mensagens ilícitas, conteúdo discriminatório, tentativas de fraude ou comunicação sem fundamento legítimo." },
  { id: "disponibilidade", title: "7. Disponibilidade e continuidade", content: "A Âncora Corretora adota medidas técnicas e operacionais para manter a plataforma disponível e segura, mas serviços digitais podem sofrer manutenção, indisponibilidade temporária ou dependência de serviços de terceiros. A corretora deve manter processos internos de conferência e não pode depender do CRM como única fonte para decisões críticas sem validação humana." },
  { id: "suspensao", title: "8. Medidas diante de uso indevido", content: "O acesso poderá ser limitado, suspenso ou investigado quando houver indício de violação destes termos, risco à segurança, tratamento irregular de dados, tentativa de fraude ou descumprimento contratual. Registros técnicos e de auditoria podem ser utilizados para proteção da plataforma e apuração de incidentes." },
  { id: "atualizacoes", title: "9. Atualizações e contato", content: "Esta página pode ser atualizada para refletir evolução do produto, requisitos legais ou ajustes operacionais. Para dúvidas sobre dados de clientes, o titular deve procurar primeiro a corretora responsável pelo atendimento. O canal oficial de privacidade e a identificação jurídica da contratada serão informados no instrumento contratual e na política definitiva aplicável." },
];

/** Termos no visual Lite para todo mundo (Onda 8): o mesmo texto, as mesmas âncoras e os mesmos links. */
export default function TermsPage() {
  return (
    <main className={`arc-venancor ${styles.page}`}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link aria-label="Voltar à página inicial" className={styles.logoLink} href="/"><AncoraLogo className="h-7 w-28 object-contain object-left" /></Link>
          <Link className={styles.link} href="/login">Acessar plataforma</Link>
        </div>
      </header>

      <div className={styles.body}>
        <section className={styles.intro}>
          <h1 className={styles.title}>Termos de uso e responsabilidade</h1>
          <p className={styles.lead}>Diretrizes gerais para o uso responsável do CRM Âncora Corretora por corretoras, gestores, corretores e demais usuários autorizados.</p>
        </section>

        <section className={styles.note} aria-label="Versão">
          <h2 className={styles.noteTitle}>Versão operacional de 16 de julho de 2026</h2>
          <p className={styles.noteText}>Este conteúdo explica o funcionamento esperado da plataforma. A versão contratual definitiva deve ser revisada pelo jurídico responsável, com razão social, contato de privacidade e política de retenção aplicáveis.</p>
        </section>

        <nav aria-label="Índice dos termos" className={styles.card}>
          <h2 className={styles.cardTitle}>Nesta página</h2>
          <ol className={styles.index}>{sections.map((section) => <li key={section.id}><a className={styles.indexLink} href={`#${section.id}`}>{section.title}</a></li>)}</ol>
        </nav>

        <section className={styles.sections} aria-label="Conteúdo dos termos">
          {sections.map((section) => <article className={styles.card} id={section.id} key={section.id}><h2 className={styles.sectionTitle}>{section.title}</h2><p className={styles.sectionText}>{section.content}</p></article>)}
        </section>

        <footer className={styles.footer}><p>Ao continuar usando a plataforma, o usuário declara que leu estas diretrizes e atua em nome ou com autorização da corretora responsável.</p><Link className={styles.link} style={{ paddingInline: 0 }} href="/login">Voltar para o login</Link></footer>
      </div>
    </main>
  );
}
