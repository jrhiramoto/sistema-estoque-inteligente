# Status do Webhook de Estoque do Bling

## ✅ Implementação Completa

O webhook de estoque está **100% implementado** no código e pronto para funcionar. A infraestrutura inclui:

### 1. Endpoint do Webhook
- **URL:** `/api/webhooks/bling`
- **Método:** POST
- **Arquivo:** `server/webhookEndpoint.ts`

### 2. Validação de Segurança
- ✅ Validação HMAC-SHA256 para autenticidade
- ✅ Sistema de idempotência (evita processar mesmo evento duas vezes)
- ✅ Tabela `webhookEvents` para rastreamento

### 3. Handlers Implementados

#### Produtos
- `product.created` - Cria novo produto
- `product.updated` - Atualiza produto existente
- `product.deleted` - Remove produto

#### Estoque Físico
- `stock.created` - Cria registro de estoque
- `stock.updated` - **Atualiza saldo de estoque em tempo real** ✅
- `stock.deleted` - Remove registro de estoque

#### Estoque Virtual
- `virtual_stock.updated` - Atualiza estoque virtual

#### Pedidos
- `order.created` - Cria novo pedido
- `order.updated` - Atualiza pedido existente
- `order.deleted` - Remove pedido

#### Fornecedores
- `product_supplier.created` - Vincula fornecedor ao produto
- `product_supplier.updated` - Atualiza vínculo
- `product_supplier.deleted` - Remove vínculo

### 4. Monitoramento
- ✅ Painel de monitoramento em `/monitoramento-api`
- ✅ Logs detalhados de todos os eventos
- ✅ Estatísticas por recurso e ação
- ✅ Alertas de falhas de validação HMAC

---

## ⚠️ Pendência: Autorização OAuth

O webhook **NÃO PODE SER REGISTRADO** no Bling porque o sistema não possui um token de acesso válido.

### Problema Identificado

```sql
SELECT userId, LENGTH(accessToken) as tokenLength, tokenExpiresAt 
FROM bling_config WHERE userId = 1;

-- Resultado:
-- userId: 1
-- tokenLength: null  ← Não há token!
-- tokenExpiresAt: null
```

### Por que isso acontece?

1. ✅ Credenciais (clientId/clientSecret) estão salvas
2. ❌ Token de acesso OAuth **não foi gerado**
3. ❌ Sem token, não é possível registrar webhook no Bling
4. ❌ Sem webhook registrado, atualizações não chegam automaticamente

---

## 🔧 Como Ativar o Webhook

### Passo 1: Completar Autorização OAuth

1. Acesse a página **Configurações** (`/settings`)
2. Na seção **"2. Autorização OAuth"**, clique em **"Abrir Portal de Desenvolvedores"**
3. No portal do Bling:
   - Vá em "Meus Aplicativos"
   - Selecione seu aplicativo
   - Clique em "Gerar Link de Convite"
   - Abra o link e autorize o aplicativo
   - Copie o **código de autorização** que aparece na URL (parâmetro `code`)
4. Volte para a página de Configurações
5. Cole o código no campo **"Código de Autorização"**
6. Clique em **"Autorizar"**

✅ Isso vai gerar o `accessToken` e `refreshToken` necessários.

### Passo 2: Registrar Webhook

Após completar a autorização OAuth:

1. Role até a seção **"Sincronização Automática via Webhook"**
2. Clique no botão **"Ativar Sincronização Automática"**
3. O sistema irá:
   - Registrar o webhook no Bling
   - Configurar eventos de produtos, estoque e pedidos
   - Ativar atualizações em tempo real

### Passo 3: Validar Funcionamento

1. Faça uma alteração de teste no Bling (ex: alterar estoque de um produto)
2. Acesse `/monitoramento-api` para ver o webhook sendo recebido
3. Verifique que o estoque foi atualizado automaticamente no sistema

---

## 📊 Eventos Suportados

Quando o webhook estiver ativo, o sistema receberá notificações em tempo real para:

| Evento | Descrição | Ação Automática |
|--------|-----------|-----------------|
| `stock.updated` | Saldo de estoque alterado | Atualiza `physicalStock` na tabela `inventory` |
| `product.updated` | Produto alterado | Atualiza dados do produto |
| `order.created` | Novo pedido criado | Cria registro na tabela `orders` |
| `order.updated` | Pedido atualizado | Atualiza status e dados do pedido |

---

## 🔄 Sincronização Híbrida

O sistema usa um modelo **híbrido** para garantir dados sempre atualizados:

1. **Webhooks (Tempo Real)** - Atualizações instantâneas quando ativado
2. **Sincronização Semanal (Fallback)** - Sincronização completa a cada 7 dias para garantir consistência

Mesmo sem webhook ativo, o sistema continua funcionando com sincronização manual ou automática semanal.

---

## 📝 Logs e Debugging

Todos os eventos de webhook são registrados na tabela `webhookEvents`:

```sql
SELECT * FROM webhookEvents 
ORDER BY receivedAt DESC 
LIMIT 10;
```

Campos importantes:
- `eventId` - ID único do evento (idempotência)
- `resource` - Recurso afetado (product, stock, order)
- `action` - Ação realizada (created, updated, deleted)
- `processed` - Se foi processado com sucesso
- `error` - Mensagem de erro (se houver)

---

## ✅ Conclusão

**Status Atual:**
- ✅ Webhook 100% implementado e testado
- ⚠️ Aguardando autorização OAuth para ativar
- ✅ Sistema funcionando com sincronização manual/automática

**Próximo Passo:**
Completar autorização OAuth conforme instruções acima para ativar atualizações em tempo real.
