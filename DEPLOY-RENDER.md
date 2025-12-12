# 🚀 Deploy no Render.com - Guia Rápido

## Por que Render ao invés de Vercel?

- ✅ Melhor suporte para Node.js/Express
- ✅ Sem limitações de cron jobs na conta gratuita
- ✅ Mais simples para aplicações full-stack
- ✅ Sem problemas com pnpm build scripts

---

## 📋 Passo a Passo

### 1. Criar Conta no Render

1. Acesse: https://render.com/
2. Clique em "Get Started for Free"
3. Faça login com GitHub

### 2. Conectar Repositório

1. No dashboard do Render, clique em **"New +"**
2. Selecione **"Web Service"**
3. Conecte seu repositório GitHub: `sistema-estoque-inteligente`
4. Clique em **"Connect"**

### 3. Configurar o Serviço

**Name:**
```
sistema-estoque-inteligente
```

**Region:**
```
Oregon (US West)
```

**Branch:**
```
main
```

**Runtime:**
```
Node
```

**Build Command:**
```
pnpm install && pnpm run build
```

**Start Command:**
```
pnpm start
```

**Instance Type:**
```
Free
```

### 4. Adicionar Environment Variables

Clique em **"Advanced"** e adicione estas variáveis:

```
NODE_ENV=production

JWT_SECRET=a78ab949198597689777d06c84656aff2d2ebb3b708b74b858fbe9244223653fb73361b6e281341f9afba36f27b01fa051031d12c490eff75c5ebd6ac7254059

DATABASE_URL=postgresql://postgres:SUA_SENHA@SEU_HOST:5432/railway

OAUTH_SERVER_URL=https://api.manus.im

VITE_OAUTH_PORTAL_URL=https://portal.manus.im

VITE_APP_ID=19JU23NF394R6HH

VITE_APP_TITLE=Sistema de Gestão de Estoque Inteligente
```

⚠️ **IMPORTANTE**: Substitua `DATABASE_URL` pelos dados do seu PostgreSQL!

### 5. Deploy

1. Clique em **"Create Web Service"**
2. Aguarde 5-10 minutos para o build completar
3. O Render fornecerá uma URL: `https://sistema-estoque-inteligente.onrender.com`

### 6. Testar

1. Acesse a URL fornecida
2. Vá para `/register` e crie uma conta
3. Faça login em `/login`

Se funcionar, **SUCESSO!** 🎉

---

## 🔄 Auto-Deploy

O Render automaticamente faz deploy a cada push no GitHub!

---

## 💰 Plano Gratuito

- ✅ 750 horas/mês grátis
- ✅ SSL automático
- ✅ Sem limitações de cron
- ⚠️ Servidor hiberna após 15min de inatividade (primeiro acesso pode demorar 30s)

---

## 🆘 Problemas?

Se o build falhar:
1. Verifique os logs no Render Dashboard
2. Confirme que todas as variáveis de ambiente foram adicionadas
3. Verifique se DATABASE_URL está correta
