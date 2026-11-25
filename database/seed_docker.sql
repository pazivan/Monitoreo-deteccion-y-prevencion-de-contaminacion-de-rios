-- ============================================================================
-- DATOS SEMILLA AUTOMÁTICOS PARA DOCKER (puebla_rios + PostGIS)
-- ============================================================================

-- 1. Los 5 ríos oficiales de Puebla
INSERT INTO rios_monitoreados (nombre, caudal_base_m3_s, velocidad_media_m_s, profundidad_m, altitud_msnm, area_cuenca_km2) VALUES
('Río Atoyac', 14.8, 0.95, 1.6, 2135.0, 4011.0),
('Río Alseseca', 4.2, 0.72, 1.1, 2150.0, 310.0),
('Río Zahuapan', 8.6, 0.84, 1.4, 2210.0, 1850.0),
('Río Nexapa', 9.5, 0.88, 1.3, 1420.0, 2450.0),
('Río Prieto', 2.1, 0.55, 0.8, 2190.0, 180.0)
ON CONFLICT (nombre) DO UPDATE SET
    caudal_base_m3_s = EXCLUDED.caudal_base_m3_s,
    velocidad_media_m_s = EXCLUDED.velocidad_media_m_s;

-- 2. Usuario institucional por defecto
INSERT INTO usuarios_sistema (nombre_completo, usuario, correo, password_hash, rol) VALUES
('Ing. Supervisor Ambiental CEASPUE', 'admi', 'admi@gmail.com', '123456', 'SUPERVISOR_CUADRILLAS')
ON CONFLICT (usuario) DO NOTHING;

-- 3.5. Catálogo operativo real (CMIC / IMSS FASAR 1.55 / EMA NOM-001-SEMARNAT-2021 / CONAGUA)
INSERT INTO catalogo_danos_saneamiento (concepto, unidad, costo_unitario_mxn, fuente_referencia) VALUES
('Despliegue de cuadrilla hidráulica (1 oficial + 2 ayudantes + cabo, FASAR 1.55)', 'jornada', 2850.00, 'CMIC / IMSS FASAR promedio 1.55'),
('Traslado operativo, unidad móvil, EPP químico/biológico y herramienta menor', 'salida', 950.00, 'Tabulador operativo CEASPUE'),
('Sobrevuelo de dron térmico/multiespectral para reconocimiento aéreo', 'vuelo', 1200.00, 'Operación aérea institucional'),
('Muestreo compuesto y análisis NOM-001-SEMARNAT-2021 (incluye toxicidad aguda)', 'muestra', 9500.00, 'Tarifa laboratorio acreditado EMA / CONAGUA'),
('Desazolve mecánico en cauce con maquinaria y tendido libre', 'm3', 182.81, 'Tabulador CONAGUA Distritos de Riego'),
('Carga y acarreo en volteo de azolve/escombro a tiro autorizado', 'm3', 115.00, 'Tabulador obra civil / acarreos'),
('Sellado / contención emergente de descarga residual irregular', 'descarga', 22000.00, 'Obra hidráulica menor CEASPUE')
ON CONFLICT (concepto) DO UPDATE SET
    costo_unitario_mxn = EXCLUDED.costo_unitario_mxn,
    fuente_referencia = EXCLUDED.fuente_referencia;

-- 3.6. Matriz completa CAPEX / OPEX (Excel Base del Usuario + Referencias Reales)
INSERT INTO matriz_costos_saneamiento (
    incidencia_categoria, tratamiento, capex_min_mxn, capex_max_mxn, capex_prom_mxn,
    unidad_capex, unidad_medida_corta, opex_min_m3, opex_max_m3, costo_directo_m3_mxn, observaciones, fuente_datos
) VALUES
('Descarga de aguas residuales', 'Humedales artificiales', 180000, 450000, 315000, 'Por L/s de capacidad instalada (CAPEX)', 'L/s', 0.50, 1.50, NULL, 'La nota técnica del Excel indica $1,800–$3,800 MXN/m². El costo principal está expresado por L/s instalado (1 L/s = 86.4 m³/día).', 'Excel Base Técnico'),
('Descarga de aguas residuales', 'Sedimentación (desarenadores y clarificadores)', 80000, 220000, 150000, 'Por L/s de capacidad instalada (CAPEX)', 'L/s', 0.40, 1.20, NULL, 'Obra civil; requiere purga de lodos primarios.', 'Excel Base Técnico'),
('Descarga de aguas residuales', 'Lodos activados (convencional / aireación extendida)', 350000, 750000, 550000, 'Por L/s de capacidad instalada (CAPEX)', 'L/s', 4.50, 9.50, NULL, '50–65% del OPEX corresponde a energía eléctrica para aireación.', 'Excel Base Técnico'),
('Descarga de aguas residuales', 'Biofiltros, MBBR y SBR', 400000, 850000, 625000, 'Por L/s de capacidad instalada (CAPEX)', 'L/s', 4.00, 8.00, NULL, 'Menor huella de terreno que lodos activados y alta tolerancia a variaciones de carga orgánica.', 'Excel Base Técnico'),

('Vertido químico o industrial', 'Electrocoagulación', 300000, 850000, 575000, 'Por L/s de capacidad instalada (CAPEX)', 'L/s', 4.50, 12.00, NULL, 'El OPEX incluye electricidad y desgaste de electrodos (Al/Fe).', 'Excel Base Técnico'),
('Vertido químico o industrial', 'Flotación por aire disuelto (DAF)', 450000, 1100000, 775000, 'Por L/s de capacidad instalada (CAPEX)', 'L/s', 3.50, 8.00, NULL, 'Alta eficiencia en remoción de grasas y colorantes textiles.', 'Excel Base Técnico'),
('Vertido químico o industrial', 'Filtración y adsorción (arena / carbón activado)', 150000, 400000, 275000, 'Por L/s de capacidad instalada (CAPEX)', 'L/s', 2.00, 6.50, NULL, 'El OPEX incluye retrolavados y recambio periódico de carbón activado.', 'Excel Base Técnico'),
('Vertido químico o industrial', 'Separación y recuperación de aceites e hidrocarburos', 35000, 1500000, 767500, 'Por equipo / infraestructura instalada', 'equipo', 0.80, 2.50, NULL, 'Trampas comerciales: $35,000–$180,000; infraestructura mayor: $700,000–$1,500,000.', 'Excel Base Técnico'),

('Basura y residuos en cauce', 'Desazolve mecánico y retiro de residuos (por m³ CONAGUA/CMIC)', 182.81, 340.00, 297.81, 'Por m³ extraído y acarreado a tiro autorizado', 'm3', NULL, NULL, 297.81, 'Desazolve mecánico CONAGUA ($182.81/m³) + carga y acarreo en volteo a tiro autorizado ($115.00/m³). Campaña municipal anual del Excel: $3M–$10M.', 'CONAGUA + CMIC + Excel'),
('Basura y residuos en cauce', 'Barreras de retención de residuos (biobardas / flotantes)', 15000, 1200000, 607500, 'Por barrera instalada', 'barrera', NULL, NULL, NULL, 'Artesanal/comunitaria (20–40 m): $15,000–$80,000; modular industrial: $250,000–$1,200,000.', 'Excel Base Técnico'),
('Basura y residuos en cauce', 'Recolección de residuos sólidos y desazolve (Campaña anual)', 3000000, 10000000, 6500000, 'Por campaña anual municipal', 'campana', NULL, NULL, NULL, 'Contratos anuales de desazolve y limpieza integral en ríos y barrancas.', 'Excel Base Técnico'),

('Espuma, manchas o cambio de color', 'Flotación por aire disuelto (DAF)', 450000, 1100000, 775000, 'Por L/s de capacidad instalada (CAPEX)', 'L/s', 3.50, 8.00, NULL, 'Alta eficiencia en grasas y colorantes textiles; pertinencia sujeta a caracterización del contaminante.', 'Excel Base Técnico'),
('Espuma, manchas o cambio de color', 'Filtración y adsorción (arena / carbón activado)', 150000, 400000, 275000, 'Por L/s de capacidad instalada (CAPEX)', 'L/s', 2.00, 6.50, NULL, 'La selección del medio filtrante depende de la sustancia que origina el color o mancha.', 'Excel Base Técnico'),
('Espuma, manchas o cambio de color', 'Electrocoagulación', 300000, 850000, 575000, 'Por L/s de capacidad instalada (CAPEX)', 'L/s', 4.50, 12.00, NULL, 'Método fisicoquímico eficaz para colorantes y tensoactivos específicos.', 'Excel Base Técnico'),
('Espuma, manchas o cambio de color', 'Separación y recuperación de aceites e hidrocarburos', 35000, 1500000, 767500, 'Por equipo / infraestructura instalada', 'equipo', 0.80, 2.50, NULL, 'Aplicable cuando las manchas o iridiscencias corresponden a aceites o hidrocarburos.', 'Excel Base Técnico'),

('Malos olores o gases tóxicos', 'Humedales artificiales (control biológico de carga)', 180000, 450000, 315000, 'Por L/s de capacidad instalada (CAPEX)', 'L/s', 0.50, 1.50, NULL, 'Relación indirecta: reduce la carga orgánica del agua que origina fermentación anaerobia.', 'Excel Base Técnico'),
('Malos olores o gases tóxicos', 'Biofiltros, MBBR y SBR', 400000, 850000, 625000, 'Por L/s de capacidad instalada (CAPEX)', 'L/s', 4.00, 8.00, NULL, 'Relación indirecta: tratamiento biológico de agua para abatir sulfuros y DBO5.', 'Excel Base Técnico'),
('Malos olores o gases tóxicos', 'Lodos activados (convencional / aireación extendida)', 350000, 750000, 550000, 'Por L/s de capacidad instalada (CAPEX)', 'L/s', 4.50, 9.50, NULL, 'Relación indirecta mediante oxigenación del agua residual; no es sistema específico de gases.', 'Excel Base Técnico'),

('Escombros o taponamiento del río', 'Desazolve mecánico y retiro de escombro (por m³ CONAGUA/CMIC)', 182.81, 340.00, 297.81, 'Por m³ retirado del cauce', 'm3', NULL, NULL, 297.81, 'Extracción mecánica de azolve y escombro ($182.81/m³ CONAGUA) + retiro a tiro autorizado ($115.00/m³). Campaña anual municipal: $3M–$10M.', 'CONAGUA + CMIC + Excel'),
('Escombros o taponamiento del río', 'Barreras de retención de residuos (biobardas / flotantes)', 15000, 1200000, 607500, 'Por barrera instalada', 'barrera', NULL, NULL, NULL, 'Medida preventiva de retención superficial; no sustituye el retiro mecánico de escombros.', 'Excel Base Técnico'),
('Escombros o taponamiento del río', 'Recolección de residuos sólidos y desazolve (Campaña anual)', 3000000, 10000000, 6500000, 'Por campaña anual municipal', 'campana', NULL, NULL, NULL, 'Contrato anual de desazolve y limpieza en tramos críticos.', 'Excel Base Técnico'),

('Desbordamiento o erosión de ribera', 'Estabilización de riberas (gaviones o muros verdes por km)', 1500000, 4500000, 3000000, 'Por km de margen estabilizada ($1,500–$4,500/m)', 'km', NULL, NULL, NULL, 'Obra hidráulica estructural con gaviones o muros verdes ($1,500,000–$4,500,000/km).', 'Excel Base Técnico'),
('Desbordamiento o erosión de ribera', 'Reforestación y bioingeniería de ribera (por ha)', 120000, 450000, 285000, 'Por hectárea (ha) restaurada', 'ha', NULL, NULL, NULL, 'Reforestación de talud y zona federal ribereña ($120,000–$450,000/ha).', 'Excel Base Técnico'),
('Desbordamiento o erosión de ribera', 'Fitorremediación (islas flotantes / macrófitas por m²)', 2500, 6500, 4500, 'Por m² de isla flotante ($25M–$60M proyecto integral)', 'm2', NULL, NULL, NULL, 'Costo unitario $2,500–$6,500 MXN/m² de isla flotante; proyecto integral $25M–$60M. No sustituye contención de erosión.', 'Excel Base Técnico')
ON CONFLICT (incidencia_categoria, tratamiento) DO UPDATE SET
    capex_min_mxn = EXCLUDED.capex_min_mxn,
    capex_max_mxn = EXCLUDED.capex_max_mxn,
    capex_prom_mxn = EXCLUDED.capex_prom_mxn,
    opex_min_m3 = EXCLUDED.opex_min_m3,
    opex_max_m3 = EXCLUDED.opex_max_m3,
    costo_directo_m3_mxn = EXCLUDED.costo_directo_m3_mxn,
    observaciones = EXCLUDED.observaciones;
INSERT INTO drones (identificador, modelo, tiene_camara_term, estado) VALUES
('DRON-PUE-01', 'DJI Matrice 300 RTK con sensor térmico e inspección multiespectral', true, 'Disponible'),
('DRON-PUE-02', 'DJI Mavic 3 Thermal monitoreo rápido de cauces', true, 'Disponible')
ON CONFLICT (identificador) DO NOTHING;

INSERT INTO cuadrillas (nombre, especialidad, zona_asignada, disponible) VALUES
('Cuadrilla 1 - Saneamiento Químico', 'Neutralización de vertidos industriales y muestreo', 'Cuenca Alta Atoyac', true),
('Cuadrilla 2 - Desazolve y Taponamientos', 'Retiro de escombro, ramas y liberación de flujo', 'Río Alseseca y Valsequillo', true),
('Cuadrilla 3 - Inspección y Sellado', 'Clausura de descargas y estabilización de ribera', 'Río Zahuapan y Nexapa', true)
ON CONFLICT DO NOTHING;

-- 4. Reportes ciudadanos iniciales georreferenciados (PostGIS - 20 registros con evidencia local)
INSERT INTO reportes_usuarios (
    folio, id_tipo_problema, id_rio, rio_nombre, municipio, direccion,
    latitud, longitud, descripcion, evidencia_url, correo_electronico,
    telefono_opcional, prioridad_score, estado
)
SELECT
    'PUE-2026-001',
    (SELECT id_tipo FROM catalogo_tipos_problema WHERE codigo = 'P01'),
    (SELECT id_rio FROM rios_monitoreados WHERE nombre = 'Río Atoyac'),
    'Río Atoyac',
    'Puebla',
    'Ribera del Río Atoyac, altura Complejo Cultural Universitario (CCU)',
    19.0195, -98.2415,
    'Se detectó vertido industrial con tonalidad azulada densa y olor penetrante a solvente. Afecta fauna acuática visible.',
    'http://localhost:3000/uploads/PUE-2026-001-1795595477753.jpeg',
    'guardavalles.pue@gmail.com', '2223456781', 5, 'Validando'
WHERE NOT EXISTS (SELECT 1 FROM reportes_usuarios WHERE folio = 'PUE-2026-001');

INSERT INTO reportes_usuarios (
    folio, id_tipo_problema, id_rio, rio_nombre, municipio, direccion,
    latitud, longitud, descripcion, evidencia_url, correo_electronico,
    telefono_opcional, prioridad_score, estado
)
SELECT
    'PUE-2026-002',
    (SELECT id_tipo FROM catalogo_tipos_problema WHERE codigo = 'P04'),
    (SELECT id_rio FROM rios_monitoreados WHERE nombre = 'Río Alseseca'),
    'Río Alseseca',
    'Puebla',
    'Puente Álamos Vista Hermosa, margen oriente del Río Alseseca',
    19.0438, -98.1755,
    'Acumulación masiva de ramas, llantas y escombros de construcción provocando taponamiento severo y riesgo de desbordamiento.',
    'http://localhost:3000/uploads/PUE-2026-002-1795595479764.jpeg',
    'comunidad.alseseca@gmail.com', '2221987654', 4, 'Dron en Verificación'
WHERE NOT EXISTS (SELECT 1 FROM reportes_usuarios WHERE folio = 'PUE-2026-002');

INSERT INTO reportes_usuarios (
    folio, id_tipo_problema, id_rio, rio_nombre, municipio, direccion,
    latitud, longitud, descripcion, evidencia_url, correo_electronico,
    telefono_opcional, prioridad_score, estado
)
SELECT
    'PUE-2026-003',
    (SELECT id_tipo FROM catalogo_tipos_problema WHERE codigo = 'P02'),
    (SELECT id_rio FROM rios_monitoreados WHERE nombre = 'Río Zahuapan'),
    'Río Zahuapan',
    'Cuautlancingo',
    'Confluencia de canal auxiliar con Río Zahuapan, límite poniente',
    19.0880, -98.2720,
    'Ducto de concreto descargando aguas negras directamente al cauce sin tratamiento. Se aprecian lodos densos y olor fétido constante.',
    'http://localhost:3000/uploads/PUE-2026-003-1795595481775.jpeg',
    'vecinos.cuautlan@gmail.com', '2225432109', 4, 'Cuadrilla Desplegada'
WHERE NOT EXISTS (SELECT 1 FROM reportes_usuarios WHERE folio = 'PUE-2026-003');

INSERT INTO reportes_usuarios (
    folio, id_tipo_problema, id_rio, rio_nombre, municipio, direccion,
    latitud, longitud, descripcion, evidencia_url, correo_electronico,
    telefono_opcional, prioridad_score, estado
)
SELECT
    'PUE-2026-004',
    (SELECT id_tipo FROM catalogo_tipos_problema WHERE codigo = 'P03'),
    (SELECT id_rio FROM rios_monitoreados WHERE nombre = 'Río Nexapa'),
    'Río Nexapa',
    'Atlixco',
    'Margen baja del Río Nexapa, zona de huertas y viveros',
    18.9120, -98.4410,
    'Erosión severa en el talud derecho del río con debilitamiento del bordo de contención tras el incremento de flujo pluvial.',
    'http://localhost:3000/uploads/PUE-2026-004-1795595483786.jpeg',
    'riego.nexapa@gmail.com', '2441238901', 4, 'Cotizado / En Saneamiento'
WHERE NOT EXISTS (SELECT 1 FROM reportes_usuarios WHERE folio = 'PUE-2026-004');

INSERT INTO reportes_usuarios (
    folio, id_tipo_problema, id_rio, rio_nombre, municipio, direccion,
    latitud, longitud, descripcion, evidencia_url, correo_electronico,
    telefono_opcional, prioridad_score, estado
)
SELECT
    'PUE-2026-005',
    (SELECT id_tipo FROM catalogo_tipos_problema WHERE codigo = 'P05'),
    (SELECT id_rio FROM rios_monitoreados WHERE nombre = 'Río Prieto'),
    'Río Prieto',
    'San Andrés Cholula',
    'Cruce con Camino Real a Cholula, cauce del Río Prieto',
    19.0550, -98.2830,
    'Capa de espuma blanca y aceites superficiales sobre el agua acumulada en las orillas con malos olores intermitentes.',
    'http://localhost:3000/uploads/PUE-2026-005-1795595485797.jpeg',
    'cholula.verde@gmail.com', '2226789012', 3, 'Validando'
WHERE NOT EXISTS (SELECT 1 FROM reportes_usuarios WHERE folio = 'PUE-2026-005');

INSERT INTO reportes_usuarios (
    folio, id_tipo_problema, id_rio, rio_nombre, municipio, direccion,
    latitud, longitud, descripcion, evidencia_url, correo_electronico,
    telefono_opcional, prioridad_score, estado
)
SELECT
    'PUE-2026-006',
    (SELECT id_tipo FROM catalogo_tipos_problema WHERE codigo = 'P07'),
    (SELECT id_rio FROM rios_monitoreados WHERE nombre = 'Río Atoyac'),
    'Río Atoyac',
    'Puebla',
    'Parque Lineal Atoyac, cerca de la Noria',
    19.0345, -98.2290,
    'Se completó la jornada de limpieza comunitaria y retiro de 4 toneladas de botellas PET, llantas y maleza en margen ribereña.',
    'http://localhost:3000/uploads/PUE-2026-006-1795595487808.jpeg',
    'parques.puebla@ceaspue.gob.mx', '2221122334', 2, 'Concluido'
WHERE NOT EXISTS (SELECT 1 FROM reportes_usuarios WHERE folio = 'PUE-2026-006');

INSERT INTO reportes_usuarios (
    folio, id_tipo_problema, id_rio, rio_nombre, municipio, direccion,
    latitud, longitud, descripcion, evidencia_url, correo_electronico,
    telefono_opcional, prioridad_score, estado
)
SELECT
    'INC-PUE-4044',
    (SELECT id_tipo FROM catalogo_tipos_problema WHERE codigo = 'P02'),
    (SELECT id_rio FROM rios_monitoreados WHERE nombre = 'Río Atoyac'),
    'Río Atoyac',
    'Tzicatlacoyan',
    'Santa Cruz el Calvario, Tzicatlacoyan, Puebla, México',
    18.8503110, -98.0479900,
    'Hay mucha descarga de aguas residuales, huele feo',
    'http://localhost:3000/uploads/INC-PUE-4044-1795589528662.jpeg',
    'liebertj795@gmail.com', '9514323245', 4, 'Concluido'
WHERE NOT EXISTS (SELECT 1 FROM reportes_usuarios WHERE folio = 'INC-PUE-4044');

INSERT INTO reportes_usuarios (
    folio, id_tipo_problema, id_rio, rio_nombre, municipio, direccion,
    latitud, longitud, descripcion, evidencia_url, correo_electronico,
    telefono_opcional, prioridad_score, estado
)
SELECT
    'INC-PUE-9436',
    (SELECT id_tipo FROM catalogo_tipos_problema WHERE codigo = 'P07'),
    (SELECT id_rio FROM rios_monitoreados WHERE nombre = 'Río Zahuapan'),
    'Río Zahuapan',
    'Tlaxcala',
    'San Lucas Cuauhtelulpan, Municipio de Tlaxcala, Tlaxcala, 90070, México',
    19.3038540, -98.2706440,
    'hay mucha basura y, ademas, residuos en el rio',
    'http://localhost:3000/uploads/INC-PUE-9436-1795589664323.jpeg',
    'liebertj795@gmail.com', '9514323245', 2, 'Validando'
WHERE NOT EXISTS (SELECT 1 FROM reportes_usuarios WHERE folio = 'INC-PUE-9436');

INSERT INTO reportes_usuarios (
    folio, id_tipo_problema, id_rio, rio_nombre, municipio, direccion,
    latitud, longitud, descripcion, evidencia_url, correo_electronico,
    telefono_opcional, prioridad_score, estado
)
SELECT
    'INC-PUE-3285',
    (SELECT id_tipo FROM catalogo_tipos_problema WHERE codigo = 'P05'),
    (SELECT id_rio FROM rios_monitoreados WHERE nombre = 'Río Nexapa'),
    'Río Nexapa',
    'Atlixco',
    'Calle Emiliano Zapata Salazar, Emiliano Zapata Nexatengo, Santa Ana Yancuitlalpan (Chilhuacán), Atlixco, Puebla, 74320, México',
    18.8841780, -98.4032310,
    'Se observa una gran cantidad de espuma en las corrientes de agua, me asusta, será peligroso?',
    'http://localhost:3000/uploads/INC-PUE-3285-1795590030027.jpeg',
    'liebertj795@gmail.com', '9514323245', 3, 'Validando'
WHERE NOT EXISTS (SELECT 1 FROM reportes_usuarios WHERE folio = 'INC-PUE-3285');

INSERT INTO reportes_usuarios (
    folio, id_tipo_problema, id_rio, rio_nombre, municipio, direccion,
    latitud, longitud, descripcion, evidencia_url, correo_electronico,
    telefono_opcional, prioridad_score, estado
)
SELECT
    'INC-PUE-8650',
    (SELECT id_tipo FROM catalogo_tipos_problema WHERE codigo = 'P04'),
    (SELECT id_rio FROM rios_monitoreados WHERE nombre = 'Río Zahuapan'),
    'Río Zahuapan',
    'San Lucas Tecopilco',
    'San Lucas Tecopilco, Tlaxcala, México',
    19.4872960, -98.2162300,
    'Las corrientes de agua estan tapados por mucha basura',
    'http://localhost:3000/uploads/INC-PUE-8650-1795590192495.jpeg',
    'liebertj795@gmail.com', '9514323245', 4, 'Validando'
WHERE NOT EXISTS (SELECT 1 FROM reportes_usuarios WHERE folio = 'INC-PUE-8650');

INSERT INTO reportes_usuarios (
    folio, id_tipo_problema, id_rio, rio_nombre, municipio, direccion,
    latitud, longitud, descripcion, evidencia_url, correo_electronico,
    telefono_opcional, prioridad_score, estado
)
SELECT
    'INC-PUE-5182',
    (SELECT id_tipo FROM catalogo_tipos_problema WHERE codigo = 'P01'),
    (SELECT id_rio FROM rios_monitoreados WHERE nombre = 'Río Atoyac'),
    'Río Atoyac',
    'San Martín Texmelucan',
    'Corredor Industrial Quetzalcóatl, ribera del Río Atoyac, San Martín Texmelucan, Puebla, México',
    19.2830160, -98.4187000,
    'Se detecta descarga química e industrial con abundante espuma blanca densa sobre el cauce del río y olor penetrante a solvente proveniente de fábrica cercana.',
    'http://localhost:3000/uploads/INC-PUE-5182-1795595264075.jpeg',
    'reporte.texmelucan@gmail.com', '2481045821', 5, 'Validando'
WHERE NOT EXISTS (SELECT 1 FROM reportes_usuarios WHERE folio = 'INC-PUE-5182');

INSERT INTO reportes_usuarios (
    folio, id_tipo_problema, id_rio, rio_nombre, municipio, direccion,
    latitud, longitud, descripcion, evidencia_url, correo_electronico,
    telefono_opcional, prioridad_score, estado
)
SELECT
    'INC-PUE-7349',
    (SELECT id_tipo FROM catalogo_tipos_problema WHERE codigo = 'P01'),
    (SELECT id_rio FROM rios_monitoreados WHERE nombre = 'Río Atoyac'),
    'Río Atoyac',
    'Puebla',
    'Bajo el puente de Blvd. Hermanos Serdán y ribera del Río Atoyac, Puebla, Puebla, México',
    19.0625820, -98.2420370,
    'Vertido químico oscuro bajo el puente con agua muy turbia, grasa superficial, llanta atrapada en el cauce y fuerte olor tóxico industrial.',
    'http://localhost:3000/uploads/INC-PUE-7349-1795595267212.jpeg',
    'alerta.atoyac.pue@gmail.com', '2224189032', 5, 'Validando'
WHERE NOT EXISTS (SELECT 1 FROM reportes_usuarios WHERE folio = 'INC-PUE-7349');

INSERT INTO reportes_usuarios (
    folio, id_tipo_problema, id_rio, rio_nombre, municipio, direccion,
    latitud, longitud, descripcion, evidencia_url, correo_electronico,
    telefono_opcional, prioridad_score, estado
)
SELECT
    'INC-PUE-2914',
    (SELECT id_tipo FROM catalogo_tipos_problema WHERE codigo = 'P02'),
    (SELECT id_rio FROM rios_monitoreados WHERE nombre = 'Río Alseseca'),
    'Río Alseseca',
    'Puebla',
    'Puente Zaragoza, ribera del Río Alseseca, Col. El Cristo, Puebla, Puebla, México',
    19.0337080, -98.1750970,
    'Colector de drenaje en muro de concreto descargando aguas residuales y aguas negras directo al río de forma continua, generando espuma y mal olor.',
    'http://localhost:3000/uploads/INC-PUE-2914-1795595270349.jpeg',
    'vecinos.elcristo@gmail.com', '2227651140', 4, 'Validando'
WHERE NOT EXISTS (SELECT 1 FROM reportes_usuarios WHERE folio = 'INC-PUE-2914');

INSERT INTO reportes_usuarios (
    folio, id_tipo_problema, id_rio, rio_nombre, municipio, direccion,
    latitud, longitud, descripcion, evidencia_url, correo_electronico,
    telefono_opcional, prioridad_score, estado
)
SELECT
    'INC-PUE-6407',
    (SELECT id_tipo FROM catalogo_tipos_problema WHERE codigo = 'P03'),
    (SELECT id_rio FROM rios_monitoreados WHERE nombre = 'Río Nexapa'),
    'Río Nexapa',
    'Atlixco',
    'Camino a Santa Ana Yancuitlalpan, margen del Río Nexapa, Atlixco, Puebla, México',
    18.8898850, -98.3983790,
    'Riesgo de desbordamiento en el río por incremento del caudal tras lluvias intensas; se observa erosión severa del talud, lodo y daño en la ribera.',
    'http://localhost:3000/uploads/INC-PUE-6407-1795595273486.jpeg',
    'proteccion.nexapa@gmail.com', '2441127890', 4, 'Validando'
WHERE NOT EXISTS (SELECT 1 FROM reportes_usuarios WHERE folio = 'INC-PUE-6407');

INSERT INTO reportes_usuarios (
    folio, id_tipo_problema, id_rio, rio_nombre, municipio, direccion,
    latitud, longitud, descripcion, evidencia_url, correo_electronico,
    telefono_opcional, prioridad_score, estado
)
SELECT
    'INC-PUE-1853',
    (SELECT id_tipo FROM catalogo_tipos_problema WHERE codigo = 'P03'),
    (SELECT id_rio FROM rios_monitoreados WHERE nombre = 'Río Alseseca'),
    'Río Alseseca',
    'Puebla',
    'Calle Río Alseseca esq. Prol. 24 Sur, Col. Jardines de San Manuel, Puebla, Puebla, México',
    19.0016090, -98.1901940,
    'Desbordamiento del cauce sobre el muro de contención de la ribera provocando inundación en la vialidad, agua turbia, lodo y arrastre de basura.',
    'http://localhost:3000/uploads/INC-PUE-1853-1795595276623.jpeg',
    'colonia.sanmanuel@gmail.com', NULL, 4, 'Validando'
WHERE NOT EXISTS (SELECT 1 FROM reportes_usuarios WHERE folio = 'INC-PUE-1853');

INSERT INTO reportes_usuarios (
    folio, id_tipo_problema, id_rio, rio_nombre, municipio, direccion,
    latitud, longitud, descripcion, evidencia_url, correo_electronico,
    telefono_opcional, prioridad_score, estado
)
SELECT
    'INC-PUE-9026',
    (SELECT id_tipo FROM catalogo_tipos_problema WHERE codigo = 'P04'),
    (SELECT id_rio FROM rios_monitoreados WHERE nombre = 'Río Prieto'),
    'Río Prieto',
    'San Pedro Cholula',
    'Cruce con Camino Real a Momoxpan, cauce del Río Prieto, San Pedro Cholula, Puebla, México',
    19.0946310, -98.3034350,
    'Taponamiento del cauce bajo el ducto por acumulación de maleza, plásticos y escombros que impiden el flujo del agua y provocan estancamiento y azolve.',
    'http://localhost:3000/uploads/INC-PUE-9026-1795595279760.jpeg',
    'cholula.rios@gmail.com', '2228394510', 4, 'Validando'
WHERE NOT EXISTS (SELECT 1 FROM reportes_usuarios WHERE folio = 'INC-PUE-9026');

INSERT INTO reportes_usuarios (
    folio, id_tipo_problema, id_rio, rio_nombre, municipio, direccion,
    latitud, longitud, descripcion, evidencia_url, correo_electronico,
    telefono_opcional, prioridad_score, estado
)
SELECT
    'INC-PUE-4761',
    (SELECT id_tipo FROM catalogo_tipos_problema WHERE codigo = 'P05'),
    (SELECT id_rio FROM rios_monitoreados WHERE nombre = 'Río Atoyac'),
    'Río Atoyac',
    'Cuautlancingo',
    'Límite con Parque Industrial FINSA, ribera del Río Atoyac, Cuautlancingo, Puebla, México',
    19.1454270, -98.2264500,
    'Cambio drástico de color en el agua del río con tonalidad rojo tinte muy intensa y escombros en la ribera, probable descarga textil sin tratamiento.',
    'http://localhost:3000/uploads/INC-PUE-4761-1795595282897.jpeg',
    'observatorio.finsa@gmail.com', '2225093412', 3, 'Validando'
WHERE NOT EXISTS (SELECT 1 FROM reportes_usuarios WHERE folio = 'INC-PUE-4761');

INSERT INTO reportes_usuarios (
    folio, id_tipo_problema, id_rio, rio_nombre, municipio, direccion,
    latitud, longitud, descripcion, evidencia_url, correo_electronico,
    telefono_opcional, prioridad_score, estado
)
SELECT
    'INC-PUE-3598',
    (SELECT id_tipo FROM catalogo_tipos_problema WHERE codigo = 'P06'),
    (SELECT id_rio FROM rios_monitoreados WHERE nombre = 'Río Prieto'),
    'Río Prieto',
    'Cuautlancingo',
    'Fraccionamiento Bello Horizonte, margen del Río Prieto, Cuautlancingo, Puebla, México',
    19.0786060, -98.2728380,
    'Vecinos reportan malos olores fétidos y gases persistentes provenientes del arroyo; muestra de agua recolectada presenta coloración turbia verdosa y grasa.',
    'http://localhost:3000/uploads/INC-PUE-3598-1795595286034.jpeg',
    'comite.bellohorizonte@gmail.com', '2229146703', 3, 'Validando'
WHERE NOT EXISTS (SELECT 1 FROM reportes_usuarios WHERE folio = 'INC-PUE-3598');

INSERT INTO reportes_usuarios (
    folio, id_tipo_problema, id_rio, rio_nombre, municipio, direccion,
    latitud, longitud, descripcion, evidencia_url, correo_electronico,
    telefono_opcional, prioridad_score, estado
)
SELECT
    'INC-PUE-8215',
    (SELECT id_tipo FROM catalogo_tipos_problema WHERE codigo = 'P07'),
    (SELECT id_rio FROM rios_monitoreados WHERE nombre = 'Río Alseseca'),
    'Río Alseseca',
    'Puebla',
    'Puente de la 14 Sur y Ribera del Río Alseseca, Col. La Hacienda, Puebla, Puebla, México',
    19.0176420, -98.1871730,
    'Tiradero clandestino con acumulación de basura, llantas, envases de plástico y residuos sólidos dentro del cauce y en la ribera del río.',
    'http://localhost:3000/uploads/INC-PUE-8215-1795595289171.jpeg',
    'lahacienda.limpia@gmail.com', NULL, 2, 'Concluido'
WHERE NOT EXISTS (SELECT 1 FROM reportes_usuarios WHERE folio = 'INC-PUE-8215');

INSERT INTO reportes_usuarios (
    folio, id_tipo_problema, id_rio, rio_nombre, municipio, direccion,
    latitud, longitud, descripcion, evidencia_url, correo_electronico,
    telefono_opcional, prioridad_score, estado
)
SELECT
    'INC-PUE-6894',
    (SELECT id_tipo FROM catalogo_tipos_problema WHERE codigo = 'P02'),
    (SELECT id_rio FROM rios_monitoreados WHERE nombre = 'Río Zahuapan'),
    'Río Zahuapan',
    'Zacatelco',
    'Puente de acceso sur sobre el Río Zahuapan, Zacatelco, Tlaxcala, México',
    19.2280770, -98.3009150,
    'Descarga directa de aguas residuales desde alcantarilla en muro de piedra hacia el cauce del río, generando agua sucia, espuma y residuos flotantes.',
    'http://localhost:3000/uploads/INC-PUE-6894-1795595292308.jpeg',
    'vigilancia.zahuapan@gmail.com', '2461389204', 4, 'Dron en Verificación'
WHERE NOT EXISTS (SELECT 1 FROM reportes_usuarios WHERE folio = 'INC-PUE-6894');

-- 5. Cotizaciones para folios en despliegue / saneamiento / concluidos
INSERT INTO cotizaciones_saneamiento (id_reporte, total_estimado_mxn, detalle_conceptos, aprobada)
SELECT id_reporte, 38000.00, '[{"concepto":"Estabilización de margen / control de erosión","cantidad":1,"subtotal":19500},{"concepto":"Desazolve de cauce y liberación de taponamiento","cantidad":1,"subtotal":18500}]'::jsonb, false
FROM reportes_usuarios WHERE folio = 'PUE-2026-004'
ON CONFLICT (id_reporte) DO NOTHING;

INSERT INTO cotizaciones_saneamiento (id_reporte, total_estimado_mxn, detalle_conceptos, aprobada)
SELECT id_reporte, 18500.00, '[{"concepto":"Retiro y disposición de residuos sólidos / escombro","cantidad":2,"subtotal":13000},{"concepto":"Muestreo de laboratorio (7 parámetros CONAGUA)","cantidad":1,"subtotal":4800}]'::jsonb, true
FROM reportes_usuarios WHERE folio = 'PUE-2026-006'
ON CONFLICT (id_reporte) DO NOTHING;

INSERT INTO cotizaciones_saneamiento (
    id_reporte, requiere_cuadrilla, costo_despliegue_mxn, costo_capex_mxn,
    costo_opex_m3_mxn, costo_opex_mensual_mxn, magnitud_medida, unidad_medida,
    volumen_m3_dia, tratamiento_aplicado, total_estimado_mxn, detalle_conceptos, aprobada
)
SELECT
    id_reporte, true, 13300.00, 472500.00, 1.00, 3888.00, 1.50, 'L/s', 129.60,
    'Humedales artificiales', 489688.00,
    '[{"cantidad":1.5,"concepto":"Humedales artificiales (1.5 L/s - rango prom)","subtotal":472500},{"cantidad":1,"concepto":"Despliegue cuadrilla en campo y/o laboratorio NOM-001","subtotal":13300},{"cantidad":30,"concepto":"Operación OPEX primer mes (129.6 m³/día a $1/m³)","subtotal":3888}]'::jsonb,
    true
FROM reportes_usuarios WHERE folio = 'INC-PUE-4044'
ON CONFLICT (id_reporte) DO NOTHING;

INSERT INTO cotizaciones_saneamiento (
    id_reporte, requiere_cuadrilla, costo_despliegue_mxn, costo_capex_mxn,
    costo_opex_m3_mxn, costo_opex_mensual_mxn, magnitud_medida, unidad_medida,
    volumen_m3_dia, tratamiento_aplicado, total_estimado_mxn, detalle_conceptos, aprobada
)
SELECT
    id_reporte, true, 13300.00, 7445.00, 0.00, 0.00, 25.00, 'm3', 0.00,
    'Desazolve mecánico y retiro de residuos (por m³ CONAGUA/CMIC)', 20745.00,
    '[{"cantidad":25,"concepto":"Desazolve mecánico y retiro de residuos (por m³ CONAGUA/CMIC) (25 m3 - rango prom)","subtotal":7445},{"cantidad":1,"concepto":"Despliegue cuadrilla en campo y/o laboratorio NOM-001","subtotal":13300}]'::jsonb,
    true
FROM reportes_usuarios WHERE folio = 'INC-PUE-8215'
ON CONFLICT (id_reporte) DO NOTHING;

INSERT INTO cotizaciones_saneamiento (
    id_reporte, requiere_cuadrilla, costo_despliegue_mxn, costo_capex_mxn,
    costo_opex_m3_mxn, costo_opex_mensual_mxn, magnitud_medida, unidad_medida,
    volumen_m3_dia, tratamiento_aplicado, total_estimado_mxn, detalle_conceptos, aprobada
)
SELECT
    id_reporte, true, 5000.00, 0.00, 0.00, 0.00, 0.00, 'm3', 0.00,
    NULL, 5000.00,
    '[{"cantidad":1,"concepto":"Despliegue cuadrilla FASAR 1.55 (1 j.) + traslado","subtotal":3800},{"cantidad":1,"concepto":"Sobrevuelo dron térmico/multiespectral","subtotal":1200}]'::jsonb,
    false
FROM reportes_usuarios WHERE folio = 'INC-PUE-6894'
ON CONFLICT (id_reporte) DO NOTHING;
