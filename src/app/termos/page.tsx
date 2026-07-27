import type { Metadata } from "next";
import Link from "next/link";

import { CorreTopLogo } from "@/components/corretop-logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Termos de uso e responsabilidade | CorreTop",
  description: "Termos gerais de uso, responsabilidade e proteção de dados do CRM CorreTop.",
};

const sections = [
  { id: "aceite", title: "1. Aceite e escopo", content: "Ao acessar o CorreTop, a corretora contratante e os usuários por ela autorizados concordam em utilizar o CRM exclusivamente para atividades comerciais, operacionais e administrativas compatíveis com sua contratação. Estes termos complementam o contrato aplicável e não substituem condições comerciais ou instrumentos específicos firmados entre as partes." },
  { id: "acesso", title: "2. Acesso e segurança", content: "Cada acesso é individual. A corretora é responsável por cadastrar somente pessoas autorizadas, definir papéis compatíveis com a função de cada usuário, proteger senhas e comunicar imediatamente qualquer suspeita de uso indevido. É proibido compartilhar credenciais, tentar acessar dados de outra corretora ou contornar controles de segurança." },
  { id: "uso-permitido", title: "3. Uso permitido do CRM", content: "O CorreTop organiza leads, atendimentos, documentos, cotações, vendas, comissões e rotinas de equipe. A plataforma não atua como corretora, operadora de saúde, consultoria jurídica ou financeira e não garante contratação, aprovação de proposta, cobertura, preço, comissão ou resultado comercial." },
  { id: "responsabilidades", title: "4. Responsabilidades da corretora", content: "A corretora responde pela origem legítima dos contatos, pelo conteúdo inserido no CRM, pelas comunicações enviadas a clientes e pela conferência das informações comerciais antes de apresentar uma cotação ou concluir uma venda. Também deve manter os dados corretos, atualizados e limitados ao necessário para sua operação." },
  { id: "privacidade", title: "5. Privacidade e proteção de dados", content: "O tratamento de dados pessoais deve observar a legislação aplicável, inclusive a LGPD. Cada corretora deve definir e documentar sua base legal, informar os titulares quando necessário, atender solicitações de direitos e limitar o acesso de sua equipe. Dados pessoais e informações de saúde exigem cuidado reforçado, finalidade legítima e acesso restrito ao trabalho necessário." },
  { id: "integracoes", title: "6. Integrações e comunicações", content: "Integrações, webhooks e canais de mensageria só podem ser utilizados com autorização adequada e em conformidade com as regras do fornecedor e da legislação. A corretora não deve usar o CRM para spam, mensagens ilícitas, conteúdo discriminatório, tentativas de fraude ou comunicação sem fundamento legítimo." },
  { id: "disponibilidade", title: "7. Disponibilidade e continuidade", content: "O CorreTop adota medidas técnicas e operacionais para manter a plataforma disponível e segura, mas serviços digitais podem sofrer manutenção, indisponibilidade temporária ou dependência de serviços de terceiros. A corretora deve manter processos internos de conferência e não pode depender do CRM como única fonte para decisões críticas sem validação humana." },
  { id: "suspensao", title: "8. Medidas diante de uso indevido", content: "O acesso poderá ser limitado, suspenso ou investigado quando houver indício de violação destes termos, risco à segurança, tratamento irregular de dados, tentativa de fraude ou descumprimento contratual. Registros técnicos e de auditoria podem ser utilizados para proteção da plataforma e apuração de incidentes." },
  { id: "atualizacoes", title: "9. Atualizações e contato", content: "Esta página pode ser atualizada para refletir evolução do produto, requisitos legais ou ajustes operacionais. Para dúvidas sobre dados de clientes, o titular deve procurar primeiro a corretora responsável pelo atendimento. O canal oficial de privacidade e a identificação jurídica da contratada serão informados no instrumento contratual e na política definitiva aplicável." },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-background/95">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link aria-label="Voltar à página inicial do CorreTop" className="flex items-center" href="/"><CorreTopLogo className="h-7 w-28 object-contain object-left" /></Link>
          <Link className="text-sm font-medium text-primary hover:underline" href="/login">Acessar plataforma</Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 lg:py-14">
        <section className="max-w-3xl">
          <p className="text-xs font-medium text-primary">CORRETOP CRM</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Termos de uso e responsabilidade</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">Diretrizes gerais para o uso responsável do CRM por corretoras, gestores, corretores e demais usuários autorizados.</p>
        </section>

        <Card className="border-primary/20 bg-primary/[0.04] shadow-none">
          <CardHeader><CardTitle>Versão operacional — 16 de julho de 2026</CardTitle><CardDescription>Este conteúdo explica o funcionamento esperado da plataforma. A versão contratual definitiva deve ser revisada pelo jurídico responsável, com razão social, contato de privacidade e política de retenção aplicáveis.</CardDescription></CardHeader>
        </Card>

        <nav aria-label="Índice dos termos" className="rounded-xl border bg-card p-4 sm:p-5">
          <p className="text-sm font-medium">Nesta página</p>
          <ol className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">{sections.map((section) => <li key={section.id}><a className="hover:text-primary hover:underline" href={`#${section.id}`}>{section.title}</a></li>)}</ol>
        </nav>

        <section className="grid gap-4" aria-label="Conteúdo dos termos">
          {sections.map((section) => <Card className="border-border bg-card shadow-none" id={section.id} key={section.id}><CardContent className="p-5 sm:p-6"><h2 className="text-lg font-semibold tracking-tight">{section.title}</h2><p className="mt-2 leading-7 text-muted-foreground">{section.content}</p></CardContent></Card>)}
        </section>

        <footer className="border-t pt-6 text-sm text-muted-foreground"><p>Ao continuar usando o CorreTop, o usuário declara que leu estas diretrizes e atua em nome ou com autorização da corretora responsável.</p><Link className="mt-3 inline-flex font-medium text-primary hover:underline" href="/login">Voltar para o login</Link></footer>
      </div>
    </main>
  );
}
