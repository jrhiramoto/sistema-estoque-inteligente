# 🚀 Guia de Deploy no Vercel

## Por que Vercel?

O Railway apresentou problemas persistentes com variáveis de ambiente (JWT_SECRET vazio), mesmo após múltiplas tentativas de correção. O Vercel tem melhor suporte para aplicações Node.js e gerenciamento de variáveis de ambiente mais confiável.

## ✅ Pré-requisitos

- Conta no Vercel (gratuita): https://vercel.com/signup
- Código já está preparado (pasta `api/` e `vercel.json` configurados)

## 📋 Passo a Passo

### Opção 1: Deploy via Vercel CLI (Recomendado)

1. **Instalar Vercel CLI** (já instalado no projeto):
   ```bash
   npm install -g vercel
   ```

2. **Fazer login**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   cd /home/ubuntu/sistema-estoque-inteligente
   vercel --prod
   ```

4. **Configurar variáveis de ambiente** (após primeiro deploy):
   - Acesse: https://vercel.com/dashboard
   - Selecione seu projeto
   - Settings → Environment Variables
   - Adicione as variáveis abaixo

### Opção 2: Deploy via Interface Web

1. **Criar repositório GitHub**:
   ```bash
   cd /home/ubuntu/sistema-estoque-inteligente
   
   # Criar novo repositório no GitHub (via web)
   # Depois conectar:
   git remote add github https://github.com/SEU_USUARIO/sistema-estoque-inteligente.git
   git push github main
   ```

2. **Importar no Vercel**:
   - Acesse: https://vercel.com/new
   - Clique em "Import Git Repository"
   - Selecione o repositório GitHub
   - Configure conforme abaixo

3. **Configurações do Projeto**:
   - **Framework Preset**: Other
   - **Build Command**: `pnpm run build`
   - **Output Directory**: `dist/client`
   - **Install Command**: `pnpm install`
   - **Node.js Version**: 18.x

## 🔐 Variáveis de Ambiente Obrigatórias

Adicione estas variáveis no Vercel Dashboard → Settings → Environment Variables:

### Banco de Dados
```
DATABASE_URL=postgresql://postgres:[senha]@[host]:[porta]/railway
```
> ⚠️ Use a mesma URL do Railway para manter os dados

### Autenticação JWT
```
JWT_SECRET=a78ab949198597689777d06c84656aff2d2ebb3b708b74b858fbe9244223653fb73361b6e281341f9afba36f27b01fa051031d12c490eff75c5ebd6ac7254059
```
> ✅ Esta é a chave padrão hardcoded - funcionará no Vercel

### OAuth Manus
```
OAUTH_SERVER_URL=https://api.manus.im
VITE_APP_ID=[seu_app_id]
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
```

### Branding
```
VITE_APP_TITLE=Sistema de Gestão de Estoque Inteligente
VITE_APP_LOGO=[url_do_logo]
```

### APIs Internas Manus
```
BUILT_IN_FORGE_API_URL=[url]
BUILT_IN_FORGE_API_KEY=[key]
VITE_FRONTEND_FORGE_API_KEY=[key]
VITE_FRONTEND_FORGE_API_URL=[url]
```

### Google OAuth (Opcional)
```
GOOGLE_CLIENT_ID=[seu_client_id]
GOOGLE_CLIENT_SECRET=[seu_client_secret]
```

### Bling ERP (Opcional)
```
BLING_CLIENT_ID=[seu_client_id]
BLING_CLIENT_SECRET=[seu_client_secret]
```

## 🧪 Testar Deploy

Após o deploy, teste:

1. **Criar conta**:
   ```bash
   curl -X POST 'https://seu-projeto.vercel.app/api/trpc/auth.register?batch=1' \
     -H "Content-Type: application/json" \
     -d '{"0":{"json":{"email":"teste@exemplo.com","password":"senha123","name":"Teste"}}}'
   ```

2. **Fazer login**:
   ```bash
   curl -X POST 'https://seu-projeto.vercel.app/api/trpc/auth.login?batch=1' \
     -H "Content-Type: application/json" \
     -d '{"0":{"json":{"email":"teste@exemplo.com","password":"senha123"}}}'
   ```

Se o login retornar um token JWT, **SUCESSO!** 🎉

## 🔄 Cron Jobs no Vercel

O Vercel suporta cron jobs nativamente (já configurados em `vercel.json`):

- **Sincronização Bling**: A cada 6 horas
- **Renovação de Token**: A cada 2 horas
- **Cálculo ABC**: Domingo às 3h

## 📊 Monitoramento

- **Logs**: https://vercel.com/dashboard → Seu Projeto → Logs
- **Analytics**: https://vercel.com/dashboard → Seu Projeto → Analytics
- **Erros**: https://vercel.com/dashboard → Seu Projeto → Errors

## 🆘 Problemas Comuns

### "Module not found"
- Verifique se `pnpm install` rodou corretamente
- Verifique se `node_modules` está no `.vercelignore`

### "Function timeout"
- Aumente o timeout em `vercel.json`:
  ```json
  {
    "functions": {
      "api/**/*.ts": {
        "maxDuration": 30
      }
    }
  }
  ```

### "Database connection failed"
- Verifique se `DATABASE_URL` está correta
- Certifique-se de que o Railway permite conexões externas

## 🎯 Próximos Passos

1. ✅ Deploy no Vercel
2. ✅ Testar autenticação
3. ✅ Configurar domínio personalizado (opcional)
4. ✅ Configurar Bling ERP
5. ✅ Testar sincronização de produtos
6. ✅ Configurar alertas de estoque baixo

---

**Desenvolvido com ❤️ por Manus AI**
