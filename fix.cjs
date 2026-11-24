const pg = require('pg');
const pool = new pg.Pool({user: 'postgres', host: 'localhost', database: 'CDMX', password: 'Saladito68', port: 5432});
pool.query("UPDATE evidencias SET archivo_url = 'https://via.placeholder.com/400x200?text=Reporte' WHERE length(archivo_url) > 1000").then(res => {console.log("Updated rows:", res.rowCount); pool.end();});
