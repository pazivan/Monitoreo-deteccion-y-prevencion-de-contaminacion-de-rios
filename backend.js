import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Asegurar carpeta uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Configuración de Base de Datos PostgreSQL con PostGIS (Puebla - compatible con Docker y local)
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'puebla_rios',
  password: process.env.DB_PASSWORD || 'Saladito68',
  port: Number(process.env.DB_PORT || 5432),
});

// Prueba de Conexión a la Base de Datos
pool.connect(async (err, client, release) => {
  if (err) {
    return console.error('[ERROR] Error al conectar a PostgreSQL (puebla_rios):', err.stack);
  }
  console.log('[OK] Conexión a PostgreSQL (puebla_rios + PostGIS) establecida con éxito.');
  try {
    const r = await client.query('SELECT count(*) FROM reportes_usuarios');
    console.log(`[INFO] Reportes ambientales activos en BD: ${r.rows[0].count}`);
  } catch (e) {
    console.warn('Aviso al consultar reportes_usuarios:', e.message);
  }
  release();
});

// Configuración de correo Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'departamentodesoporteymantimie@gmail.com',
    pass: 'kvde uapu rbeq fsnd'
  }
});

/* ==========================================================================
   1. REGISTRO DE REPORTES CIUDADANOS (PostGIS + reportes_usuarios)
   ========================================================================== */
app.post('/api/reportes', async (req, res) => {
  const {
    correo,
    folio,
    categoria,
    rioAfectado,
    rio,
    municipio,
    alcaldia,
    ubicacion,
    direccion,
    descripcion,
    latitud,
    longitud,
    ubicacionGps,
    evidenciaBase64,
    telefono
  } = req.body;

  // FILTRO ANTI-SPAM POR PALABRAS CLAVE AMBIENTALES
  const validWords = [
    'rio', 'río', 'contaminacion', 'contaminación', 'descarga', 'residual', 'residuales',
    'espuma', 'olor', 'olores', 'quimico', 'químico', 'quimicos', 'químicos', 'aceite',
    'grasa', 'tinte', 'color', 'turbia', 'sucia', 'escombro', 'escombros', 'cauce',
    'ribera', 'arroyo', 'atoyac', 'alseseca', 'zahuapan', 'nexapa', 'prieto', 'toxico',
    'tóxico', 'desecho', 'desechos', 'tiradero', 'plastico', 'plástico', 'llantas',
    'fabrica', 'fábrica', 'industrial', 'desborde', 'desbordamiento', 'erosion',
    'erosión', 'taponamiento', 'azolve', 'lodo', 'negras', 'alcantarilla', 'colector',
    'basura', 'residuo', 'residuos', 'drenaje', 'agua', 'aguas', 'fuga', 'inundacion',
    'inundación', 'daño'
  ];
  const descLower = descripcion ? descripcion.toLowerCase() : "";
  const isValid = validWords.some(word => descLower.includes(word));

  if (!isValid) {
    return res.status(400).json({
      success: false,
      error: "Reporte detectado como posible texto no ambiental. Por favor describe la afectación en el río utilizando palabras clave (río, contaminación, descarga, basura, espuma, olor, químico, drenaje, agua, taponamiento, etc.)."
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Resolver id_tipo_problema y severidad_base
    let catRes = await client.query(
      'SELECT id_tipo, severidad_base, nombre FROM catalogo_tipos_problema WHERE nombre ILIKE $1 OR $1 ILIKE nombre LIMIT 1',
      [`%${categoria || 'Descarga'}%`]
    );
    const idTipo = catRes.rows.length > 0 ? catRes.rows[0].id_tipo : 2;
    const severidad = catRes.rows.length > 0 ? catRes.rows[0].severidad_base : 4;
    const categoriaNombre = catRes.rows.length > 0 ? catRes.rows[0].nombre : (categoria || 'Descarga de aguas residuales');

    // 2. Resolver id_rio
    const nombreRio = rioAfectado || rio || 'Río Atoyac';
    let rioRes = await client.query(
      'SELECT id_rio, nombre FROM rios_monitoreados WHERE nombre ILIKE $1 LIMIT 1',
      [`%${nombreRio}%`]
    );
    const idRio = rioRes.rows.length > 0 ? rioRes.rows[0].id_rio : 1;
    const rioFinal = rioRes.rows.length > 0 ? rioRes.rows[0].nombre : nombreRio;

    // 3. Coordenadas y dirección
    let lat = parseFloat(latitud);
    let lng = parseFloat(longitud);
    if (isNaN(lat) || isNaN(lng)) {
      if (ubicacionGps && ubicacionGps.includes(',')) {
        const parts = ubicacionGps.split(',');
        lat = parseFloat(parts[0]);
        lng = parseFloat(parts[1]);
      }
    }
    if (isNaN(lat) || isNaN(lng)) {
      lat = 19.0414;
      lng = -98.2063;
    }

    const munFinal = municipio || alcaldia || 'Puebla';
    const dirFinal = direccion || ubicacion || `Margen de ${rioFinal}, ${munFinal}`;

    // 4. Guardar imagen si se adjuntó
    let fileUrl = null;
    if (evidenciaBase64) {
      try {
        const matches = evidenciaBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const extension = matches[1].split('/')[1] || 'jpeg';
          const buffer = Buffer.from(matches[2], 'base64');
          const fileName = `${folio}-${Date.now()}.${extension}`;
          const filePath = path.join(uploadsDir, fileName);
          fs.writeFileSync(filePath, buffer);
          fileUrl = `http://localhost:3000/uploads/${fileName}`;
        }
      } catch (err) {
        console.error("Error guardando imagen:", err);
      }
    }

    // 5. Inserción en reportes_usuarios
    const insertQuery = `
      INSERT INTO reportes_usuarios (
        folio, id_tipo_problema, id_rio, rio_nombre, municipio, direccion,
        latitud, longitud, descripcion, evidencia_url, correo_electronico,
        telefono_opcional, prioridad_score, estado
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'Validando')
      RETURNING id_reporte;
    `;
    const repRes = await client.query(insertQuery, [
      folio,
      idTipo,
      idRio,
      rioFinal,
      munFinal,
      dirFinal,
      lat,
      lng,
      descripcion,
      fileUrl,
      correo || 'anonimo@ceaspue.gob.mx',
      telefono || null,
      severidad
    ]);

    await client.query('COMMIT');

    // 6. Enviar correo de acuse formal
    if (correo && correo.includes('@')) {
      enviarCorreoAcuse(correo, folio, categoriaNombre, dirFinal, descripcion).catch(e =>
        console.error("Error al enviar acuse de correo:", e.message)
      );
    }

    res.json({
      success: true,
      id_reporte: repRes.rows[0].id_reporte,
      folio: folio
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error en POST /api/reportes:", error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

/* ==========================================================================
   2. OBTENER REPORTES ORDENADOS DE MAYOR A MENOR PROBLEMA (dashboard y reportes)
   ========================================================================== */
app.get('/api/reportes', async (req, res) => {
  try {
    const query = `
      SELECT 
        r.id_reporte,
        r.folio AS id,
        c.nombre AS categoria,
        r.rio_nombre,
        r.municipio,
        r.direccion AS ubicacion,
        r.latitud,
        r.longitud,
        r.descripcion,
        r.correo_electronico AS correo,
        r.telefono_opcional AS telefono,
        r.prioridad_score,
        c.severidad_base,
        r.estado,
        'CEASPUE · Cuadrillas' AS dependencia,
        TO_CHAR(r.fecha_creacion, 'DD/MM/YYYY') AS fecha,
        COALESCE(r.evidencia_url, '') AS img,
        COALESCE(cot.total_estimado_mxn, 0) AS costo,
        COALESCE(cot.requiere_cuadrilla, true) AS requiere_cuadrilla,
        COALESCE(cot.costo_despliegue_mxn, 0) AS costo_despliegue_mxn,
        COALESCE(cot.costo_capex_mxn, 0) AS costo_capex_mxn,
        COALESCE(cot.costo_opex_m3_mxn, 0) AS costo_opex_m3_mxn,
        COALESCE(cot.costo_opex_mensual_mxn, 0) AS costo_opex_mensual_mxn,
        COALESCE(cot.magnitud_medida, 0) AS magnitud_medida,
        COALESCE(cot.unidad_medida, 'm3') AS unidad_medida,
        COALESCE(cot.volumen_m3_dia, 0) AS volumen_m3_dia,
        cot.tratamiento_aplicado,
        COALESCE(cot.detalle_conceptos, '[]'::jsonb) AS detalle_conceptos
      FROM reportes_usuarios r
      JOIN catalogo_tipos_problema c ON r.id_tipo_problema = c.id_tipo
      LEFT JOIN cotizaciones_saneamiento cot ON cot.id_reporte = r.id_reporte
      ORDER BY 
        CASE WHEN r.estado = 'Concluido' THEN 1 ELSE 0 END ASC,
        r.prioridad_score DESC,
        r.fecha_creacion DESC;
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener reportes:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ==========================================================================
   2.5. CATÁLOGO OFICIAL DE COSTOS (EXCEL BASE + CONAGUA / CMIC / EMA)
   ========================================================================== */
app.get('/api/catalogo-costos', async (req, res) => {
  const { categoria } = req.query;
  try {
    const matrizQuery = categoria
      ? 'SELECT * FROM matriz_costos_saneamiento WHERE incidencia_categoria ILIKE $1 ORDER BY id_matriz'
      : 'SELECT * FROM matriz_costos_saneamiento ORDER BY incidencia_categoria, id_matriz';
    const matrizRes = await pool.query(matrizQuery, categoria ? [`%${categoria}%`] : []);
    const opRes = await pool.query('SELECT * FROM catalogo_danos_saneamiento ORDER BY id_dano');

    res.json({
      success: true,
      matriz_tratamientos: matrizRes.rows,
      tarifas_operativas: opRes.rows
    });
  } catch (error) {
    console.error("Error consultando catálogo de costos:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ==========================================================================
   3. AUTENTICACIÓN DE SUPERVISORES (usuarios_sistema)
   ========================================================================== */
app.post('/api/login', async (req, res) => {
  const { correo, password } = req.body;
  if (!correo || !password) {
    return res.status(400).json({ success: false, error: "Credenciales incompletas" });
  }

  try {
    const userRes = await pool.query(
      "SELECT id_usuario, nombre_completo, usuario, correo, rol, activo, password_hash FROM usuarios_sistema WHERE correo = $1 OR usuario = $1",
      [correo]
    );

    if (userRes.rows.length === 0) {
      // Fallback si coinciden credenciales demo de la institución
      if (correo === 'admi@gmail.com' && password === '123456') {
        return res.json({
          success: true,
          usuario: {
            id: 1,
            nombre: 'Ing. Supervisor Ambiental CEASPUE',
            correo: 'admi@gmail.com',
            rol: 'SUPERVISOR_CUADRILLAS'
          }
        });
      }
      return res.status(401).json({ success: false, error: "Usuario o contraseña incorrectos" });
    }

    const u = userRes.rows[0];
    if (u.password_hash !== password) {
      return res.status(401).json({ success: false, error: "Usuario o contraseña incorrectos" });
    }

    res.json({
      success: true,
      usuario: {
        id: u.id_usuario,
        nombre: u.nombre_completo,
        correo: u.correo,
        rol: u.rol
      }
    });
  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ==========================================================================
   4. ACTUALIZACIÓN DE ESTADO, DESPLIEGUE Y COTIZACIONES
   ========================================================================== */
app.post('/api/notificar-estado', async (req, res) => {
  const {
    correo,
    folio,
    nuevoEstado,
    mensaje,
    costoEstimado,
    requiereCuadrilla,
    costoDespliegue,
    costoCapex,
    costoOpexM3,
    costoOpexMensual,
    magnitud,
    unidadMedida,
    volumenM3Dia,
    tratamientoAplicado,
    conceptos
  } = req.body;

  if (!folio) return res.status(400).json({ error: 'Falta el folio' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Actualizar estado en reportes_usuarios
    const updateRes = await client.query(
      `UPDATE reportes_usuarios 
       SET estado = $1, fecha_actualizacion = NOW() 
       WHERE folio = $2 
       RETURNING id_reporte, correo_electronico, rio_nombre`,
      [nuevoEstado, folio]
    );

    if (updateRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: "Folio no encontrado" });
    }

    const { id_reporte, correo_electronico, rio_nombre } = updateRes.rows[0];
    const emailDestino = correo || correo_electronico;

    // 2. Si se envía costo estimado o despliegue, registrar/actualizar cotización detallada
    const totalNum = Number(costoEstimado || 0);
    const despNum = Number(costoDespliegue || 0);
    if (totalNum > 0 || despNum > 0) {
      await client.query(`
        INSERT INTO cotizaciones_saneamiento (
          id_reporte, requiere_cuadrilla, costo_despliegue_mxn, costo_capex_mxn,
          costo_opex_m3_mxn, costo_opex_mensual_mxn, magnitud_medida, unidad_medida,
          volumen_m3_dia, tratamiento_aplicado, total_estimado_mxn, detalle_conceptos, aprobada
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id_reporte) DO UPDATE SET
          requiere_cuadrilla = EXCLUDED.requiere_cuadrilla,
          costo_despliegue_mxn = GREATEST(cotizaciones_saneamiento.costo_despliegue_mxn, EXCLUDED.costo_despliegue_mxn),
          costo_capex_mxn = CASE WHEN EXCLUDED.costo_capex_mxn > 0 THEN EXCLUDED.costo_capex_mxn ELSE cotizaciones_saneamiento.costo_capex_mxn END,
          costo_opex_m3_mxn = CASE WHEN EXCLUDED.costo_opex_m3_mxn > 0 THEN EXCLUDED.costo_opex_m3_mxn ELSE cotizaciones_saneamiento.costo_opex_m3_mxn END,
          costo_opex_mensual_mxn = CASE WHEN EXCLUDED.costo_opex_mensual_mxn > 0 THEN EXCLUDED.costo_opex_mensual_mxn ELSE cotizaciones_saneamiento.costo_opex_mensual_mxn END,
          magnitud_medida = CASE WHEN EXCLUDED.magnitud_medida > 0 THEN EXCLUDED.magnitud_medida ELSE cotizaciones_saneamiento.magnitud_medida END,
          unidad_medida = COALESCE(NULLIF(EXCLUDED.unidad_medida, ''), cotizaciones_saneamiento.unidad_medida),
          volumen_m3_dia = CASE WHEN EXCLUDED.volumen_m3_dia > 0 THEN EXCLUDED.volumen_m3_dia ELSE cotizaciones_saneamiento.volumen_m3_dia END,
          tratamiento_aplicado = COALESCE(EXCLUDED.tratamiento_aplicado, cotizaciones_saneamiento.tratamiento_aplicado),
          total_estimado_mxn = CASE WHEN EXCLUDED.total_estimado_mxn > 0 THEN EXCLUDED.total_estimado_mxn ELSE cotizaciones_saneamiento.total_estimado_mxn END,
          detalle_conceptos = CASE WHEN jsonb_array_length(EXCLUDED.detalle_conceptos) > 0 THEN EXCLUDED.detalle_conceptos ELSE cotizaciones_saneamiento.detalle_conceptos END,
          aprobada = EXCLUDED.aprobada;
      `, [
        id_reporte,
        requiereCuadrilla !== false,
        despNum,
        Number(costoCapex || 0),
        Number(costoOpexM3 || 0),
        Number(costoOpexMensual || 0),
        Number(magnitud || 0),
        unidadMedida || 'm3',
        Number(volumenM3Dia || 0),
        tratamientoAplicado || null,
        totalNum > 0 ? totalNum : despNum,
        JSON.stringify(conceptos || []),
        nuevoEstado === 'Concluido'
      ]);
    } else if (nuevoEstado === 'Concluido') {
      await client.query('UPDATE cotizaciones_saneamiento SET aprobada = true WHERE id_reporte = $1', [id_reporte]);
    }

    await client.query('COMMIT');

    // 3. Notificar al ciudadano por correo
    if (emailDestino && emailDestino.includes('@') && emailDestino !== 'anonimo@ceaspue.gob.mx') {
      const costoTxt = totalNum > 0
        ? `<p style="margin: 0 0 8px 0;"><strong>Presupuesto oficial estimado:</strong> $${totalNum.toLocaleString('es-MX')} MXN</p>`
        : (despNum > 0 ? `<p style="margin: 0 0 8px 0;"><strong>Costo operativo de despliegue en sitio:</strong> $${despNum.toLocaleString('es-MX')} MXN</p>` : '');
      const tratTxt = tratamientoAplicado ? `<p style="margin: 0 0 8px 0;"><strong>Solución técnica asignada:</strong> ${tratamientoAplicado}</p>` : '';
      await transporter.sendMail({
        from: '"SIGMAH · Monitoreo Hídrico Puebla" <departamentodesoporteymantimie@gmail.com>',
        to: emailDestino,
        subject: `Actualización de Expediente ${folio} - ${nuevoEstado} | Gobierno de Puebla`,
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #d1d5db; border-radius: 6px; overflow: hidden;">
              <div style="background-color: #6b102c; color: #ffffff; padding: 8px 20px; font-size: 11px; display: flex; justify-content: space-between;">
                  <span style="text-transform: uppercase; font-weight: 600;">Gobierno del Estado de Puebla</span>
                  <span style="opacity: 0.75; font-size: 10px;">SIGMAH – Sistema de Gestión y Monitoreo Ambiental Hídrico</span>
              </div>
              <div style="background-color: #951a3e; color: white; padding: 20px 26px;">
                  <h1 style="margin: 0; font-size: 20px;">Actualización de Expediente Ambiental</h1>
                  <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.85;">SIGMAH – Sistema de Gestión y Monitoreo Ambiental Hídrico</p>
              </div>
              <div style="padding: 28px; background: #ffffff;">
                  <p style="font-size: 15px; color: #1e293b;">Estimado(a) ciudadano(a):</p>
                  <p style="font-size: 14px; color: #334155;">Le informamos que su denuncia correspondiente al <strong>${rio_nombre}</strong> ha sido actualizada en el sistema estatal.</p>
                  
                  <div style="background-color: #f8fafc; border-left: 4px solid #bc955c; padding: 15px; margin: 22px 0; font-size: 13px;">
                      <p style="margin: 0 0 8px 0;"><strong>Folio Oficial:</strong> <span style="color: #951a3e; font-family: monospace; font-size: 16px; font-weight: 700;">${folio}</span></p>
                      <p style="margin: 0 0 8px 0;"><strong>Estatus Actual:</strong> <span style="background-color: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${nuevoEstado}</span></p>
                      ${tratTxt}
                      ${costoTxt}
                  </div>
                  
                  <p style="font-size: 14px; color: #334155; line-height: 1.55;">${mensaje}</p>
              </div>
          </div>
        `
      }).catch(e => console.error("Error enviando email de estado:", e.message));
    }

    res.json({ success: true, folio, nuevoEstado });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error al actualizar/notificar estado:", error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// Función interna para el acuse de recibo inicial
async function enviarCorreoAcuse(correo, folio, categoria, ubicacion, descripcion) {
  await transporter.sendMail({
    from: '"SIGMAH · Monitoreo Hídrico Puebla" <departamentodesoporteymantimie@gmail.com>',
    to: correo,
    subject: `Acuse Oficial de Registro - Folio ${folio} | Gobierno del Estado de Puebla`,
    html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #d1d5db; border-radius: 6px; overflow: hidden;">
            <div style="background-color: #6b102c; color: #ffffff; padding: 8px 20px; font-size: 11px; letter-spacing: 0.5px;">
                <span style="text-transform: uppercase; font-weight: 600;">Gobierno del Estado de Puebla</span> · <span style="opacity: 0.75; font-size: 10px;">SIGMAH – Sistema de Gestión y Monitoreo Ambiental Hídrico</span>
            </div>
            <div style="background-color: #951a3e; color: white; padding: 22px 28px;">
                <h1 style="margin: 0; font-size: 20px; font-weight: 700;">Acuse de Recibo de Denuncia Ambiental Hídrica</h1>
                <p style="margin: 6px 0 0 0; font-size: 12px; opacity: 0.85;">SIGMAH – Sistema de Gestión y Monitoreo Ambiental Hídrico</p>
            </div>
            <div style="padding: 28px; background-color: #ffffff;">
                <p style="font-size: 15px; color: #1e293b;">Estimado(a) ciudadano(a):</p>
                <p style="font-size: 14px; color: #334155; line-height: 1.6;">Su denuncia ambiental ha sido georreferenciada e integrada formalmente en el Sistema Estatal de Monitoreo y Saneamiento de Cuencas. El personal técnico autorizado iniciará el proceso de verificación y dictamen.</p>
                
                <div style="background-color: #f8fafc; border-left: 4px solid #bc955c; padding: 16px; margin: 22px 0;">
                    <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Folio de Seguimiento:</strong> <span style="color: #951a3e; font-family: monospace; font-size: 16px; font-weight: 700;">${folio}</span></p>
                    <p style="margin: 0 0 8px 0; font-size: 13px;"><strong>Clasificación:</strong> ${categoria}</p>
                    <p style="margin: 0 0 8px 0; font-size: 13px;"><strong>Ubicación Georreferenciada:</strong> ${ubicacion}</p>
                    <p style="margin: 0; font-size: 13px;"><strong>Descripción Registrada:</strong> ${descripcion}</p>
                </div>

                <p style="font-size: 13px; color: #475569; line-height: 1.5;">Conserve su número de folio para consultar el avance de atención en el Portal Ciudadano. Recibirá notificaciones oficiales en esta dirección de correo electrónico conforme avance la inspección en campo.</p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 22px 0;" />
                <p style="font-size: 11px; color: #64748b; margin: 0;">Aviso de Privacidad: Sus datos personales son tratados conforme a la Ley de Protección de Datos Personales en Posesión de Sujetos Obligados del Estado de Puebla.</p>
            </div>
        </div>
      `
  });
  console.log(`[OK] Correo Acuse enviado a ${correo}`);
}

/* ==========================================================================
   5. CLIMA EN TIEMPO REAL MULTIPUNTO (OPEN-METEO · ZONA DELIMITADA DE PUEBLA)
      Soporta consulta bajo demanda (forzar=1) o caché automática de 2 horas
   ========================================================================== */
const ESTACIONES_CLIMA_PUEBLA = [
  { id: 'puebla_centro', nombre: 'Puebla Centro', cuenca: 'Río Atoyac Urbano', lat: 19.0414, lng: -98.2063 },
  { id: 'texmelucan', nombre: 'San Martín Texmelucan', cuenca: 'Alto Atoyac (Noroeste)', lat: 19.2840, lng: -98.4380 },
  { id: 'cuautlancingo', nombre: 'Cuautlancingo / Cholula', cuenca: 'Río Zahuapan - Río Prieto', lat: 19.0920, lng: -98.2680 },
  { id: 'amozoc', nombre: 'Amozoc / Oriente', cuenca: 'Cuenca Río Alseseca', lat: 19.0460, lng: -98.0450 },
  { id: 'atlixco', nombre: 'Atlixco', cuenca: 'Cuenca Río Nexapa', lat: 18.9080, lng: -98.4350 },
  { id: 'valsequillo', nombre: 'Presa Valsequillo', cuenca: 'Desembocadura Sur', lat: 18.9180, lng: -98.1550 }
];

const WEATHER_CACHE_TTL_MS = 2 * 60 * 60 * 1000;
let climaCache = { timestamp: 0, data: null };

async function obtenerClimaPuebla(forzar = false) {
  const ahora = Date.now();
  if (!forzar && climaCache.data && (ahora - climaCache.timestamp) < WEATHER_CACHE_TTL_MS) {
    return { ...climaCache.data, desde_cache: true };
  }

  const lats = ESTACIONES_CLIMA_PUEBLA.map(e => e.lat).join(',');
  const lngs = ESTACIONES_CLIMA_PUEBLA.map(e => e.lng).join(',');
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,precipitation,rain,relative_humidity_2m,wind_speed_10m&hourly=precipitation,temperature_2m&timezone=America%2FMexico_City&forecast_days=2`;

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Open-Meteo HTTP ${resp.status}`);
  const rawJson = await resp.json();
  const respuestas = Array.isArray(rawJson) ? rawJson : [rawJson];

  const estaciones = ESTACIONES_CLIMA_PUEBLA.map((est, idx) => {
    const item = respuestas[idx] || respuestas[0] || {};
    const cur = item.current || {};
    const hourlyPrecip = (item.hourly && item.hourly.precipitation) ? item.hourly.precipitation.slice(0, 24) : [];
    const lluvia24h = hourlyPrecip.reduce((acc, v) => acc + (Number(v) || 0), 0);
    const max24h = hourlyPrecip.length ? Math.max(...hourlyPrecip.map(v => Number(v) || 0)) : 0;

    return {
      ...est,
      lluvia_mm_h: Number((cur.precipitation ?? cur.rain ?? 0).toFixed(2)),
      temperatura_c: Number((cur.temperature_2m ?? 18.5).toFixed(1)),
      humedad_pct: Math.round(cur.relative_humidity_2m ?? 55),
      viento_km_h: Number((cur.wind_speed_10m ?? 8.0).toFixed(1)),
      lluvia_24h_mm: Number(lluvia24h.toFixed(2)),
      pico_lluvia_24h_mm_h: Number(max24h.toFixed(2))
    };
  });

  const n = estaciones.length || 1;
  const promLluvia = estaciones.reduce((a, e) => a + e.lluvia_mm_h, 0) / n;
  const maxLluviaActual = Math.max(...estaciones.map(e => e.lluvia_mm_h));
  const promTemp = estaciones.reduce((a, e) => a + e.temperatura_c, 0) / n;
  const promHumedad = estaciones.reduce((a, e) => a + e.humedad_pct, 0) / n;
  const promViento = estaciones.reduce((a, e) => a + e.viento_km_h, 0) / n;
  const promLluvia24h = estaciones.reduce((a, e) => a + e.lluvia_24h_mm, 0) / n;
  const pico24h = Math.max(...estaciones.map(e => e.pico_lluvia_24h_mm_h));

  // Persistir lectura promedio de la zona delimitada en PostgreSQL
  pool.query(
    'INSERT INTO clima_historico (fecha_hora, lluvia_mm_h, temperatura_c, fuente) VALUES (NOW(), $1, $2, $3)',
    [Number(promLluvia.toFixed(2)), Number(promTemp.toFixed(1)), 'Open-Meteo (Zona Delimitada Puebla - 6 estaciones)']
  ).catch(err => console.warn('No se pudo guardar histórico climático:', err.message));

  const resultado = {
    lluvia_mm_h: Number(promLluvia.toFixed(2)),
    lluvia_max_mm_h: Number(maxLluviaActual.toFixed(2)),
    temperatura_c: Number(promTemp.toFixed(1)),
    humedad_pct: Math.round(promHumedad),
    viento_km_h: Number(promViento.toFixed(1)),
    lluvia_24h_mm: Number(promLluvia24h.toFixed(2)),
    pico_lluvia_24h_mm_h: Number(pico24h.toFixed(2)),
    estaciones,
    zona_delimitada: { latMin: 18.75, lngMin: -98.75, latMax: 19.52, lngMax: -97.62 },
    actualizado_en: new Date().toISOString(),
    proxima_actualizacion_min: 120,
    fuente: 'Open-Meteo · Red Zona Delimitada Puebla (6 estaciones)'
  };

  climaCache = { timestamp: ahora, data: resultado };
  return { ...resultado, desde_cache: false };
}

app.get('/api/clima-puebla', async (req, res) => {
  try {
    const forzar = req.query.forzar === '1';
    const clima = await obtenerClimaPuebla(forzar);
    res.json({ success: true, ...clima });
  } catch (error) {
    console.error('Error consultando clima Open-Meteo:', error.message);
    res.json({
      success: false,
      lluvia_mm_h: 0,
      lluvia_max_mm_h: 0,
      temperatura_c: 18.5,
      humedad_pct: 55,
      viento_km_h: 8.0,
      lluvia_24h_mm: 0,
      pico_lluvia_24h_mm_h: 0,
      estaciones: ESTACIONES_CLIMA_PUEBLA.map(e => ({ ...e, lluvia_mm_h: 0, temperatura_c: 18.5, humedad_pct: 55, viento_km_h: 8.0, lluvia_24h_mm: 0 })),
      actualizado_en: new Date().toISOString(),
      fuente: 'Respaldo local (sin conexión externa)'
    });
  }
});

app.get('/api/quejas-por-rio', async (req, res) => {
  const rios = ['Río Atoyac', 'Río Alseseca', 'Río Zahuapan', 'Río Nexapa', 'Río Prieto'];
  try {
    const q = `
      SELECT r.rio_nombre, r.descripcion, c.codigo, r.estado
      FROM reportes_usuarios r
      JOIN catalogo_tipos_problema c ON r.id_tipo_problema = c.id_tipo
      WHERE r.estado != 'Concluido'
    `;
    const result = await pool.query(q);
    const resumen = {};
    for (const r of rios) resumen[r] = { activas: 0, taponamientos: 0 };

    for (const row of result.rows) {
      const rio = row.rio_nombre;
      if (resumen[rio]) {
        resumen[rio].activas++;
        const desc = (row.descripcion || '').toLowerCase();
        if (row.codigo === 'P04' || /taponamiento|escombro|basura|desborde|azolve/.test(desc)) {
          resumen[rio].taponamientos++;
        }
      }
    }
    res.json({ success: true, resumen });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ==========================================================================
   6. CONTENIDO DE CONCIENTIZACIÓN EN CALIENTE (CMS ligero)
   ========================================================================== */
app.get('/api/concientizacion', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id_contenido, seccion, titulo, subtitulo, cuerpo_texto, icono_material, orden_visual FROM contenido_concientizacion WHERE activo = true ORDER BY seccion, orden_visual'
    );
    res.json({ success: true, contenido: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`[OK] Servidor Backend Puebla corriendo en http://localhost:${PORT}`);
});
