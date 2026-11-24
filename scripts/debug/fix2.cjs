const pg = require('pg');
const pool = new pg.Pool({user: 'postgres', host: 'localhost', database: 'CDMX', password: 'Saladito68', port: 5432});
pool.query("UPDATE evidencias SET archivo_url = 'https://images.unsplash.com/photo-1584483756263-149b144bcbbd?auto=format&fit=crop&q=80&w=400' WHERE archivo_url = 'https://via.placeholder.com/400x200?text=Reporte'").then(res => {console.log("Updated rows:", res.rowCount); pool.end();});
