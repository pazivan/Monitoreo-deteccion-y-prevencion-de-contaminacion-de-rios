const pg = require('pg');
const pool = new pg.Pool({user: 'postgres', host: 'localhost', database: 'CDMX', password: 'Saladito68', port: 5432});
pool.query("SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'evidencias'").then(res => {console.log(res.rows); pool.end();});
