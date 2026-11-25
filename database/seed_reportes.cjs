const { Client } = require('pg');

async function seedReportes() {
    const client = new Client({
        user: 'postgres',
        host: 'localhost',
        database: 'puebla_rios',
        password: 'Saladito68',
        port: 5432
    });

    await client.connect();

    const reportes = [
        {
            folio: "PUE-2026-001",
            codigo_problema: "P01", // Vertido químico o industrial
            rio_nombre: "Río Atoyac",
            municipio: "Puebla",
            direccion: "Ribera del Río Atoyac, altura Complejo Cultural Universitario (CCU)",
            latitud: 19.0195,
            longitud: -98.2415,
            descripcion: "Se detectó vertido industrial con tonalidad azulada densa y olor penetrante a solvente. Afecta fauna acuática visible.",
            evidencia_url: "https://images.unsplash.com/photo-1618477388954-7852f32655ec?auto=format&fit=crop&q=80&w=600",
            correo_electronico: "guardavalles.pue@gmail.com",
            telefono_opcional: "2223456781",
            prioridad_score: 5,
            estado: "Validando"
        },
        {
            folio: "PUE-2026-002",
            codigo_problema: "P04", // Escombros o taponamiento
            rio_nombre: "Río Alseseca",
            municipio: "Puebla",
            direccion: "Puente Álamos Vista Hermosa, margen oriente del Río Alseseca",
            latitud: 19.0438,
            longitud: -98.1755,
            descripcion: "Acumulación masiva de ramas, llantas y escombros de construcción provocando taponamiento severo y riesgo de desbordamiento.",
            evidencia_url: "https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&q=80&w=600",
            correo_electronico: "comunidad.alseseca@gmail.com",
            telefono_opcional: "2221987654",
            prioridad_score: 4,
            estado: "Dron en Verificación"
        },
        {
            folio: "PUE-2026-003",
            codigo_problema: "P02", // Descarga de aguas residuales
            rio_nombre: "Río Zahuapan",
            municipio: "Cuautlancingo",
            direccion: "Confluencia de canal auxiliar con Río Zahuapan, límite poniente",
            latitud: 19.0880,
            longitud: -98.2720,
            descripcion: "Ducto de concreto descargando aguas negras directamente al cauce sin tratamiento. Se aprecian lodos densos y olor fétido constante.",
            evidencia_url: "https://images.unsplash.com/photo-1584824486509-112e4181ff6b?auto=format&fit=crop&q=80&w=600",
            correo_electronico: "vecinos.cuautlan@gmail.com",
            telefono_opcional: "2225432109",
            prioridad_score: 4,
            estado: "Cuadrilla Desplegada"
        },
        {
            folio: "PUE-2026-004",
            codigo_problema: "P03", // Desbordamiento o erosión
            rio_nombre: "Río Nexapa",
            municipio: "Atlixco",
            direccion: "Margen baja del Río Nexapa, zona de huertas y viveros",
            latitud: 18.9120,
            longitud: -98.4410,
            descripcion: "Erosión severa en el talud derecho del río con debilitamiento del bordo de contención tras el incremento de flujo pluvial.",
            evidencia_url: "https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&q=80&w=600",
            correo_electronico: "riego.nexapa@gmail.com",
            telefono_opcional: "2441238901",
            prioridad_score: 4,
            estado: "Cotizado / En Saneamiento"
        },
        {
            folio: "PUE-2026-005",
            codigo_problema: "P05", // Espuma o manchas
            rio_nombre: "Río Prieto",
            municipio: "San Andrés Cholula",
            direccion: "Cruce con Camino Real a Cholula, cauce del Río Prieto",
            latitud: 19.0550,
            longitud: -98.2830,
            descripcion: "Capa de espuma blanca y aceites superficiales sobre el agua acumulada en las orillas con malos olores intermitentes.",
            evidencia_url: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&q=80&w=600",
            correo_electronico: "cholula.verde@gmail.com",
            telefono_opcional: "2226789012",
            prioridad_score: 3,
            estado: "Validando"
        },
        {
            folio: "PUE-2026-006",
            codigo_problema: "P07", // Basura y residuos
            rio_nombre: "Río Atoyac",
            municipio: "Puebla",
            direccion: "Parque Lineal Atoyac, cerca de la Noria",
            latitud: 19.0345,
            longitud: -98.2290,
            descripcion: "Se completó la jornada de limpieza comunitaria y retiro de 4 toneladas de botellas PET, llantas y maleza en margen ribereña.",
            evidencia_url: "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&q=80&w=600",
            correo_electronico: "parques.puebla@ceaspue.gob.mx",
            telefono_opcional: "2221122334",
            prioridad_score: 2,
            estado: "Concluido"
        }
    ];

    for (const r of reportes) {
        // Obtener id_tipo
        const tipoRes = await client.query("SELECT id_tipo FROM catalogo_tipos_problema WHERE codigo = $1", [r.codigo_problema]);
        const idTipo = tipoRes.rows[0].id_tipo;

        // Obtener id_rio
        const rioRes = await client.query("SELECT id_rio FROM rios_monitoreados WHERE nombre = $1", [r.rio_nombre]);
        const idRio = rioRes.rows.length > 0 ? rioRes.rows[0].id_rio : 1;

        const insertQuery = `
            INSERT INTO reportes_usuarios (
                folio, id_tipo_problema, id_rio, rio_nombre, municipio, direccion,
                latitud, longitud, descripcion, evidencia_url, correo_electronico,
                telefono_opcional, prioridad_score, estado
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (folio) DO UPDATE SET
                estado = EXCLUDED.estado,
                prioridad_score = EXCLUDED.prioridad_score
            RETURNING id_reporte;
        `;
        const res = await client.query(insertQuery, [
            r.folio, idTipo, idRio, r.rio_nombre, r.municipio, r.direccion,
            r.latitud, r.longitud, r.descripcion, r.evidencia_url, r.correo_electronico,
            r.telefono_opcional, r.prioridad_score, r.estado
        ]);

        const idReporte = res.rows[0].id_reporte;

        // Si está cotizado o concluido, añadir cotización oficial
        if (r.estado === "Cotizado / En Saneamiento" || r.estado === "Concluido") {
            const monto = r.estado === "Concluido" ? 18500.00 : 38000.00;
            await client.query(`
                INSERT INTO cotizaciones_saneamiento (id_reporte, total_estimado_mxn, detalle_conceptos, aprobada)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT DO NOTHING;
            `, [
                idReporte,
                monto,
                JSON.stringify([
                    { concepto: "Retiro y disposición de residuos sólidos", cantidad: 2, subtotal: 13000 },
                    { concepto: "Muestreo de 7 parámetros CONAGUA", cantidad: 1, subtotal: 4800 }
                ]),
                r.estado === "Concluido"
            ]);
        }
    }

    console.log(` Se insertaron ${reportes.length} reportes oficiales en 'reportes_usuarios'.`);
    await client.end();
}

seedReportes().catch(console.error);
