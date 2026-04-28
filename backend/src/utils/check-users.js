const { supabase } = require('../config/database');

async function check() {
    const { data, error } = await supabase.from('users').select('*');
    if (error) {
        console.error(error);
        return;
    }
    console.log('--- USERS LIST ---');
    data.forEach(u => {
        console.log(`ID: ${u.id}, Name: ${u.name}, Company: ${u.company}, Role: ${u.role}`);
    });
    console.log('------------------');
}

check();

