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

-- 4. Reportes ciudadanos iniciales georreferenciados (PostGIS)
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
    'https://images.unsplash.com/photo-1618477388954-7852f32655ec?auto=format&fit=crop&q=80&w=600',
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
    'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&q=80&w=600',
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
    'https://images.unsplash.com/photo-1584824486509-112e4181ff6b?auto=format&fit=crop&q=80&w=600',
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
    'https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&q=80&w=600',
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
    'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&q=80&w=600',
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
    'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&q=80&w=600',
    'parques.puebla@ceaspue.gob.mx', '2221122334', 2, 'Concluido'
WHERE NOT EXISTS (SELECT 1 FROM reportes_usuarios WHERE folio = 'PUE-2026-006');

-- 5. Cotizaciones para folios en saneamiento / concluidos
INSERT INTO cotizaciones_saneamiento (id_reporte, total_estimado_mxn, detalle_conceptos, aprobada)
SELECT id_reporte, 38000.00, '[{"concepto":"Estabilización de margen / control de erosión","cantidad":1,"subtotal":19500},{"concepto":"Desazolve de cauce y liberación de taponamiento","cantidad":1,"subtotal":18500}]'::jsonb, false
FROM reportes_usuarios WHERE folio = 'PUE-2026-004'
ON CONFLICT (id_reporte) DO NOTHING;

INSERT INTO cotizaciones_saneamiento (id_reporte, total_estimado_mxn, detalle_conceptos, aprobada)
SELECT id_reporte, 18500.00, '[{"concepto":"Retiro y disposición de residuos sólidos / escombro","cantidad":2,"subtotal":13000},{"concepto":"Muestreo de laboratorio (7 parámetros CONAGUA)","cantidad":1,"subtotal":4800}]'::jsonb, true
FROM reportes_usuarios WHERE folio = 'PUE-2026-006'
ON CONFLICT (id_reporte) DO NOTHING;
