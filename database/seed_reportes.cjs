const { Client } = require('pg');

async function seedReportes() {
    const client = new Client({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'puebla_rios',
        password: process.env.DB_PASSWORD || 'Saladito68',
        port: Number(process.env.DB_PORT || 5432)
    });

    await client.connect();

    const reportes = [
        {
            folio: "PUE-2026-001",
            codigo_problema: "P01",
            rio_nombre: "Río Atoyac",
            municipio: "Puebla",
            direccion: "Ribera del Río Atoyac, altura Complejo Cultural Universitario (CCU)",
            latitud: 19.0195,
            longitud: -98.2415,
            descripcion: "Se detectó vertido industrial con tonalidad azulada densa y olor penetrante a solvente. Afecta fauna acuática visible.",
            evidencia_url: "http://localhost:3000/uploads/PUE-2026-001-1795595477753.jpeg",
            correo_electronico: "guardavalles.pue@gmail.com",
            telefono_opcional: "2223456781",
            prioridad_score: 5,
            estado: "Validando"
        },
        {
            folio: "PUE-2026-002",
            codigo_problema: "P04",
            rio_nombre: "Río Alseseca",
            municipio: "Puebla",
            direccion: "Puente Álamos Vista Hermosa, margen oriente del Río Alseseca",
            latitud: 19.0438,
            longitud: -98.1755,
            descripcion: "Acumulación masiva de ramas, llantas y escombros de construcción provocando taponamiento severo y riesgo de desbordamiento.",
            evidencia_url: "http://localhost:3000/uploads/PUE-2026-002-1795595479764.jpeg",
            correo_electronico: "comunidad.alseseca@gmail.com",
            telefono_opcional: "2221987654",
            prioridad_score: 4,
            estado: "Dron en Verificación"
        },
        {
            folio: "PUE-2026-003",
            codigo_problema: "P02",
            rio_nombre: "Río Zahuapan",
            municipio: "Cuautlancingo",
            direccion: "Confluencia de canal auxiliar con Río Zahuapan, límite poniente",
            latitud: 19.0880,
            longitud: -98.2720,
            descripcion: "Ducto de concreto descargando aguas negras directamente al cauce sin tratamiento. Se aprecian lodos densos y olor fétido constante.",
            evidencia_url: "http://localhost:3000/uploads/PUE-2026-003-1795595481775.jpeg",
            correo_electronico: "vecinos.cuautlan@gmail.com",
            telefono_opcional: "2225432109",
            prioridad_score: 4,
            estado: "Cuadrilla Desplegada"
        },
        {
            folio: "PUE-2026-004",
            codigo_problema: "P03",
            rio_nombre: "Río Nexapa",
            municipio: "Atlixco",
            direccion: "Margen baja del Río Nexapa, zona de huertas y viveros",
            latitud: 18.9120,
            longitud: -98.4410,
            descripcion: "Erosión severa en el talud derecho del río con debilitamiento del bordo de contención tras el incremento de flujo pluvial.",
            evidencia_url: "http://localhost:3000/uploads/PUE-2026-004-1795595483786.jpeg",
            correo_electronico: "riego.nexapa@gmail.com",
            telefono_opcional: "2441238901",
            prioridad_score: 4,
            estado: "Cotizado / En Saneamiento"
        },
        {
            folio: "PUE-2026-005",
            codigo_problema: "P05",
            rio_nombre: "Río Prieto",
            municipio: "San Andrés Cholula",
            direccion: "Cruce con Camino Real a Cholula, cauce del Río Prieto",
            latitud: 19.0550,
            longitud: -98.2830,
            descripcion: "Capa de espuma blanca y aceites superficiales sobre el agua acumulada en las orillas con malos olores intermitentes.",
            evidencia_url: "http://localhost:3000/uploads/PUE-2026-005-1795595485797.jpeg",
            correo_electronico: "cholula.verde@gmail.com",
            telefono_opcional: "2226789012",
            prioridad_score: 3,
            estado: "Validando"
        },
        {
            folio: "PUE-2026-006",
            codigo_problema: "P07",
            rio_nombre: "Río Atoyac",
            municipio: "Puebla",
            direccion: "Parque Lineal Atoyac, cerca de la Noria",
            latitud: 19.0345,
            longitud: -98.2290,
            descripcion: "Se completó la jornada de limpieza comunitaria y retiro de 4 toneladas de botellas PET, llantas y maleza en margen ribereña.",
            evidencia_url: "http://localhost:3000/uploads/PUE-2026-006-1795595487808.jpeg",
            correo_electronico: "parques.puebla@ceaspue.gob.mx",
            telefono_opcional: "2221122334",
            prioridad_score: 2,
            estado: "Concluido"
        },
        {
            folio: "INC-PUE-4044",
            codigo_problema: "P02",
            rio_nombre: "Río Atoyac",
            municipio: "Tzicatlacoyan",
            direccion: "Santa Cruz el Calvario, Tzicatlacoyan, Puebla, México",
            latitud: 18.8503110,
            longitud: -98.0479900,
            descripcion: "Hay mucha descarga de aguas residuales, huele feo",
            evidencia_url: "http://localhost:3000/uploads/INC-PUE-4044-1795589528662.jpeg",
            correo_electronico: "liebertj795@gmail.com",
            telefono_opcional: "9514323245",
            prioridad_score: 4,
            estado: "Concluido"
        },
        {
            folio: "INC-PUE-9436",
            codigo_problema: "P07",
            rio_nombre: "Río Zahuapan",
            municipio: "Tlaxcala",
            direccion: "San Lucas Cuauhtelulpan, Municipio de Tlaxcala, Tlaxcala, 90070, México",
            latitud: 19.3038540,
            longitud: -98.2706440,
            descripcion: "hay mucha basura y, ademas, residuos en el rio",
            evidencia_url: "http://localhost:3000/uploads/INC-PUE-9436-1795589664323.jpeg",
            correo_electronico: "liebertj795@gmail.com",
            telefono_opcional: "9514323245",
            prioridad_score: 2,
            estado: "Validando"
        },
        {
            folio: "INC-PUE-3285",
            codigo_problema: "P05",
            rio_nombre: "Río Nexapa",
            municipio: "Atlixco",
            direccion: "Calle Emiliano Zapata Salazar, Emiliano Zapata Nexatengo, Santa Ana Yancuitlalpan (Chilhuacán), Atlixco, Puebla, 74320, México",
            latitud: 18.8841780,
            longitud: -98.4032310,
            descripcion: "Se observa una gran cantidad de espuma en las corrientes de agua, me asusta, será peligroso?",
            evidencia_url: "http://localhost:3000/uploads/INC-PUE-3285-1795590030027.jpeg",
            correo_electronico: "liebertj795@gmail.com",
            telefono_opcional: "9514323245",
            prioridad_score: 3,
            estado: "Validando"
        },
        {
            folio: "INC-PUE-8650",
            codigo_problema: "P04",
            rio_nombre: "Río Zahuapan",
            municipio: "San Lucas Tecopilco",
            direccion: "San Lucas Tecopilco, Tlaxcala, México",
            latitud: 19.4872960,
            longitud: -98.2162300,
            descripcion: "Las corrientes de agua estan tapados por mucha basura",
            evidencia_url: "http://localhost:3000/uploads/INC-PUE-8650-1795590192495.jpeg",
            correo_electronico: "liebertj795@gmail.com",
            telefono_opcional: "9514323245",
            prioridad_score: 4,
            estado: "Validando"
        },
        {
            folio: "INC-PUE-5182",
            codigo_problema: "P01",
            rio_nombre: "Río Atoyac",
            municipio: "San Martín Texmelucan",
            direccion: "Corredor Industrial Quetzalcóatl, ribera del Río Atoyac, San Martín Texmelucan, Puebla, México",
            latitud: 19.2830160,
            longitud: -98.4187000,
            descripcion: "Se detecta descarga química e industrial con abundante espuma blanca densa sobre el cauce del río y olor penetrante a solvente proveniente de fábrica cercana.",
            evidencia_url: "http://localhost:3000/uploads/INC-PUE-5182-1795595264075.jpeg",
            correo_electronico: "reporte.texmelucan@gmail.com",
            telefono_opcional: "2481045821",
            prioridad_score: 5,
            estado: "Validando"
        },
        {
            folio: "INC-PUE-7349",
            codigo_problema: "P01",
            rio_nombre: "Río Atoyac",
            municipio: "Puebla",
            direccion: "Bajo el puente de Blvd. Hermanos Serdán y ribera del Río Atoyac, Puebla, Puebla, México",
            latitud: 19.0625820,
            longitud: -98.2420370,
            descripcion: "Vertido químico oscuro bajo el puente con agua muy turbia, grasa superficial, llanta atrapada en el cauce y fuerte olor tóxico industrial.",
            evidencia_url: "http://localhost:3000/uploads/INC-PUE-7349-1795595267212.jpeg",
            correo_electronico: "alerta.atoyac.pue@gmail.com",
            telefono_opcional: "2224189032",
            prioridad_score: 5,
            estado: "Validando"
        },
        {
            folio: "INC-PUE-2914",
            codigo_problema: "P02",
            rio_nombre: "Río Alseseca",
            municipio: "Puebla",
            direccion: "Puente Zaragoza, ribera del Río Alseseca, Col. El Cristo, Puebla, Puebla, México",
            latitud: 19.0337080,
            longitud: -98.1750970,
            descripcion: "Colector de drenaje en muro de concreto descargando aguas residuales y aguas negras directo al río de forma continua, generando espuma y mal olor.",
            evidencia_url: "http://localhost:3000/uploads/INC-PUE-2914-1795595270349.jpeg",
            correo_electronico: "vecinos.elcristo@gmail.com",
            telefono_opcional: "2227651140",
            prioridad_score: 4,
            estado: "Validando"
        },
        {
            folio: "INC-PUE-6407",
            codigo_problema: "P03",
            rio_nombre: "Río Nexapa",
            municipio: "Atlixco",
            direccion: "Camino a Santa Ana Yancuitlalpan, margen del Río Nexapa, Atlixco, Puebla, México",
            latitud: 18.8898850,
            longitud: -98.3983790,
            descripcion: "Riesgo de desbordamiento en el río por incremento del caudal tras lluvias intensas; se observa erosión severa del talud, lodo y daño en la ribera.",
            evidencia_url: "http://localhost:3000/uploads/INC-PUE-6407-1795595273486.jpeg",
            correo_electronico: "proteccion.nexapa@gmail.com",
            telefono_opcional: "2441127890",
            prioridad_score: 4,
            estado: "Validando"
        },
        {
            folio: "INC-PUE-1853",
            codigo_problema: "P03",
            rio_nombre: "Río Alseseca",
            municipio: "Puebla",
            direccion: "Calle Río Alseseca esq. Prol. 24 Sur, Col. Jardines de San Manuel, Puebla, Puebla, México",
            latitud: 19.0016090,
            longitud: -98.1901940,
            descripcion: "Desbordamiento del cauce sobre el muro de contención de la ribera provocando inundación en la vialidad, agua turbia, lodo y arrastre de basura.",
            evidencia_url: "http://localhost:3000/uploads/INC-PUE-1853-1795595276623.jpeg",
            correo_electronico: "colonia.sanmanuel@gmail.com",
            telefono_opcional: null,
            prioridad_score: 4,
            estado: "Validando"
        },
        {
            folio: "INC-PUE-9026",
            codigo_problema: "P04",
            rio_nombre: "Río Prieto",
            municipio: "San Pedro Cholula",
            direccion: "Cruce con Camino Real a Momoxpan, cauce del Río Prieto, San Pedro Cholula, Puebla, México",
            latitud: 19.0946310,
            longitud: -98.3034350,
            descripcion: "Taponamiento del cauce bajo el ducto por acumulación de maleza, plásticos y escombros que impiden el flujo del agua y provocan estancamiento y azolve.",
            evidencia_url: "http://localhost:3000/uploads/INC-PUE-9026-1795595279760.jpeg",
            correo_electronico: "cholula.rios@gmail.com",
            telefono_opcional: "2228394510",
            prioridad_score: 4,
            estado: "Validando"
        },
        {
            folio: "INC-PUE-4761",
            codigo_problema: "P05",
            rio_nombre: "Río Atoyac",
            municipio: "Cuautlancingo",
            direccion: "Límite con Parque Industrial FINSA, ribera del Río Atoyac, Cuautlancingo, Puebla, México",
            latitud: 19.1454270,
            longitud: -98.2264500,
            descripcion: "Cambio drástico de color en el agua del río con tonalidad rojo tinte muy intensa y escombros en la ribera, probable descarga textil sin tratamiento.",
            evidencia_url: "http://localhost:3000/uploads/INC-PUE-4761-1795595282897.jpeg",
            correo_electronico: "observatorio.finsa@gmail.com",
            telefono_opcional: "2225093412",
            prioridad_score: 3,
            estado: "Validando"
        },
        {
            folio: "INC-PUE-3598",
            codigo_problema: "P06",
            rio_nombre: "Río Prieto",
            municipio: "Cuautlancingo",
            direccion: "Fraccionamiento Bello Horizonte, margen del Río Prieto, Cuautlancingo, Puebla, México",
            latitud: 19.0786060,
            longitud: -98.2728380,
            descripcion: "Vecinos reportan malos olores fétidos y gases persistentes provenientes del arroyo; muestra de agua recolectada presenta coloración turbia verdosa y grasa.",
            evidencia_url: "http://localhost:3000/uploads/INC-PUE-3598-1795595286034.jpeg",
            correo_electronico: "comite.bellohorizonte@gmail.com",
            telefono_opcional: "2229146703",
            prioridad_score: 3,
            estado: "Validando"
        },
        {
            folio: "INC-PUE-8215",
            codigo_problema: "P07",
            rio_nombre: "Río Alseseca",
            municipio: "Puebla",
            direccion: "Puente de la 14 Sur y Ribera del Río Alseseca, Col. La Hacienda, Puebla, Puebla, México",
            latitud: 19.0176420,
            longitud: -98.1871730,
            descripcion: "Tiradero clandestino con acumulación de basura, llantas, envases de plástico y residuos sólidos dentro del cauce y en la ribera del río.",
            evidencia_url: "http://localhost:3000/uploads/INC-PUE-8215-1795595289171.jpeg",
            correo_electronico: "lahacienda.limpia@gmail.com",
            telefono_opcional: null,
            prioridad_score: 2,
            estado: "Concluido"
        },
        {
            folio: "INC-PUE-6894",
            codigo_problema: "P02",
            rio_nombre: "Río Zahuapan",
            municipio: "Zacatelco",
            direccion: "Puente de acceso sur sobre el Río Zahuapan, Zacatelco, Tlaxcala, México",
            latitud: 19.2280770,
            longitud: -98.3009150,
            descripcion: "Descarga directa de aguas residuales desde alcantarilla en muro de piedra hacia el cauce del río, generando agua sucia, espuma y residuos flotantes.",
            evidencia_url: "http://localhost:3000/uploads/INC-PUE-6894-1795595292308.jpeg",
            correo_electronico: "vigilancia.zahuapan@gmail.com",
            telefono_opcional: "2461389204",
            prioridad_score: 4,
            estado: "Dron en Verificación"
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
                evidencia_url = EXCLUDED.evidencia_url,
                descripcion = EXCLUDED.descripcion,
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

    console.log(` Se insertaron/actualizaron ${reportes.length} reportes oficiales en 'reportes_usuarios'.`);
    await client.end();
}

seedReportes().catch(console.error);
