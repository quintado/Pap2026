const { supabase } = require('../config/database');

async function debugAll() {
    console.log('--- START DEBUG ---');

    const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, name, company, role');

    if (userError) {
        console.log('USER_ERROR:' + JSON.stringify(userError));
    } else {
        console.log('USERS_DATA:' + JSON.stringify(users));
    }

    const { data: cols, error: colError } = await supabase.from('deliveries').select('*').limit(1);
    if (!colError && cols.length > 0) {
        console.log('DELIVERY_COLUMNS:' + JSON.stringify(Object.keys(cols[0])));
    } else if (colError) {
        console.log('DELIVERY_COL_ERROR:' + JSON.stringify(colError));
    }

    // Try a manual insert with a known user if possible
    if (users && users.length > 0) {
        const u = users[0];
        console.log(`TESTING_INSERT_WITH_USER:${u.id} (${u.name}), COMPANY:${u.company}`);
        const { error: insErr } = await supabase.from('deliveries').insert([{
            tipo: 'Debug',
            origem: 'Debug',
            destino: 'Debug',
            estado: 'pendente',
            company: u.company,
            created_by: u.id
        }]);
        if (insErr) {
            console.log('INSERT_ERROR:' + JSON.stringify(insErr));
        } else {
            console.log('INSERT_SUCCESS');
        }
    }

    console.log('--- END DEBUG ---');
}

debugAll().catch(err => console.log('FATAL_ERROR:' + err.message));

