# Sistema de Gestão de Estoque Inteligente - TODO

## Configuração Inicial
- [x] Definir schema do banco de dados
- [x] Configurar integração com API do Bling
- [x] Criar estrutura de navegação e layout

## Integração com Bling
- [ ] Implementar autenticação OAuth com Bling
- [ ] Criar endpoints para sincronização de produtos
- [ ] Criar endpoints para sincronização de estoque
- [ ] Criar endpoints para sincronização de vendas
- [ ] Implementar importação manual via CSV como fallback

## Análise ABC
- [ ] Implementar cálculo automático da classificação ABC
- [ ] Criar visualização da distribuição ABC
- [ ] Permitir ajustes manuais de classificação

## Métricas de Estoque
- [ ] Implementar cálculo de estoque atual
- [ ] Implementar cálculo de ponto de pedido
- [ ] Implementar cálculo de média de vendas (12 meses)
- [ ] Implementar cálculo de quantidade sugerida de compra
- [ ] Implementar indicador de produto a estocar
- [ ] Implementar sugestão para estocar produto
- [ ] Implementar giro de estoque
- [ ] Implementar cobertura de estoque
- [ ] Implementar custo de manutenção
- [ ] Implementar taxa de ruptura

## Dashboards
- [ ] Dashboard principal com visão geral
- [ ] Dashboard de análise ABC
- [ ] Dashboard de métricas por produto
- [ ] Dashboard de alertas e ações necessárias
- [ ] Gráficos de evolução temporal

## Sistema de Alertas
- [ ] Alertas de estoque baixo (Classe A)
- [ ] Alertas de reposição necessária
- [ ] Alertas de estoque excessivo
- [ ] Alertas de divergências de inventário

## Inventário Cíclico
- [ ] Criar agenda de contagens baseada em ABC
- [ ] Interface para registro de contagens
- [ ] Comparação estoque virtual vs físico
- [ ] Registro de divergências e ajustes
- [ ] Histórico de contagens

## Gestão de Produtos
- [ ] Listagem de produtos com filtros
- [ ] Detalhes de produto individual
- [ ] Edição de parâmetros de estoque
- [ ] Histórico de movimentações

## Relatórios
- [ ] Relatório de produtos para reposição
- [ ] Relatório de produtos com estoque excessivo
- [ ] Relatório de acuracidade de inventário
- [ ] Exportação de relatórios em CSV/PDF

## UX/UI
- [ ] Design minimalista e moderno
- [ ] Tema de cores profissional
- [ ] Responsividade mobile
- [ ] Loading states e feedback visual
- [ ] Notificações toast para ações

## OAuth Bling (Novo)
- [x] Implementar endpoint para trocar authorization code por tokens
- [x] Implementar refresh automático de tokens
- [x] Criar interface para colar authorization code
- [ ] Testar fluxo completo de autenticação

## Sincronização Bling (Novo)
- [x] Implementar sincronização de produtos
- [x] Implementar sincronização de estoque
- [x] Implementar sincronização de vendas
- [x] Adicionar botões de sincronização manual
- [ ] Implementar sincronização automática periódica

## Bugs
- [x] Corrigir erro de query retornando undefined quando não há config do Bling
- [x] Corrigir erro 404 na sincronização com API do Bling (endpoints corrigidos + logs melhorados)
- [x] Corrigir erro 400 ao sincronizar estoque do Bling (alterado para buscar estoque por produto)
- [x] Investigar e corrigir erro 404 em algum endpoint da sincronização (endpoint de vendas corrigido para /pedidos/vendas)
- [x] Implementar controle de rate limiting para evitar erro 429 do Bling (processamento em lotes + delay de 500ms)
- [x] Ajustar rate limiting - ainda ocorrendo erro 429 (aumentado delay para 1s + paginação em produtos)
- [x] Corrigir erro de resposta HTML ao invés de JSON da API Bling (adicionado detecção e logs detalhados)

## Sincronização Completa e Contínua
- [x] Corrigir paginação para sincronizar todos os 39.868 produtos (logs detalhados + continua até 3 páginas vazias)
- [x] Adicionar indicador de progresso na sincronização (logs a cada 1000 produtos)
- [ ] Implementar sincronização automática agendada (diária/horária)
- [ ] Criar sistema de atualização incremental (apenas produtos alterados)
- [ ] Adicionar log de histórico de sincronizações

## Controle de Concorrência e Otimização
- [x] Implementar lock de sincronização (apenas 1 por vez)
- [x] Criar sistema de fila para sincronizações pendentes
- [x] Adicionar retry automático para sincronizações que falharem (backoff exponencial: 5, 10, 20 min)
- [x] Aumentar delay para 2 segundos (mais conservador)
- [x] Implementar backoff exponencial para erro 429
- [ ] Adicionar dashboard de monitoramento de sincronizações
- [x] Investigar erro HTML retornado pela API do Bling durante sincronização
- [x] Implementar tratamento robusto de erros HTML da API Bling com mensagens amigáveis (detecta HTML, extrai erro, mensagens por status code)
- [x] Adicionar barra de progresso visual na sincronização (com polling a cada 2s, mostra current/total, percentual e fila)
- [ ] Investigar erro HTML recorrente na sincronização (verificar token expirado ou endpoint incorreto)
- [x] Implementar paginação na listagem de produtos (50 por página)
- [x] Adicionar debounce na busca de produtos (500ms)
- [x] Otimizar query do banco com limit, offset e busca por nome/código

## Sincronização Incremental Automática
- [x] Implementar sincronização incremental de produtos (dataAlteracaoInicial)
- [x] Implementar sincronização incremental de vendas (dataInicial baseada em última sync)
- [ ] Implementar sincronização incremental de estoque (apenas produtos com alteração)
- [x] Criar job agendado para sincronização automática (node-cron, configurável via syncConfig)
- [x] Adicionar interface de configuração de frequência de sincronização (switch + select com opções de 1h a 1 semana)
- [ ] Implementar gestão de produtos inativos (produtos excluídos no Bling)
- [ ] Adicionar dashboard de histórico de sincronizações

## Sincronização de Vendas (Novo)
- [x] Corrigir syncSales para filtrar apenas pedidos com situação "atendido" (ID:15) e "faturado" (ID:24)
- [x] Adicionar syncSales ao fluxo de sincronização completa (syncAll)
- [x] Adicionar syncSales ao job de sincronização automática (já incluído no 'full')
- [x] Verificar e corrigir permissões do aplicativo Bling para acessar pedidos de venda
- [x] Testar sincronização inicial de vendas
- [ ] Testar sincronização incremental de vendas

## Renovação Automática de Token
- [x] Implementar verificação de token expirado antes de cada requisição
- [x] Implementar renovação automática usando refresh token
- [x] Adicionar retry automático após renovação de token
- [ ] Testar fluxo completo de renovação automática

## Bug: Sincronização Automática Indesejada
- [x] Investigar por que sincronização inicia automaticamente após renovação OAuth
- [ ] Remover disparo automático de sincronização após autorização
- [ ] Sincronização deve iniciar apenas: manualmente (botão) ou via job agendado

## Bugs - Módulo de Produtos
- [x] Corrigir exibição de preço dos produtos (valores incorretos)
- [x] Corrigir exibição de custo dos produtos (valores incorretos)
- [x] Adicionar exibição de saldo em estoque na listagem de produtos
- [ ] Adicionar exibição de saldo em estoque na página de detalhes do produto

## Melhorias - Interface
- [x] Adicionar data/hora da última sincronização na seção de Sincronização Automática
- [x] Adicionar data/hora da última sincronização na seção 3 (Sincronização de Dados)

## Bug - Página de Configurações
- [x] Corrigir erro "Unexpected token '<', "<html>" na página /settings (RECORRENTE)
- [x] API mutation retornando HTML ao invés de JSON - causa raiz corrigida

## Melhorias - Sincronização
- [x] Melhorar visibilidade da barra de progresso durante sincronização
- [x] Adicionar porcentagem e ícone animado na barra de progresso

## Bug - Barra de Progresso
- [x] Barra de progresso não aparece quando clica em "Sincronizar Agora"
- [x] Remover sistema de fila - sincronização deve iniciar imediatamente ao clicar
- [x] Simplificar lógica de concorrência (apenas bloquear se já estiver rodando)

## Bug Crítico - API Retornando HTML
- [ ] Erro recorrente: "Unexpected token '<', "<!doctype "... is not valid JSON"
- [ ] Ocorre em queries e mutations na página /settings
- [ ] Investigar se servidor está crashando ou retornando 404/500

## Problema Crítico - Uso Excessivo de Requisições
- [ ] Sistema está atingindo limite de 120.000 requisições diárias da API do Bling
- [ ] Calcular quantas requisições são feitas por sincronização
- [ ] Identificar requisições desnecessárias ou redundantes
- [ ] Otimizar sincronização para reduzir número de requisições
- [x] Otimizar rate limiting: reduzir delay de 1000ms para 350ms (~2.8 req/s)
- [x] Implementar backoff exponencial inteligente para erro 429
- [x] Adicionar circuit breaker para evitar bloqueio de IP
- [x] Adicionar retry inteligente com limite de 3 tentativas
- [x] Criar schema para rastreamento de uso de API (apiUsageLog)
- [x] Implementar coleta automática de métricas no blingService
- [x] Criar endpoints tRPC para consultar métricas de API
- [x] Implementar página de monitoramento com gráficos
- [x] Adicionar status do circuit breaker em tempo real
- [x] Mostrar histórico de erros 429 e recuperações

## Webhooks do Bling (Sincronização em Tempo Real)

### Infraestrutura Base
- [x] Criar tabela webhook_events para idempotência
- [x] Criar endpoint POST /api/webhooks/bling
- [x] Implementar validação HMAC-SHA256
- [x] Implementar sistema de idempotência com eventId
- [x] Adicionar logging detalhado de webhooks

### Handlers de Recursos
- [x] Implementar handler product.created
- [x] Implementar handler product.updated
- [x] Implementar handler product.deleted
- [x] Implementar handler stock.created
- [x] Implementar handler stock.updated
- [x] Implementar handler stock.deleted
- [x] Implementar handler virtual_stock.updated
- [x] Implementar handler order.created
- [x] Implementar handler order.updated
- [x] Implementar handler order.deleted

### Monitoramento
- [x] Adicionar métricas de webhooks ao painel de monitoramento
- [x] Criar visualização de últimos webhooks recebidos
- [x] Adicionar alertas de falhas de validação HMAC
- [x] Mostrar estatísticas por recurso e ação

### Integração
- [x] Integrar webhooks com análise ABC (vendas em tempo real)
- [x] Atualizar alertas de estoque em tempo real
- [x] Documentar configuração no Bling

## Webhook de Produto Fornecedor

- [x] Criar tabela product_suppliers no schema
- [x] Implementar handler product_supplier.created
- [x] Implementar handler product_supplier.updated
- [x] Implementar handler product_supplier.deleted
- [x] Adicionar ao monitoramento de webhooks


## Ajuste de Sincronização Automática

- [x] Alterar frequência de 48h para 7 dias (168h)
- [x] Atualizar cron expression para semanal
- [x] Atualizar descrição na página de configurações
- [x] Documentar modelo híbrido (webhooks + fallback semanal)


## Sincronização Completa de Dados do Bling

### Estoque
- [ ] Sincronizar saldos de estoque de todos os produtos
- [ ] Atualizar campo de saldo atual em produtos
- [ ] Adicionar exibição de saldo na listagem de produtos
- [ ] Adicionar exibição de saldo na página de detalhes do produto

### Vendas
- [ ] Sincronizar histórico completo de vendas
- [ ] Garantir dados para análise ABC (últimos 12 meses mínimo)
- [ ] Validar integridade dos dados de vendas

### Fornecedores
- [ ] Sincronizar fornecedores de produtos do Bling
- [ ] Vincular fornecedores aos produtos correspondentes
- [ ] Exibir fornecedor principal na listagem de produtos
- [ ] Criar seção de fornecedores na página de detalhes do produto


## Sincronização de Vendas com Filtro de Status

- [x] Adicionar campo orderStatus na tabela sales
- [x] Atualizar sincronização para filtrar apenas pedidos "atendido" e "faturado"
- [ ] Executar sincronização completa de vendas
- [ ] Sincronizar fornecedores e vincular aos produtos
- [ ] Validar dados sincronizados
- [ ] Remover logs de debug do código


## Renovação Automática de Token do Bling (CRÍTICO)

- [x] Investigar por que token expirou (verificar tokenExpiresAt no banco)
- [x] Implementar job de renovação automática de token (executar a cada 6h, renova se expira em < 24h)
- [x] Adicionar tentativa de renovação automática antes de cada sincronização
- [x] Implementar renovação automática no blingService antes de cada requisição (se token expira em < 1h)
- [x] Adicionar logs de renovação de token
- [x] Sistema protegido contra expiração de token

## Sincronização de Fornecedores (PENDENTE)

- [ ] Criar função syncProductSuppliers no blingService
- [ ] Adicionar sincronização de fornecedores ao fluxo completo
- [ ] Testar sincronização de fornecedores


## Correção de Erro ao Listar Situações de Pedidos

- [x] Corrigir erro ao listar situações de pedidos quando token está expirado
- [x] Melhorar mensagem de erro quando usuário precisa reautorizar
- [x] Adicionar tratamento de erro UNAUTHORIZED no frontend

## Validação Pós-Reconexão com Bling

### Teste de Conexão
- [ ] Verificar status "Conectado" na página de Configurações
- [ ] Confirmar token válido no banco de dados
- [ ] Testar requisição simples à API do Bling

### Sincronização Manual Completa
- [ ] Executar sincronização manual de produtos
- [ ] Executar sincronização manual de estoque
- [ ] Executar sincronização manual de vendas
- [x] Adicionar sincronização de fornecedores ao fluxo
- [ ] Executar sincronização completa (full)

### Validação de Dados
- [ ] Verificar quantidade de produtos sincronizados
- [ ] Verificar saldos de estoque atualizados
- [ ] Verificar vendas sincronizadas (com filtro de status)
- [ ] Verificar fornecedores vinculados aos produtos
- [ ] Comparar amostra de dados com Bling

### Teste de Webhooks
- [ ] Criar produto de teste no Bling
- [ ] Verificar se webhook foi recebido
- [ ] Editar produto no Bling
- [ ] Verificar atualização em tempo real
- [ ] Lançar movimento de estoque no Bling
- [ ] Verificar atualização de saldo

### Monitoramento
- [ ] Verificar painel de Monitoramento API
- [ ] Confirmar taxa de sucesso de webhooks
- [ ] Verificar consumo de requisições
- [ ] Validar logs de renovação automática de token
