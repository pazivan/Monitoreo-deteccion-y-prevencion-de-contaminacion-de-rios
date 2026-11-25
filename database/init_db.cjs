const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const configMaster = {
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: 'Saladito68',
    port: 5432
};

const configPuebla = {
    ...configMaster,
    database: 'puebla_rios'
};

async function init() {
    console.log("1. Conectando al servidor PostgreSQL...");
    const masterClient = new Client(configMaster);
    await masterClient.connect();

    // Comprobar si existe puebla_rios
    const dbRes = await masterClient.query("SELECT 1 FROM pg_database WHERE datname = 'puebla_rios'");
    if (dbRes.rows.length === 0) {
        console.log("   Creando base de datos 'puebla_rios'...");
        await masterClient.query("CREATE DATABASE puebla_rios");
        console.log("   Base de datos creada exitosamente.");
    } else {
        console.log("   Base de datos 'puebla_rios' ya existe.");
    }
    await masterClient.end();

    console.log("2. Conectando a 'puebla_rios' y ejecutando schema con PostGIS...");
    const pueblaClient = new Client(configPuebla);
    await pueblaClient.connect();

    // Activar PostGIS
    console.log("   Habilitando extensión PostGIS...");
    await pueblaClient.query("CREATE EXTENSION IF NOT EXISTS postgis;");

    // Leer schema
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema_puebla.sql'), 'utf-8');
    await pueblaClient.query(schemaSql);
    console.log("   Schema base ejecutado con éxito.");

    // Seed de los 5 ríos oficiales de Puebla
    console.log("3. Sembrando los 5 ríos oficiales de Puebla...");
    const seedRios = `
        INSERT INTO rios_monitoreados (nombre, caudal_base_m3_s, velocidad_media_m_s, profundidad_m, altitud_msnm, area_cuenca_km2) VALUES
        ('Río Atoyac', 14.8, 0.95, 1.6, 2135.0, 4011.0),
        ('Río Alseseca', 4.2, 0.72, 1.1, 2150.0, 310.0),
        ('Río Zahuapan', 8.6, 0.84, 1.4, 2210.0, 1850.0),
        ('Río Nexapa', 9.5, 0.88, 1.3, 1420.0, 2450.0),
        ('Río Prieto', 2.1, 0.55, 0.8, 2190.0, 180.0)
        ON CONFLICT (nombre) DO UPDATE SET
            caudal_base_m3_s = EXCLUDED.caudal_base_m3_s,
            velocidad_media_m_s = EXCLUDED.velocidad_media_m_s;
    `;
    await pueblaClient.query(seedRios);

    // Seed de usuario supervisor
    console.log("4. Sembrando usuario del sistema para supervisor...");
    const seedUsuario = `
        INSERT INTO usuarios_sistema (nombre_completo, usuario, correo, password_hash, rol) VALUES
        ('Ing. Supervisor Ambiental CEASPUE', 'admi', 'admi@gmail.com', '123456', 'SUPERVISOR_CUADRILLAS')
        ON CONFLICT (usuario) DO NOTHING;
    `;
    await pueblaClient.query(seedUsuario);

    // Seed dron y cuadrillas
    console.log("5. Sembrando drones y cuadrillas de despliegue...");
    const seedFlota = `
        INSERT INTO drones (identificador, modelo, tiene_camara_term, estado) VALUES
        ('DRON-PUE-01', 'DJI Matrice 300 RTK con sensor térmico e inspección multiespectral', true, 'Disponible'),
        ('DRON-PUE-02', 'DJI Mavic 3 Thermal monitoreo rápido de cauces', true, 'Disponible')
        ON CONFLICT (identificador) DO NOTHING;

        INSERT INTO cuadrillas (nombre, especialidad, zona_asignada, disponible) VALUES
        ('Cuadrilla 1 - Saneamiento Químico', 'Neutralización de vertidos industriales y muestreo', 'Cuenca Alta Atoyac', true),
        ('Cuadrilla 2 - Desazolve y Taponamientos', 'Retiro de escombro, ramas y liberación de flujo', 'Río Alseseca y Valsequillo', true),
        ('Cuadrilla 3 - Inspección y Sellado', 'Clausura de descargas y estabilización de ribera', 'Río Zahuapan y Nexapa', true)
        ON CONFLICT DO NOTHING;
    `;
    await pueblaClient.query(seedFlota);

    // Comprobar tablas creadas
    const tablesRes = await pueblaClient.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
    `);
    console.log("\n Tablas verificadas en 'puebla_rios':");
    tablesRes.rows.forEach(r => console.log(`   - ${r.table_name}`));

    // PostGIS version
    const gisRes = await pueblaClient.query("SELECT PostGIS_Version();");
    console.log(`\n PostGIS activo: ${gisRes.rows[0].postgis_version}`);

    await pueblaClient.end();
    console.log("\n Base de datos inicializada al 100%.");
}

init().catch(err => {
    console.error(" Error inicializando base de datos:", err);
    process.exit(1);
});
