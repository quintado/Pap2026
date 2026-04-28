const { supabase } = require('../config/database');

async function check() {
    console.log('--- Checking delivery_requests table ---');
    const { data, error } = await supabase.from('delivery_requests').select('*').limit(1);

    if (error) {
        if (error.code === '42P01') {
            console.log('TABLE_MISSING: delivery_requests does not exist.');
        } else {
            console.log('ERROR:' + JSON.stringify(error));
        }
    } else {
        console.log('TABLE_EXISTS: delivery_requests is present.');
        if (data.length > 0) {
            console.log('Columns:', Object.keys(data[0]));
        } else {
            // Error hack to find columns
            const { error: err } = await supabase.from('delivery_requests').select('dummy');
            console.log('HINT:' + (err ? err.message : 'No hint'));
        }
    }
}

check();

