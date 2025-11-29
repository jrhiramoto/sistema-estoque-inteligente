/**
 * Script para testar API de pedidos do Bling
 * Verifica se há pedidos e quais situações existem
 */

import { config } from 'dotenv';
config();

const BLING_API_URL = 'https://www.bling.com.br/Api/v3';

async function testBlingOrders() {
  try {
    // Buscar config do Bling do banco
    const mysql = await import('mysql2/promise');
    const connection = await mysql.createConnection(process.env.DATABASE_URL);
    
    const [rows] = await connection.execute(
      'SELECT accessToken FROM bling_config ORDER BY id DESC LIMIT 1'
    );
    
    if (!rows || rows.length === 0) {
      console.error('❌ Nenhuma configuração do Bling encontrada');
      process.exit(1);
    }
    
    const accessToken = rows[0].accessToken;
    console.log('✅ Token encontrado');
    
    // 1. Buscar pedidos SEM filtro de situação (primeiros 10)
    console.log('\n📦 Buscando pedidos sem filtro...');
    const response1 = await fetch(
      `${BLING_API_URL}/pedidos/vendas?limite=10`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );
    
    if (!response1.ok) {
      console.error(`❌ Erro na API: ${response1.status} ${response1.statusText}`);
      const text = await response1.text();
      console.error(text);
      process.exit(1);
    }
    
    const data1 = await response1.json();
    console.log(`✅ Total de pedidos encontrados: ${data1.data?.length || 0}`);
    
    if (data1.data && data1.data.length > 0) {
      console.log('\n📋 Primeiros 5 pedidos:');
      data1.data.slice(0, 5).forEach((pedido, i) => {
        console.log(`${i + 1}. Pedido #${pedido.numero} - Situação: ${pedido.situacao?.valor} (ID: ${pedido.situacao?.id})`);
      });
      
      // Listar todas as situações únicas
      const situacoes = new Map();
      data1.data.forEach(pedido => {
        if (pedido.situacao) {
          situacoes.set(pedido.situacao.id, pedido.situacao.valor);
        }
      });
      
      console.log('\n📊 Situações encontradas:');
      situacoes.forEach((valor, id) => {
        console.log(`  - ID ${id}: ${valor}`);
      });
    }
    
    // 2. Buscar pedidos com situação "atendido" (ID 15)
    console.log('\n\n📦 Buscando pedidos com situação "atendido" (ID 15)...');
    const response2 = await fetch(
      `${BLING_API_URL}/pedidos/vendas?limite=10&idsSituacoes[]=15`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );
    
    if (response2.ok) {
      const data2 = await response2.json();
      console.log(`✅ Pedidos "atendido": ${data2.data?.length || 0}`);
    }
    
    // 3. Buscar pedidos com situação "faturado" (ID 24)
    console.log('\n📦 Buscando pedidos com situação "faturado" (ID 24)...');
    const response3 = await fetch(
      `${BLING_API_URL}/pedidos/vendas?limite=10&idsSituacoes[]=24`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );
    
    if (response3.ok) {
      const data3 = await response3.json();
      console.log(`✅ Pedidos "faturado": ${data3.data?.length || 0}`);
    }
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

testBlingOrders();
