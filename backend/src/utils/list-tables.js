const { supabase } = require('../config/database');

async function listTables() {
    console.log('--- Listing tables in public schema ---');

    // We'll try to guess table names or use a trick.
    // Since we cannot query pg_class directly via PostgREST easily, 
    // let's try to access tables we suspect might exist.

    const tablesToTry = ['trucks', 'camioes', 'users', 'utilizadores', 'deliveries', 'entregas'];

    for (const table of tablesToTry) {
        const { error } = await supabase.from(table).select('*').limit(0);
        if (error) {
            console.log(`Table "${table}": ❌ ERROR (${error.code}) - ${error.message}`);
        } else {
            console.log(`Table "${table}": ✅ EXISTS`);
        }
    }
}

listTables();

