# ⚙️ Configurações do Vercel

## 📋 Configurações do Projeto

Na tela de configuração do Vercel, use **EXATAMENTE** estas configurações:

### Build & Development Settings

**Framework Preset:**
```
Other
```

**Build Command:**
```
pnpm install --shamefully-hoist && pnpm run build
```

**Output Directory:**
```
dist/client
```

**Install Command:**
```
pnpm install --shamefully-hoist
```

**Root Directory:**
```
./
```
(deixe vazio ou use `./`)

---

## 🔐 Environment Variables

Clique em "Environment Variables" e adicione **TODAS** estas variáveis:

### Obrigatórias

```
DATABASE_URL
```
Valor: `postgresql://postgres:[senha]@[host]:[porta]/railway`
(Use a mesma URL do Railway)

```
JWT_SECRET
```
Valor: `a78ab949198597689777d06c84656aff2d2ebb3b708b74b858fbe9244223653fb73361b6e281341f9afba36f27b01fa051031d12c490eff75c5ebd6ac7254059`

```
NODE_ENV
```
Valor: `production`

### OAuth Manus

```
OAUTH_SERVER_URL
```
Valor: `https://api.manus.im`

```
VITE_OAUTH_PORTAL_URL
```
Valor: `https://portal.manus.im`

```
VITE_APP_ID
```
Valor: (pegue do .env atual)

### Branding

```
VITE_APP_TITLE
```
Valor: `Sistema de Gestão de Estoque Inteligente`

```
VITE_APP_LOGO
```
Valor: (URL do logo, se tiver)

### APIs Internas Manus

```
BUILT_IN_FORGE_API_URL
```
Valor: (pegue do .env atual)

```
BUILT_IN_FORGE_API_KEY
```
Valor: (pegue do .env atual)

```
VITE_FRONTEND_FORGE_API_KEY
```
Valor: (pegue do .env atual)

```
VITE_FRONTEND_FORGE_API_URL
```
Valor: (pegue do .env atual)

---

## ✅ Checklist

- [ ] Framework Preset = "Other"
- [ ] Build Command com `--shamefully-hoist`
- [ ] Output Directory = `dist/client`
- [ ] Todas as variáveis de ambiente adicionadas
- [ ] JWT_SECRET configurado
- [ ] DATABASE_URL do Railway configurada

---

## 🚀 Após Deploy

1. Aguarde o build completar (5-10 minutos)
2. Acesse a URL fornecida pelo Vercel
3. Teste o registro: `/register`
4. Teste o login: `/login`

Se o login funcionar sem erro de JWT, **SUCESSO!** 🎉

---

## 🆘 Se o Build Falhar

1. Verifique os logs no Vercel Dashboard
2. Se erro de `pnpm install`, tente mudar Install Command para:
   ```
   npm install
   ```
3. E Build Command para:
   ```
   npm run build
   ```
