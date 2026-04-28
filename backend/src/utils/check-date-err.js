const { supabase } = require('../config/database');

async function checkSchema() {
    console.log('START_SCHEMA');
    const { data, error } = await supabase.from('deliveries').select('*').limit(1);
    if (data && data.length > 0) {
        console.log('COLUMNS:' + JSON.stringify(Object.keys(data[0])));
    } else {
        // If no data, try to find column names via error hack
        const { error: err } = await supabase.from('deliveries').select('not_a_col');
        console.log('ERROR_HINT:' + JSON.stringify(err));
    }
    console.log('END_SCHEMA');
}

checkSchema();

