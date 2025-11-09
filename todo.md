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
