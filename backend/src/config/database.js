require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error('❌ ERRO: Variáveis de ambiente SUPABASE_URL e SUPABASE_KEY são obrigatórias!');
    process.exit(1);
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

async function testConnection() {
    try {
        const { error } = await supabase.from('users').select('count').limit(1);
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('❌ Erro ao conectar com Supabase:', error.message);
        return false;
    }
}

module.exports = {
    supabase,
    testConnection
};
