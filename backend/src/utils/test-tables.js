const { supabase } = require('../config/database');

async function check() {
    console.log('--- TARGETED CHECK ---');

    const t1 = await supabase.from('trucks').select('*').limit(1);
    if (t1.error) {
        console.log('trucks ERROR:', t1.error.message, 'CODE:', t1.error.code);
    } else {
        console.log('trucks ✅ EXISTS');
    }

    const t2 = await supabase.from('camioes').select('*').limit(1);
    if (t2.error) {
        console.log('camioes ERROR:', t2.error.message, 'CODE:', t2.error.code);
    } else {
        console.log('camioes ✅ EXISTS');
    }

    console.log('--- END CHECK ---');
}

check();

