const { supabase } = require('../config/database');

async function standardize() {
    console.log('--- STANDARDIZING COMPANY NAMES ---');

    const { error: err1 } = await supabase
        .from('users')
        .update({ company: 'CamiGest' })
        .ilike('company', 'camigest');

    if (err1) console.error('Error updating users:', err1);
    else console.log('Users updated successfully.');

    const { error: err2 } = await supabase
        .from('deliveries')
        .update({ company: 'CamiGest' })
        .ilike('company', 'camigest');

    if (err2) console.error('Error updating deliveries:', err2);
    else console.log('Deliveries updated successfully.');

    const { error: err3 } = await supabase
        .from('trucks')
        .update({ company: 'CamiGest' })
        .ilike('company', 'camigest');

    if (err3) console.error('Error updating trucks:', err3);
    else console.log('Trucks updated successfully.');
}

standardize();

