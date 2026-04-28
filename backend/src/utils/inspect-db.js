const { supabase } = require('../config/database');

async function inspect() {
    console.log('--- Deep Inspection: deliveries table ---');

    // Check if the table has data and what it looks like
    const { data, error } = await supabase.from('deliveries').select('*').limit(5);
    if (error) {
        console.error('Error fetching deliveries:', error);
    } else {
        console.log('Current deliveries data (first 5):', JSON.stringify(data, null, 2));
    }

    // Attempting a direct insert with a hardcoded company string to bypass any variables
    console.log('\n--- Test Insert with hardcoded "TEST_COMPANY" ---');
    const { error: insertError } = await supabase.from('deliveries').insert([{
        tipo: 'Inspect',
        origem: 'Source',
        destino: 'Dest',
        estado: 'pendente',
        company: 'TEST_COMPANY',
        created_by: 1 // Assuming 1 exists based on previous debus
    }]);

    if (insertError) {
        console.error('❌ Hardcoded insert FAILED:', insertError.message);
        console.error('Full error:', JSON.stringify(insertError, null, 2));
    } else {
        console.log('✅ Hardcoded insert SUCCEEDED!');
    }
}

inspect();

