export type RouteOnboardingIcon =
  | "dashboard"
  | "leads"
  | "distribution"
  | "conversations"
  | "clients"
  | "documents"
  | "tasks"
  | "calendar"
  | "sales"
  | "finance"
  | "team"
  | "branches"
  | "reports"
  | "goals"
  | "settings"
  | "integrity"
  | "guide";

export type RouteOnboardingDefinition = {
  key: string;
  match: (pathname: string) => boolean;
  title: string;
  description: string;
  eyebrow: string;
  icon: RouteOnboardingIcon;
  tip: string;
};

const route = (
  key: string,
  paths: string[],
  title: string,
  description: string,
  icon: RouteOnboardingIcon,
  tip: string,
): RouteOnboardingDefinition => ({
  key,
  match: (pathname) => paths.some((path) => pathname === path || pathname.startsWith(`${path}/`)),
  title,
  description,
  eyebrow: "Primeira visita",
  icon,
  tip,
});

export const routeOnboardingDefinitions: readonly RouteOnboardingDefinition[] = [
  route("dashboard", ["/dashboard", "/diretor/resume", "/gestor", "/corretor/resumo"], "Seu painel de comando", "Veja o que merece sua atenção agora e comece o dia com uma visão clara da operação.", "dashboard", "Use os indicadores como atalhos: cada número leva para uma ação real.") ,
  route("lead-distribution", ["/leads/distribuicao", "/leads/distribuicao/plantao"], "Distribuição sob controle", "Acompanhe filas, disponibilidade e plantões para que cada lead chegue à pessoa certa.", "distribution", "Filtros de unidade e status ajudam a investigar gargalos sem navegar por várias telas."),
  route("leads", ["/leads"], "Leads sem perder o fio", "Organize sua carteira, acompanhe o funil e encontre rapidamente o próximo atendimento.", "leads", "Abra um lead para ver histórico, tarefas e próximos passos no mesmo contexto."),
  route("my-queue", ["/minha-fila"], "Sua fila de atendimento", "Priorize os leads atribuídos a você e dê visibilidade ao que precisa de contato.", "leads", "Comece pelos itens com SLA mais próximo do vencimento."),
  route("conversations", ["/conversas"], "Conversas que viram atendimento", "Centralize o contexto do cliente, registre o que aconteceu e siga a conversa até o próximo passo.", "conversations", "O painel lateral mantém resumo, tags e ações disponíveis enquanto você conversa."),
  route("clients", ["/clientes"], "Relacionamentos ativos", "Encontre clientes, acompanhe a carteira e mantenha o histórico pós-venda acessível.", "clients", "Use o responsável e a unidade para localizar rapidamente quem cuida de cada cliente."),

  route("documents", ["/documentos", "/checklist"], "Documentação no ritmo certo", "Acompanhe pendências, envie arquivos e revise documentos sem perder a etapa da venda.", "documents", "Rejeições sempre ficam registradas com o motivo e o próximo passo."),
  route("tasks", ["/tarefas"], "Próximas ações visíveis", "Transforme combinados em tarefas com prazo, prioridade e responsável definidos.", "tasks", "Vincule a tarefa ao lead para voltar ao contexto em um clique."),
  route("sales", ["/vendas"], "Vendas com rastreabilidade", "Consulte vendas registradas, evidências e o caminho que levou cada negócio até aqui.", "sales", "Use o responsável e a unidade para separar a operação em cenários maiores."),
  route("finance", ["/financeiro", "/financeiro/comissoes", "/configuracoes/comissoes"], "Financeiro que explica", "Veja repasses, comissões e regras com clareza sobre o que foi previsto, pago ou está pendente.", "finance", "Os dados exibidos respeitam seu papel e o escopo das unidades autorizadas."),
  route("team", ["/equipe", "/equipe/convidar"], "Uma equipe alinhada", "Gerencie acessos, cargos e disponibilidade mantendo cada pessoa na unidade correta.", "team", "Permissões e unidade são coisas diferentes: confira ambos antes de salvar."),
  route("branches", ["/filiais", "/unidades"], "Cada unidade no lugar", "Acompanhe filiais, status operacional e o contexto que organiza sua corretora.", "branches", "Diretores veem a rede; gestores trabalham apenas dentro do escopo autorizado."),
  route("reports", ["/relatorios"], "Decisões com contexto", "Compare operação, conversão e produtividade sem perder o responsável por trás dos números.", "reports", "Aplique filtros de período e unidade para transformar o panorama em decisão."),
  route("goals", ["/metas", "/minha-meta"], "Metas que movimentam a operação", "Defina objetivos, acompanhe progresso e entenda quais ações aproximam o resultado.", "goals", "O progresso é calculado a partir dos registros reais do sistema."),
  route("notifications", ["/notificacoes"], "Nada importante passa despercebido", "Reúna alertas e atualizações em um só lugar para agir no momento certo.", "conversations", "Marque como lida depois de decidir o próximo passo, não apenas para limpar a tela."),
  route("settings", ["/settings", "/settings/whatsapp", "/assinatura"], "Seu espaço, do seu jeito", "Ajuste preferências pessoais e integrações disponíveis sem sair do ambiente CorreTop.", "settings", "Configurações da corretora e configurações pessoais aparecem separadas por permissão."),
  route("integrity", ["/integridade", "/noc"], "Confiança construída nos detalhes", "Monitore integridade, eventos e sinais que ajudam a manter a operação segura e previsível.", "integrity", "Quando algo exigir atenção, abra o registro para ver evidência e responsável."),
  route("guide", ["/guia", "/roadmap"], "Aprenda no contexto", "Consulte orientações do produto, decisões e próximos passos da plataforma sem sair do fluxo.", "guide", "O conteúdo é vivo e acompanha a evolução das capacidades do CorreTop."),
];

export function getRouteOnboardingDefinition(pathname: string) {
  return routeOnboardingDefinitions.find((definition) => definition.match(pathname)) ?? null;
}
