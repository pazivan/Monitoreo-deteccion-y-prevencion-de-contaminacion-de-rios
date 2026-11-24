const pg = require('pg');
const pool = new pg.Pool({user: 'postgres', host: 'localhost', database: 'CDMX', password: 'Saladito68', port: 5432});

async function restore() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Insert INC-CDMX-1907
    const inc1 = await client.query("INSERT INTO incidencias (folio, id_categoria, id_estado, titulo, descripcion, direccion, prioridad) VALUES ('INC-CDMX-1907', 21, 1, 'Reporte de la compañera 1', 'Falla reportada', 'Ubicación 1', 'Alta') RETURNING id_incidencia");
    await client.query("INSERT INTO evidencias (id_incidencia, archivo_url, etapa) VALUES ($1, $2, 'REPORTE')", [inc1.rows[0].id_incidencia, 'http://localhost:3000/uploads/INC-CDMX-1907-1790784208854.jpeg']);

    // Insert INC-CDMX-7317
    const inc2 = await client.query("INSERT INTO incidencias (folio, id_categoria, id_estado, titulo, descripcion, direccion, prioridad) VALUES ('INC-CDMX-7317', 21, 1, 'Reporte de la compañera 2', 'Otra falla reportada', 'Ubicación 2', 'Alta') RETURNING id_incidencia");
    await client.query("INSERT INTO evidencias (id_incidencia, archivo_url, etapa) VALUES ($1, $2, 'REPORTE')", [inc2.rows[0].id_incidencia, 'http://localhost:3000/uploads/INC-CDMX-7317-1790783661457.jpeg']);

    await client.query('COMMIT');
    console.log("Restored missing reports to database successfully!");
  } catch(e) {
    await client.query('ROLLBACK');
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
restore();
