/**
 * Job de Recálculo Automático da Análise ABC
 * 
 * Executa semanalmente (domingos às 3h) para manter classificações atualizadas
 * Configurável via banco de dados para ajustar frequência
 */

import * as db from "./db";

/**
 * Executa recálculo da análise ABC
 */
async function executeAbcCalculation(): Promise<void> {
  try {
    console.log("[ABC Auto] 🔄 Iniciando recálculo automático da análise ABC...");
    
    const startTime = Date.now();
    const result = await db.calculateAbcClassification(1); // userId 1 = owner
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (result.success) {
      console.log(`[ABC Auto] ✅ Recálculo concluído em ${duration}s`);
      console.log(`[ABC Auto] 📊 Estatísticas:`, {
        totalProdutos: result.stats?.totalProducts,
        classeA: result.stats?.classA,
        classeB: result.stats?.classB,
        classeC: result.stats?.classC,
        classeD: result.stats?.classD,
      });
    } else {
      console.error("[ABC Auto] ❌ Falha no recálculo:", result.message);
    }
    
  } catch (error: any) {
    console.error("[ABC Auto] ❌ Erro ao executar recálculo:", error.message);
  }
}

/**
 * Verifica se deve executar recálculo baseado na configuração
 */
async function checkAndExecute(): Promise<void> {
  try {
    // Buscar configuração de frequência (userId 1 = owner)
    const config = await db.getAbcAutoCalculationConfig(1);
    
    if (!config || !config.enabled) {
      console.log("[ABC Auto] ⏸️  Recálculo automático desabilitado");
      return;
    }
    
    const now = new Date();
    const lastCalculation = config.lastCalculationAt ? new Date(config.lastCalculationAt) : null;
    
    // Se nunca calculou, executar
    if (!lastCalculation) {
      console.log("[ABC Auto] 🆕 Primeira execução automática");
      await executeAbcCalculation();
      await db.updateAbcAutoCalculationConfig(1, { lastCalculationAt: now });
      return;
    }
    
    // Calcular tempo desde última execução
    const hoursSinceLastCalc = (now.getTime() - lastCalculation.getTime()) / (1000 * 60 * 60);
    
    // Verificar se deve executar baseado na frequência
    let shouldExecute = false;
    let frequencyName = "";
    
    switch (config.frequency) {
      case "daily":
        shouldExecute = hoursSinceLastCalc >= 24;
        frequencyName = "diária";
        break;
      case "weekly":
        shouldExecute = hoursSinceLastCalc >= 168; // 7 dias
        frequencyName = "semanal";
        break;
      case "biweekly":
        shouldExecute = hoursSinceLastCalc >= 336; // 14 dias
        frequencyName = "quinzenal";
        break;
      case "monthly":
        shouldExecute = hoursSinceLastCalc >= 720; // 30 dias
        frequencyName = "mensal";
        break;
      default:
        console.error(`[ABC Auto] ⚠️  Frequência desconhecida: ${config.frequency}`);
        return;
    }
    
    if (shouldExecute) {
      console.log(`[ABC Auto] ⏰ Executando recálculo ${frequencyName} (última: ${lastCalculation.toLocaleString('pt-BR')})`);
      await executeAbcCalculation();
      await db.updateAbcAutoCalculationConfig(1, { lastCalculationAt: now });
    } else {
      const hoursRemaining = Math.ceil(
        (config.frequency === "daily" ? 24 :
         config.frequency === "weekly" ? 168 :
         config.frequency === "biweekly" ? 336 : 720) - hoursSinceLastCalc
      );
      console.log(`[ABC Auto] ⏳ Próximo recálculo ${frequencyName} em ~${hoursRemaining}h`);
    }
    
  } catch (error: any) {
    console.error("[ABC Auto] ❌ Erro ao verificar configuração:", error.message);
  }
}

/**
 * Executa o cálculo ABC (para ser chamada por Vercel Cron)
 */
export async function performAbcAutoCalculation(): Promise<void> {
  await checkAndExecute();
}

/**
 * Inicia o job de recálculo automático (para ambiente local/Manus)
 * Verifica a cada 1 hora se deve executar baseado na configuração
 */
export function startAbcAutoCalculationJob(): void {
  console.log("[ABC Auto] 🚀 Iniciando job de recálculo automático da análise ABC");
  console.log("[ABC Auto] 🔍 Verificação: a cada 1 hora");
  console.log("[ABC Auto] ⚙️  Frequência padrão: semanal (domingos às 3h)");
  console.log("[ABC Auto] 📝 Configurável via banco de dados");
  
  // Executar verificação imediatamente na inicialização
  checkAndExecute().catch(console.error);
  
  // Verificar a cada 1 hora se deve executar
  setInterval(() => {
    checkAndExecute().catch(console.error);
  }, 60 * 60 * 1000); // 1 hora em ms
}
