const { supabase } = require('../config/database');

async function checkSchema() {
    console.log('--- Checking "deliveries" table ---');

    // Try to get one row to see columns
    const { data, error } = await supabase
        .from('deliveries')
        .select('*')
        .limit(1);

    if (error) {
        console.error('❌ Error selecting from deliveries:', error);
        // If it fails, let's try to see if the table exists at all
        const { error: tableError } = await supabase.from('deliveries').select('id').limit(1);
        if (tableError) {
            console.error('❌ Table "deliveries" might not exist:', tableError.message);
        }
        process.exit(1);
    }

    if (data && data.length > 0) {
        console.log('✅ Columns found in "deliveries":', Object.keys(data[0]));
    } else {
        console.log('⚠️ No data found in "deliveries" table.');
        console.log('Attempting to check metadata via PostgREST if possible (by selecting non-existent column to see error)...');
        const { error: hintError } = await supabase.from('deliveries').select('non_existent_column_test');
        console.log('Metadata hint from error:', hintError?.message);
    }

    console.log('\n--- Checking "users" table for comparison ---');
    const { data: userData, error: userError } = await supabase.from('users').select('*').limit(1);
    if (!userError && userData.length > 0) {
        console.log('✅ Columns found in "users":', Object.keys(userData[0]));
    }
}

checkSchema();

