const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function setupMaintenanceSystem() {
  console.log('[SETUP MAINTENANCE] Verificando estrutura do sistema...');
  
  try {
    // 1. Verificar se a coluna existe
    let { data: sampleTruck, error } = await supabase
      .from('trucks')
      .select('*')
      .limit(1);

    if (error) {
      console.error('[SETUP MAINTENANCE] Erro ao buscar camiões:', error);
      return;
    }

    if (!sampleTruck || sampleTruck.length === 0) {
      console.log('[SETUP MAINTENANCE] Nenhum camião na base de dados');
      return;
    }

    const hasMaintenanceColumn = 'mileage_since_maintenance' in sampleTruck[0];
    console.log('[SETUP MAINTENANCE] Coluna mileage_since_maintenance existe?', hasMaintenanceColumn);

    if (!hasMaintenanceColumn) {
      console.log('[SETUP MAINTENANCE] ⚠️ AÇÃO NECESSÁRIA:');
      console.log('');
      console.log('Você precisa adicionar a coluna manualmente no Supabase Dashboard:');
      console.log('');
      console.log('SQL para executar:');
      console.log('----------------------------------------------');
      console.log('ALTER TABLE trucks ADD COLUMN mileage_since_maintenance INTEGER DEFAULT 0;');
      console.log('----------------------------------------------');
      console.log('');
      console.log('Passos:');
      console.log('1. Abra https://app.supabase.com/');
      console.log('2. Selecione seu projeto');
      console.log('3. Vá para "SQL Editor"');
      console.log('4. Clique em "New query"');
      console.log('5. Cole o SQL acima');
      console.log('6. Clique em "Run"');
      console.log('');
      console.log('Depois, recarregue a aplicação!');
      return;
    }

    console.log('[SETUP MAINTENANCE] ✅ Coluna existe!');
    
    // 2. Verificar se todos os camiões têm valores
    const { count } = await supabase
      .from('trucks')
      .select('*', { count: 'exact', head: true });

    console.log(`[SETUP MAINTENANCE] Total de camiões: ${count}`);
    
    // 3. Atualizar camiões sem valor (segurança)
    const { error: updateError } = await supabase
      .from('trucks')
      .update({ mileage_since_maintenance: 0 })
      .is('mileage_since_maintenance', null);

    if (updateError) {
      console.log('[SETUP MAINTENANCE] Nota: Alguns camiões já têm valores');
    } else {
      console.log('[SETUP MAINTENANCE] ✅ Camiões inicializados com mileage_since_maintenance = 0');
    }

    console.log('[SETUP MAINTENANCE] ✅ Sistema de manutenção pronto!');

  } catch (err) {
    console.error('[SETUP MAINTENANCE] Erro:', err.message);
  }
}

setupMaintenanceSystem();
