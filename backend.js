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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// Configuración de Base de Datos PostgreSQL
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'CDMX',
  password: 'Saladito68',
  port: 5432,
});

// Prueba de Conexión a la Base de Datos
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error al conectar a PostgreSQL:', err.stack);
  }
  console.log(' Conexión a PostgreSQL establecida con éxito.');
  release();
});

// Configuración del correo con las credenciales
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'departamentodesoporteymantimie@gmail.com',
    pass: 'kvde uapu rbeq fsnd'
  }
});

/* ==========================================
   NUEVOS ENDPOINTS PARA BASE DE DATOS
========================================== */

// 1. CREAR REPORTE (Desde ciudadano.html)
app.post('/api/reportes', async (req, res) => {
  const { correo, folio, categoria, ubicacion, descripcion, ubicacionGps, evidenciaBase64 } = req.body;
  
  // FILTRO ANTI-SPAM
  const validWords = ['bache', 'hoyo', 'fuga', 'agua', 'luz', 'luminaria', 'basura', 'arbol', 'árbol', 'drenaje', 'semaforo', 'semáforo', 'calle', 'banqueta', 'pavimento', 'coladera', 'socavon', 'inundacion', 'inundación', 'infraestructura', 'daño', 'roto', 'hundimiento'];
  const descLower = descripcion ? descripcion.toLowerCase() : "";
  const isValid = validWords.some(word => descLower.includes(word));
  
  if (!isValid) {
    return res.status(400).json({ success: false, error: "Reporte detectado como posible SPAM. Por favor describe el problema urbano utilizando palabras clave (bache, fuga, luz, basura, árbol, etc)." });
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN'); // Iniciar Transacción

    // 1. Buscar el ID de la Categoría seleccionada (por nombre aprox o default)
    let catRes = await client.query('SELECT id_categoria FROM categorias WHERE nombre ILIKE $1', [`%${categoria}%`]);
    let idCategoria = catRes.rows.length > 0 ? catRes.rows[0].id_categoria : 1; // 1 por default

    // 2. Buscar el ID del Estado "Validando" o "Reportado"
    let estRes = await client.query("SELECT id_estado FROM estados_incidencia WHERE nombre ILIKE '%Validando%' OR nombre ILIKE '%Reportado%'");
    let idEstado = estRes.rows.length > 0 ? estRes.rows[0].id_estado : 1; 

    // 3. Insertar en la tabla incidencias
    const incQuery = `
      INSERT INTO incidencias (folio, id_categoria, id_estado, titulo, descripcion, direccion, prioridad) 
      VALUES ($1, $2, $3, $4, $5, $6, 'Alta') 
      RETURNING id_incidencia
    `;
    const incRes = await client.query(incQuery, [folio, idCategoria, idEstado, `Reporte ${categoria}`, descripcion, ubicacion]);
    const idIncidencia = incRes.rows[0].id_incidencia;

    // 4. Insertar en reportes_ciudadanos para guardar el correo
    const repQuery = `
      INSERT INTO reportes_ciudadanos (id_incidencia, correo_contacto, descripcion_original)
      VALUES ($1, $2, $3)
    `;
    await client.query(repQuery, [idIncidencia, correo, descripcion]);

    // Guardar evidencia fotográfica si existe
    if (evidenciaBase64) {
      try {
        const matches = evidenciaBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const extension = matches[1].split('/')[1] || 'jpeg';
          const buffer = Buffer.from(matches[2], 'base64');
          const fileName = `${folio}-${Date.now()}.${extension}`;
          const filePath = path.join(__dirname, 'uploads', fileName);
          fs.writeFileSync(filePath, buffer);
          
          const fileUrl = `http://localhost:3000/uploads/${fileName}`;
          await client.query('INSERT INTO evidencias (id_incidencia, archivo_url, etapa) VALUES ($1, $2, $3)', [idIncidencia, fileUrl, 'REPORTE']);
        }
      } catch (err) {
        console.error("Error guardando imagen:", err);
      }
    }

    await client.query('COMMIT'); // Guardar cambios

    // 5. Enviar el Correo Automático
    if (correo) {
      await enviarCorreoAcuse(correo, folio, categoria, ubicacion, descripcion);
    }

    res.json({ success: true, id_incidencia: idIncidencia, folio: folio });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("❌ Error al guardar reporte en BD:", error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// ENDPOINT TEMPORAL PARA SUBIR FOTO FALTANTE
app.post('/api/reportes/:folio/foto', async (req, res) => {
  const { folio } = req.params;
  const { evidenciaBase64 } = req.body;
  
  if (!evidenciaBase64) return res.status(400).json({ error: "No se envió imagen" });

  const client = await pool.connect();
  try {
    const incRes = await client.query('SELECT id_incidencia FROM incidencias WHERE folio = $1', [folio]);
    if (incRes.rows.length === 0) return res.status(404).json({ error: "Folio no encontrado" });
    const idIncidencia = incRes.rows[0].id_incidencia;

    const matches = evidenciaBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return res.status(400).json({ error: "Formato base64 inválido" });
    
    const extension = matches[1].split('/')[1] || 'jpeg';
    const buffer = Buffer.from(matches[2], 'base64');
    const fileName = `${folio}-${Date.now()}.${extension}`;
    const filePath = path.join(__dirname, 'uploads', fileName);
    fs.writeFileSync(filePath, buffer);
    const fileUrl = `http://localhost:3000/uploads/${fileName}`;

    const evRes = await client.query('SELECT id_evidencia FROM evidencias WHERE id_incidencia = $1', [idIncidencia]);
    
    if (evRes.rows.length > 0) {
      await client.query('UPDATE evidencias SET archivo_url = $1 WHERE id_incidencia = $2', [fileUrl, idIncidencia]);
    } else {
      await client.query('INSERT INTO evidencias (id_incidencia, archivo_url, etapa) VALUES ($1, $2, $3)', [idIncidencia, fileUrl, 'REPORTE']);
    }

    res.json({ success: true, url: fileUrl });
  } catch (error) {
    console.error("Error al actualizar foto:", error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// 2. OBTENER TODOS LOS REPORTES (Para dashboard.html)
app.get('/api/reportes', async (req, res) => {
  try {
    const query = `
      SELECT 
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
      ORDER BY i.fecha_deteccion DESC
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener reportes:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ==========================================
   ENDPOINTS EXISTENTES (Correos)
========================================== */

// Función interna para el acuse de recibo
async function enviarCorreoAcuse(correo, folio, categoria, ubicacion, descripcion) {
    const info = await transporter.sendMail({
      from: '"Servicios Urbanos CDMX" <departamentodesoporteymantimie@gmail.com>',
      to: correo,
      subject: `Acuse de Recibo - Folio de Reporte: ${folio}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #9F2241; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">Confirmación de Reporte</h1>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">Servicios Urbanos CDMX</p>
            </div>
            <div style="padding: 30px;">
                <p style="font-size: 16px; color: #334155;">Hola,</p>
                <p style="font-size: 16px; color: #334155;">Hemos recibido tu solicitud ciudadana exitosamente. La Inteligencia Artificial del sistema ya ha clasificado tu reporte y está en proceso de validación.</p>
                
                <div style="background-color: #f8fafc; border-left: 4px solid #bc955c; padding: 15px; margin: 25px 0;">
                    <p style="margin: 0 0 10px 0;"><strong>Folio:</strong> <span style="color: #9F2241; font-family: monospace; font-size: 18px;">${folio}</span></p>
                    <p style="margin: 0 0 10px 0;"><strong>Categoría:</strong> ${categoria}</p>
                    <p style="margin: 0 0 10px 0;"><strong>Ubicación:</strong> ${ubicacion}</p>
                    <p style="margin: 0;"><strong>Descripción:</strong> ${descripcion}</p>
                </div>
            </div>
        </div>
      `
    });
    console.log(`✅ Correo Acuse enviado a ${correo}`);
}

app.post('/api/enviar-folio', async (req, res) => {
  const { correo, folio, categoria, ubicacion, descripcion } = req.body;
  if (!correo) return res.status(400).json({ error: 'Falta correo' });

  try {
    await enviarCorreoAcuse(correo, folio, categoria, ubicacion, descripcion);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/notificar-estado', async (req, res) => {
  const { correo, folio, nuevoEstado, mensaje } = req.body;
  
  if (!folio) return res.status(400).json({ error: 'Falta el folio' });

  const client = await pool.connect();
  try {
    // ACTUALIZAR EL ESTADO EN LA BD DIRECTAMENTE
    const estRes = await client.query("SELECT id_estado FROM estados_incidencia WHERE nombre ILIKE $1", [`%${nuevoEstado}%`]);
    if (estRes.rows.length > 0) {
      const idEstado = estRes.rows[0].id_estado;
      await client.query("UPDATE incidencias SET id_estado = $1 WHERE folio = $2", [idEstado, folio]);
    } else {
      console.warn(`No se encontró el estado: ${nuevoEstado}`);
    }
    
    // Solo enviar correo si hay dirección de correo
    if (correo && correo.trim() !== '') {
      const info = await transporter.sendMail({
        from: '"Servicios Urbanos CDMX" <departamentodesoporteymantimie@gmail.com>',
        to: correo,
        subject: `Actualización de Folio: ${folio} - ${nuevoEstado}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
              <div style="background-color: #bc955c; color: white; padding: 20px; text-align: center;">
                  <h1 style="margin: 0; font-size: 24px;">Actualización de Solicitud</h1>
                  <p style="margin: 5px 0 0 0; opacity: 0.9;">Servicios Urbanos CDMX</p>
              </div>
              <div style="padding: 30px;">
                  <p style="font-size: 16px; color: #334155;">Te informamos que tu reporte ha cambiado de estado.</p>
                  
                  <div style="background-color: #f8fafc; border-left: 4px solid #bc955c; padding: 15px; margin: 25px 0;">
                      <p style="margin: 0 0 10px 0;"><strong>Folio:</strong> <span style="color: #9F2241; font-family: monospace; font-size: 18px;">${folio}</span></p>
                      <p style="margin: 0 0 10px 0;"><strong>Nuevo Estado:</strong> <span style="background-color: #e2e8f0; padding: 3px 8px; border-radius: 4px; font-weight: bold;">${nuevoEstado}</span></p>
                  </div>
                  
                  <p style="font-size: 15px; color: #334155; line-height: 1.5;">${mensaje}</p>
              </div>
          </div>
        `
      });
      console.log(`✅ Notificación enviada a ${correo}`);
      res.json({ success: true, messageId: info.messageId });
    } else {
      res.json({ success: true, message: 'Estado actualizado en BD (Sin correo)' });
    }
    
  } catch (error) {
    console.error("❌ Error al actualizar/notificar estado:", error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor Backend CDMX corriendo en http://localhost:${PORT}`);
});
