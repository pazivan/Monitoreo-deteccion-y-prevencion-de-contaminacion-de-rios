const pg = require('pg');
const pool = new pg.Pool({user: 'postgres', host: 'localhost', database: 'CDMX', password: 'Saladito68', port: 5432});
pool.query('SELECT archivo_url FROM evidencias LIMIT 5').then(res => {console.log(res.rows); pool.end();});
