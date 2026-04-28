const { supabase } = require('../config/database');
const fs = require('fs');

async function checkSchema() {
    const result = {
        deliveries: {},
        users: {}
    };

    const { data: delData, error: delError } = await supabase.from('deliveries').select('*').limit(1);
    if (!delError && delData.length > 0) {
        result.deliveries.columns = Object.keys(delData[0]);
    } else if (delError) {
        result.deliveries.error = delError;
    }

    const { data: userData, error: userError } = await supabase.from('users').select('*').limit(1);
    if (!userError && userData.length > 0) {
        result.users.columns = Object.keys(userData[0]);
    } else if (userError) {
        result.users.error = userError;
    }

    fs.writeFileSync('schema-debug.json', JSON.stringify(result, null, 2));
    console.log('Schema info written to schema-debug.json');
}

checkSchema();

