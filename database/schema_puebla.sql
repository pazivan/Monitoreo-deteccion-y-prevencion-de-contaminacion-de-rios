-- ============================================================================
-- ESQUEMA MODULAR DE BASE DE DATOS - MONITOREO Y SANEAMIENTO DE RÍOS (PUEBLA)
-- Motor: PostgreSQL 15+ con PostGIS (SRID 4326 - WGS 84)
-- Nota: Archivo de diseño listo para ejecutar mañana en PostgreSQL.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- ----------------------------------------------------------------------------
-- MÓDULO 1: CATÁLOGOS ESTANDARIZADOS Y RÍOS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rios_monitoreados (
    id_rio              SERIAL PRIMARY KEY,
    nombre              VARCHAR(100) NOT NULL UNIQUE, -- Río Atoyac, Alseseca, Zahuapan, Nexapa, Prieto
    caudal_base_m3_s    DOUBLE PRECISION NOT NULL,
    velocidad_media_m_s DOUBLE PRECISION NOT NULL,
    profundidad_m       DOUBLE PRECISION DEFAULT 1.2,
    altitud_msnm        DOUBLE PRECISION DEFAULT 2135.0,
    area_cuenca_km2     DOUBLE PRECISION NOT NULL,
    geom                GEOMETRY(MultiLineString, 4326)
);

CREATE TABLE IF NOT EXISTS catalogo_tipos_problema (
    id_tipo             SERIAL PRIMARY KEY,
    codigo              VARCHAR(20) NOT NULL UNIQUE,
    nombre              VARCHAR(120) NOT NULL UNIQUE, -- Los 7 tipos estandarizados del portal ciudadano
    severidad_base      INT NOT NULL CHECK (severidad_base BETWEEN 1 AND 5), -- Para ordenar de mayor a menor problema
    descripcion_tecnica TEXT
);

INSERT INTO catalogo_tipos_problema (codigo, nombre, severidad_base) VALUES
('P01', 'Vertido químico o industrial', 5),
('P02', 'Descarga de aguas residuales', 4),
('P03', 'Desbordamiento o erosión de ribera', 4),
('P04', 'Escombros o taponamiento del río', 4),
('P05', 'Espuma, manchas o cambio de color', 3),
('P06', 'Malos olores o gases tóxicos', 3),
('P07', 'Basura y residuos en cauce', 2)
ON CONFLICT (codigo) DO NOTHING;

-- ----------------------------------------------------------------------------
-- MÓDULO 2: REPORTES CIUDADANOS (Primera tabla principal solicitada)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reportes_usuarios (
    id_reporte          SERIAL PRIMARY KEY,
    folio               VARCHAR(30) NOT NULL UNIQUE,
    id_tipo_problema    INT NOT NULL REFERENCES catalogo_tipos_problema(id_tipo),
    id_rio              INT REFERENCES rios_monitoreados(id_rio),
    rio_nombre          VARCHAR(100) NOT NULL,
    municipio           VARCHAR(120) NOT NULL,
    direccion           TEXT NOT NULL,
    latitud             DECIMAL(10, 7) NOT NULL,
    longitud            DECIMAL(10, 7) NOT NULL,
    geom                GEOMETRY(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitud::double precision, latitud::double precision), 4326)) STORED,
    descripcion         TEXT NOT NULL,
    evidencia_url       TEXT,
    correo_electronico  VARCHAR(150) NOT NULL, -- Obligatorio para acuse y avisos de revisión
    telefono_opcional   VARCHAR(25),           -- Opcional (WhatsApp API es de paga)
    prioridad_score     INT NOT NULL DEFAULT 3 CHECK (prioridad_score BETWEEN 1 AND 5),
    estado              VARCHAR(40) NOT NULL DEFAULT 'Validando',
    -- 'Validando' | 'Dron en Verificación' | 'Cuadrilla Desplegada' | 'Cotizado / En Saneamiento' | 'Concluido'
    notificado_recibo   BOOLEAN DEFAULT FALSE,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reportes_geom ON reportes_usuarios USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_reportes_prioridad ON reportes_usuarios (prioridad_score DESC, fecha_creacion DESC);

-- ----------------------------------------------------------------------------
-- MÓDULO 3: CONCIENTIZACIÓN EDITABLE EN CALIENTE (CMS ligero)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contenido_concientizacion (
    id_contenido        SERIAL PRIMARY KEY,
    seccion             VARCHAR(50) NOT NULL,  -- 'hero' | 'senales_alerta' | 'contexto' | 'rio_ficha' | 'consejo'
    titulo              VARCHAR(200) NOT NULL,
    subtitulo           VARCHAR(250),
    cuerpo_texto        TEXT NOT NULL,
    icono_material      VARCHAR(60) DEFAULT 'eco',
    orden_visual        INT NOT NULL DEFAULT 1,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    actualizado_por     VARCHAR(100),
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- MÓDULO 4: PERSONAL, CUADRILLAS, DRON DE APOYO Y COTIZACIÓN DE DAÑOS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios_sistema (
    id_usuario          SERIAL PRIMARY KEY,
    nombre_completo     VARCHAR(150) NOT NULL,
    usuario             VARCHAR(80) NOT NULL UNIQUE,
    correo              VARCHAR(150) NOT NULL UNIQUE,
    password_hash       TEXT NOT NULL, -- Hash bcrypt/argon2 (nunca texto plano)
    rol                 VARCHAR(40) NOT NULL CHECK (rol IN ('ADMIN', 'SUPERVISOR_CUADRILLAS', 'OPERADOR_DRON', 'ANALISTA')),
    activo              BOOLEAN DEFAULT TRUE,
    creado_en           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drones (
    id_dron             SERIAL PRIMARY KEY,
    identificador       VARCHAR(50) NOT NULL UNIQUE, -- ej. DRON-PUE-01
    modelo              VARCHAR(100) NOT NULL,
    tiene_camara_term   BOOLEAN DEFAULT FALSE,
    estado              VARCHAR(30) DEFAULT 'Disponible'
);

CREATE TABLE IF NOT EXISTS cuadrillas (
    id_cuadrilla        SERIAL PRIMARY KEY,
    nombre              VARCHAR(120) NOT NULL,
    especialidad        VARCHAR(100) NOT NULL, -- 'Saneamiento Químico', 'Desazolve y Residuos', 'Sellado de Descargas'
    id_encargado        INT REFERENCES usuarios_sistema(id_usuario),
    zona_asignada       VARCHAR(100),
    disponible          BOOLEAN DEFAULT TRUE
);

-- El dron funciona como herramienta de apoyo visual; la cuadrilla especializada confirma los daños
CREATE TABLE IF NOT EXISTS inspecciones_campo (
    id_inspeccion       SERIAL PRIMARY KEY,
    id_reporte          INT NOT NULL REFERENCES reportes_usuarios(id_reporte) ON DELETE CASCADE,
    id_dron             INT REFERENCES drones(id_dron),
    evidencia_dron_url  TEXT,
    observacion_dron    TEXT,
    id_cuadrilla        INT REFERENCES cuadrillas(id_cuadrilla),
    id_encargado        INT REFERENCES usuarios_sistema(id_usuario),
    confirmado_en_sitio BOOLEAN DEFAULT FALSE,
    dictamen_cuadrilla  TEXT,
    fecha_despliegue    TIMESTAMPTZ,
    fecha_confirmacion  TIMESTAMPTZ
);

-- Catálogo de daños y costos unitarios operativos (CMIC / CONAGUA / EMA)
CREATE TABLE IF NOT EXISTS catalogo_danos_saneamiento (
    id_dano             SERIAL PRIMARY KEY,
    concepto            VARCHAR(150) NOT NULL UNIQUE,
    unidad              VARCHAR(40) NOT NULL, -- 'jornada', 'muestra', 'm3', 'barrera', 'descarga'
    costo_unitario_mxn  NUMERIC(12, 2) NOT NULL,
    fuente_referencia   VARCHAR(150) DEFAULT 'Tabulador Técnico CEASPUE'
);

-- Matriz oficial de tratamientos CAPEX / OPEX (Excel Base + Tabulador CONAGUA / CMIC)
CREATE TABLE IF NOT EXISTS matriz_costos_saneamiento (
    id_matriz               SERIAL PRIMARY KEY,
    incidencia_categoria    VARCHAR(120) NOT NULL,
    tratamiento             VARCHAR(180) NOT NULL,
    capex_min_mxn           NUMERIC(14, 2) NOT NULL,
    capex_max_mxn           NUMERIC(14, 2) NOT NULL,
    capex_prom_mxn          NUMERIC(14, 2) NOT NULL,
    unidad_capex            VARCHAR(100) NOT NULL,
    unidad_medida_corta     VARCHAR(25) NOT NULL, -- 'L/s', 'm3', 'barrera', 'equipo', 'm2', 'ha', 'km', 'campana'
    opex_min_m3             NUMERIC(10, 2),
    opex_max_m3             NUMERIC(10, 2),
    costo_directo_m3_mxn    NUMERIC(10, 2),       -- Costo unitario real por m3 (ej. desazolve CONAGUA $182.81 + acarreo $115)
    observaciones           TEXT,
    fuente_datos            VARCHAR(150) DEFAULT 'Matriz Excel Base + CONAGUA/CMIC',
    UNIQUE (incidencia_categoria, tratamiento)
);

CREATE TABLE IF NOT EXISTS cotizaciones_saneamiento (
    id_cotizacion           SERIAL PRIMARY KEY,
    id_reporte              INT NOT NULL UNIQUE REFERENCES reportes_usuarios(id_reporte) ON DELETE CASCADE,
    id_inspeccion           INT REFERENCES inspecciones_campo(id_inspeccion),
    requiere_cuadrilla      BOOLEAN DEFAULT TRUE,
    costo_despliegue_mxn    NUMERIC(14, 2) NOT NULL DEFAULT 0,
    costo_capex_mxn         NUMERIC(14, 2) NOT NULL DEFAULT 0,
    costo_opex_m3_mxn       NUMERIC(10, 2) NOT NULL DEFAULT 0,
    costo_opex_mensual_mxn  NUMERIC(14, 2) NOT NULL DEFAULT 0,
    magnitud_medida         NUMERIC(12, 2) DEFAULT 0,
    unidad_medida           VARCHAR(40) DEFAULT 'm3',
    volumen_m3_dia          NUMERIC(14, 2) DEFAULT 0,
    tratamiento_aplicado    VARCHAR(180),
    total_estimado_mxn      NUMERIC(14, 2) NOT NULL DEFAULT 0,
    detalle_conceptos       JSONB NOT NULL DEFAULT '[]'::jsonb,
    aprobada                BOOLEAN DEFAULT FALSE,
    creada_en               TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- MÓDULO 5: HISTÓRICO PARA PREDICCIÓN (CALIDAD + CLIMA) Y REPORTES PDF
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS historico_parametros_rios (
    id_registro         SERIAL PRIMARY KEY,
    id_rio              INT NOT NULL REFERENCES rios_monitoreados(id_rio),
    fecha_muestreo      TIMESTAMPTZ NOT NULL,
    km_rio              DOUBLE PRECISION NOT NULL,
    caudal_m3_s         DOUBLE PRECISION,
    temperatura_c       DOUBLE PRECISION,
    dbo5_mg_l           DOUBLE PRECISION,
    dqo_mg_l            DOUBLE PRECISION,
    sst_mg_l            DOUBLE PRECISION,
    cf_nmp_100ml        DOUBLE PRECISION,
    e_coli_nmp_100ml    DOUBLE PRECISION,
    tox_ut              DOUBLE PRECISION,
    od_sat_pct          DOUBLE PRECISION,
    semaforo_conagua    VARCHAR(30)
);
CREATE INDEX IF NOT EXISTS idx_hist_rio_fecha ON historico_parametros_rios (id_rio, fecha_muestreo DESC);

CREATE TABLE IF NOT EXISTS clima_historico (
    id_clima            SERIAL PRIMARY KEY,
    fecha_hora          TIMESTAMPTZ NOT NULL,
    lluvia_mm_h         DOUBLE PRECISION NOT NULL DEFAULT 0,
    temperatura_c       DOUBLE PRECISION,
    fuente              VARCHAR(60) DEFAULT 'Open-Meteo'
);

CREATE TABLE IF NOT EXISTS reportes_pdf_emitidos (
    id_pdf              SERIAL PRIMARY KEY,
    codigo_documento    VARCHAR(50) NOT NULL UNIQUE,
    titulo              VARCHAR(200) NOT NULL,
    total_casos         INT NOT NULL,
    monto_total_mxn     NUMERIC(14, 2) DEFAULT 0,
    emitido_por         INT REFERENCES usuarios_sistema(id_usuario),
    fecha_emision       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
