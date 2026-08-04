import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

// Ler o SVG da logo e converter para Data URI em Base64 para garantir a renderização cristalina no PDF
const logoSvgPath = path.join(process.cwd(), "public/logo.svg");
const logoSvgContent = fs.readFileSync(logoSvgPath, "utf8");

const startIdx = logoSvgContent.indexOf("data:image/png;base64,");
let logoPngDataUri = "";

if (startIdx !== -1) {
  const endIdx = logoSvgContent.indexOf('"', startIdx);
  logoPngDataUri = logoSvgContent.substring(startIdx, endIdx);
} else {
  const logoBase64 = Buffer.from(logoSvgContent).toString("base64");
  logoPngDataUri = `data:image/svg+xml;base64,${logoBase64}`;
}

const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Âncora CRM — Apresentação da Plataforma, Plano de Implantação & Custos</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

    @page {
      size: A4;
      margin: 8mm 10mm 8mm 10mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      color: #1e293b;
      background-color: #ffffff;
      line-height: 1.4;
      font-size: 11px;
      -webkit-font-smoothing: antialiased;
    }

    .page {
      page-break-after: always;
      height: 275mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 4mm 2mm;
    }

    .page:last-child {
      page-break-after: avoid;
    }

    /* Cabeçalho de Página */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 10px;
      border-bottom: 2px solid #e2e8f0;
      margin-bottom: 12px;
    }

    .brand {
      display: flex;
      align-items: center;
    }

    .brand-img {
      height: 38px;
      width: auto;
      max-width: 240px;
      display: block;
    }

    .doc-meta {
      text-align: right;
      font-size: 9.5px;
      color: #64748b;
    }

    .doc-meta strong {
      color: #0f172a;
    }

    /* Hero / Box Principal */
    .hero-box {
      background: linear-gradient(135deg, #f8fafc 0%, #f0f9ff 100%);
      border: 1px solid #bae6fd;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 12px;
    }

    .hero-title {
      font-size: 13.5px;
      font-weight: 700;
      color: #0369a1;
      margin-bottom: 4px;
    }

    .hero-text {
      font-size: 10.5px;
      color: #334155;
      line-height: 1.45;
    }

    h2 {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 12px;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    h2::before {
      content: '';
      display: inline-block;
      width: 4px;
      height: 13px;
      background-color: #0284c7;
      border-radius: 2px;
    }

    p {
      margin-bottom: 6px;
      color: #475569;
    }

    /* Grid de Cards */
    .grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 12px;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-bottom: 12px;
    }

    .card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 10px;
    }

    .card h3 {
      font-size: 11px;
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 3px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .card p {
      font-size: 9.5px;
      color: #64748b;
      margin-bottom: 0;
      line-height: 1.35;
    }

    /* Tabelas */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      font-size: 10.5px;
    }

    th {
      background-color: #0f172a;
      color: #ffffff;
      font-weight: 600;
      text-align: left;
      padding: 6px 8px;
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    th:first-child { border-top-left-radius: 5px; }
    th:last-child { border-top-right-radius: 5px; }

    td {
      padding: 6px 8px;
      border-bottom: 1px solid #e2e8f0;
      color: #334155;
    }

    tr:nth-child(even) td {
      background-color: #f8fafc;
    }

    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 9px;
      font-weight: 600;
    }

    .badge-blue { background-color: #dbeafe; color: #1e40af; }
    .badge-green { background-color: #dcfce7; color: #166534; }
    .badge-orange { background-color: #ffedd5; color: #9a3412; }
    .badge-gray { background-color: #f1f5f9; color: #475569; }

    /* Total Card */
    .total-box {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: white;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .total-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #94a3b8;
    }

    .total-sub {
      font-size: 10px;
      color: #cbd5e1;
    }

    .total-amount {
      font-size: 20px;
      font-weight: 700;
      color: #38bdf8;
    }

    .note-box {
      background-color: #fffbeb;
      border-left: 3.5px solid #f59e0b;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 10px;
      color: #92400e;
      margin-bottom: 10px;
    }

    .highlight-box {
      background-color: #f0fdf4;
      border-left: 3.5px solid #10b981;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 10px;
      color: #065f46;
      margin-bottom: 10px;
    }

    .footer {
      padding-top: 6px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #94a3b8;
    }

    .text-right { text-align: right; }
    .bold { font-weight: 600; }
  </style>
</head>
<body>

  <!-- PÁGINA 1: APRESENTAÇÃO DO PROJETO ATUAL - PARTE 1 -->
  <div class="page">
    <div>
      <div class="header">
        <div class="brand">
          <img src="${logoPngDataUri}" class="brand-img" alt="Âncora Saúde Logo" />
        </div>
        <div class="doc-meta">
          <div><strong>Apresentação Interna:</strong> Âncora CRM</div>
          <div><strong>Data:</strong> Agosto de 2026</div>
          <div><strong>Destinatário:</strong> Diretoria da Âncora Saúde</div>
        </div>
      </div>

      <div style="text-align: center; margin: 16px 0 12px 0;">
        <h1 style="font-size: 24px; color: #0f172a; font-weight: 800; letter-spacing: -0.5px;">Âncora CRM — O que a corretora consegue fazer hoje</h1>
        <p style="font-size: 13px; color: #0284c7; font-weight: 600; margin-top: 2px;">Gestão completa do ciclo comercial: entrada do lead, distribuição, atendimento, cotação, venda e pós-venda.</p>
      </div>

      <div class="hero-box" style="margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div class="hero-title">📌 Status de Prontidão do Sistema</div>
          <div>
            <span class="badge badge-green">✅ Pronto para uso</span>
            <span class="badge badge-orange" style="margin-left: 4px;">🟡 Em evolução</span>
            <span class="badge badge-gray" style="margin-left: 4px;">⚪ Próxima fase</span>
          </div>
        </div>
      </div>

      <h2>1. Captação de Leads & Entrada de Oportunidades</h2>
      <div class="grid-2">
        <div class="card">
          <h3>Integração Meta Lead Ads <span class="badge badge-green">✅ Pronto</span></h3>
          <p>Leads do Facebook/Instagram entram automaticamente. A origem da campanha é vinculada, o webhook é validado e eventos duplicados são filtrados sem criar cadastros repetidos.</p>
        </div>
        <div class="card">
          <h3>Multicanais de Entrada <span class="badge badge-green">✅ Pronto</span></h3>
          <p>Cadastro manual de balcão, webhooks dedicados para landing pages e importação de listas via planilha, garantindo que a corretora não dependa apenas da Meta.</p>
        </div>
      </div>

      <h2>2. Distribuição Automática & Plantão de Atendimento</h2>
      <div class="grid-3">
        <div class="card">
          <h3>Fila Central Automática <span class="badge badge-green">✅ Pronto</span></h3>
          <p>Encaminha o lead para a unidade e corretor considerando escala e carga de trabalho. Sem pessoa livre, o lead fica seguro na fila central.</p>
        </div>
        <div class="card">
          <h3>Redistribuição SLA <span class="badge badge-green">✅ Pronto</span></h3>
          <p>Se o primeiro contato atrasar, o sistema emite alerta para a gestão e redistribui a oportunidade automaticamente.</p>
        </div>
        <div class="card">
          <h3>Plantões por Unidade <span class="badge badge-green">✅ Pronto</span></h3>
          <p>Gestores criam escalas por filial. Se houver pouca cobertura em uma unidade, os corretores disponíveis continuam recebendo leads.</p>
        </div>
      </div>

      <h2>3. Workspace & Produtividade do Corretor</h2>
      <div class="grid-2">
        <div class="card">
          <h3>Workspace Inteligente <span class="badge badge-orange">🟡 Em Evolução</span></h3>
          <p>Painel com prioridades do dia: chamados aguardando resposta, alertas de SLA, tarefas vencidas, retornos agendados, novos leads e atalhos rápidos.</p>
        </div>
        <div class="card">
          <h3>Fila, Kanban e Filtros <span class="badge badge-green">✅ Pronto</span></h3>
          <p>Visualização fluida por lista ou Kanban com drag-and-drop fracionado (Lexorank), pesquisa instantânea e filtros por etapa/filial.</p>
        </div>
      </div>

      <h2>4. Perfil 360º & Atendimento do Lead</h2>
      <div class="grid-3">
        <div class="card">
          <h3>Ficha Completa 360º <span class="badge badge-green">✅ Pronto</span></h3>
          <p>Reúne contato, origem da campanha, fase do funil, histórico, tarefas, cotações, documentos e perfil familiar no mesmo lugar.</p>
        </div>
        <div class="card">
          <h3>Timeline & Auditoria <span class="badge badge-green">✅ Pronto</span></h3>
          <p>Notas, alterações de status, uploads e transferências ficam registrados de forma imutável para supervisão e gestão.</p>
        </div>
        <div class="card">
          <h3>Central de Conversas <span class="badge badge-green">✅ Pronto</span></h3>
          <p>Inbox centralizado organizando conversas por lead, respeitando o isolamento por permissão, unidade e carteira do corretor.</p>
        </div>
      </div>
    </div>

    <div class="footer">
      <div>Âncora Saúde | Âncora CRM — Apresentação da Plataforma Atual</div>
      <div>Página 1 de 11</div>
    </div>
  </div>

  <!-- PÁGINA 2: APRESENTAÇÃO DO PROJETO ATUAL - PARTE 2 -->
  <div class="page">
    <div>
      <div class="header">
        <div class="brand">
          <img src="${logoPngDataUri}" class="brand-img" alt="Âncora Saúde Logo" />
        </div>
        <div class="doc-meta">
          <div><strong>Apresentação Interna:</strong> Âncora CRM</div>
          <div><strong>Data:</strong> Agosto de 2026</div>
        </div>
      </div>

      <h2>5. Qualificação por Inteligência Artificial & Cotações</h2>
      <div class="grid-2">
        <div class="card">
          <h3>Qualificação por IA <span class="badge badge-orange">🟡 Em Evolução</span></h3>
          <p>A IA faz a pré-qualificação no WhatsApp, coleta idades/perfil familiar e classifica o interesse. Pedidos de ajuda humana pausam a IA e notificam o corretor.</p>
        </div>
        <div class="card">
          <h3>Cotação de Planos de Saúde <span class="badge badge-green">✅ Pronto</span></h3>
          <p>Montagem de cotações com tabelas de operadoras, faixas etárias e beneficiários (titular/dependentes), gerando versão histórica em PDF.</p>
        </div>
      </div>

      <h2>6. Aprovação de Documentos, Vendas & Financeiro</h2>
      <div class="grid-3">
        <div class="card">
          <h3>Checklist de Documentos <span class="badge badge-green">✅ Pronto</span></h3>
          <p>Validação por plano/operadora, upload privado seguro no Cloudflare R2 e revisão de aprovação por gestores.</p>
        </div>
        <div class="card">
          <h3>Venda & Cliente Ativo <span class="badge badge-green">✅ Pronto</span></h3>
          <p>A confirmação da venda gera o cliente ativo e dispara a estrutura de comissões e vigência contratual do pós-venda.</p>
        </div>
        <div class="card">
          <h3>Comissão & Repasses <span class="badge badge-green">✅ Pronto</span></h3>
          <p>Regras de comissionamento por operadora/plano definidas pelo Diretor, gerando parcelas, baixa de pagamentos e exportação CSV.</p>
        </div>
      </div>

      <h2>7. Gestão, Segurança e Integrações</h2>
      <div class="grid-3">
        <div class="card">
          <h3>Gestão Multi-Unidade <span class="badge badge-green">✅ Pronto</span></h3>
          <p>Controle de equipes, filiais e permissões por papéis (Diretor, Gestor, Corretor) com isolamento rigoroso entre carteiras.</p>
        </div>
        <div class="card">
          <h3>WhatsApp Oficial Meta <span class="badge badge-orange">🟡 Em Evolução</span></h3>
          <p>Canal oficial da empresa via Embedded Signup com inbox corporativo, templates pré-aprovados e log de entrega.</p>
        </div>
        <div class="card">
          <h3>Cadência WAHA em VPS <span class="badge badge-gray">⚪ Próxima Fase</span></h3>
          <p>Estrutura técnica pronta para rodar cadências em servidor VPS próprio com o motor WAHA para maior autonomia.</p>
        </div>
      </div>

      <div class="hero-box" style="background: #f0fdf4; border-color: #bbf7d0; margin-top: 10px;">
        <div class="hero-title" style="color: #166534;">🌟 O Maior Impacto do Âncora CRM para a Âncora Saúde</div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 6px; font-size: 10px; color: #14532d;">
          <div>• <strong>Menos Leads Perdidos:</strong> Captação centralizada, fila automatizada e alerta de SLA.</div>
          <div>• <strong>Atendimento Rápido:</strong> Corretor com visão clara de prioridades e dados em uma tela.</div>
          <div>• <strong>Gestão Transparente:</strong> Acompanhamento em tempo real por filial, equipe e corretor.</div>
          <div>• <strong>Venda Organizada:</strong> Cotação, documentos, venda e comissões 100% integrados.</div>
        </div>
      </div>

      <h2>Próximas Evoluções Estratégicas da Plataforma</h2>
      <div class="card">
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; font-size: 10px; color: #334155;">
          <div>1. Finalização da homologação do WhatsApp Oficial e Meta Lead Ads.</div>
          <div>2. Ampliação dos indicadores do painel do gestor (NOC) e ranking de vendas.</div>
          <div>3. Ativação do servidor VPS WAHA para mensagens de cadência comercial.</div>
          <div>4. Automações avançadas de pós-venda, renovação e retenção de beneficiários.</div>
        </div>
      </div>
    </div>

    <div class="footer">
      <div>Âncora Saúde | Âncora CRM — Apresentação da Plataforma Atual</div>
      <div>Página 2 de 11</div>
    </div>
  </div>

  <!-- PÁGINA 3: CAPA & APRESENTAÇÃO OPERACIONAL -->
  <div class="page">
    <div>
      <div class="header">
        <div class="brand">
          <img src="${logoPngDataUri}" class="brand-img" alt="Âncora Saúde Logo" />
        </div>
        <div class="doc-meta">
          <div><strong>Versão:</strong> 1.0 - Agosto de 2026</div>
          <div><strong>Status:</strong> Pronto para piloto</div>
          <div><strong>Público:</strong> Diretoria, gestão e corretores</div>
        </div>
      </div>

      <div style="text-align: center; margin: 24px 0 18px 0;">
        <h1 style="font-size: 26px; color: #0f172a; font-weight: 800; letter-spacing: -0.5px;">Âncora CRM</h1>
        <p style="font-size: 14px; color: #0284c7; font-weight: 600; margin-top: 4px;">Plano de Implantação Operacional & Análise de Custos</p>
      </div>

      <div class="hero-box" style="margin-bottom: 16px;">
        <div class="hero-title">📌 Objetivo do Plano de Implantação</div>
        <div class="hero-text">
          Um passo a passo simples e estruturado para organizar os atendimentos da <strong>Âncora Saúde</strong>, acompanhar os leads em tempo real, garantir segurança de dados e ajudar a equipe de vendas a fechar mais contratos com eficiência.
        </div>
      </div>

      <h2>Visão Geral do Projeto</h2>
      <div class="grid-3">
        <div class="card">
          <h3>🎯 Objetivo Principal</h3>
          <p>Colocar o Âncora CRM para funcionar aos poucos na operação, sem atrapalhar a rotina atual de vendas da equipe.</p>
        </div>
        <div class="card">
          <h3>🚀 O que entra na 1ª Fase</h3>
          <p>Gestão de leads, distribuição, tarefas, WhatsApp oficial corporativo, documentos, metas e relatórios simples.</p>
        </div>
        <div class="card">
          <h3>🔄 Como será feito</h3>
          <p>Iniciamos com um grupo piloto reduzido (5 a 10 corretores), ajustamos os fluxos e depois expandimos para toda a empresa.</p>
        </div>
      </div>

      <h2>Decisões Estratégicas Já Tomadas</h2>
      <div class="card" style="margin-bottom: 14px;">
        <ul style="padding-left: 18px; color: #334155; font-size: 10.5px; line-height: 1.6;">
          <li><strong>Tela Única de Trabalho:</strong> O Âncora CRM será a ferramenta central do dia a dia do corretor.</li>
          <li><strong>WhatsApp Oficial Corporativo:</strong> As conversas com clientes serão realizadas no canal oficial da Âncora Saúde sempre disponível.</li>
          <li><strong>Supervisão Humana da IA:</strong> A Inteligência Artificial gera resumos e sugestões, mas o corretor aprova ações importantes antes do envio.</li>
          <li><strong>Evolução Gradual:</strong> Módulos avançados de comissões detalhadas e relatórios complexos entram nas etapas seguintes.</li>
        </ul>
      </div>

      <div class="highlight-box">
        <strong> O que esperamos melhorar de imediato:</strong> Uma rotina comercial mais organizada, resposta rápida aos clientes, eliminação de leads esquecidos e clareza total das tarefas diárias da equipe.
      </div>
    </div>

    <div class="footer">
      <div>Âncora Saúde | Âncora CRM — Documento de Alinhamento Executivo</div>
      <div>Página 3 de 11</div>
    </div>
  </div>

  <!-- PÁGINA 4: O QUE O CRM VAI AJUDAR A FAZER & REGRAS -->
  <div class="page">
    <div>
      <div class="header">
        <div class="brand">
          <img src="${logoPngDataUri}" class="brand-img" alt="Âncora Saúde Logo" />
        </div>
        <div class="doc-meta">
          <div><strong>Documento:</strong> Escopo Operacional</div>
          <div><strong>Versão:</strong> Agosto de 2026</div>
        </div>
      </div>

      <h2>O que o CRM vai ajudar a fazer no dia a dia</h2>
      <p style="font-size: 10.5px; margin-bottom: 8px;">A primeira versão entrega o que a equipe precisa no trabalho diário, com acessos liberados de acordo com a função de cada profissional:</p>

      <table>
        <thead>
          <tr>
            <th>Área</th>
            <th>O que a equipe poderá fazer no Âncora CRM</th>
            <th>Cuidado / Regra Importante</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="bold">Leads e Vendas</td>
            <td>Cadastrar leads, acompanhar etapas do funil, guardar documentos e criar lembretes de retorno.</td>
            <td>Cada corretor vê apenas os leads atribuídos à sua carteira ou plantão.</td>
          </tr>
          <tr>
            <td class="bold">Atendimento</td>
            <td>Visualizar o histórico de conversas, entender o perfil do cliente e registrar o histórico comercial.</td>
            <td>O envio de mensagens para o cliente é feito exclusivamente pelo canal oficial corporativo.</td>
          </tr>
          <tr>
            <td class="bold">Ajuda por IA</td>
            <td>Receber resumos automáticos da conversa, perfil familiar e sugestões de respostas para o cliente.</td>
            <td>O corretor decide e confirma antes de enviar qualquer mensagem ou alterar o status.</td>
          </tr>
          <tr>
            <td class="bold">Gestão</td>
            <td>Acompanhar metas, tempo de resposta dos atendimentos e tarefas pendentes da equipe.</td>
            <td>Cada gestor visualiza e acompanha exclusivamente a sua equipe/filial.</td>
          </tr>
          <tr>
            <td class="bold">Administração</td>
            <td>Criar usuários, definir níveis de acesso, configurar unidades e ligar/desligar recursos.</td>
            <td>Todas as alterações administrativas ficam gravadas em log de auditoria.</td>
          </tr>
        </tbody>
      </table>

      <h2>Regras de Segurança e Governança</h2>
      <table>
        <thead>
          <tr>
            <th>Princípio</th>
            <th>Aplicação Prática no Âncora CRM</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="bold">Privacidade & Multi-Tenant</td>
            <td>Cada usuário vê estritamente as informações necessárias para o seu trabalho (isolamento por perfil/unidade).</td>
          </tr>
          <tr>
            <td class="bold">Registro & Auditoria</td>
            <td>Todas as alterações importantes de cadastro, permissões ou transferências ficam registradas para consulta.</td>
          </tr>
          <tr>
            <td class="bold">Controle Administrativo</td>
            <td>A administração do sistema pode ativar ou pausar recursos a qualquer momento com efeito imediato.</td>
          </tr>
          <tr>
            <td class="bold">Atendimento Seguro</td>
            <td>A equipe utiliza o canal oficial da Âncora Saúde, respeitando as regras de horário e opt-out do cliente.</td>
          </tr>
        </tbody>
      </table>

      <div class="note-box">
        <strong>🔒 Garantia de Proteção de Dados:</strong> O Âncora CRM foi estruturado respeitando a LGPD. Informações de beneficiários e documentos são protegidos por criptografia e controle de acesso server-side.
      </div>
    </div>

    <div class="footer">
      <div>Âncora Saúde | Âncora CRM — Documento de Alinhamento Executivo</div>
      <div>Página 4 de 11</div>
    </div>
  </div>

  <!-- PÁGINA 5: CRONOGRAMA DE IMPLANTAÇÃO & ACOMPANHAMENTO -->
  <div class="page">
    <div>
      <div class="header">
        <div class="brand">
          <img src="${logoPngDataUri}" class="brand-img" alt="Âncora Saúde Logo" />
        </div>
        <div class="doc-meta">
          <div><strong>Fase:</strong> Planejamento Operacional</div>
          <div><strong>Agosto de 2026</strong></div>
        </div>
      </div>

      <h2>Como vamos colocar o CRM para funcionar (6 Etapas)</h2>
      <p style="font-size: 10.5px; margin-bottom: 8px;">A implantação será feita em etapas graduais. Só avançamos para o próximo passo quando a etapa anterior estiver rodando com total segurança:</p>

      <table>
        <thead>
          <tr>
            <th>Etapa</th>
            <th>O que vamos fazer</th>
            <th>Critério para avançar de etapa</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="bold">1. Preparar</td>
            <td>Criar acessos, organizar dados de operadoras/planos e conferir se tudo está pronto.</td>
            <td>Quando cada pessoa conseguir acessar e visualizar o que precisa.</td>
          </tr>
          <tr>
            <td class="bold">2. Ensinar os Gestores</td>
            <td>Treinar os gestores em como acompanhar a equipe, os leads e a fila de atendimento.</td>
            <td>Quando os gestores souberem tirar dúvidas e acompanhar o grupo piloto.</td>
          </tr>
          <tr>
            <td class="bold">3. Grupo Piloto</td>
            <td>De 5 a 10 corretores selecionados usam o Âncora CRM no seu trabalho diário normal.</td>
            <td>Quando o grupo piloto estiver operando bem e as dúvidas resolvidas.</td>
          </tr>
          <tr>
            <td class="bold">4. Ajustar & Melhorar</td>
            <td>Ouvir a equipe piloto, corrigir dificuldades operacionais e reforçar o treinamento.</td>
            <td>Quando o uso estiver simples, seguro e sem problemas relevantes.</td>
          </tr>
          <tr>
            <td class="bold">5. Expandir Equipes</td>
            <td>Inserir gradualmente novas equipes e unidades no Âncora CRM.</td>
            <td>Quando o suporte estiver fluido e os resultados acompanhados.</td>
          </tr>
          <tr>
            <td class="bold">6. Rotina Definitiva</td>
            <td>Usar o CRM como ferramenta padrão em toda a Âncora Saúde e buscar melhoria contínua.</td>
            <td>Nas reuniões mensais de alinhamento e avaliação de resultados.</td>
          </tr>
        </tbody>
      </table>

      <h2>Rituais de Acompanhamento no Piloto</h2>
      <div class="grid-3">
        <div class="card" style="background: #f0f9ff; border-color: #bae6fd;">
          <h3 style="color: #0369a1;">📅 Todos os Dias (no Piloto)</h3>
          <p>A equipe tem suporte direto para tirar dúvidas rápidas e avisar se algum ajuste for necessário.</p>
        </div>
        <div class="card" style="background: #f0fdf4; border-color: #bbf7d0;">
          <h3 style="color: #15803d;">📅 Toda Semana</h3>
          <p>Reunião curta entre gestão e suporte para analisar dificuldades, ajustar o plantão e implementar melhorias.</p>
        </div>
        <div class="card" style="background: #faf5ff; border-color: #e9d5ff;">
          <h3 style="color: #7e22ce;">📅 Todo Mês</h3>
          <p>A Diretoria acompanha os relatórios de volume, taxa de resposta e decide os próximos passos de expansão.</p>
        </div>
      </div>

      <div class="highlight-box">
        <strong>💡 Regra de Ouro da Implantação:</strong> "Primeiro resolver, depois ampliar". Se surgirem ajustes críticos no piloto, pausamos a expansão até resolver totalmente.
      </div>
    </div>

    <div class="footer">
      <div>Âncora Saúde | Âncora CRM — Documento de Alinhamento Executivo</div>
      <div>Página 5 de 11</div>
    </div>
  </div>

  <!-- PÁGINA 6: MÉTRICAS DE ACOMPANHAMENTO & PLANO DE CONTINGÊNCIA -->
  <div class="page">
    <div>
      <div class="header">
        <div class="brand">
          <img src="${logoPngDataUri}" class="brand-img" alt="Âncora Saúde Logo" />
        </div>
        <div class="doc-meta">
          <div><strong>Foco:</strong> Qualidade & Gestão de Riscos</div>
        </div>
      </div>

      <h2>Como saber se o piloto está funcionando (Indicadores)</h2>
      <div class="grid-3">
        <div class="card">
          <h3>1. Adesão da Equipe</h3>
          <p>Quantidade de corretores ativos utilizando o CRM semanalmente no trabalho diário.</p>
        </div>
        <div class="card">
          <h3>2. Tempo de Resposta</h3>
          <p>Tempo entre a entrada do lead na plataforma e o primeiro contato realizado pelo corretor.</p>
        </div>
        <div class="card">
          <h3>3. Tarefas em Dia</h3>
          <p>Redução da quantidade de lembretes e retornos pendentes em atraso.</p>
        </div>
        <div class="card">
          <h3>4. Avanço de Funil</h3>
          <p>Percentual de leads que passam de etapa (cotação enviada $\rightarrow$ estudo $\rightarrow$ fechamento).</p>
        </div>
        <div class="card">
          <h3>5. Qualidade do Cadastro</h3>
          <p>Preenchimento correto das informações de beneficiários, operadoras e valores.</p>
        </div>
        <div class="card">
          <h3>6. Satisfação da Equipe</h3>
          <p>Avaliação dos corretores sobre a facilidade e agilidade do novo sistema.</p>
        </div>
      </div>

      <h2>O que fazer se um indicador não estiver bom (Plano de Ação)</h2>
      <table>
        <thead>
          <tr>
            <th>Se Acontecer</th>
            <th>Pode Significar</th>
            <th>Ação Imediata da Gestão</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="bold">Poucos corretores usando o CRM</td>
            <td>Dúvidas no processo ou dificuldade com a ferramenta.</td>
            <td>Realizar acompanhamento individual próximo e simplificar o passo a passo.</td>
          </tr>
          <tr>
            <td class="bold">Demora para responder ao lead</td>
            <td>Leads acumulando no plantão sem atendimento.</td>
            <td>Reorganizar a fila de distribuição e verificar disponibilidade dos corretores.</td>
          </tr>
          <tr>
            <td class="bold">Cadastros incompletos</td>
            <td>Falta de clareza nos dados exigidos para cotação.</td>
            <td>Destacar campos obrigatórios e reforçar instrução de preenchimento.</td>
          </tr>
          <tr>
            <td class="bold">Leads estagnados sem avançar</td>
            <td>Acompanhamento pós-cotação precisando de reforço.</td>
            <td>Revisar os casos junto com a gestão e apoiar nas negociações.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="footer">
      <div>Âncora Saúde | Âncora CRM — Documento de Alinhamento Executivo</div>
      <div>Página 6 de 11</div>
    </div>
  </div>

  <!-- PÁGINA 7: MATRIZ DE RESPONSABILIDADES, TREINAMENTO & CONTINGÊNCIA -->
  <div class="page">
    <div>
      <div class="header">
        <div class="brand">
          <img src="${logoPngDataUri}" class="brand-img" alt="Âncora Saúde Logo" />
        </div>
        <div class="doc-meta">
          <div><strong>Operação:</strong> Governança de Equipes</div>
        </div>
      </div>

      <h2>Quem faz o quê no projeto (Matriz de Responsabilidades)</h2>
      <table>
        <thead>
          <tr>
            <th>Papel</th>
            <th>O que faz na operação do Âncora CRM</th>
            <th>Frequência</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="bold">Diretoria</td>
            <td>Aprova o planejamento, acompanha métricas gerais e auxilia a resolver obstáculos.</td>
            <td>Mensal</td>
          </tr>
          <tr>
            <td class="bold">Gestão Comercial</td>
            <td>Acompanha a fila de leads, apoia o grupo piloto e avalia os resultados da equipe.</td>
            <td>Semanal</td>
          </tr>
          <tr>
            <td class="bold">Corretores</td>
            <td>Atendem os leads no CRM, atualizam status, guardam documentos e avisam dúvidas.</td>
            <td>Diário</td>
          </tr>
          <tr>
            <td class="bold">TI / Produto</td>
            <td>Garante a estabilidade, integração do WhatsApp, segurança de dados e atualizações.</td>
            <td>Contínuo</td>
          </tr>
        </tbody>
      </table>

      <h2>Plano de Treinamento por Perfil</h2>
      <div class="grid-3">
        <div class="card">
          <h3>Gestão Comercial</h3>
          <p>Treinamento em como analisar os dashboards, reatribuir leads, acompanhar tarefas e medir produtividade.</p>
        </div>
        <div class="card">
          <h3>Corretores</h3>
          <p>Passo a passo prático para atender no WhatsApp, anexar documentos, gerar cotações e organizar lembretes.</p>
        </div>
        <div class="card">
          <h3>Suporte Interno</h3>
          <p>Capacitação para tirar dúvidas da equipe, liberar acessos e encaminhar correções rapidamente.</p>
        </div>
      </div>

      <h2>Plano de Contingência (Se algo der errado)</h2>
      <table>
        <thead>
          <tr>
            <th>Situação Inesperada</th>
            <th>Como Evitar</th>
            <th>O que Fazer Imediatamente</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="bold">Instabilidade no WhatsApp</td>
            <td>Testar a conexão do canal antes de cada etapa.</td>
            <td>Registrar os atendimentos e utilizar o canal autorizado de contingência.</td>
          </tr>
          <tr>
            <td class="bold">Dúvida ou erro de cadastro</td>
            <td>Revisar tabelas e dados antes do piloto.</td>
            <td>Apoiar o corretor na correção e orientar o preenchimento correto.</td>
          </tr>
          <tr>
            <td class="bold">IA ou automação com falha</td>
            <td>Testar fluxos previamente com supervisão.</td>
            <td>Pausar o recurso afetado e seguir pelo atendimento manual seguro.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="footer">
      <div>Âncora Saúde | Âncora CRM — Documento de Alinhamento Executivo</div>
      <div>Página 7 de 11</div>
    </div>
  </div>

  <!-- PÁGINA 8: PASSO A PASSO DE INÍCIO & MENSAGEM FINAL -->
  <div class="page">
    <div>
      <div class="header">
        <div class="brand">
          <img src="${logoPngDataUri}" class="brand-img" alt="Âncora Saúde Logo" />
        </div>
        <div class="doc-meta">
          <div><strong>Fase:</strong> Execução do Piloto</div>
        </div>
      </div>

      <h2>Próximos Passos para Início do Piloto</h2>
      <p style="font-size: 10.5px; margin-bottom: 10px;">Ordem exata de execução para darmos início com total segurança na Âncora Saúde:</p>

      <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
        <div class="card" style="display: flex; align-items: center; gap: 12px;">
          <div style="background: #0284c7; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700;">1</div>
          <div><strong>Definir Responsáveis:</strong> Identificar os responsáveis pela gestão do piloto, suporte e administração dos acessos.</div>
        </div>
        <div class="card" style="display: flex; align-items: center; gap: 12px;">
          <div style="background: #0284c7; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700;">2</div>
          <div><strong>Selecionar Grupo Piloto:</strong> Escolher entre 5 e 10 corretores para iniciar o uso no trabalho diário.</div>
        </div>
        <div class="card" style="display: flex; align-items: center; gap: 12px;">
          <div style="background: #0284c7; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700;">3</div>
          <div><strong>Configuração Inicial:</strong> Validar acessos, cadastros de planos, canal de WhatsApp oficial e permissões dos usuários.</div>
        </div>
        <div class="card" style="display: flex; align-items: center; gap: 12px;">
          <div style="background: #0284c7; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700;">4</div>
          <div><strong>Treinamento do Grupo Piloto:</strong> Realizar treinamento prático com os corretores e abrir canal de suporte tirar dúvidas.</div>
        </div>
        <div class="card" style="display: flex; align-items: center; gap: 12px;">
          <div style="background: #0284c7; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700;">5</div>
          <div><strong>Acompanhamento Semanal:</strong> Avaliar os resultados semanalmente, ouvir a equipe e ajustar pontos de melhoria.</div>
        </div>
        <div class="card" style="display: flex; align-items: center; gap: 12px;">
          <div style="background: #0284c7; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700;">6</div>
          <div><strong>Expansão Gradual:</strong> Ampliar o uso para as demais equipes e unidades somente quando o grupo piloto estiver fluido.</div>
        </div>
      </div>

      <div class="hero-box" style="background: #f8fafc; border-color: #cbd5e1; text-align: center; padding: 16px;">
        <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">Mensagem de Alinhamento</div>
        <div style="font-size: 11px; color: #475569;">"Vamos começar pequeno, aprender com a nossa equipe no dia a dia e aperfeiçoar os processos antes de expandir para toda a corretora."</div>
      </div>
    </div>

    <div class="footer">
      <div>Âncora Saúde | Âncora CRM — Documento de Alinhamento Executivo</div>
      <div>Página 8 de 11</div>
    </div>
  </div>

  <!-- PÁGINA 9: INFRAESTRUTURA FIXA E SERVIDORES DO ÂNCORA CRM -->
  <div class="page">
    <div>
      <div class="header">
        <div class="brand">
          <img src="${logoPngDataUri}" class="brand-img" alt="Âncora Saúde Logo" />
        </div>
        <div class="doc-meta">
          <div><strong>Apresentado a:</strong> Diretoria da Âncora Saúde</div>
          <div><strong>Moeda:</strong> Reais (R$)</div>
        </div>
      </div>

      <div class="hero-box">
        <div class="hero-title">💡 Como funciona a Infraestrutura do Âncora CRM? (Visão Descomplicada)</div>
        <div class="hero-text">
          O Âncora CRM utiliza uma arquitetura sob demanda <strong>Serverless</strong>. Não é preciso comprar servidores físicos caros para a corretora: a aplicação roda na nuvem de forma rápida, segura e com valor fixo mensal extremamente previsível.
        </div>
      </div>

      <h2>Glossário das Ferramentas da Nossa Infraestrutura</h2>
      <div class="grid-2">
        <div class="card">
          <strong>🌐 Vercel Pro (Servidor do App Web)</strong>
          <p>Mantém a plataforma do Âncora CRM no ar 24h por dia para a nossa equipe, rápida e acessível de qualquer lugar.</p>
        </div>
        <div class="card">
          <strong>🗄️ Supabase Pro (Banco de Dados Interno)</strong>
          <p>Armazena os dados dos leads, clientes, beneficiários e histórico com atualização ao vivo nas telas da gestão.</p>
        </div>
        <div class="card">
          <strong>🖥️ Servidor VPS Dedicado (WhatsApp WAHA)</strong>
          <p>Nosso computador virtual de alta performance (8GB RAM) para conectar o robô do WhatsApp com total estabilidade.</p>
        </div>
        <div class="card">
          <strong>🤖 OpenRouter (Conector de IA)</strong>
          <p>Plataforma que conecta a IA de atendimento (DeepSeek V3.1) por frações de centavo por resposta.</p>
        </div>
      </div>

      <h2>Custos Fixos Mensais de Infraestrutura do Âncora CRM</h2>
      <table>
        <thead>
          <tr>
            <th>Serviço / Infraestrutura</th>
            <th>Finalidade na Operação da Âncora Saúde</th>
            <th class="text-right">Custo Mensal (R$)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="bold">Servidor da Aplicação Web (Vercel Pro)</td>
            <td>Mantém o painel do Âncora CRM rápido e acessível para todos os corretores</td>
            <td class="text-right bold">R$ 108,00</td>
          </tr>
          <tr>
            <td class="bold">Banco de Dados (Supabase Pro)</td>
            <td>Registra negociações, tabelas de operadoras e sincroniza status em tempo real</td>
            <td class="text-right bold">R$ 135,00</td>
          </tr>
          <tr style="background-color: #fefce8;">
            <td class="bold">🚀 Servidor VPS Dedicado (WhatsApp WAHA)</td>
            <td><strong>Servidor de alta capacidade (2 vCPU, 8GB RAM, 100GB NVMe) para o WhatsApp</strong></td>
            <td class="text-right bold" style="color: #9a3412;">R$ 77,99</td>
          </tr>
          <tr>
            <td class="bold">Armazenamento Seguro (Cloudflare R2)</td>
            <td>Guarda PDFs de cotações e documentos dos beneficiários (Egress R$0)</td>
            <td class="text-right bold">R$ 10,00</td>
          </tr>
          <tr>
            <td class="bold">Processamento de IA (OpenRouter)</td>
            <td>Cérebro de IA para atendimento inicial no WhatsApp (DeepSeek / Qwen3)</td>
            <td class="text-right bold">R$ 15,00</td>
          </tr>
          <tr>
            <td class="bold">Filas, E-mails e Segurança</td>
            <td>Envio de senhas, verificação de SLA e proteção contra picos de tráfego</td>
            <td class="text-right bold"><span class="badge badge-green">R$ 0,00 (Grátis)</span></td>
          </tr>
        </tbody>
      </table>

      <div class="total-box">
        <div>
          <div class="total-title">Custo Fixo Total Mensal da Infraestrutura</div>
          <div class="total-sub">Plataforma Web Âncora CRM + Banco de Dados + Servidor VPS WhatsApp + IA</div>
        </div>
        <div class="total-amount">R$ 345,99 / mês</div>
      </div>

      <div class="note-box">
        <strong>📌 Otimização Conquistada na VPS do WhatsApp:</strong> Dimensionamos uma VPS de alta performance (2 vCPU, 8 GB de RAM, 100 GB NVMe e 8 TB de largura de banda) por apenas <strong>R$ 77,99/mês</strong>, garantindo estabilidade ao robô de atendimento.
      </div>
    </div>

    <div class="footer">
      <div>Âncora Saúde | Âncora CRM — Relatório Interno para a Diretoria</div>
      <div>Página 9 de 11</div>
    </div>
  </div>

  <!-- PÁGINA 10: DETALHAMENTO DE MENSAGERIA WPP (META) VS IA & CUSTO POR VENDA -->
  <div class="page">
    <div>
      <div class="header">
        <div class="brand">
          <img src="${logoPngDataUri}" class="brand-img" alt="Âncora Saúde Logo" />
        </div>
        <div class="doc-meta">
          <div><strong>Foco:</strong> Custos Variáveis por Lead</div>
          <div><strong>Moeda:</strong> Reais (R$) | Câmbio BRL 5,40</div>
        </div>
      </div>

      <h2>1. Custos de Tarifas da Meta (WhatsApp Oficial) — Independente de IA</h2>
      <p style="font-size: 10px; margin-bottom: 6px;">Valores cobrados diretamente pela Meta para o envio de mensagens oficiais do WhatsApp Business API:</p>
      <table>
        <thead>
          <tr>
            <th>Tipo de Mensagem no WhatsApp</th>
            <th>Regra de Cobrança da Meta</th>
            <th class="text-right">Custo Meta por Lead (R$)</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background-color: #ecfdf5;">
            <td class="bold">🎯 Leads de Anúncios Click-to-WhatsApp</td>
            <td>Janela de 72 horas isenta de cobrança de mensagens pela Meta</td>
            <td class="text-right bold" style="color: #15803d;">R$ 0,00 (Isento 72h)</td>
          </tr>
          <tr>
            <td class="bold">💬 Mensagem de Serviço (Cliente Inicia o Contato)</td>
            <td>Cobrança por sessão de 24h iniciada pelo cliente (pós 01/10/2026)</td>
            <td class="text-right bold">R$ 0,22 / lead</td>
          </tr>
          <tr>
            <td class="bold">📢 Mensagem de Marketing (Empresa Inicia o Contato)</td>
            <td>Envio de modelo aprovado de campanha ou prospecção ativa pela corretora</td>
            <td class="text-right bold" style="color: #b91c1c;">R$ 0,56 / lead</td>
          </tr>
        </tbody>
      </table>

      <h2>2. Custos de Processamento por Inteligência Artificial (OpenRouter + DeepSeek)</h2>
      <p style="font-size: 10px; margin-bottom: 6px;">Consumo de IA durante uma qualificação completa de 6 interações no WhatsApp (~12k tokens de entrada / 900 tokens de saída):</p>
      <table>
        <thead>
          <tr>
            <th>Modelo de IA Escolhido</th>
            <th>Provedor</th>
            <th class="text-right">Custo por Atendimento (6 msgs)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="bold">Qwen3 32B (Modelo Leve e Rápido)</td>
            <td>OpenRouter</td>
            <td class="text-right bold">~ R$ 0,006 (Fração de centavo)</td>
          </tr>
          <tr>
            <td class="bold">DeepSeek V3.1 (Raciocínio Avançado e Alta Precisão)</td>
            <td>OpenRouter</td>
            <td class="text-right bold">~ R$ 0,021 (Aprox. 2 centavos)</td>
          </tr>
        </tbody>
      </table>

      <h2>3. Custo Combinado por Lead (Tarifa WhatsApp + Processamento IA)</h2>
      <table>
        <thead>
          <tr>
            <th>Cenário Operacional</th>
            <th>Meta (WhatsApp)</th>
            <th>IA (DeepSeek)</th>
            <th class="text-right">Custo Total por Lead</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background-color: #ecfdf5;">
            <td class="bold">Lead de Anúncio Click-to-WhatsApp</td>
            <td>R$ 0,00</td>
            <td>R$ 0,02</td>
            <td class="text-right bold" style="color: #15803d;">R$ 0,02 / lead</td>
          </tr>
          <tr>
            <td class="bold">Cliente inicia conversa (Inbound)</td>
            <td>R$ 0,22</td>
            <td>R$ 0,02</td>
            <td class="text-right bold">R$ 0,24 / lead</td>
          </tr>
          <tr>
            <td class="bold">Empresa inicia contato (Marketing)</td>
            <td>R$ 0,56</td>
            <td>R$ 0,02</td>
            <td class="text-right bold" style="color: #b91c1c;">R$ 0,58 / lead</td>
          </tr>
        </tbody>
      </table>

      <div class="highlight-box">
        <strong>⚡ Recomendação Estratégica para Nosso Time de Tráfego Pago:</strong><br>
        Ao configurarmos nossas campanhas no Meta Ads (Facebook/Instagram) direcionando para <strong>Click-to-WhatsApp</strong>, a Meta zera a cobrança de mensagens por 72 horas. A qualificação automatizada pela IA custará **apenas R$ 0,02 por lead**.
      </div>

      <h2>4. Custo da Automação por Contrato Fechado (Simulação: 5.000 Leads @ 30% Conversão)</h2>
      <p style="font-size: 10px; margin-bottom: 6px;">Simulação para 5.000 leads e taxa de fechamento de 30% (1.500 contratos de planos de saúde emitidos):</p>
      <table>
        <thead>
          <tr>
            <th>Origem do Atendimento</th>
            <th>Custo Variação Mensal</th>
            <th>Contratos Fechados</th>
            <th>Custo Real / Contrato</th>
            <th class="text-right">Custo c/ Margem de Segurança</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="bold">Cliente inicia conversa (Inbound)</td>
            <td>R$ 1.250,00</td>
            <td>1.500 contratos</td>
            <td>R$ 0,83 / contrato</td>
            <td class="text-right bold" style="color: #15803d;">R$ 1,00 / contrato</td>
          </tr>
          <tr>
            <td class="bold">Empresa inicia contato (Marketing)</td>
            <td>R$ 2.950,00</td>
            <td>1.500 contratos</td>
            <td>R$ 1,97 / contrato</td>
            <td class="text-right bold" style="color: #b91c1c;">R$ 2,17 / contrato</td>
          </tr>
        </tbody>
      </table>

      <div class="note-box">
        <strong>🛡️ Reserva de Orçamento Recomendada:</strong> Reservar <strong>R$ 0,30 por lead</strong> no Inbound e <strong>R$ 0,65 por lead</strong> no Outbound para margem de segurança cambial e retries.
      </div>
    </div>

    <div class="footer">
      <div>Âncora Saúde | Âncora CRM — Relatório Interno para a Diretoria</div>
      <div>Página 10 de 11</div>
    </div>
  </div>

  <!-- PÁGINA 11: RESULTADOS ESPERADOS COM A IMPLANTAÇÃO DO ÂNCORA CRM -->
  <div class="page">
    <div>
      <div class="header">
        <div class="brand">
          <img src="${logoPngDataUri}" class="brand-img" alt="Âncora Saúde Logo" />
        </div>
        <div class="doc-meta">
          <div><strong>Apresentado a:</strong> Diretoria da Âncora Saúde</div>
          <div><strong>Agosto de 2026</strong></div>
        </div>
      </div>

      <div class="hero-box" style="background: #f0fdf4; border-color: #bbf7d0;">
        <div class="hero-title" style="color: #166534;">🏆 Resultados Esperados com a Implantação do Âncora CRM</div>
        <div class="hero-text" style="color: #14532d;">
          A implantação do Âncora CRM não é apenas uma mudança de sistema, mas uma <strong>transformação operacional na Âncora Saúde</strong>. O objetivo é aumentar a conversão de contratos, otimizar a rotina dos corretores e dar total controle à Diretoria.
        </div>
      </div>

      <h2>Os 4 Pilares de Impacto no Negócio da Âncora Saúde</h2>
      <div class="grid-2">
        <div class="card" style="background: #f0f9ff; border-color: #bae6fd;">
          <h3 style="color: #0369a1;">⚡ 1. Agilidade & Redução do Tempo de Resposta</h3>
          <p>Redução do tempo de primeiro atendimento ao lead de horas para <strong>poucos segundos</strong>. Resumos de IA aceleram a montagem de cotações em até 70%.</p>
        </div>
        <div class="card" style="background: #f0fdf4; border-color: #bbf7d0;">
          <h3 style="color: #15803d;">🛡️ 2. Zero Perda de Leads (Retenção 100%)</h3>
          <p>Eliminação de leads esquecidos via distribuição por plantão e alertas automáticos de SLA. Nenhum lead fica sem acompanhamento.</p>
        </div>
        <div class="card" style="background: #faf5ff; border-color: #e9d5ff;">
          <h3 style="color: #7e22ce;">💰 3. Redução do CAC & Alta Eficiência</h3>
          <p>Custo de automação por contrato vendido inferior a <strong>R$ 1,00 a R$ 2,00</strong>, com aproveitamento máximo do tráfego pago da Âncora Saúde.</p>
        </div>
        <div class="card" style="background: #fffbeb; border-color: #fde68a;">
          <h3 style="color: #b45309;">📊 4. Governança Executiva & Transparência</h3>
          <p>Painéis em tempo real para a Diretoria com métricas de conversão por filial, desempenho da equipe e controle total do pipeline.</p>
        </div>
      </div>

      <h2>Antes vs. Depois da Implantação do Âncora CRM</h2>
      <table>
        <thead>
          <tr>
            <th>Processo Operacional</th>
            <th>Antes (Processo Atual)</th>
            <th class="text-right">Depois (Com Âncora CRM)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="bold">Atendimento Inicial ao Lead</td>
            <td>Demorado ou dependente da disponibilidade manual do corretor</td>
            <td class="text-right bold" style="color: #15803d;">Imediato via IA com pré-qualificação em segundos</td>
          </tr>
          <tr>
            <td class="bold">Distribuição de Leads</td>
            <td>Manual, descentralizada e suscetível a erros ou atrasos</td>
            <td class="text-right bold" style="color: #15803d;">Plantão multiunidade automático por regra transparente</td>
          </tr>
          <tr>
            <td class="bold">Histórico do Cliente & Documentos</td>
            <td>Disperso nos celulares pessoais dos corretores</td>
            <td class="text-right bold" style="color: #15803d;">Centralizado e protegido na nuvem da Âncora Saúde (LGPD)</td>
          </tr>
          <tr>
            <td class="bold">Acompanhamento da Gestão</td>
            <td>Baseado em planilhas ou relatórios manuais defasados</td>
            <td class="text-right bold" style="color: #15803d;">Dashboard executivo em tempo real com métricas precisas</td>
          </tr>
          <tr style="background-color: #ecfdf5;">
            <td class="bold">Custo de Automação / Contrato Fechado</td>
            <td>Alto custo de mensalidades por usuário de CRMs de mercado</td>
            <td class="text-right bold" style="color: #15803d;">R$ 0,83 a R$ 1,97 por contrato vendido</td>
          </tr>
        </tbody>
      </table>

      <div class="hero-box" style="background: #f8fafc; border-color: #0284c7; text-align: center; padding: 14px; margin-top: 8px;">
        <div style="font-size: 13px; font-weight: 700; color: #0369a1; margin-bottom: 3px;">Recomendação à Diretoria da Âncora Saúde</div>
        <div style="font-size: 10.5px; color: #334155;">"Aprovar o início imediato da Etapa 1 (Preparação e Piloto com 5 a 10 corretores) para validar na prática todos os ganhos operacionais e financeiros apresentados."</div>
      </div>
    </div>

    <div class="footer">
      <div>Âncora Saúde | Âncora CRM — Relatório Interno para a Diretoria</div>
      <div>Página 11 de 11</div>
    </div>
  </div>

</body>
</html>`;

async function generatePDF() {
  const outputPath = path.join(process.cwd(), "Relatorio_Custos_Infraestrutura_AncoraHub.pdf");

  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.setContent(htmlContent, { waitUntil: "networkidle" });

  await page.pdf({
    path: outputPath,
    format: "A4",
    printBackground: true,
    margin: {
      top: "6mm",
      bottom: "6mm",
      left: "8mm",
      right: "8mm"
    }
  });

  await browser.close();
  console.log(`Master PDF de 11 páginas gerado com sucesso em: ${outputPath}`);
}

generatePDF().catch(err => {
  console.error("Erro ao gerar PDF:", err);
  process.exit(1);
});
