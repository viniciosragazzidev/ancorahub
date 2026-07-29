from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output" / "pdf" / "ancorahub-apresentacao-rapida.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

PAGE_W, PAGE_H = A4
NAVY = colors.HexColor("#102A43")
BLUE = colors.HexColor("#1677D2")
BLUE_SOFT = colors.HexColor("#EAF4FF")
INK = colors.HexColor("#16202A")
MUTED = colors.HexColor("#5C6B7A")
LINE = colors.HexColor("#DDE5EC")
SURFACE = colors.HexColor("#F7F9FB")
GREEN = colors.HexColor("#147A50")
GREEN_SOFT = colors.HexColor("#EAF7F1")
AMBER = colors.HexColor("#9A5B00")
AMBER_SOFT = colors.HexColor("#FFF5DE")


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="CoverEyebrow", parent=styles["Normal"], fontName="Helvetica-Bold",
    fontSize=9, leading=12, textColor=colors.white, spaceAfter=12,
))
styles.add(ParagraphStyle(
    name="CoverTitle", parent=styles["Normal"], fontName="Helvetica-Bold",
    fontSize=31, leading=36, textColor=colors.white, spaceAfter=14,
))
styles.add(ParagraphStyle(
    name="CoverBody", parent=styles["Normal"], fontName="Helvetica",
    fontSize=13, leading=19, textColor=colors.HexColor("#DCEAF7"), spaceAfter=18,
))
styles.add(ParagraphStyle(
    name="Kicker", parent=styles["Normal"], fontName="Helvetica-Bold",
    fontSize=8, leading=11, textColor=BLUE, spaceAfter=5,
))
styles.add(ParagraphStyle(
    name="H1", parent=styles["Normal"], fontName="Helvetica-Bold",
    fontSize=21, leading=26, textColor=INK, spaceAfter=9,
))
styles.add(ParagraphStyle(
    name="H2", parent=styles["Normal"], fontName="Helvetica-Bold",
    fontSize=12, leading=15, textColor=INK, spaceAfter=4,
))
styles.add(ParagraphStyle(
    name="Body", parent=styles["Normal"], fontName="Helvetica",
    fontSize=9.5, leading=14, textColor=MUTED, spaceAfter=6,
))
styles.add(ParagraphStyle(
    name="Small", parent=styles["Normal"], fontName="Helvetica",
    fontSize=8.2, leading=11, textColor=MUTED,
))
styles.add(ParagraphStyle(
    name="CardTitle", parent=styles["Normal"], fontName="Helvetica-Bold",
    fontSize=10.5, leading=14, textColor=INK, spaceAfter=3,
))
styles.add(ParagraphStyle(
    name="CardBody", parent=styles["Normal"], fontName="Helvetica",
    fontSize=8.5, leading=12, textColor=MUTED,
))
styles.add(ParagraphStyle(
    name="TableHead", parent=styles["Normal"], fontName="Helvetica-Bold",
    fontSize=8.5, leading=11, textColor=colors.white,
))
styles.add(ParagraphStyle(
    name="TableCell", parent=styles["Normal"], fontName="Helvetica",
    fontSize=8.3, leading=11.5, textColor=INK,
))
styles.add(ParagraphStyle(
    name="TableCellMuted", parent=styles["Normal"], fontName="Helvetica",
    fontSize=8.3, leading=11.5, textColor=MUTED,
))


def P(text, style="Body"):
    return Paragraph(text, styles[style])


def page_chrome(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.45)
    canvas.line(18 * mm, PAGE_H - 15 * mm, PAGE_W - 18 * mm, PAGE_H - 15 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(18 * mm, 10 * mm, "AncoraHub | Apresentação rápida")
    canvas.drawRightString(PAGE_W - 18 * mm, 10 * mm, f"{doc.page}")
    canvas.restoreState()


def cover(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor("#0E65AD"))
    canvas.circle(PAGE_W - 18 * mm, PAGE_H - 34 * mm, 54 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor("#12395A"))
    canvas.circle(PAGE_W - 6 * mm, 23 * mm, 35 * mm, fill=1, stroke=0)
    canvas.setStrokeColor(colors.HexColor("#66B6F6"))
    canvas.setLineWidth(1)
    canvas.line(18 * mm, 36 * mm, PAGE_W - 18 * mm, 36 * mm)
    canvas.setFillColor(colors.HexColor("#BBDCF7"))
    canvas.setFont("Helvetica", 8)
    canvas.drawString(18 * mm, 25 * mm, "Produto de operação comercial para corretoras de saúde")
    canvas.restoreState()


def capability_card(title, headline, detail, tone="blue"):
    """A self-contained card sized by its parent grid, never by nested columns."""
    bg = BLUE_SOFT if tone == "blue" else GREEN_SOFT if tone == "green" else AMBER_SOFT
    accent = BLUE if tone == "blue" else GREEN if tone == "green" else AMBER
    content = P(
        f"<b>{title}</b><br/><font color='#16202A'>{headline}</font><br/>{detail}",
        "CardBody",
    )
    table = Table([[content]], colWidths=[77 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("LINEBEFORE", (0, 0), (0, -1), 3, accent),
        ("BOX", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    return table


story = []

# Cover
story.append(Spacer(1, 52 * mm))
story.append(P("ANCORAHUB", "CoverEyebrow"))
story.append(P("Transforme cada novo contato em uma oportunidade acompanhada do início ao fim.", "CoverTitle"))
story.append(P("O AncoraHub organiza a operação comercial da corretora: recebe leads, prepara o atendimento, distribui para a pessoa certa e dá visibilidade para quem precisa decidir.", "CoverBody"))
story.append(Spacer(1, 12 * mm))
cover_summary = Table([
    [P("Do primeiro contato ao pós-venda", "CoverEyebrow"), P("Operação que não perde oportunidades", "CoverEyebrow")],
    [P("Sem planilhas. Sem grupos desorganizados.", "CoverBody"), P("Mais controle para crescer com previsibilidade.", "CoverBody")],
], colWidths=[78 * mm, 78 * mm])
cover_summary.setStyle(TableStyle([
    ("LINEABOVE", (0, 0), (-1, 0), 0.5, colors.HexColor("#4D7A9F")),
    ("TOPPADDING", (0, 0), (-1, -1), 9),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
]))
story.append(cover_summary)
story.append(NextPageTemplate("body"))
story.append(PageBreak())

# Product and roles
story.append(P("COMO FUNCIONA NA PRÁTICA", "Kicker"))
story.append(P("Cada novo contato segue um fluxo único, organizado e rastreável.", "H1"))
story.append(P("Não importa de onde o cliente veio. O AncoraHub transforma a entrada de um novo contato em uma oportunidade acompanhada, com responsável e próximo passo definidos."))
story.append(Spacer(1, 4 * mm))
flow = Table([
    [P("1. O cliente entra em contato", "CardTitle"), P("2. O atendimento é preparado", "CardTitle"), P("3. O sistema escolhe quem atende", "CardTitle"), P("4. O corretor recebe um cliente pronto", "CardTitle")],
    [P("WhatsApp, landing page, Meta, Google, site ou indicação: todos os contatos entram no mesmo fluxo.", "CardBody"), P("Quando configurado, o Agente identifica a necessidade, coleta as informações essenciais e prepara o atendimento antes do corretor assumir.", "CardBody"), P("A distribuição considera plantões, disponibilidade, prioridade e regras definidas pela empresa. Sem alguém elegível, o caso vai para acompanhamento do gestor.", "CardBody"), P("O corretor recebe histórico, dados coletados e próxima ação recomendada. Assim atende melhor, com menos tempo procurando informações.", "CardBody")],
], colWidths=[39 * mm] * 4)
flow.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), SURFACE),
    ("BOX", (0, 0), (-1, -1), 0.5, LINE),
    ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 9),
    ("RIGHTPADDING", (0, 0), (-1, -1), 9),
    ("TOPPADDING", (0, 0), (-1, -1), 9),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
]))
story.append(flow)
story.append(Spacer(1, 8 * mm))
story.append(P("RESPONSABILIDADE CLARA PARA CADA PAPEL", "Kicker"))
roles = [
    [P("Perfil", "TableHead"), P("O que consegue fazer", "TableHead"), P("Exemplo simples", "TableHead")],
    [P("Diretor", "TableCell"), P("Controla a operação comercial da empresa, define regras, acompanha a evolução e garante que todos os leads sejam tratados corretamente.", "TableCellMuted"), P("Define como os leads de cada unidade devem ser entregues e acompanha os pontos que precisam de atenção.", "TableCellMuted")],
    [P("Gestor", "TableCell"), P("Gerencia a unidade em tempo real, acompanha a equipe, resolve gargalos e evita que atendimentos fiquem parados.", "TableCellMuted"), P("Recebe um alerta de plantão sem cobertura e ajusta a escala antes que isso vire uma oportunidade perdida.", "TableCellMuted")],
    [P("Corretor", "TableCell"), P("Recebe clientes preparados para atendimento, acompanha o histórico completo e registra cada evolução da negociação.", "TableCellMuted"), P("Abre a conversa já sabendo o que o cliente procura e qual deve ser o próximo passo.", "TableCellMuted")],
]
role_table = Table(roles, colWidths=[27 * mm, 83 * mm, 50 * mm], repeatRows=1)
role_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
    ("BOX", (0, 0), (-1, -1), 0.5, LINE),
    ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ("TOPPADDING", (0, 0), (-1, -1), 8),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
]))
story.append(role_table)
story.append(PageBreak())

# Capabilities
story.append(P("TUDO O QUE A OPERAÇÃO PRECISA", "Kicker"))
story.append(P("Um único sistema para transformar atendimento em resultado.", "H1"))
story.append(P("O AncoraHub conecta o que normalmente fica espalhado: entrada de leads, distribuição, atendimento, gestão de equipe, vendas e acompanhamento."))
story.append(Spacer(1, 3 * mm))
capability_rows = [
    ("Recebimento", "Todo novo contato é encontrado.", "Leads centralizados, origem identificada e histórico completo desde a primeira mensagem."),
    ("Distribuição", "A oportunidade chega a quem pode atender.", "Entrega automática ou manual, plantões, prioridades, capacidade e acompanhamento de exceções."),
    ("Atendimento", "Uma conversa mais preparada.", "Histórico, próxima ação, feedback, WhatsApp e Agente Inteligente de Atendimento para qualificar e encaminhar."),
    ("Gestão", "A equipe trabalha com direção clara.", "Unidades, equipes, permissões, alertas, cobertura de plantão e registros de mudanças importantes."),
    ("Comercial", "Do interesse à venda.", "Clientes, beneficiários, documentos, cotações, registro de venda e acompanhamento pós-venda."),
    ("Agente Inteligente", "Apoio sem tirar o controle humano.", "Conversa com o cliente, identifica necessidade, coleta informações importantes e prepara a passagem para o corretor."),
    ("Atendimento integrado ao WhatsApp", "Menos perda de contexto.", "O CRM mantém a jornada organizada; templates e status ajudam a acompanhar o que foi enviado e recebido."),
    ("Segurança e controle", "Cada pessoa vê apenas o que precisa.", "Permissões por papel, unidade e carteira, além de histórico para entender o que aconteceu em cada etapa."),
]
cards = []
for i in range(0, len(capability_rows), 2):
    left = capability_card(*capability_rows[i], tone="blue" if i % 4 == 0 else "green")
    right = capability_card(*capability_rows[i + 1], tone="green" if i % 4 == 0 else "blue")
    cards.append([left, "", right])
capability_table = Table(cards, colWidths=[77 * mm, 5 * mm, 77 * mm], hAlign="LEFT")
capability_table.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ("TOPPADDING", (0, 0), (-1, -1), 0),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
]))
story.append(capability_table)
story.append(Spacer(1, 5 * mm))
story.append(P("O diferencial", "H2"))
story.append(P("O AncoraHub não é apenas um CRM. É uma plataforma para organizar toda a operação comercial de uma corretora de planos de saúde, do primeiro contato ao pós-venda."))
story.append(PageBreak())

# Example flows
story.append(P("UM DIA COMUM DENTRO DA CORRETORA", "Kicker"))
story.append(P("A operação segue em frente, mesmo quando muita coisa acontece ao mesmo tempo.", "H1"))
story.append(P("O sistema dá contexto para a equipe agir rápido e ajuda a não deixar oportunidades paradas. Veja três situações comuns."))
story.append(Spacer(1, 4 * mm))
examples = [
    [P("09:12\nNovo cliente", "TableHead"), P("“Quero plano para minha família.” O sistema identifica a origem, inicia a qualificação quando ela estiver habilitada, reúne os dados essenciais e entrega o caso ao corretor certo. Quando ele abre a conversa, já entende o pedido do cliente.", "TableCellMuted")],
    [P("10:40\nPlantão sem cobertura", "TableHead"), P("O gestor recebe um alerta de escala incompleta. Ele adiciona ou move um corretor elegível e acompanha a cobertura. Enquanto isso, os corretores já escalados continuam aptos a receber novos contatos.", "TableCellMuted")],
    [P("15:30\nCliente pede humano", "TableHead"), P("A automação interrompe a conversa na hora. O corretor é avisado e o cliente continua exatamente de onde parou, sem receber novas perguntas repetidas ou mensagens automáticas fora de contexto.", "TableCellMuted")],
]
example_table = Table(examples, colWidths=[48 * mm, 112 * mm])
example_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (0, -1), NAVY),
    ("BOX", (0, 0), (-1, -1), 0.5, LINE),
    ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 9),
    ("RIGHTPADDING", (0, 0), (-1, -1), 9),
    ("TOPPADDING", (0, 0), (-1, -1), 10),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
]))
story.append(example_table)
story.append(Spacer(1, 9 * mm))
story.append(P("O que cada pessoa ganha", "H2"))
benefits = Table([
    [P("Para o Diretor", "CardTitle"), P("Para o Gestor", "CardTitle"), P("Para o Corretor", "CardTitle")],
    [P("Visão completa da operação, regras padronizadas e mais previsibilidade para crescer.", "CardBody"), P("Mais controle da equipe, menos redistribuição manual e alertas quando algo exige atenção.", "CardBody"), P("Menos tempo procurando informações e mais tempo atendendo um cliente já preparado.", "CardBody")],
], colWidths=[53 * mm] * 3)
benefits.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
    ("BOX", (0, 0), (-1, -1), 0.5, LINE),
    ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 9),
    ("RIGHTPADDING", (0, 0), (-1, -1), 9),
    ("TOPPADDING", (0, 0), (-1, -1), 9),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
]))
story.append(benefits)
story.append(PageBreak())

# Roadmap
story.append(P("PLATAFORMA PREPARADA PARA CRESCER", "Kicker"))
story.append(P("O fluxo principal permanece. A capacidade de atendimento evolui.", "H1"))
story.append(P("O AncoraHub foi criado para crescer junto com a operação. Novas capacidades podem ser incorporadas sem obrigar a equipe a reaprender a rotina de trabalho."))
roadmap = [
    [P("Evolução", "TableHead"), P("Como a plataforma pode crescer", "TableHead"), P("Valor para a corretora", "TableHead")],
    [P("IA cada vez mais inteligente", "TableCell"), P("Treinamento contínuo, base de conhecimento privada, simulações e melhoria supervisionada das conversas.", "TableCellMuted"), P("Atendimento mais padronizado e respostas comerciais usadas apenas quando houver informação validada.", "TableCellMuted")],
    [P("Distribuição mais inteligente", "TableCell"), P("Ranking configurável, especialidades, novas regras de prioridade e automações de redistribuição.", "TableCellMuted"), P("Mais velocidade para entregar o lead certo à pessoa certa, mesmo em operações maiores.", "TableCellMuted")],
    [P("Expansão da operação", "TableCell"), P("Mais unidades, mais equipes, novas integrações e controles de operação por contexto.", "TableCellMuted"), P("Crescer sem perder padrão, visibilidade ou controle sobre a jornada do cliente.", "TableCellMuted")],
    [P("Assistente do corretor", "TableCell"), P("Mais contexto no WhatsApp Web, tarefas, sugestões avaliáveis e apoio por situação de atendimento.", "TableCellMuted"), P("Uma equipe mais rápida e segura, com menos dependência de anotações e memória individual.", "TableCellMuted")],
]
roadmap_table = Table(roadmap, colWidths=[35 * mm, 78 * mm, 47 * mm], repeatRows=1)
roadmap_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
    ("BOX", (0, 0), (-1, -1), 0.5, LINE),
    ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ("TOPPADDING", (0, 0), (-1, -1), 8),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
]))
story.append(roadmap_table)
story.append(Spacer(1, 9 * mm))
closing = Table([[P("O resultado esperado", "CardTitle"), P("Todos os leads centralizados. Atendimento mais padronizado. Distribuição organizada. Histórico completo. Mais controle da equipe. Mais previsibilidade para crescer.", "CardBody")]], colWidths=[50 * mm, 110 * mm])
closing.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), BLUE_SOFT),
    ("LINEBEFORE", (0, 0), (0, -1), 3, BLUE),
    ("BOX", (0, 0), (-1, -1), 0.4, LINE),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 10),
    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ("TOPPADDING", (0, 0), (-1, -1), 10),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
]))
story.append(closing)

# Implementation next steps
story.append(PageBreak())
story.append(P("PRÓXIMOS PASSOS", "Kicker"))
story.append(P("Um caminho simples para colocar a primeira operação no ar.", "H1"))
story.append(P("A primeira build interna deve começar pequena, com responsáveis claros e aprendizado rápido. O objetivo não é ativar tudo de uma vez: é validar o fluxo completo antes de ampliar."))
next_steps = [
    [P("1. Preparar a operação", "TableHead"), P("Escolher a unidade piloto, cadastrar equipe, definir responsáveis, confirmar filas e montar os primeiros plantões.", "TableCellMuted")],
    [P("2. Configurar o atendimento", "TableHead"), P("Definir quais leads entram na qualificação, revisar perguntas, preparar templates aprovados e confirmar quando o atendimento deve passar para um humano.", "TableCellMuted")],
    [P("3. Validar a distribuição", "TableHead"), P("Simular a chegada de leads dentro e fora do horário, com plantão disponível, sem cobertura e com necessidade de fila central.", "TableCellMuted")],
    [P("4. Treinar a equipe", "TableHead"), P("Diretor e Gestor aprendem a acompanhar alertas; corretores praticam atualizar o atendimento, registrar resultado e usar o WhatsApp com contexto.", "TableCellMuted")],
    [P("5. Rodar o piloto", "TableHead"), P("Começar com uma unidade e um volume controlado. Acompanhar diariamente os casos que ficaram sem responsável, sem retorno ou com falha de automação.", "TableCellMuted")],
    [P("6. Ajustar e expandir", "TableHead"), P("Corrigir regras, reforçar cobertura e só então adicionar novas unidades, equipes e origens de leads.", "TableCellMuted")],
]
next_steps_table = Table(next_steps, colWidths=[48 * mm, 112 * mm])
next_steps_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (0, -1), NAVY),
    ("BOX", (0, 0), (-1, -1), 0.5, LINE),
    ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 9),
    ("RIGHTPADDING", (0, 0), (-1, -1), 9),
    ("TOPPADDING", (0, 0), (-1, -1), 9),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
]))
story.append(next_steps_table)
story.append(Spacer(1, 8 * mm))
story.append(P("Critério para avançar", "H2"))
story.append(P("A unidade piloto só deve avançar quando a equipe conseguir identificar rapidamente: quem recebeu cada lead, quem está de plantão, quais atendimentos precisam de ação e o que fazer quando não houver corretor disponível."))

# Test plan
story.append(PageBreak())
story.append(P("PLANO DE TESTES", "Kicker"))
story.append(P("Antes de ampliar, testar o que realmente pode travar a operação.", "H1"))
story.append(P("O teste não serve apenas para encontrar erro técnico. Ele confirma que a equipe entende o fluxo e consegue resolver situações reais sem depender de improviso."))
test_rows = [
    [P("Cenário", "TableHead"), P("O que validar", "TableHead"), P("Resultado esperado", "TableHead")],
    [P("Novo lead", "TableCell"), P("Lead vindo de cada origem configurada.", "TableCellMuted"), P("Entra uma única vez, com origem, unidade e histórico visíveis.", "TableCellMuted")],
    [P("Qualificação", "TableCell"), P("Perguntas do agente, respostas curtas, mídia e pedido de humano.", "TableCellMuted"), P("Conversa natural, sem repetição; humano interrompe a automação imediatamente.", "TableCellMuted")],
    [P("Distribuição", "TableCell"), P("Plantão ativo, corretor indisponível, exclusão e ausência de cobertura.", "TableCellMuted"), P("Lead vai para pessoa elegível ou para a fila central, sempre com motivo visível.", "TableCellMuted")],
    [P("Atendimento", "TableCell"), P("Atualização de status, próxima ação, feedback e retorno do cliente.", "TableCellMuted"), P("Histórico fica organizado e o corretor sabe qual é a próxima ação.", "TableCellMuted")],
    [P("WhatsApp", "TableCell"), P("Template, confirmação de entrega e mensagens repetidas do provedor.", "TableCellMuted"), P("Sem mensagens duplicadas e sem perda do registro no CRM.", "TableCellMuted")],
    [P("Permissões", "TableCell"), P("Acesso de Diretor, Gestor e Corretor em unidades diferentes.", "TableCellMuted"), P("Cada perfil visualiza e altera somente o que está autorizado.", "TableCellMuted")],
]
test_table = Table(test_rows, colWidths=[34 * mm, 71 * mm, 55 * mm], repeatRows=1)
test_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
    ("BOX", (0, 0), (-1, -1), 0.5, LINE),
    ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ("TOPPADDING", (0, 0), (-1, -1), 8),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
]))
story.append(test_table)
story.append(Spacer(1, 8 * mm))
story.append(P("Como registrar o teste", "H2"))
story.append(P("Para cada cenário, registrar data, responsável, resultado, evidência e ação de correção. Use apenas dados sintéticos nos testes e trate qualquer falha de entrega, permissão ou duplicidade como bloqueadora antes da expansão."))

# Go-live checklist
story.append(PageBreak())
story.append(P("ENTRADA EM OPERAÇÃO", "Kicker"))
story.append(P("Checklist para liberar a primeira build interna com segurança.", "H1"))
story.append(P("A liberação deve ser gradual, reversível e acompanhada. Se alguma parte crítica falhar, a equipe precisa conseguir pausar a automação e continuar trabalhando pelo fluxo seguro."))
go_live_cards = [
    ("Pessoas", "Diretor, Gestor e corretores do piloto confirmados, com acessos corretos e responsáveis definidos."),
    ("Regras", "Filas, unidades, plantões, cobertura mínima, exclusões e caminho para a fila central revisados."),
    ("Atendimento", "Templates aprovados, perguntas de qualificação revisadas e regra de passagem para humano confirmada."),
    ("Integrações", "Canal WhatsApp, notificações e origens de leads testados com dados sintéticos antes do uso real."),
    ("Acompanhamento", "Gestor sabe onde ver alertas, pendências e exceções; Diretor recebe a rotina de revisão do piloto."),
    ("Plano de reversão", "Automação pode ser pausada por tenant sem apagar histórico; novos leads seguem o fluxo direto seguro quando necessário."),
]
go_live_rows = []
for i in range(0, len(go_live_cards), 2):
    go_live_rows.append([
        capability_card(go_live_cards[i][0], "Pronto para conferir.", go_live_cards[i][1], tone="green"),
        "",
        capability_card(go_live_cards[i + 1][0], "Pronto para conferir.", go_live_cards[i + 1][1], tone="blue"),
    ])
go_live_table = Table(go_live_rows, colWidths=[77 * mm, 5 * mm, 77 * mm], hAlign="LEFT")
go_live_table.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ("TOPPADDING", (0, 0), (-1, -1), 0),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
]))
story.append(go_live_table)
story.append(Spacer(1, 6 * mm))
story.append(P("Primeira semana", "H2"))
story.append(P("Revisar diariamente volume de leads, tempo até atribuição, lacunas de plantão, conversas transferidas para humano, erros de integração e atendimentos sem próxima ação. A partir desses dados, ajustar uma regra por vez e registrar a mudança."))

# Platform infrastructure
story.append(PageBreak())
story.append(P("INFRAESTRUTURA DA PLATAFORMA", "Kicker"))
story.append(P("Uma base preparada para manter a operação estável e pronta para crescer.", "H1"))
story.append(P("O AncoraHub utiliza serviços especializados para garantir disponibilidade, segurança e continuidade da operação. Alguns desses serviços possuem cobrança por uso e serão dimensionados de acordo com o volume de atendimentos, usuários e integrações da empresa."))
story.append(Spacer(1, 4 * mm))
story.append(P("Custos em análise e homologação", "H2"))
story.append(P("Neste momento, os custos operacionais ainda estão em fase de análise e homologação. O objetivo é definir uma estrutura equilibrada: preparada para o crescimento da corretora, sem comprometer desempenho ou previsibilidade financeira."))
story.append(Spacer(1, 5 * mm))
infra_rows = [
    ("WhatsApp Business", "A API oficial mantém o atendimento conectado ao CRM. As tarifas seguem o modelo de cobrança e as categorias de conversa definidos pela Meta."),
    ("Servidores e processamento", "Mantêm a aplicação disponível e executam automações, integrações, filas de processamento, APIs e recursos de atendimento."),
    ("Banco de dados e arquivos", "Guardam leads, histórico, usuários, tarefas, auditoria, documentos, anexos e configurações com controles de acesso."),
    ("Inteligência Artificial", "Apoia qualificação, sugestões ao corretor e consulta de conhecimento. O consumo varia conforme interações, modelos e recursos habilitados."),
    ("Monitoramento e segurança", "Ajudam a observar disponibilidade, manter logs, auditoria e backups, e reduzir impactos de falhas operacionais."),
    ("Integrações", "Alguns fornecedores de mensagens, telefonia, e-mail, marketing ou outros serviços podem ter custos próprios."),
]
infra_table_rows = []
for i in range(0, len(infra_rows), 2):
    infra_table_rows.append([
        capability_card(infra_rows[i][0], "Base para uma operação confiável.", infra_rows[i][1], tone="blue"),
        "",
        capability_card(infra_rows[i + 1][0], "Base para uma operação confiável.", infra_rows[i + 1][1], tone="green"),
    ])
infra_table = Table(infra_table_rows, colWidths=[77 * mm, 5 * mm, 77 * mm], hAlign="LEFT")
infra_table.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ("TOPPADDING", (0, 0), (-1, -1), 0),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
]))
story.append(infra_table)

story.append(PageBreak())
story.append(P("MODELO DE COBRANÇA", "Kicker"))
story.append(P("A infraestrutura acompanha o crescimento da operação.", "H1"))
story.append(P("A proposta é dimensionar a maior parte da infraestrutura conforme o uso. Assim, empresas menores não assumem custos desnecessários e operações maiores contam com uma base compatível com seu volume de atendimento."))
cost_rows = [
    [P("Componente", "TableHead"), P("Finalidade", "TableHead"), P("Modelo de cobrança", "TableHead")],
    [P("WhatsApp Business API", "TableCell"), P("Envio e recebimento de mensagens pelo canal oficial.", "TableCellMuted"), P("Conforme tabela e política oficial da Meta.", "TableCellMuted")],
    [P("Servidores", "TableCell"), P("Execução do sistema, integrações e automações.", "TableCellMuted"), P("Conforme capacidade utilizada.", "TableCellMuted")],
    [P("Banco de dados", "TableCell"), P("Armazenamento das informações da operação.", "TableCellMuted"), P("Conforme volume de dados e recursos contratados.", "TableCellMuted")],
    [P("Armazenamento", "TableCell"), P("Documentos, anexos, materiais e arquivos da base de conhecimento.", "TableCellMuted"), P("Conforme espaço utilizado.", "TableCellMuted")],
    [P("Inteligência Artificial", "TableCell"), P("Atendimento automatizado, qualificação e sugestões.", "TableCellMuted"), P("Conforme consumo de tokens, modelos e recursos utilizados.", "TableCellMuted")],
    [P("Monitoramento e backups", "TableCell"), P("Segurança, continuidade, auditoria e acompanhamento da plataforma.", "TableCellMuted"), P("Conforme infraestrutura contratada.", "TableCellMuted")],
    [P("Integrações", "TableCell"), P("Serviços externos utilizados pela empresa.", "TableCellMuted"), P("Conforme fornecedor contratado.", "TableCellMuted")],
]
cost_table = Table(cost_rows, colWidths=[42 * mm, 67 * mm, 51 * mm], repeatRows=1)
cost_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
    ("BOX", (0, 0), (-1, -1), 0.5, LINE),
    ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ("TOPPADDING", (0, 0), (-1, -1), 8),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
]))
story.append(cost_table)
story.append(Spacer(1, 8 * mm))
story.append(P("Observação importante", "H2"))
story.append(P("Os custos de infraestrutura são independentes do desenvolvimento da plataforma e seguem as políticas comerciais dos fornecedores envolvidos, como Meta, provedores de nuvem, banco de dados, armazenamento e Inteligência Artificial. Os valores finais serão definidos após testes de carga, homologação das integrações oficiais e validação do ambiente de produção."))

# Transformation
story.append(PageBreak())
story.append(P("A TRANSFORMAÇÃO DA OPERAÇÃO", "Kicker"))
story.append(P("O valor não está em ter mais uma ferramenta. Está em trabalhar melhor todos os dias.", "H1"))
story.append(P("O AncoraHub substitui uma operação espalhada e reativa por uma rotina organizada, com responsáveis, histórico e próximos passos claros."))
transformation = [
    [P("Antes", "TableHead"), P("Depois com AncoraHub", "TableHead")],
    [P("Leads espalhados em mensagens, planilhas e anotações.", "TableCellMuted"), P("Todos os contatos centralizados no mesmo fluxo.", "TableCellMuted")],
    [P("Distribuição manual ou sem critério claro.", "TableCellMuted"), P("Distribuição orientada por unidade, fila, plantão e regras da empresa.", "TableCellMuted")],
    [P("Atendimento com informações perdidas ou repetidas.", "TableCellMuted"), P("Histórico completo, dados coletados e próxima ação visível.", "TableCellMuted")],
    [P("Decisões sem registro e difícil acompanhamento.", "TableCellMuted"), P("Mudanças relevantes, responsáveis e exceções com rastreabilidade.", "TableCellMuted")],
    [P("Equipe trabalha de forma isolada.", "TableCellMuted"), P("Diretor, Gestor e Corretor atuam sobre a mesma visão operacional.", "TableCellMuted")],
    [P("Crescimento aumenta a desorganização.", "TableCellMuted"), P("A operação pode ganhar unidades, pessoas e regras sem trocar de sistema.", "TableCellMuted")],
]
transformation_table = Table(transformation, colWidths=[80 * mm, 80 * mm], repeatRows=1)
transformation_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (0, 0), AMBER),
    ("BACKGROUND", (1, 0), (1, 0), GREEN),
    ("BOX", (0, 0), (-1, -1), 0.5, LINE),
    ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 9),
    ("RIGHTPADDING", (0, 0), (-1, -1), 9),
    ("TOPPADDING", (0, 0), (-1, -1), 9),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
]))
story.append(transformation_table)
story.append(Spacer(1, 9 * mm))
story.append(P("Muito mais que um CRM", "H2"))
story.append(P("O AncoraHub foi desenvolvido para organizar toda a operação comercial de uma corretora de planos de saúde. Mais do que guardar contatos, conecta pessoas, processos e tecnologia para acompanhar cada oportunidade do primeiro contato ao pós-venda."))

# Platform overview
story.append(PageBreak())
story.append(P("VISÃO GERAL DA PLATAFORMA", "Kicker"))
story.append(P("Uma jornada única, do interesse do cliente à gestão da empresa.", "H1"))
story.append(P("Esta visão resume como os canais, o atendimento e a gestão se conectam. Cada etapa compartilha contexto com a próxima, sem obrigar a equipe a recomeçar a conversa ou procurar dados em outro lugar."))
platform_flow = [
    [P("CAPTAÇÃO", "TableHead")],
    [P("Landing pages • Meta • WhatsApp • Site • Indicação • Integrações", "TableCellMuted")],
    [P("CENTRAL DE LEADS", "TableHead")],
    [P("Origem, histórico, dados do cliente, status e próxima ação", "TableCellMuted")],
    [P("AGENTE INTELIGENTE", "TableHead")],
    [P("Qualifica quando habilitado, responde o básico com segurança e encaminha para a equipe", "TableCellMuted")],
    [P("DISTRIBUIÇÃO E CORRETOR", "TableHead")],
    [P("Regras, plantões, filas, atendimento humano, tarefas e acompanhamento", "TableCellMuted")],
    [P("VENDA, PÓS-VENDA E DIRETOR", "TableHead")],
    [P("Documentos, beneficiários, vendas, retornos e visão da operação", "TableCellMuted")],
]
platform_table = Table(platform_flow, colWidths=[160 * mm], hAlign="LEFT")
platform_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (0, 0), NAVY),
    ("BACKGROUND", (0, 2), (0, 2), NAVY),
    ("BACKGROUND", (0, 4), (0, 4), NAVY),
    ("BACKGROUND", (0, 6), (0, 6), NAVY),
    ("BACKGROUND", (0, 8), (0, 8), NAVY),
    ("BOX", (0, 0), (-1, -1), 0.5, LINE),
    ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("LEFTPADDING", (0, 0), (-1, -1), 10),
    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ("TOPPADDING", (0, 0), (-1, -1), 8),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
]))
story.append(platform_table)
story.append(Spacer(1, 8 * mm))
story.append(P("Arquitetura explicada de forma simples", "H2"))
story.append(P("Cliente → WhatsApp e outros canais → AncoraHub → Agente e regras da empresa → Corretor → Diretor. O AncoraHub é a camada que organiza a informação e coordena o trabalho entre todas essas pontas."))

# Differentials, security and IA
story.append(PageBreak())
story.append(P("DIFERENCIAIS E CONFIANÇA", "Kicker"))
story.append(P("Tecnologia que ajuda a vender, com a empresa no controle.", "H1"))
story.append(P("O AncoraHub foi pensado para combinar velocidade no atendimento com regras claras, permissões e histórico de decisão."))
differentials = [
    ("Distribuição com contexto", "As regras podem considerar unidade, fila, plantão, disponibilidade e restrições definidas pela empresa."),
    ("Atendimento rastreável", "A equipe acompanha o histórico, quem assumiu o caso e qual é a próxima ação sem depender de memória individual."),
    ("Configuração sem programação", "Diretores e gestores ajustam regras operacionais na própria plataforma, dentro das permissões previstas."),
    ("Operação multiunidade", "Cada unidade pode ter equipe, filas e regras próprias, preservando uma visão geral para a empresa."),
    ("Ambiente isolado", "Dados e regras são separados por empresa; cada usuário acessa apenas o que sua função, unidade e carteira permitem."),
    ("Auditoria e continuidade", "Ações importantes podem ser rastreadas; logs, monitoramento, backups e integrações oficiais ajudam a dar segurança à rotina."),
]
diff_rows = []
for i in range(0, len(differentials), 2):
    diff_rows.append([
        capability_card(differentials[i][0], "Um diferencial operacional.", differentials[i][1], tone="blue"),
        "",
        capability_card(differentials[i + 1][0], "Um diferencial operacional.", differentials[i + 1][1], tone="green"),
    ])
diff_table = Table(diff_rows, colWidths=[77 * mm, 5 * mm, 77 * mm], hAlign="LEFT")
diff_table.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
]))
story.append(diff_table)
story.append(Spacer(1, 6 * mm))
story.append(P("Agente Inteligente de Atendimento", "H2"))
story.append(P("O agente não substitui a equipe. Ele prepara o atendimento: recebe novos contatos, qualifica clientes, coleta dados, responde perguntas frequentes dentro das regras configuradas e encaminha para um corretor quando necessário. A evolução com documentos privados, simulações e treinamento supervisionado permanece uma etapa futura da plataforma."))

# Metrics, implementation and glossary
story.append(PageBreak())
story.append(P("GESTÃO QUE PODE SER ACOMPANHADA", "Kicker"))
story.append(P("Indicadores e implantação feitos para reduzir dúvidas na operação.", "H1"))
story.append(P("A plataforma permite estruturar uma rotina de acompanhamento. No piloto, o foco é olhar os dados que ajudam a agir, e não apenas acumular números."))
metrics = [
    [P("Indicadores a acompanhar", "TableHead"), P("Pergunta que ajuda a responder", "TableHead")],
    [P("Leads recebidos e origem", "TableCell"), P("De onde vêm as oportunidades que chegam à corretora?", "TableCellMuted")],
    [P("Tempo até primeiro atendimento", "TableCell"), P("Quanto tempo o cliente espera até alguém assumir o caso?", "TableCellMuted")],
    [P("Tempo de resposta e SLA", "TableCell"), P("A equipe está atendendo dentro do prazo definido?", "TableCellMuted")],
    [P("Conversão por corretor e unidade", "TableCell"), P("Onde o atendimento está gerando mais resultado?", "TableCellMuted")],
    [P("Cobertura e produtividade", "TableCell"), P("Existem horários, equipes ou plantões que exigem ajuste?", "TableCellMuted")],
    [P("Uso do Agente", "TableCell"), P("A automação está ajudando a preparar conversas e evitar repetições?", "TableCellMuted")],
]
metrics_table = Table(metrics, colWidths=[65 * mm, 95 * mm], repeatRows=1)
metrics_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), NAVY), ("BOX", (0, 0), (-1, -1), 0.5, LINE),
    ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
]))
story.append(metrics_table)
story.append(Spacer(1, 7 * mm))
story.append(P("Como acontece a implantação", "H2"))
story.append(P("1. Configuração inicial → 2. Importação ou cadastro de dados essenciais → 3. Treinamento da equipe → 4. Operação assistida → 5. Uso em produção e expansão gradual."))
story.append(Spacer(1, 5 * mm))
story.append(P("Glossário rápido", "H2"))
story.append(P("<b>Lead:</b> pessoa que demonstrou interesse. &nbsp;&nbsp; <b>Plantão:</b> regra de cobertura por dia e horário. &nbsp;&nbsp; <b>Qualificação:</b> coleta das informações essenciais antes do atendimento. &nbsp;&nbsp; <b>Distribuição:</b> decisão de quem recebe o lead. &nbsp;&nbsp; <b>Próxima ação:</b> o que deve acontecer depois no atendimento."))


doc = BaseDocTemplate(
    str(OUTPUT), pagesize=A4,
    leftMargin=18 * mm, rightMargin=18 * mm, topMargin=23 * mm, bottomMargin=17 * mm,
)
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
doc.addPageTemplates([
    __import__("reportlab.platypus", fromlist=["PageTemplate"]).PageTemplate(id="cover", frames=[frame], onPage=cover),
    __import__("reportlab.platypus", fromlist=["PageTemplate"]).PageTemplate(id="body", frames=[frame], onPage=page_chrome),
])

doc.build(story)
print(OUTPUT)
