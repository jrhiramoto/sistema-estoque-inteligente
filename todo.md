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
