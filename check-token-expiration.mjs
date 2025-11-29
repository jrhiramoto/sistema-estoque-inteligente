/**
 * Script para analisar expiração do token do Bling
 */

import { config } from 'dotenv';
config();

async function checkTokenExpiration() {
  try {
    const mysql = await import('mysql2/promise');
    const connection = await mysql.createConnection(process.env.DATABASE_URL);
    
    const [rows] = await connection.execute(`
      SELECT 
        id,
        clientId,
        tokenExpiresAt,
        TIMESTAMPDIFF(SECOND, NOW(), tokenExpiresAt) as segundos_restantes,
        TIMESTAMPDIFF(HOUR, NOW(), tokenExpiresAt) as horas_restantes,
        TIMESTAMPDIFF(DAY, NOW(), tokenExpiresAt) as dias_restantes,
        createdAt,
        updatedAt
      FROM bling_config
      ORDER BY id DESC
      LIMIT 1
    `);
    
    if (!rows || rows.length === 0) {
      console.error('❌ Nenhuma configuração do Bling encontrada');
      process.exit(1);
    }
    
    const config = rows[0];
    const now = new Date();
    const expiresAt = new Date(config.tokenExpiresAt);
    
    console.log('\n📊 Análise de Expiração do Token\n');
    console.log(`Token expira em: ${expiresAt.toLocaleString('pt-BR')}`);
    console.log(`Data atual: ${now.toLocaleString('pt-BR')}`);
    console.log(`\nTempo restante:`);
    console.log(`  - ${config.dias_restantes} dias`);
    console.log(`  - ${config.horas_restantes} horas`);
    console.log(`  - ${config.segundos_restantes} segundos`);
    
    if (config.segundos_restantes <= 0) {
      console.log('\n❌ TOKEN EXPIRADO!');
      console.log(`Expirou há ${Math.abs(config.horas_restantes)} horas`);
    } else if (config.horas_restantes < 24) {
      console.log('\n⚠️ TOKEN EXPIRA EM MENOS DE 24 HORAS!');
    } else {
      console.log('\n✅ Token ainda válido');
    }
    
    console.log(`\n📅 Histórico:`);
    console.log(`  - Criado em: ${new Date(config.createdAt).toLocaleString('pt-BR')}`);
    console.log(`  - Atualizado em: ${new Date(config.updatedAt).toLocaleString('pt-BR')}`);
    
    // Calcular duração do token (em dias)
    const createdAt = new Date(config.createdAt);
    const tokenDuration = Math.floor((expiresAt - createdAt) / (1000 * 60 * 60 * 24));
    console.log(`\n⏱️ Duração do token: ${tokenDuration} dias`);
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

checkTokenExpiration();
