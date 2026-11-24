const pg = require('pg');
const pool = new pg.Pool({user: 'postgres', host: 'localhost', database: 'CDMX', password: 'Saladito68', port: 5432});
pool.query('SELECT id_incidencia, length(archivo_url) FROM evidencias').then(res => {console.log(res.rows); pool.end();});
