const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function addMaintenanceColumn() {
  try {
    console.log('[ADD MAINTENANCE COLUMN] Iniciando...');
    
    // Primeiro, vamos usar uma abordagem diferente - tentar selecionar a coluna
    // Se ela não existe, ela vai falhar e saberemos que precisa ser criada
    let { data, error } = await supabase
      .from('trucks')
      .select('id, mileage_since_maintenance')
      .limit(1);

    if (error && error.message && error.message.includes('mileage_since_maintenance')) {
      console.log('[ADD MAINTENANCE COLUMN] Coluna não existe. Criando...');
      
      // Usar execSQL através de query
      // Note: Supabase não permite ALTER TABLE via REST API diretamente
      // Você precisa ir ao Supabase Dashboard > SQL Editor e executar:
      // ALTER TABLE trucks ADD COLUMN mileage_since_maintenance INTEGER DEFAULT 0;
      
      console.log('[ADD MAINTENANCE COLUMN] SQL a executar manualmente:');
      console.log('ALTER TABLE trucks ADD COLUMN mileage_since_maintenance INTEGER DEFAULT 0;');
      console.log('');
      console.log('Por favor, execute este SQL no Supabase Dashboard:');
      console.log('1. Aceda a https://app.supabase.com/');
      console.log('2. Selecione o seu projeto');
      console.log('3. Vá para SQL Editor');
      console.log('4. Cole o SQL acima e execute');
    } else if (error) {
      console.error('[ADD MAINTENANCE COLUMN] Erro:', error);
    } else {
      console.log('[ADD MAINTENANCE COLUMN] Coluna já existe!');
      console.log('Dados:', data);
    }
  } catch (err) {
    console.error('[ADD MAINTENANCE COLUMN] Erro geral:', err.message);
  }
}

addMaintenanceColumn();
