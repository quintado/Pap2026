const { supabase } = require('../config/database');

async function debug() {
    console.log('--- DEBUG: DELIVERY REQUESTS ---');
    const { data: requests, error: err1 } = await supabase.from('delivery_requests').select('*, delivery:delivery_id(*), worker:worker_id(*), truck:truck_id(*)');
    if (err1) console.error('Error fetching requests:', err1);
    else console.log('Total Requests:', requests.length, JSON.stringify(requests, null, 2));

    console.log('\n--- DEBUG: DELIVERIES (First 5) ---');
    const { data: deliveries, error: err2 } = await supabase.from('deliveries').select('*').limit(5);
    if (err2) console.error('Error fetching deliveries:', err2);
    else console.log('Deliveries Samples:', JSON.stringify(deliveries, null, 2));

    console.log('\n--- DEBUG: USERS (First 5) ---');
    const { data: users, error: err3 } = await supabase.from('users').select('*').limit(5);
    if (err3) console.error('Error fetching users:', err3);
    else console.log('Users Samples:', JSON.stringify(users, null, 2));
}

debug();

