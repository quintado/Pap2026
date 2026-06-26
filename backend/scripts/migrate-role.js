require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function migrateRole() {
  console.log('🔍 A verificar utilizadores com role = "fundador"...');

  // Ver quantos existem antes
  const { data: before, error: fetchError } = await supabase
    .from('users')
    .select('id, name, company, role')
    .eq('role', 'fundador');

  if (fetchError) {
    console.error('❌ Erro ao buscar utilizadores:', fetchError.message);
    process.exit(1);
  }

  if (!before || before.length === 0) {
    console.log('✅ Nenhum utilizador com role "fundador" encontrado. Nada a fazer.');
    process.exit(0);
  }

  console.log(`📋 Encontrados ${before.length} utilizador(es) com role "fundador":`);
  before.forEach(u => console.log(`   - ID ${u.id}: ${u.name} (${u.company})`));

  // Executar o update
  const { error: updateError } = await supabase
    .from('users')
    .update({ role: 'CEO' })
    .eq('role', 'fundador');

  if (updateError) {
    console.error('❌ Erro ao atualizar roles:', updateError.message);
    process.exit(1);
  }

  console.log(`\n✅ Sucesso! ${before.length} utilizador(es) atualizados de "fundador" → "CEO".`);
  process.exit(0);
}

migrateRole();
