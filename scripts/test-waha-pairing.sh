#!/bin/bash
# ============================================================
# TESTE COMPLETO DE PAREAMENTO WAHA
# Execute na VPS: bash scripts/test-waha-pairing.sh
# ============================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para log
log() {
  echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

success() {
  echo -e "${GREEN}✓${NC} $1"
}

error() {
  echo -e "${RED}✗${NC} $1"
}

warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

# Função para testar endpoint via docker exec
test_endpoint() {
  local container=$1
  local url=$2
  local method=${3:-GET}
  local data=$4
  
  # Tentar curl primeiro
  if docker exec "$container" sh -c "command -v curl" >/dev/null 2>&1; then
    if [ "$method" = "POST" ] && [ -n "$data" ]; then
      docker exec "$container" curl -s -X POST -H "Content-Type: application/json" -d "$data" "$url" 2>/dev/null
    elif [ "$method" = "DELETE" ]; then
      docker exec "$container" curl -s -X DELETE "$url" 2>/dev/null
    else
      docker exec "$container" curl -s "$url" 2>/dev/null
    fi
  # Tentar wget
  elif docker exec "$container" sh -c "command -v wget" >/dev/null 2>&1; then
    if [ "$method" = "POST" ] && [ -n "$data" ]; then
      docker exec "$container" wget -q -O- --post-data="$data" --header="Content-Type: application/json" "$url" 2>/dev/null
    elif [ "$method" = "DELETE" ]; then
      docker exec "$container" wget -q -O- --method=DELETE "$url" 2>/dev/null
    else
      docker exec "$container" wget -q -O- "$url" 2>/dev/null
    fi
  # Tentar node/fetch
  elif docker exec "$container" sh -c "command -v node" >/dev/null 2>&1; then
    docker exec "$container" node -e "
      fetch('$url').then(r => r.text()).then(console.log).catch(e => console.error(e.message))
    " 2>/dev/null
  else
    echo "FALHA"
  fi
}

# Verificar se está no diretório correto
if [ ! -f "docker-compose.yml" ] && [ ! -f "docker-compose.yaml" ]; then
  error "Execute este script no diretório /srv/corretop/infra"
  exit 1
fi

echo ""
echo "============================================================"
echo "  TESTE DE PAREAMENTO WAHA - CORRETOP"
echo "============================================================"
echo ""

# ── 1. Verificar serviços ──────────────────────────────────────
log "1. Verificando serviços..."

# Verificar containers
if docker ps --filter "name=corretop-api" --format "{{.Status}}" | grep -q "Up"; then
  success "corretop-api está rodando"
else
  error "corretop-api NÃO está rodando"
fi

if docker ps --filter "name=corretop-waha" --format "{{.Status}}" | grep -q "Up"; then
  success "corretop-waha está rodando"
else
  error "corretop-waha NÃO está rodando"
fi

echo ""

# ── 2. Verificar ferramentas disponíveis ────────────────────────
log "2. Verificando ferramentas nos containers..."

# API
if docker exec corretop-api sh -c "command -v curl" >/dev/null 2>&1; then
  success "corretop-api: curl disponível"
elif docker exec corretop-api sh -c "command -v wget" >/dev/null 2>&1; then
  success "corretop-api: wget disponível"
elif docker exec corretop-api sh -c "command -v node" >/dev/null 2>&1; then
  success "corretop-api: node disponível"
else
  warn "corretop-api: nenhuma ferramenta de HTTP encontrada"
fi

# WAHA
if docker exec corretop-waha sh -c "command -v curl" >/dev/null 2>&1; then
  success "corretop-waha: curl disponível"
elif docker exec corretop-waha sh -c "command -v wget" >/dev/null 2>&1; then
  success "corretop-waha: wget disponível"
elif docker exec corretop-waha sh -c "command -v node" >/dev/null 2>&1; then
  success "corretop-waha: node disponível"
else
  warn "corretop-waha: nenhuma ferramenta de HTTP encontrada"
fi

echo ""

# ── 3. Health checks via Docker network ────────────────────────
log "3. Health checks (via Docker network)..."

# Fastify health
FASTIFY_HEALTH=$(test_endpoint "corretop-api" "http://localhost:3001/health" "GET")
if echo "$FASTIFY_HEALTH" | grep -q '"status":"ok"'; then
  success "Fastify /health = OK"
else
  # Tentar porta alternativa
  FASTIFY_HEALTH=$(test_endpoint "corretop-api" "http://localhost:8080/health" "GET")
  if echo "$FASTIFY_HEALTH" | grep -q '"status":"ok"'; then
    success "Fastify /health = OK (port 8080)"
  else
    error "Fastify /health falhou"
    echo "  Resposta: $FASTIFY_HEALTH"
  fi
fi

# WAHA health (dentro do próprio container)
WAHA_HEALTH=$(test_endpoint "corretop-waha" "http://localhost:3000/api/server/health" "GET")
if echo "$WAHA_HEALTH" | grep -q '"status":"ok"'; then
  success "WAHA /api/server/health = OK"
else
  error "WAHA /api/server/health falhou"
  echo "  Resposta: $WAHA_HEALTH"
fi

# WAHA health via corretop-api (teste de conectividade inter-container)
API_TO_WAHA=$(test_endpoint "corretop-api" "http://corretop-waha:3000/api/server/health" "GET")
if echo "$API_TO_WAHA" | grep -q '"status":"ok"'; then
  success "corretop-api → corretop-waha conectividade OK"
else
  error "corretop-api → corretop-waha falhou"
  echo "  Resposta: $API_TO_WAHA"
fi

echo ""

# ── 4. Verificar variáveis de ambiente ─────────────────────────
log "4. Variáveis de ambiente..."

# WAHA_API_KEY
WAHA_API_KEY=$(docker exec corretop-waha sh -c 'printenv WAHA_API_KEY 2>/dev/null || echo ""')
if [ -n "$WAHA_API_KEY" ]; then
  success "WAHA_API_KEY configurada (${#WAHA_API_KEY} chars)"
else
  warn "WAHA_API_KEY não encontrada"
fi

# WAHA_BASE_URL
WAHA_BASE_URL=$(docker exec corretop-waha sh -c 'printenv WAHA_BASE_URL 2>/dev/null || echo ""')
if [ -n "$WAHA_BASE_URL" ]; then
  success "WAHA_BASE_URL = $WAHA_BASE_URL"
else
  warn "WAHA_BASE_URL não encontrada"
fi

echo ""

# ── 5. Listar sessões existentes ───────────────────────────────
log "5. Sessões existentes no WAHA..."

if [ -n "$WAHA_API_KEY" ]; then
  SESSIONS=$(test_endpoint "corretop-waha" "http://localhost:3000/api/sessions" "GET" "" "-H 'x-api-key: $WAHA_API_KEY'")
else
  SESSIONS=$(test_endpoint "corretop-waha" "http://localhost:3000/api/sessions" "GET")
fi

if echo "$SESSIONS" | grep -q '"name"'; then
  echo "$SESSIONS" | python3 -m json.tool 2>/dev/null || echo "$SESSIONS"
  success "Sessões listadas"
else
  warn "Nenhuma sessão encontrada ou erro ao listar"
  echo "  Resposta: $SESSIONS"
fi

echo ""

# ── 6. Testar API interna do Fastify ───────────────────────────
log "6. Testando API interna do Fastify..."

# Verificar se a API interna responde (precisa do token)
INTERNAL_TOKEN=$(docker exec corretop-api sh -c 'printenv WHATSAPP_API_INTERNAL_TOKEN 2>/dev/null || echo ""')
if [ -n "$INTERNAL_TOKEN" ]; then
  success "WHATSAPP_API_INTERNAL_TOKEN configurado (${#INTERNAL_TOKEN} chars)"
  
  # Testar health do WAHA via Fastify
  WAHA_HEALTH_FASTIFY=$(docker exec corretop-api sh -c "
    curl -s -H 'X-CorreTop-Internal-Token: $INTERNAL_TOKEN' http://localhost:3001/internal/waha/health 2>/dev/null
  ")
  if echo "$WAHA_HEALTH_FASTIFY" | grep -q '"ok":true'; then
    success "Fastify → WAHA health = OK"
  else
    error "Fastify → WAHA health falhou"
    echo "  Resposta: $WAHA_HEALTH_FASTIFY"
  fi
else
  warn "WHATSAPP_API_INTERNAL_TOKEN não encontrada"
fi

echo ""

# ── 7. Logs recentes ──────────────────────────────────────────
log "7. Últimas linhas dos logs..."

echo ""
echo "--- corretop-waha logs (últimas 10 linhas) ---"
docker logs corretop-waha --tail=10 2>&1 || echo "  (não foi possível obter logs)"

echo ""
echo "--- corretop-api logs (últimas 10 linhas) ---"
docker logs corretop-api --tail=10 2>&1 || echo "  (não foi possível obter logs)"

echo ""
echo "============================================================"
echo "  DIAGNÓSTICO CONCLUÍDO"
echo "============================================================"
echo ""

# Resumo
if echo "$FASTIFY_HEALTH" | grep -q '"status":"ok"' && echo "$WAHA_HEALTH" | grep -q '"status":"ok"'; then
  success "Ambos os serviços estão responding corretamente"
  echo ""
  echo "Próximos passos:"
  echo "1. Teste o pareamento pelo CRM: https://crm.ancorasaude.cloud/conversas/broker"
  echo "2. Clique em 'Conectar WhatsApp'"
  echo "3. Escaneie o QR code"
elif echo "$WAHA_HEALTH" | grep -q '"status":"ok"'; then
  warn "WAHA está ok, mas Fastify pode ter problema"
  echo ""
  echo "Verifique:"
  echo "1. Porta do Fastify: docker exec corretop-api sh -c 'netstat -tlnp 2>/dev/null || ss -tlnp'"
  echo "2. Logs do Fastify: docker logs corretop-api --tail=50"
else
  error "Um ou ambos os serviços estão com problema"
  echo ""
  echo "Verifique:"
  echo "1. docker compose ps"
  echo "2. docker compose logs -f waha"
  echo "3. docker compose logs -f api"
fi

echo ""
