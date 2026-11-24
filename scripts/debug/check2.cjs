const pg = require('pg');
const pool = new pg.Pool({user: 'postgres', host: 'localhost', database: 'CDMX', password: 'Saladito68', port: 5432});
pool.query(`SELECT 
        i.folio AS id,
        c.nombre AS categoria,
        e.nombre AS estado,
        COALESCE(a.nombre, 'Sin Asignar') AS dependencia,
        i.direccion AS ubicacion,
        i.descripcion,
        r.correo_contacto AS correo,
        TO_CHAR(i.fecha_deteccion, 'DD/MM/YYYY') AS fecha,
        (SELECT archivo_url FROM evidencias ev WHERE ev.id_incidencia = i.id_incidencia ORDER BY ev.id_evidencia ASC LIMIT 1) as img
      FROM incidencias i
      LEFT JOIN categorias c ON i.id_categoria = c.id_categoria
      LEFT JOIN estados_incidencia e ON i.id_estado = e.id_estado
      LEFT JOIN areas_responsables a ON i.id_area = a.id_area
      LEFT JOIN reportes_ciudadanos r ON i.id_incidencia = r.id_incidencia
      ORDER BY i.fecha_deteccion DESC LIMIT 5`).then(res => {console.log(res.rows); pool.end();}).catch(console.error);
