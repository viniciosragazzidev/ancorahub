#!/bin/bash

# Diagnóstico Cloudflare → Fastify (Coolify)
# Uso: bash scripts/diagnose-coolify-waha.sh

echo "🔍 Diagnóstico: Cloudflare → Fastify (Coolify)"
echo "================================================"
echo ""

# 1. Verificar DNS
echo "1️⃣  Verificando DNS..."
DNS_RESULT=$(nslookup api.crm.ancorasaude.cloud 2>&1)
echo "$DNS_RESULT" | grep -E "Address:|Name:" | head -5
echo ""

# 2. Verificar IPs do Cloudflare
echo "2️⃣  IPs do Cloudflare (esperado):"
echo "   104.21.x.x ou 172.67.x.x"
echo ""

# 3. Testar HTTP (deve retornar 302)
echo "3️⃣  Testando HTTP (deve redirecionar para HTTPS)..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 http://api.crm.ancorasaude.cloud/health)
if [ "$HTTP_CODE" = "302" ]; then
    echo "   ✅ HTTP funciona (302 redirect)"
else
    echo "   ❌ HTTP retornou $HTTP_CODE"
fi
echo ""

# 4. Testar HTTPS (o problema atual)
echo "4️⃣  Testando HTTPS (onde está falhando)..."
HTTPS_RESULT=$(curl -v --connect-timeout 10 --max-time 15 https://api.crm.ancorasaude.cloud/health 2>&1)
if echo "$HTTPS_RESULT" | grep -q "SSL alert number 40"; then
    echo "   ❌ HTTPS falha: SSL handshake failure"
    echo "   Causa: Cloudflare não consegue conectar à origem Fastify"
elif echo "$HTTPS_RESULT" | grep -q "HTTP/2 200"; then
    echo "   ✅ HTTPS funciona!"
else
    echo "   ⚠️  HTTPS retornou algo inesperado"
    echo "$HTTPS_RESULT" | tail -5
fi
echo ""

# 5. Diagnóstico do problema
echo "================================================"
echo "📋 DIAGNÓSTICO:"
echo ""
echo "O problema é que o Cloudflare consegue receber requisições,"
echo "mas NÃO consegue conectar ao servidor Fastify na VPS."
echo ""
echo "Possíveis causas no Coolify:"
echo ""
echo "1. SSL/TLS no Coolify:"
echo "   - O Coolify precisa ter SSL configurado para o domínio"
echo "   - Verifique se o certificado está válido no painel do Coolify"
echo ""
echo "2. Porta do Fastify:"
echo "   - Verifique qual porta o Fastify está escutando"
echo "   - O Coolify precisa fazer proxy para essa porta"
echo ""
echo "3. Firewall:"
echo "   - Verifique se a porta do Fastify está aberta"
echo "   - O Coolify pode precisar de configuração de rede"
echo ""
echo "4. Configuração Cloudflare SSL:"
echo "   - Vá em Cloudflare → SSL/TLS → Overview"
echo "   - Verifique se está em 'Full' ou 'Full (Strict)'"
echo "   - Se estiver em 'Flexible', mude para 'Full'"
echo ""
echo "================================================"
echo "🔧 COMO CORRIGIR:"
echo ""
echo "Opção A: Configurar SSL no Coolify"
echo "   1. Acesse o painel do Coolify"
echo "   2. Vá no projeto Fastify (api.crm.ancorasaude.cloud)"
echo "   3. Verifique se há certificado SSL válido"
echo "   4. Se não houver, gere um novo (Let's Encrypt)"
echo ""
echo "Opção B: Verificar porta do Fastify"
echo "   1. No Coolify, veja as variáveis de ambiente do Fastify"
echo "   2. Procure por PORT ou similar"
echo "   3. Verifique se o Coolify está fazendo proxy para essa porta"
echo ""
echo "Opção C: Testar diretamente na VPS"
echo "   1. Acesse a VPS via SSH"
echo "   2. Rode: curl http://localhost:PORTA/health"
echo "   3. Se funcionar, o problema é a configuração do Coolify"
