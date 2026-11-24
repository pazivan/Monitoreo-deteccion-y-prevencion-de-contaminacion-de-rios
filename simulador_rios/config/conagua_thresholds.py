"""
Clasificación oficial del Semáforo de Calidad del Agua (CONAGUA - RENAMECA)
para los 7 indicadores oficiales:
  1. DBO5 (mg/L)
  2. DQO (mg/L)
  3. SST (mg/L)
  4. Coliformes Fecales - CF (NMP/100 mL)
  5. Escherichia coli - E_COLI (NMP/100 mL)
  6. Toxicidad Aguda - TOX (UT - Unidades de Toxicidad)
  7. Porcentaje de Saturación de Oxígeno Disuelto - OD_SAT (%)
"""

from dataclasses import dataclass
from typing import Dict, Any


@dataclass(frozen=True)
class SemaphoreLevel:
    nivel: int          # 1 (mejor) a 5 (peor)
    etiqueta: str
    color_nombre: str
    color_hex: str


EXCELENTE = SemaphoreLevel(1, "Excelente", "Azul", "#0284c7")
BUENA = SemaphoreLevel(2, "Buena Calidad", "Verde", "#16a34a")
ACEPTABLE = SemaphoreLevel(3, "Aceptable", "Amarillo", "#eab308")
CONTAMINADA = SemaphoreLevel(4, "Contaminada", "Naranja", "#f97316")
FUERTEMENTE_CONTAMINADA = SemaphoreLevel(5, "Fuertemente Contaminada", "Rojo", "#dc2626")


def clasificar_dbo5(valor_mg_l: float) -> SemaphoreLevel:
    if valor_mg_l <= 3.0:
        return EXCELENTE
    if valor_mg_l <= 6.0:
        return BUENA
    if valor_mg_l <= 30.0:
        return ACEPTABLE
    if valor_mg_l <= 120.0:
        return CONTAMINADA
    return FUERTEMENTE_CONTAMINADA


def clasificar_dqo(valor_mg_l: float) -> SemaphoreLevel:
    if valor_mg_l <= 10.0:
        return EXCELENTE
    if valor_mg_l <= 20.0:
        return BUENA
    if valor_mg_l <= 40.0:
        return ACEPTABLE
    if valor_mg_l <= 200.0:
        return CONTAMINADA
    return FUERTEMENTE_CONTAMINADA


def clasificar_sst(valor_mg_l: float) -> SemaphoreLevel:
    if valor_mg_l <= 25.0:
        return EXCELENTE
    if valor_mg_l <= 75.0:
        return BUENA
    if valor_mg_l <= 150.0:
        return ACEPTABLE
    if valor_mg_l <= 400.0:
        return CONTAMINADA
    return FUERTEMENTE_CONTAMINADA


def clasificar_coliformes(valor_nmp_100ml: float) -> SemaphoreLevel:
    """Aplica a Coliformes Fecales (CF) y E. coli (NMP/100 mL) según criterios CONAGUA."""
    if valor_nmp_100ml <= 100.0:
        return EXCELENTE
    if valor_nmp_100ml <= 200.0:
        return BUENA
    if valor_nmp_100ml <= 1000.0:
        return ACEPTABLE
    if valor_nmp_100ml <= 10000.0:
        return CONTAMINADA
    return FUERTEMENTE_CONTAMINADA


def clasificar_toxicidad(valor_ut: float) -> SemaphoreLevel:
    """Toxicidad aguda (UT - Daphnia magna / Vibrio fischeri)."""
    if valor_ut < 1.0:
        return EXCELENTE
    if valor_ut <= 1.33:
        return BUENA
    if valor_ut <= 2.0:
        return ACEPTABLE
    if valor_ut <= 5.0:
        return CONTAMINADA
    return FUERTEMENTE_CONTAMINADA


def clasificar_od_saturacion(porcentaje_od: float) -> SemaphoreLevel:
    """
    Clasificación CONAGUA para % de Saturación de Oxígeno Disuelto (%OD).
    Penaliza tanto hipoxia (<70%) como sobresaturación eutrófica (>110%).
    """
    if 70.0 < porcentaje_od <= 110.0:
        return EXCELENTE
    if (50.0 < porcentaje_od <= 70.0) or (110.0 < porcentaje_od <= 120.0):
        return BUENA
    if (30.0 < porcentaje_od <= 50.0) or (120.0 < porcentaje_od <= 130.0):
        return ACEPTABLE
    if (10.0 < porcentaje_od <= 30.0) or (130.0 < porcentaje_od <= 150.0):
        return CONTAMINADA
    return FUERTEMENTE_CONTAMINADA


def evaluar_semaforo_conagua(indicadores: Dict[str, float]) -> Dict[str, Any]:
    """
    Evalúa los 7 indicadores oficiales de la CONAGUA y retorna el semáforo
    por parámetro más el semáforo global (regla oficial del peor indicador).

    Claves esperadas en `indicadores`:
      - dbo5 (mg/L)
      - dqo (mg/L)
      - sst (mg/L)
      - cf (NMP/100 mL)
      - e_coli (NMP/100 mL)
      - tox (UT)
      - od_sat (%)
    """
    clasificadores = {
        "dbo5": clasificar_dbo5,
        "dqo": clasificar_dqo,
        "sst": clasificar_sst,
        "cf": clasificar_coliformes,
        "e_coli": clasificar_coliformes,
        "tox": clasificar_toxicidad,
        "od_sat": clasificar_od_saturacion,
    }

    detalle: Dict[str, Dict[str, Any]] = {}
    peor_nivel = EXCELENTE
    parametro_critico = None

    for clave, fn in clasificadores.items():
        if clave not in indicadores:
            continue
        valor = float(indicadores[clave])
        nivel = fn(valor)
        detalle[clave] = {
            "valor": round(valor, 3),
            "etiqueta": nivel.etiqueta,
            "color": nivel.color_nombre,
            "hex": nivel.color_hex,
            "nivel": nivel.nivel,
        }
        if nivel.nivel > peor_nivel.nivel:
            peor_nivel = nivel
            parametro_critico = clave

    return {
        "semaforo_global": {
            "etiqueta": peor_nivel.etiqueta,
            "color": peor_nivel.color_nombre,
            "hex": peor_nivel.color_hex,
            "nivel": peor_nivel.nivel,
            "parametro_critico": parametro_critico,
        },
        "detalle": detalle,
    }
