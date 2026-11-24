const pg = require('pg');
const pool = new pg.Pool({user: 'postgres', host: 'localhost', database: 'CDMX', password: 'Saladito68', port: 5432});
pool.query("SELECT * FROM evidencias WHERE archivo_url LIKE '%1907%' OR archivo_url LIKE '%7317%'").then(res => {console.log(res.rows); pool.end();});
