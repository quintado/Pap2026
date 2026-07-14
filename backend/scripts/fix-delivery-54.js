/**
 * Script temporário para corrigir a entrega 54 que perdeu o assigned_to
 * por causa do trigger do Supabase.
 * Worker: Paulo (id: 40) — confirmado nos logs do servidor
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function fixDelivery() {
  // 1. Verificar a entrega atual
  const { data: delivery } = await supabase
    .from('deliveries')
    .select('id, estado, assigned_to, truck_id')
    .eq('id', 54)
    .single();

  console.log('Estado atual da entrega 54:', delivery);

  if (!delivery) {
    console.log('Entrega 54 não encontrada.');
    return;
  }

  // 2. Corrigir: atribuir o worker Paulo (id: 40) de volta
  const { data, error } = await supabase
    .from('deliveries')
    .update({ assigned_to: 40 })  // Paulo
    .eq('id', 54)
    .select();

  if (error) {
    console.error('Erro ao corrigir:', error);
  } else {
    console.log('Entrega 54 corrigida! assigned_to agora:', data?.[0]?.assigned_to);
  }
}

fixDelivery().catch(console.error);
