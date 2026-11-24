const pg = require('pg');
const pool = new pg.Pool({user: 'postgres', host: 'localhost', database: 'CDMX', password: 'Saladito68', port: 5432});
pool.query("SELECT i.folio, i.id_categoria, c.nombre FROM incidencias i LEFT JOIN categorias c ON i.id_categoria = c.id_categoria WHERE i.folio = 'INC-CDMX-5812'").then(res => {console.log(res.rows); pool.end();});
