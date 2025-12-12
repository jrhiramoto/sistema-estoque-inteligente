# Deploy no Fly.io

## Pré-requisitos

1. Conta no Fly.io (https://fly.io/app/sign-up)
2. Instalar Fly CLI: `curl -L https://fly.io/install.sh | sh`

## Configuração

O projeto já está configurado com:
- `fly.toml` - Configuração da aplicação
- `Dockerfile` - Build da imagem Docker
- `.dockerignore` - Arquivos excluídos do build

## Deploy Manual via CLI

### 1. Login no Fly.io
```bash
flyctl auth login
```

### 2. Criar aplicação
```bash
flyctl launch --no-deploy
```

### 3. Configurar variáveis de ambiente
```bash
# Banco de dados
flyctl secrets set DATABASE_URL="sua_connection_string_aqui"

# Autenticação
flyctl secrets set JWT_SECRET="seu_jwt_secret_aqui"

# OAuth Manus
flyctl secrets set OAUTH_SERVER_URL="https://api.manus.im"
flyctl secrets set VITE_APP_ID="seu_app_id"
flyctl secrets set VITE_OAUTH_PORTAL_URL="https://login.manus.im"
flyctl secrets set OWNER_OPEN_ID="seu_open_id"
flyctl secrets set OWNER_NAME="seu_nome"

# Manus APIs
flyctl secrets set BUILT_IN_FORGE_API_URL="https://api.manus.im/forge"
flyctl secrets set BUILT_IN_FORGE_API_KEY="sua_api_key"
flyctl secrets set VITE_FRONTEND_FORGE_API_KEY="sua_frontend_key"
flyctl secrets set VITE_FRONTEND_FORGE_API_URL="https://api.manus.im/forge"

# Bling
flyctl secrets set BLING_CLIENT_SECRET="seu_client_secret"

# Email (Resend)
flyctl secrets set RESEND_API_KEY="sua_resend_key"
flyctl secrets set RESEND_FROM_EMAIL="seu_email"

# App
flyctl secrets set VITE_APP_TITLE="Sistema de Estoque Inteligente"
flyctl secrets set VITE_APP_LOGO="/logo.svg"

# Analytics (opcional)
flyctl secrets set VITE_ANALYTICS_ENDPOINT="seu_endpoint"
flyctl secrets set VITE_ANALYTICS_WEBSITE_ID="seu_website_id"
```

### 4. Deploy
```bash
flyctl deploy
```

### 5. Abrir aplicação
```bash
flyctl open
```

## Deploy via GitHub Actions (Recomendado)

### 1. Obter token do Fly.io
```bash
flyctl auth token
```

### 2. Adicionar secrets no GitHub
- `FLY_API_TOKEN` - Token obtido acima
- Todas as variáveis de ambiente listadas acima

### 3. Criar `.github/workflows/fly-deploy.yml`
```yaml
name: Deploy to Fly.io

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

## Comandos Úteis

```bash
# Ver logs
flyctl logs

# Ver status
flyctl status

# Escalar máquinas
flyctl scale count 2

# Aumentar memória
flyctl scale memory 1024

# SSH na máquina
flyctl ssh console

# Reiniciar aplicação
flyctl apps restart

# Ver métricas
flyctl metrics

# Configurar domínio customizado
flyctl certs add seu-dominio.com
```

## Troubleshooting

### Aplicação não inicia
```bash
flyctl logs
```

### Erro de conexão com banco
Verificar se DATABASE_URL está configurado corretamente:
```bash
flyctl secrets list
```

### Erro de build
Verificar Dockerfile e .dockerignore

### Health check falhando
Verificar se endpoint `/api/trpc/system.health` está respondendo

## Custos

- **Free tier**: 3 máquinas compartilhadas, 256MB RAM
- **Hobby**: ~$5/mês por máquina (512MB RAM)
- **Escalável**: Pague conforme uso

## Região

Configurado para `gru` (São Paulo, Brasil) para menor latência.

## Suporte

- Documentação: https://fly.io/docs
- Community: https://community.fly.io
- Status: https://status.fly.io
