/**
 * Script para adicionar coluna mileage_since_maintenance à tabela trucks
 * Usa Supabase REST API com admin access
 */

require('dotenv').config();
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const PROJECT_ID = SUPABASE_URL.split('.')[0].replace('https://', '');

async function executeSQL(sqlQuery) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/rpc/sql`);
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
        'Prefer': 'return=representation'
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify({ query: sqlQuery }));
    req.end();
  });
}

async function main() {
  console.log('[MIGRATION] Iniciando migração do sistema de manutenção...');
  console.log('');

  try {
    // SQL para adicionar a coluna
    const sql = `
      ALTER TABLE trucks 
      ADD COLUMN IF NOT EXISTS mileage_since_maintenance INTEGER DEFAULT 0;
    `;

    console.log('[MIGRATION] Executando SQL:');
    console.log('  ' + sql.trim().replace(/\n/g, '\n  '));
    console.log('');

    const result = await executeSQL(sql);
    
    if (result.status === 200 || result.status === 201) {
      console.log('[MIGRATION] ✅ Sucesso! Coluna adicionada/verificada.');
      console.log('[MIGRATION] ✅ Sistema de manutenção pronto para usar!');
    } else if (result.status === 404) {
      console.log('[MIGRATION] ⚠️ Função SQL não disponível neste projeto.');
      console.log('[MIGRATION] Você precisa adicionar a coluna manualmente:');
      console.log('');
      console.log('Abra o Supabase Dashboard e execute no SQL Editor:');
      console.log('  ALTER TABLE trucks ADD COLUMN IF NOT EXISTS mileage_since_maintenance INTEGER DEFAULT 0;');
    } else {
      console.log('[MIGRATION] Resposta:', result);
    }
  } catch (err) {
    console.error('[MIGRATION] Erro:', err.message);
    console.log('');
    console.log('Se receber um erro, execute manualmente no Supabase Dashboard:');
    console.log('  ALTER TABLE trucks ADD COLUMN IF NOT EXISTS mileage_since_maintenance INTEGER DEFAULT 0;');
  }
}

main();
