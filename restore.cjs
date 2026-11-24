const pg = require('pg');
const pool = new pg.Pool({user: 'postgres', host: 'localhost', database: 'CDMX', password: 'Saladito68', port: 5432});

async function restore() {
  const inc1 = await pool.query("SELECT id_incidencia FROM incidencias WHERE folio = 'INC-CDMX-1907'");
  if (inc1.rows.length > 0) {
    await pool.query("INSERT INTO evidencias (id_incidencia, archivo_url, etapa) VALUES ($1, $2, 'REPORTE')", 
      [inc1.rows[0].id_incidencia, 'http://localhost:3000/uploads/INC-CDMX-1907-1790784208854.jpeg']);
  }
  
  const inc2 = await pool.query("SELECT id_incidencia FROM incidencias WHERE folio = 'INC-CDMX-7317'");
  if (inc2.rows.length > 0) {
    await pool.query("INSERT INTO evidencias (id_incidencia, archivo_url, etapa) VALUES ($1, $2, 'REPORTE')", 
      [inc2.rows[0].id_incidencia, 'http://localhost:3000/uploads/INC-CDMX-7317-1790783661457.jpeg']);
  }
  
  console.log("Restored missing uploads!");
  pool.end();
}

restore();
