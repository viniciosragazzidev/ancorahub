Para sua VPS de **16 GB RAM**, eu faria assim. O ideal é usar **Ubuntu 24.04 LTS + Docker**. A própria Hostinger oferece template com Ubuntu e Docker pré-instalado. ([Hostinger Help Center][1])

### Resumo do que vai rodar nela

```text
VPS Hostinger
├── Ubuntu 24.04 LTS
├── Docker + Docker Compose
├── Fastify API
├── Redis
├── BullMQ
├── Workers
│   ├── automações
│   ├── IA
│   └── RAG/documentos
├── MCP / Tool Gateway
├── WAHA interno
├── Nginx ou Caddy
└── Monitoramento/logs
```

Fora dela continuam:

```text
Vercel
└── Next.js

Supabase
├── PostgreSQL
├── pgvector
└── Storage

OpenRouter
└── IA

Meta
└── WhatsApp Cloud API
```

## 1. Instalar o sistema

Na Hostinger:

**VPS → Gerenciar → SO e Painel → Sistema Operacional**

Procure o template:

**Ubuntu 24.04 + Docker**

A Hostinger atualmente oferece esse template com `docker-ce` e Docker Compose já instalados. ([Hostinger Help Center][1])

Se você já instalou Ubuntu puro, também funciona; Docker pode ser instalado depois.

## 2. Entrar por SSH

Pegue o IP no painel da VPS e conecte:

```bash
ssh root@IP_DA_VPS
```

Depois atualize:

```bash
apt update && apt upgrade -y
```

A Hostinger também recomenda atualizar os pacotes antes da configuração do Docker. ([Hostinger][2])

## 3. Criar usuário administrativo

Evite trabalhar sempre como `root`.

Exemplo:

```bash
adduser deploy
usermod -aG sudo deploy
usermod -aG docker deploy
```

Depois configure uma **SSH Key** para esse usuário.

Mais para frente, desative login SSH por senha e login direto de root.

## 4. Firewall

No próprio painel Hostinger:

**VPS → Segurança → Firewall**

Inicialmente libere somente:

```text
22   SSH
80   HTTP
443  HTTPS
```

A Hostinger possui firewall em nível da própria VPS, antes do tráfego chegar ao Ubuntu. ([Hostinger Help Center][3])

Não exponha:

```text
6379 Redis
PostgreSQL
BullMQ
portas dos Workers
```

para a internet.

Redis deve ficar acessível apenas internamente.

## 5. Estrutura de diretórios

Eu usaria algo simples:

```bash
/srv/corretop/
```

Dentro:

```text
/srv/corretop
├── api
├── infra
├── volumes
├── backups
└── logs
```

Seu código provavelmente virá via GitHub/deploy.

## 6. Docker Compose

O Docker será o organizador da VPS.

Conceitualmente:

```yaml
services:

  api:
    # Fastify

  redis:
    # Redis

  worker:
    # BullMQ Workers

  waha:
    # WAHA

  proxy:
    # Nginx/Caddy
```

Eu não começaria criando 10 workers diferentes.

No início:

```text
Fastify
Redis
1 worker geral
WAHA
Proxy
```

Depois separe conforme o consumo.

## 7. Fastify

Seu backend deve rodar em container.

Exemplo lógico:

```text
Internet
↓
HTTPS
↓
Nginx/Caddy
↓
Fastify :3000
```

Não exponha diretamente a porta `3000`.

O proxy recebe `443` e encaminha internamente.

## 8. Domínio da API

Crie algo como:

```text
api.crm.ancorasaude.com.br
```

No DNS:

```text
A
api.crm.ancorasaude.com.br
→ IP_DA_VPS
```

Depois configure HTTPS com Let's Encrypt através de Nginx ou Caddy.

Eu usaria **Caddy** se quiser simplicidade; Nginx se seu projeto já usa.

## 9. Redis

Redis fica dentro da VPS:

```text
Fastify
   ↓
Redis
   ↑
Workers
```

Uso:

* cache;
* BullMQ;
* locks;
* idempotência;
* rate limit;
* estados temporários.

Importante:

```text
Redis ≠ banco principal
```

O dado definitivo continua no PostgreSQL/Supabase.

## 10. BullMQ

BullMQ usa Redis.

Crie filas inicialmente como:

```text
automation
ai
knowledge
notifications
```

Por exemplo:

```text
Fastify
↓
BullMQ
↓
Worker
↓
OpenRouter
```

Assim a API não fica esperando trabalhos demorados.

## 11. Workers

Com seus **16 GB**, você tem uma margem boa.

Eu começaria com um único container worker com concorrência controlada.

Ele processará:

* automações;
* IA;
* embeddings;
* documentos;
* relatórios;
* follow-ups.

Depois você pode separar:

```text
worker-ai
worker-automation
worker-rag
```

sem mudar a aplicação.

## 12. Supabase

Na VPS configure somente as credenciais.

Exemplo:

```env
DATABASE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Mas atenção: `SERVICE_ROLE_KEY` fica **somente no backend**, nunca Next.js/browser.

A VPS se conecta ao Supabase; você não instala PostgreSQL nela.

## 13. Connection pooling

Como Fastify + Workers podem abrir várias conexões, configure corretamente o pool para o Supabase.

Não deixe:

```text
API 50 conexões
+
Workers 50 conexões
+
scripts 50 conexões
```

sem controle.

Use pool pequeno e observável inicialmente e ajuste conforme as métricas.

## 14. OpenRouter

Configure:

```env
OPENROUTER_API_KEY=
```

E centralize chamadas numa camada:

```text
Agent Runtime
↓
OpenRouter
```

Workers e Fastify não devem possuir dezenas de implementações distintas de chamada de modelo.

## 15. WAHA

Como você vai usar WAHA apenas internamente, mantenha isolado.

Algo como:

```text
WAHA container
↓
rede Docker interna
↓
Fastify
```

Se precisar acessar painel administrativo do WAHA externamente, proteja com autenticação e, idealmente, IP/VPN.

Não deixe uma interface administrativa sensível aberta publicamente.

## 16. MCP / Tool Gateway

Esse serviço pode inicialmente ficar dentro do próprio Fastify.

Não precisa necessariamente virar outro container agora.

Fluxo:

```text
Agent
↓
Tool Gateway
↓
RBAC
↓
Tenant validation
↓
Domain Service
↓
Supabase
```

Quando crescer, você separa.

## 17. Variáveis e secrets

Crie `.env` de produção apenas no servidor ou use secret management.

Nunca coloque no Git:

```text
DATABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPENROUTER_API_KEY
META_TOKEN
WAHA credentials
```

E não envie esses secrets para o frontend.

## 18. Logs

Configure logs estruturados do Fastify:

```text
requestId
tenantId
route
status
duration
```

Mas evite gravar:

* senha;
* token;
* CPF;
* mensagens completas;
* prompts gigantes.

Tenha rotação de logs para não encher o disco.

## 19. Monitoramento

Primeiro use o próprio painel da Hostinger para:

* CPU;
* RAM;
* disco;
* rede;
* uptime.

A seção VPS da Hostinger já fornece métricas de uso e backups/snapshots. ([Hostinger Help Center][4])

Depois seu Super Dev pode acompanhar:

```text
CPU
RAM
API P95
Redis memory
cache hit
queue size
worker jobs
failed jobs
Supabase egress
DB size
OpenRouter cost
```

## 20. Backup

Você tem duas coisas diferentes:

**Supabase:** backup do banco conforme o plano.

**Hostinger:** snapshots/backups da VPS.

Mas o ideal é que a VPS seja **recriável**.

Ou seja, se ela morrer:

```text
nova VPS
↓
Docker Compose
↓
.env
↓
deploy
↓
funcionando
```

Não deixe dados críticos existirem exclusivamente dentro de um container.

## 21. Reinício automático

Configure:

```yaml
restart: unless-stopped
```

nos containers importantes.

Assim, se a VPS reiniciar:

* Fastify volta;
* Redis volta;
* workers voltam;
* WAHA volta.

## 22. Redis persistence

Como BullMQ depende dele, habilite persistência apropriada do Redis.

Mesmo assim, operações críticas devem continuar persistidas no PostgreSQL.

Redis não deve ser o único lugar onde você sabe que:

> “lead X foi vendido”

ou

> “workflow Y terminou”.

## 23. Health checks

Crie endpoints:

```text
/health
/ready
```

O health deve verificar de forma apropriada:

```text
API
Redis
Database
```

E um health mais completo pode verificar:

```text
OpenRouter
Meta
Workers
queues
```

sem transformar cada health check em dezenas de chamadas externas.

## 24. Deploy

O fluxo ideal depois:

```text
GitHub
↓
build
↓
Docker image
↓
VPS
↓
docker compose pull
↓
docker compose up -d
```

Evite fazer deploy copiando arquivos manualmente por FTP.

## 25. Primeiro objetivo

Não tente configurar tudo de uma vez.

A ordem que eu seguiria é:

```text
1 Ubuntu/Docker
2 SSH seguro
3 Firewall
4 Domínio
5 HTTPS
6 Fastify
7 Redis
8 BullMQ
9 Worker
10 Supabase
11 OpenRouter
12 WAHA
13 Monitoramento
14 Backups
15 Deploy automático
```

### Sua VPS de 16 GB no início

Eu reservaria mentalmente algo próximo de:

```text
Ubuntu/Docker       ~1 GB
Fastify             <1 GB
Redis               1–2 GB máximo inicialmente
Workers             2–5 GB dependendo da concorrência
WAHA                variável
Sistema/cache       restante
```

Não configure Redis para consumir os 16 GB só porque eles existem. Deixe margem para workers e sistema.

Sua arquitetura final fica:

```text
                  Vercel
                    │
                 Next.js
                    │
                    ▼
             VPS Hostinger 16GB
             ┌───────────────┐
             │ Caddy/Nginx   │
             │ Fastify       │
             │ Redis         │
             │ BullMQ        │
             │ Workers       │
             │ MCP           │
             │ WAHA interno  │
             └──────┬────────┘
                    │
       ┌────────────┼────────────┐
       ▼            ▼            ▼
    Supabase    OpenRouter      Meta
 PostgreSQL       IA          WhatsApp
 pgvector
 Storage
```

**Primeiro passo prático agora:** no hPanel da Hostinger, confirme se sua VPS está com **Ubuntu 24.04 LTS + Docker**. Se ainda estiver na tela de escolha do sistema operacional, use o template Docker da Hostinger. ([Hostinger Help Center][1])

[1]: https://support.hostinger.com/en/articles/8306612-how-to-use-the-docker-vps-template?utm_source=chatgpt.com "How to use the Docker VPS template | Hostinger Help Center"
[2]: https://www.hostinger.com/br/tutoriais/?p=15538&utm_source=chatgpt.com "Como instalar Docker no Ubuntu (manualmente ou template VPS)"
[3]: https://support.hostinger.com/pt/articles/8172641-como-usar-um-firewall-gerenciado-no-vps?utm_source=chatgpt.com "Como usar um firewall gerenciado no VPS | Central de Ajuda da Hostinger"
[4]: https://support.hostinger.com/pt/articles/5726606-como-usar-a-secao-vps-na-hostinger?utm_source=chatgpt.com "Como usar a seção VPS na Hostinger? | Central de Ajuda da Hostinger"
