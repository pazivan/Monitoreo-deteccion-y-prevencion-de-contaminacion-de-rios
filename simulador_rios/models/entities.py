"""
Entidades de dominio alineadas al futuro esquema PostgreSQL + PostGIS:
  - RiverReach        -> tabla `tramos_rio`
  - WaterQualityState -> tabla `puntos_monitoreo` / resultados de simulación
  - DischargeSource   -> tabla `fuentes_descarga`
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class WaterQualityState:
    """Vector de los 7 indicadores oficiales de la CONAGUA + temperatura y OD en mg/L."""
    dbo5: float            # Demanda Bioquímica de Oxígeno a 5 días (mg/L)
    dqo: float             # Demanda Química de Oxígeno (mg/L)
    sst: float             # Sólidos Suspendidos Totales (mg/L)
    cf: float              # Coliformes Fecales (NMP/100 mL)
    e_coli: float          # Escherichia coli (NMP/100 mL)
    tox: float             # Toxicidad Aguda (UT)
    od_mg_l: float         # Oxígeno Disuelto (mg/L)
    temperatura_c: float = 18.5  # Temperatura promedio del agua en Puebla (°C)


@dataclass
class RiverReach:
    """Parámetros hidráulicos, geográficos y cinéticos de un tramo de río 1D."""
    nombre: str
    longitud_km: float               # Longitud total del tramo (km)
    caudal_m3_s: float               # Caudal base del río Q_r (m³/s)
    velocidad_m_s: float             # Velocidad media de flujo v (m/s)
    profundidad_m: float = 1.2       # Profundidad hidráulica media H (m)
    altitud_msnm: float = 2135.0     # Altitud media de Puebla (m s.n.m.)
    # Constantes cinéticas de referencia a 20 °C (d⁻¹)
    kd_20: float = 0.35              # Desoxigenación de DBO (d⁻¹)
    ka_20: Optional[float] = None    # Reaireación (d⁻¹); si es None se calcula con O'Connor-Dobbins
    k_dqo_20: float = 0.20           # Degradación de fracción biodegradable de DQO (d⁻¹)
    fraccion_dqo_refractaria: float = 0.35  # Fracción no biodegradable de DQO
    k_sst_20: float = 0.25           # Sedimentación neta de SST (d⁻¹)
    k_cf_20: float = 1.20            # Decaimiento de Coliformes Fecales (d⁻¹)
    k_ecoli_20: float = 1.40         # Decaimiento de E. coli (d⁻¹)
    k_tox_20: float = 0.15           # Atenuación / degradación de toxicidad aguda (d⁻¹)
    osm_way_id: Optional[int] = None


@dataclass
class DischargeSource:
    """Descarga puntual de aguas residuales municipales o industriales sobre el tramo."""
    nombre: str
    ubicacion_km: float              # Distancia desde el inicio del tramo (km)
    caudal_m3_s: float               # Caudal de descarga Q_d (m³/s)
    calidad: WaterQualityState       # Concentraciones de la descarga
    tipo: str = "municipal"          # 'municipal' | 'industrial' | 'agricola'
