const { supabase } = require('../config/database');

async function check() {
    const { data, error } = await supabase.from('users').select('id, name, company').eq('id', 1).single();
    if (error) {
        console.log('USER_NOT_FOUND_OR_ERROR:' + JSON.stringify(error));
        return;
    }
    console.log('USER_ID_1_INFO:' + JSON.stringify(data));
}

check();

