from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

OUT = Path(r"C:\Users\kyper\Desktop\Kyper\Projects\ancorahub\output\pdf\Plano_Implementacao_CRM_Ancora_Saude_v4.pdf")
OUT.parent.mkdir(parents=True, exist_ok=True)

NAVY = colors.HexColor("#0B3159")
BLUE = colors.HexColor("#1265B0")
SKY = colors.HexColor("#EAF3FB")
INK = colors.HexColor("#17212B")
MUTED = colors.HexColor("#667085")
LINE = colors.HexColor("#D7E3F0")
GREEN = colors.HexColor("#17805D")
AMBER = colors.HexColor("#A35B00")
RED = colors.HexColor("#B42318")
WHITE = colors.white


def p(text, style):
    return Paragraph(text, style)


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="Kicker", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8,
    leading=10, textColor=BLUE, spaceAfter=8, tracking=1.2,
))
styles.add(ParagraphStyle(
    name="TitleCRM", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=29,
    leading=35, textColor=NAVY, spaceAfter=14,
))
styles.add(ParagraphStyle(
    name="SubtitleCRM", parent=styles["Normal"], fontName="Helvetica", fontSize=13,
    leading=19, textColor=MUTED,
))
styles.add(ParagraphStyle(
    name="H1CRM", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=20,
    leading=25, textColor=NAVY, spaceBefore=0, spaceAfter=13,
))
styles.add(ParagraphStyle(
    name="H2CRM", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=11,
    leading=14, textColor=NAVY, spaceAfter=5,
))
styles.add(ParagraphStyle(
    name="BodyCRM", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.4,
    leading=14, textColor=INK, spaceAfter=7,
))
styles.add(ParagraphStyle(
    name="SmallCRM", parent=styles["Normal"], fontName="Helvetica", fontSize=7.8,
    leading=10.5, textColor=MUTED,
))
styles.add(ParagraphStyle(
    name="CardTitle", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=10,
    leading=13, textColor=NAVY, spaceAfter=4,
))
styles.add(ParagraphStyle(
    name="CardBody", parent=styles["Normal"], fontName="Helvetica", fontSize=8.3,
    leading=11.5, textColor=INK,
))
styles.add(ParagraphStyle(
    name="TableHeader", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8.5,
    leading=11, textColor=WHITE,
))
styles.add(ParagraphStyle(
    name="Metric", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=12.5,
    leading=14.5, textColor=BLUE, alignment=TA_CENTER,
))
styles.add(ParagraphStyle(
    name="MetricLabel", parent=styles["Normal"], fontName="Helvetica", fontSize=7.8,
    leading=10, textColor=MUTED, alignment=TA_CENTER,
))


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.6)
    canvas.line(doc.leftMargin, 1.25 * cm, A4[0] - doc.rightMargin, 1.25 * cm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(doc.leftMargin, 0.78 * cm, "Âncora Saúde  |  Plano de implantação do CRM interno")
    canvas.drawRightString(A4[0] - doc.rightMargin, 0.78 * cm, f"Versão 1.0  |  Agosto de 2026  |  {doc.page}")
    canvas.restoreState()


def card(title, body, width=None):
    content = [[p(title, styles["CardTitle"])], [p(body, styles["CardBody"])]]
    table = Table(content, colWidths=[width] if width else None)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), WHITE),
        ("BOX", (0, 0), (-1, -1), 0.65, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 11),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 11),
    ]))
    return table


def section(title, intro=None):
    items = [p(title, styles["H1CRM"])]
    if intro:
        items.append(p(intro, styles["BodyCRM"]))
        items.append(Spacer(1, 5))
    return items


def bullets(items):
    return [p(f"<bullet>&bull;</bullet>{item}", styles["BodyCRM"]) for item in items]


def table(data, widths, header=True):
    converted = []
    for r, row in enumerate(data):
        converted.append([p(str(cell), styles["TableHeader"] if r == 0 and header else styles["CardBody"]) for cell in row])
    t = Table(converted, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
    commands = [
        ("GRID", (0, 0), (-1, -1), 0.45, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]
    if header:
        commands.extend([("BACKGROUND", (0, 0), (-1, 0), NAVY), ("TEXTCOLOR", (0, 0), (-1, 0), WHITE)])
    for row in range(1 if header else 0, len(data)):
        if row % 2 == 0:
            commands.append(("BACKGROUND", (0, row), (-1, row), colors.HexColor("#F8FBFE")))
    t.setStyle(TableStyle(commands))
    return t


doc = BaseDocTemplate(
    str(OUT), pagesize=A4, leftMargin=2.0 * cm, rightMargin=2.0 * cm,
    topMargin=1.8 * cm, bottomMargin=1.8 * cm,
)
frame = Frame(doc.leftMargin, doc.bottomMargin, A4[0] - doc.leftMargin - doc.rightMargin,
              A4[1] - doc.topMargin - doc.bottomMargin, id="normal")
doc.addPageTemplates([PageTemplate(id="normal", frames=[frame], onPage=footer)])

story = []

# Cover
story += [Spacer(1, 2.4 * cm), p("ÂNCORA SAÚDE", styles["Kicker"]), p("CRM interno", styles["TitleCRM"])]
story += [p("Plano de implantação operacional", styles["SubtitleCRM"]), Spacer(1, 1.0 * cm)]
story.append(Table([[p("Um passo a passo simples para organizar os atendimentos, acompanhar os leads e ajudar a equipe a vender melhor.", styles["BodyCRM"])]], colWidths=[17.0 * cm], style=TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), SKY), ("BOX", (0, 0), (-1, -1), 0.8, BLUE),
    ("LEFTPADDING", (0, 0), (-1, -1), 16), ("RIGHTPADDING", (0, 0), (-1, -1), 16),
    ("TOPPADDING", (0, 0), (-1, -1), 16), ("BOTTOMPADDING", (0, 0), (-1, -1), 16),
])))
story += [Spacer(1, 1.45 * cm)]
cover_data = [
    [p("VERSÃO", styles["SmallCRM"]), p("STATUS", styles["SmallCRM"]), p("PÚBLICO", styles["SmallCRM"])],
    [p("1.0 - Agosto de 2026", styles["CardTitle"]), p("Pronto para piloto", styles["CardTitle"]), p("Diretoria, gestão e corretores", styles["CardTitle"])],
]
story.append(Table(cover_data, colWidths=[5.65 * cm] * 3, style=TableStyle([
    ("LINEABOVE", (0, 0), (-1, 0), 0.8, LINE), ("LINEBELOW", (0, 1), (-1, 1), 0.8, LINE),
    ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
])))
story += [Spacer(1, 5.9 * cm), p("Documento de alinhamento executivo e operacional", styles["SmallCRM"]), PageBreak()]

# Executive summary
story += section("Resumo do plano", "O CRM será o lugar onde a equipe vai cuidar dos leads, atender clientes, organizar tarefas e acompanhar resultados.")
summary_cards = [
    card("Objetivo", "Colocar o CRM para funcionar aos poucos, sem atrapalhar o trabalho da equipe."),
    card("O que entra agora", "Leads, tarefas, WhatsApp oficial, documentos, metas e relatórios simples."),
    card("Como será feito", "Começamos com um grupo pequeno, ajustamos o que for preciso e depois levamos para todos."),
]
story.append(Table([[summary_cards[0], summary_cards[1], summary_cards[2]]], colWidths=[5.56 * cm] * 3, hAlign="LEFT", style=TableStyle([( "VALIGN", (0,0),(-1,-1),"TOP"), ("LEFTPADDING",(0,0),(-1,-1),0), ("RIGHTPADDING",(0,0),(-1,-1),7)])))
story += [Spacer(1, 17)]
story += [p("O que já está decidido", styles["H2CRM"])]
story += bullets([
    "O CRM será a tela principal de trabalho do corretor.",
    "As conversas com clientes serão feitas pelo WhatsApp oficial sempre que ele estiver disponível.",
    "A inteligência artificial pode ajudar com resumos e sugestões, mas uma pessoa aprova qualquer ação importante.",
    "Comissões e relatórios mais detalhados entram em uma próxima etapa.",
])
story += [Spacer(1, 4), p("O que esperamos melhorar", styles["H2CRM"]), card("Uma rotina mais organizada", "Menos leads esquecidos, respostas mais rápidas e mais clareza para saber o que cada pessoa precisa fazer.")]
story.append(PageBreak())

# Scope and foundation
story += section("O que o CRM vai ajudar a fazer", "A primeira versão entrega o que a equipe precisa no dia a dia. Tudo é liberado de acordo com a função de cada pessoa.")
scope_data = [
    ["Área", "O que a equipe poderá fazer", "Cuidado importante"],
    ["Leads e vendas", "Cadastrar leads, acompanhar as etapas, guardar documentos e criar lembretes.", "Cada pessoa vê apenas os leads que pode atender."],
    ["Atendimento", "Ver a conversa, saber quem é o cliente e registrar o que foi feito.", "O envio para o cliente é feito pelo canal oficial."],
    ["Ajuda por IA", "Receber resumo da conversa e sugestões de resposta.", "A pessoa decide antes de enviar ou mudar algo importante."],
    ["Gestão", "Acompanhar metas, atendimento e tarefas da equipe.", "Cada gestor vê apenas a sua equipe."],
    ["Administração", "Criar usuários, definir acessos e ligar ou desligar recursos.", "As mudanças importantes ficam registradas."],
]
story.append(table(scope_data, [3.0 * cm, 7.0 * cm, 7.0 * cm]))
story += [Spacer(1, 17), p("Regras que vamos seguir", styles["H2CRM"])]
principles = [
    ["Privacidade", "Cada pessoa vê apenas as informações necessárias para o seu trabalho."],
    ["Registro", "As mudanças importantes ficam registradas para consulta."],
    ["Controle", "O administrador pode ligar ou desligar recursos quando for necessário."],
    ["Atendimento seguro", "A equipe usa o canal oficial e respeita as regras de contato com o cliente."],
]
story.append(table([["Princípio", "Aplicação"]] + principles, [4.2 * cm, 12.8 * cm]))
story.append(PageBreak())

# Phases
story += section("Como vamos colocar o CRM para funcionar", "Este é o cronograma de implantação. Vamos fazer uma etapa por vez. Só passamos para a próxima quando a anterior estiver funcionando bem.")
phase_data = [
    ["Etapa", "O que vamos fazer", "Quando podemos seguir"],
    ["1. Preparar", "Criar acessos, organizar os dados e conferir se tudo está pronto para começar.", "Quando cada pessoa conseguir entrar e usar o que precisa."],
    ["2. Ensinar os gestores", "Mostrar como acompanhar a equipe, os leads e as tarefas.", "Quando os gestores souberem tirar dúvidas e acompanhar o grupo piloto."],
    ["3. Começar com um grupo pequeno", "De 5 a 10 corretores usam o CRM no trabalho normal.", "Quando o grupo estiver usando o sistema e os problemas mais importantes estiverem resolvidos."],
    ["4. Melhorar", "Ouvir a equipe, corrigir dificuldades e reforçar o treinamento.", "Quando o uso estiver simples, seguro e sem problemas graves."],
    ["5. Levar para mais pessoas", "Colocar novas equipes e unidades no CRM aos poucos.", "Quando o suporte estiver funcionando bem e os resultados forem acompanhados."],
    ["6. Usar como rotina", "Usar o CRM no dia a dia e melhorar continuamente.", "Quando houver uma reunião mensal para olhar os resultados e decidir as melhorias."],
]
story.append(table(phase_data, [3.0 * cm, 7.0 * cm, 7.0 * cm]))
story += [Spacer(1, 16), p("Como vamos acompanhar", styles["H2CRM"])]
cadence = [
    card("Todos os dias no piloto", "A equipe pode pedir ajuda e avisar quando algo não estiver funcionando."),
    card("Toda semana", "Gestão e suporte fazem uma reunião curta para ver dificuldades e melhorias."),
    card("Todo mês", "A diretoria acompanha os resultados e decide os próximos passos."),
]
story.append(Table([[cadence[0], cadence[1], cadence[2]]], colWidths=[5.56 * cm] * 3, style=TableStyle([( "VALIGN", (0,0),(-1,-1),"TOP"), ("LEFTPADDING",(0,0),(-1,-1),0), ("RIGHTPADDING",(0,0),(-1,-1),7)])))
story.append(PageBreak())

# Metrics
story += section("Como saber se está funcionando", "Vamos acompanhar poucos números, fáceis de entender. Antes de começar, vamos anotar como a equipe trabalha hoje para comparar depois.")
metric_cells = [
    [p("Quem está usando", styles["Metric"]), p("Velocidade de resposta", styles["Metric"]), p("Tarefas em atraso", styles["Metric"])],
    [p("Quantas pessoas usam o CRM na semana", styles["MetricLabel"]), p("Tempo entre chegar o lead e falar com ele", styles["MetricLabel"]), p("Quantas tarefas ficaram para depois", styles["MetricLabel"])],
    [p("Leads que avançam", styles["Metric"]), p("Cadastro completo", styles["Metric"]), p("Opinião da equipe", styles["Metric"])],
    [p("Quantos leads passam para a próxima etapa", styles["MetricLabel"]), p("Se as informações importantes foram preenchidas", styles["MetricLabel"]), p("O que as pessoas acham do novo jeito de trabalhar", styles["MetricLabel"])],
]
story.append(Table(metric_cells, colWidths=[5.65 * cm] * 3, rowHeights=[1.0 * cm, 0.8 * cm, 1.0 * cm, 0.8 * cm], style=TableStyle([
    ("BACKGROUND", (0,0), (-1,1), SKY), ("BACKGROUND", (0,2), (-1,3), colors.HexColor("#F8FBFE")),
    ("BOX", (0,0), (-1,-1), 0.6, LINE), ("INNERGRID", (0,0), (-1,-1), 0.45, LINE),
    ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
])))
story += [Spacer(1, 19), p("O que fazer quando um número não estiver bom", styles["H2CRM"])]
metrics_data = [
    ["Se acontecer", "Pode significar", "Vamos fazer"],
    ["Pouca gente usando", "A equipe não entendeu ou encontrou dificuldade.", "Dar ajuda mais de perto e simplificar o que estiver difícil."],
    ["Demora para responder", "Alguns leads estão ficando sem atendimento.", "Ver quem está disponível e organizar melhor a fila."],
    ["Cadastro incompleto", "Faltam informações para continuar o atendimento.", "Mostrar o que precisa ser preenchido e corrigir o processo."],
    ["Poucos leads avançando", "O atendimento ou o acompanhamento pode precisar melhorar.", "Revisar os casos com a gestão e apoiar a equipe."],
]
story.append(table(metrics_data, [3.6 * cm, 6.3 * cm, 7.1 * cm]))
story.append(PageBreak())

# Roles
story += section("Quem faz o quê", "Para o CRM funcionar, cada grupo precisa saber qual é a sua parte.")
raci_data = [
    ["Quem", "O que faz", "Quando"],
    ["Diretoria", "Define metas, aprova a expansão e ajuda a resolver obstáculos.", "Uma vez por mês."],
    ["Gestão", "Acompanha os leads e tarefas da equipe e ajuda no piloto.", "Toda semana."],
    ["Corretores", "Atendem os leads, registram o que aconteceu e avisam quando tiverem dificuldade.", "Todos os dias."],
    ["TI / Produto", "Mantém o sistema, as integrações e a segurança funcionando.", "Acompanha sempre."],
    ["Administrador", "Cuida dos acessos e pode ligar ou desligar recursos.", "Quando necessário."],
]
story.append(table(raci_data, [3.2 * cm, 8.0 * cm, 5.8 * cm]))
story += [Spacer(1, 16), p("Treinamento", styles["H2CRM"])]
training = [
    card("Gestão", "Como olhar a equipe, os leads, as tarefas e os resultados."),
    card("Corretores", "Como atender, criar lembretes, guardar informações e encontrar um lead."),
    card("Suporte", "Como ajudar a equipe e encaminhar problemas quando for preciso."),
]
story.append(Table([[training[0], training[1], training[2]]], colWidths=[5.56 * cm] * 3, style=TableStyle([( "VALIGN", (0,0),(-1,-1),"TOP"), ("LEFTPADDING",(0,0),(-1,-1),0), ("RIGHTPADDING",(0,0),(-1,-1),7)])))
story.append(PageBreak())

# Risks
story += section("Se alguma coisa der errado", "Antes de levar o CRM para toda a empresa, já vamos saber como agir nas situações mais importantes.")
risk_data = [
    ["Situação", "Como evitar", "O que fazer"],
    ["WhatsApp oficial não funciona", "Conferir a integração antes do piloto e acompanhar o status.", "Registrar o atendimento e usar o caminho autorizado até normalizar."],
    ["Informações erradas ou faltando", "Conferir os dados antes de começar e ensinar o preenchimento.", "Corrigir os dados e mostrar para a equipe como fazer certo."],
    ["A equipe não usa o CRM", "Treinar bem, acompanhar os primeiros dias e ouvir as dúvidas.", "Ajudar cada equipe e não ampliar antes de entender o problema."],
    ["Alguém vê algo que não deveria", "Definir acessos corretos e registrar mudanças importantes.", "Bloquear o acesso, investigar e corrigir a permissão."],
    ["A IA ou uma automação falha", "Testar antes, manter controle e pedir confirmação humana.", "Desligar o recurso e continuar pelo processo manual seguro."],
]
story.append(table(risk_data, [4.0 * cm, 6.2 * cm, 6.8 * cm]))
story += [Spacer(1, 18), p("Regra simples", styles["H2CRM"]), card("Primeiro, resolver. Depois, ampliar.", "Se houver um problema grave de acesso, privacidade ou atendimento, paramos a expansão. O administrador pode desligar o recurso afetado enquanto a equipe volta a usar o processo seguro.")]
story.append(PageBreak())

# Actions
story += section("Próximos passos", "Agora é só seguir esta ordem para começar com segurança.")
next_steps = [
    ["1", "Escolher as pessoas responsáveis", "Definir quem cuida do projeto, do piloto, do suporte e dos acessos."],
    ["2", "Escolher o primeiro grupo", "Separar de 5 a 10 corretores para começar usando o CRM."],
    ["3", "Deixar tudo pronto", "Conferir acessos, dados, WhatsApp oficial e permissões."],
    ["4", "Ensinar e começar", "Treinar a equipe e abrir um canal simples para pedir ajuda."],
    ["5", "Ouvir e melhorar", "Toda semana, ver o que funcionou e corrigir o que dificultou o trabalho."],
    ["6", "Levar para mais equipes", "Ampliar somente quando o primeiro grupo estiver usando bem o CRM."],
]
rows = []
for number, title, body in next_steps:
    rows.append([p(number, styles["Metric"]), p(title, styles["CardTitle"]), p(body, styles["CardBody"])])
steps = Table(rows, colWidths=[1.5 * cm, 4.2 * cm, 11.3 * cm])
steps.setStyle(TableStyle([
    ("GRID", (0,0), (-1,-1), 0.45, LINE), ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ("BACKGROUND", (0,0), (0,-1), SKY),
    ("LEFTPADDING", (0,0), (-1,-1), 9), ("RIGHTPADDING", (0,0), (-1,-1), 9),
    ("TOPPADDING", (0,0), (-1,-1), 10), ("BOTTOMPADDING", (0,0), (-1,-1), 10),
]))
story.append(steps)
story += [Spacer(1, 28), p("Mensagem final", styles["H2CRM"]), p("Vamos começar pequeno, aprender com a equipe e melhorar antes de levar o CRM para todos.", styles["SubtitleCRM"])]

doc.build(story)
print(OUT)
