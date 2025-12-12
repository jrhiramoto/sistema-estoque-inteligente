#!/bin/bash

# Script de Deploy no Fly.io
# Este script deve ser executado LOCALMENTE (não no sandbox)

echo "=== Deploy no Fly.io ==="
echo ""
echo "IMPORTANTE: Execute este script no seu computador local, não no sandbox!"
echo ""

# Verificar se flyctl está instalado
if ! command -v flyctl &> /dev/null; then
    echo "❌ Fly CLI não encontrado!"
    echo ""
    echo "Instale com:"
    echo "  curl -L https://fly.io/install.sh | sh"
    echo ""
    exit 1
fi

echo "✅ Fly CLI encontrado"
echo ""

# Verificar se está logado
if ! flyctl auth whoami &> /dev/null; then
    echo "❌ Não está logado no Fly.io"
    echo ""
    echo "Faça login com:"
    echo "  flyctl auth login"
    echo ""
    exit 1
fi

echo "✅ Logado no Fly.io"
echo ""

# Verificar se app já existe
APP_NAME="sistema-estoque-inteligente"

if flyctl apps list | grep -q "$APP_NAME"; then
    echo "ℹ️  App '$APP_NAME' já existe"
else
    echo "📦 Criando app '$APP_NAME'..."
    flyctl apps create "$APP_NAME" --org personal
fi

echo ""
echo "🔐 Configurando secrets..."
echo ""
echo "ATENÇÃO: Você precisa configurar as seguintes variáveis:"
echo ""
echo "  flyctl secrets set DATABASE_URL='sua_connection_string'"
echo "  flyctl secrets set JWT_SECRET='seu_jwt_secret'"
echo "  flyctl secrets set BLING_CLIENT_SECRET='seu_client_secret'"
echo "  flyctl secrets set OAUTH_SERVER_URL='https://api.manus.im'"
echo "  flyctl secrets set VITE_APP_ID='seu_app_id'"
echo "  flyctl secrets set VITE_OAUTH_PORTAL_URL='https://login.manus.im'"
echo "  flyctl secrets set OWNER_OPEN_ID='seu_open_id'"
echo "  flyctl secrets set OWNER_NAME='seu_nome'"
echo "  flyctl secrets set BUILT_IN_FORGE_API_URL='https://api.manus.im/forge'"
echo "  flyctl secrets set BUILT_IN_FORGE_API_KEY='sua_api_key'"
echo "  flyctl secrets set VITE_FRONTEND_FORGE_API_KEY='sua_frontend_key'"
echo "  flyctl secrets set VITE_FRONTEND_FORGE_API_URL='https://api.manus.im/forge'"
echo "  flyctl secrets set RESEND_API_KEY='sua_resend_key'"
echo "  flyctl secrets set RESEND_FROM_EMAIL='seu_email'"
echo "  flyctl secrets set VITE_APP_TITLE='Sistema de Estoque Inteligente'"
echo "  flyctl secrets set VITE_APP_LOGO='/logo.svg'"
echo ""
read -p "Pressione ENTER após configurar os secrets..."

echo ""
echo "🚀 Fazendo deploy..."
flyctl deploy --remote-only

echo ""
echo "✅ Deploy concluído!"
echo ""
echo "🌐 Abrir aplicação:"
echo "  flyctl open"
echo ""
echo "📊 Ver logs:"
echo "  flyctl logs"
echo ""
echo "📈 Ver status:"
echo "  flyctl status"
