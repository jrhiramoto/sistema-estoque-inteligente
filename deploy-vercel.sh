#!/bin/bash

# Script de Deploy Automatizado para Vercel
# Sistema de Gestão de Estoque Inteligente

set -e

echo "🚀 Iniciando deploy no Vercel..."
echo ""

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar se está no diretório correto
if [ ! -f "vercel.json" ]; then
    echo -e "${RED}❌ Erro: vercel.json não encontrado!${NC}"
    echo "Execute este script na raiz do projeto."
    exit 1
fi

# Verificar se Vercel CLI está instalado
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️  Vercel CLI não encontrado. Instalando...${NC}"
    npm install -g vercel
fi

# Build do projeto
echo -e "${GREEN}📦 Fazendo build do projeto...${NC}"
pnpm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Erro no build!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build concluído!${NC}"
echo ""

# Instruções para o usuário
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📋 PRÓXIMOS PASSOS:${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "1. Execute o comando abaixo para fazer login no Vercel:"
echo -e "   ${GREEN}vercel login${NC}"
echo ""
echo "2. Após o login, execute:"
echo -e "   ${GREEN}vercel --prod${NC}"
echo ""
echo "3. Configure as variáveis de ambiente no Vercel Dashboard:"
echo "   https://vercel.com/dashboard → Seu Projeto → Settings → Environment Variables"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🔐 VARIÁVEIS DE AMBIENTE OBRIGATÓRIAS:${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "DATABASE_URL=<sua_url_postgres>"
echo "JWT_SECRET=a78ab949198597689777d06c84656aff2d2ebb3b708b74b858fbe9244223653fb73361b6e281341f9afba36f27b01fa051031d12c490eff75c5ebd6ac7254059"
echo "OAUTH_SERVER_URL=https://api.manus.im"
echo "VITE_APP_ID=<seu_app_id>"
echo "VITE_OAUTH_PORTAL_URL=https://portal.manus.im"
echo "VITE_APP_TITLE=Sistema de Gestão de Estoque Inteligente"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}📖 Para mais detalhes, consulte: README-DEPLOY-VERCEL.md${NC}"
echo ""
