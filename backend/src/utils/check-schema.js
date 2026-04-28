const { supabase } = require('../config/database');
const fs = require('fs');

async function checkSchema() {
    let output = '';
    try {
        const tables = ['deliveries', 'trucks', 'delivery_requests'];
        for (const table of tables) {
            output += `--- ${table.toUpperCase()} COLUMNS ---\n`;
            const { data, error } = await supabase.from(table).select('*').limit(1);
            if (error) {
                output += `Error: ${JSON.stringify(error)}\n`;
            } else {
                const keys = Object.keys(data[0] || {});
                keys.forEach(k => output += `${k}\n`);
            }
            output += '\n';
        }
        fs.writeFileSync('schema_final.txt', output, 'utf8');
        console.log('Schema written to schema_final.txt');
    } catch (err) {
        console.error('Catch Error:', err);
    }
}

checkSchema();

