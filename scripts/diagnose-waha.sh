#!/bin/bash

# Diagnóstico rápido de conectividade com o VPS WhatsApp
# Uso: bash scripts/diagnose-waha.sh

VPS_URL="https://api.crm.ancorasaude.cloud"
TOKEN="${VPS_INTERNAL_API_TOKEN:-e381a7120e3440d4fbc73c435fc050de0b178384687c4673afb8aafa19eac552}"

echo "🔍 Diagnóstico de Conectividade WhatsApp (WAHA)"
echo "================================================"
echo ""

# 1. Teste de DNS
echo "1️⃣  Testando resolução DNS..."
if nslookup api.crm.ancorasaude.cloud > /dev/null 2>&1; then
    echo "   ✅ DNS resolve corretamente"
else
    echo "   ❌ Falha na resolução DNS"
fi
echo ""

# 2. Teste de conectividade TCP
echo "2️⃣  Testando conectividade TCP (porta 443)..."
if nc -z -w5 api.crm.ancorasaude.cloud 443 2>/dev/null; then
    echo "   ✅ Porta 443 acessível"
else
    echo "   ❌ Porta 443 inacessível"
fi
echo ""

# 3. Teste de TLS/SSL
echo "3️⃣  Testando certificado SSL..."
SSL_INFO=$(echo | openssl s_client -connect api.crm.ancorasaude.cloud:443 -servername api.crm.ancorasaude.cloud 2>/dev/null | grep -E "subject|issuer|expire|Verify return code")
if [ $? -eq 0 ]; then
    echo "   ✅ Certificado SSL válido"
    echo "   $SSL_INFO"
else
    echo "   ❌ Falha na verificação SSL"
fi
echo ""

# 4. Teste de HTTP - Health Check
echo "4️⃣  Testando endpoint /health..."
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" --connect-timeout 10 --max-time 15 "$VPS_URL/health" 2>&1)
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Health check retornou 200"
    echo "   Resposta: $BODY"
else
    echo "   ❌ Health check retornou $HTTP_CODE"
    echo "   Resposta: $BODY"
fi
echo ""

# 5. Teste de autenticação
echo "5️⃣  Testando autenticação com token..."
AUTH_RESPONSE=$(curl -s -w "\n%{http_code}" --connect-timeout 10 --max-time 15 \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-CorreTop-Internal-Token: $TOKEN" \
    "$VPS_URL/internal/waha/health" 2>&1)
AUTH_CODE=$(echo "$AUTH_RESPONSE" | tail -n1)
AUTH_BODY=$(echo "$AUTH_RESPONSE" | head -n-1)

if [ "$AUTH_CODE" = "200" ]; then
    echo "   ✅ Autenticação funcionando"
    echo "   Resposta: $AUTH_BODY"
else
    echo "   ❌ Falha na autenticação (HTTP $AUTH_CODE)"
    echo "   Resposta: $AUTH_BODY"
fi
echo ""

# 6. Teste de lista de sessões
echo "6️⃣  Testando endpoint de sessões..."
SESSIONS_RESPONSE=$(curl -s -w "\n%{http_code}" --connect-timeout 10 --max-time 15 \
    -H "Authorization: Bearer $TOKEN" \
    "$VPS_URL/internal/waha/connections" 2>&1)
SESSIONS_CODE=$(echo "$SESSIONS_RESPONSE" | tail -n1)
SESSIONS_BODY=$(echo "$SESSIONS_RESPONSE" | head -n-1)

if [ "$SESSIONS_CODE" = "200" ]; then
    echo "   ✅ Endpoint de sessões acessível"
    echo "   Resposta: $SESSIONS_BODY"
else
    echo "   ❌ Falha no endpoint de sessões (HTTP $SESSIONS_CODE)"
    echo "   Resposta: $SESSIONS_BODY"
fi
echo ""

echo "================================================"
echo "📋 Resumo: Se algum teste falhou, verifique:"
echo "   - Se a VPS está online e acessível"
echo "   - Se o serviço Fastify está rodando"
echo "   - Se o token de autenticação está correto"
echo "   - Se há problemas de rede/firewall"
