"""
Motor Matemático 1D de Calidad del Agua para Ríos de Puebla.

Implementa:
  1. Saturación de oxígeno disuelto ajustada por temperatura y altitud barométrica (Puebla ~2,135 m s.n.m.).
  2. Corrección de constantes cinéticas por temperatura (Arrhenius / van't Hoff).
  3. Coeficiente de reaireación k_a (O'Connor-Dobbins) cuando no se provee calibrado.
  4. Balance de masa instantáneo en cada fuente de descarga puntual.
  5. Ecuación diferencial acoplada de Streeter-Phelps (DBO última y déficit de OD) resuelta con `scipy.integrate.odeint`.
  6. Cinética de decaimiento de primer orden para DBO5, DQO, SST, CF, E. coli y Toxicidad Aguda.
  7. Clasificación oficial mediante el Semáforo de la CONAGUA.
"""

from typing import List, Dict, Any, Tuple
import numpy as np
from scipy.integrate import odeint

from config.conagua_thresholds import evaluar_semaforo_conagua
from models.entities import RiverReach, WaterQualityState, DischargeSource


class RiverModel:
    # Coeficientes térmicos estándar de Arrhenius (θ)
    THETA_KD = 1.047
    THETA_KA = 1.024
    THETA_BACTERIA = 1.070
    THETA_GENERAL = 1.040

    def __init__(self, reach: RiverReach, initial_state: WaterQualityState):
        self.reach = reach
        self.initial_state = initial_state

    @staticmethod
    def calcular_od_saturacion(temperatura_c: float, altitud_msnm: float = 2135.0) -> float:
        """
        Calcula la concentración de saturación de Oxígeno Disuelto OD_sat (mg/L)
        usando la ecuación polinómica APHA/Benson-Krause a nivel del mar y
        corrección barométrica estándar por altitud.
        """
        t_k = temperatura_c + 273.15
        ln_od_sea = (
            -139.34411
            + (1.575701e5 / t_k)
            - (6.642308e7 / (t_k ** 2))
            + (1.243800e10 / (t_k ** 3))
            - (8.621949e11 / (t_k ** 4))
        )
        od_sea_level = float(np.exp(ln_od_sea))

        # Factor de presión barométrica relativa P(H) / P0
        factor_presion = (1.0 - 2.25577e-5 * altitud_msnm) ** 5.25588
        return od_sea_level * factor_presion

    @staticmethod
    def ajustar_temperatura(k_20: float, theta: float, temperatura_c: float) -> float:
        """Corrección de Arrhenius: k(T) = k_20 * theta^(T - 20)."""
        return k_20 * (theta ** (temperatura_c - 20.0))

    def obtener_ka(self, temperatura_c: float) -> float:
        """
        Devuelve la constante de reaireación k_a(T) en d⁻¹.
        Si no se especificó ka_20, aplica la ecuación empírica de O'Connor-Dobbins:
            ka_20 = 3.93 * (v^0.5) / (H^1.5)
        """
        if self.reach.ka_20 is not None:
            ka_20 = self.reach.ka_20
        else:
            v = max(self.reach.velocidad_m_s, 0.05)
            h = max(self.reach.profundidad_m, 0.15)
            ka_20 = 3.93 * (v ** 0.5) / (h ** 1.5)
        return self.ajustar_temperatura(ka_20, self.THETA_KA, temperatura_c)

    @staticmethod
    def mezclar_descarga(
        q_rio: float,
        estado_rio: WaterQualityState,
        descarga: DischargeSource,
        factor_escenario: float = 1.0,
    ) -> Tuple[float, WaterQualityState]:
        """
        Balance de masa conservativo en el punto de descarga:
            C_mezcla = (Q_r * C_r + Q_d * C_d) / (Q_r + Q_d)
        `factor_escenario` permite simular escenarios "¿Qué pasa si?" (ej. 1.20 = +20% caudal de descarga).
        """
        q_d = descarga.caudal_m3_s * factor_escenario
        q_total = q_rio + q_d
        if q_total <= 0:
            raise ValueError("El caudal total debe ser mayor a cero.")

        def mix(c_r: float, c_d: float) -> float:
            return (q_rio * c_r + q_d * c_d) / q_total

        d = descarga.calidad
        nuevo_estado = WaterQualityState(
            dbo5=mix(estado_rio.dbo5, d.dbo5),
            dqo=mix(estado_rio.dqo, d.dqo),
            sst=mix(estado_rio.sst, d.sst),
            cf=mix(estado_rio.cf, d.cf),
            e_coli=mix(estado_rio.e_coli, d.e_coli),
            tox=mix(estado_rio.tox, d.tox),
            od_mg_l=mix(estado_rio.od_mg_l, d.od_mg_l),
            temperatura_c=mix(estado_rio.temperatura_c, d.temperatura_c),
        )
        return q_total, nuevo_estado

    @staticmethod
    def _sistema_streeter_phelps(y: np.ndarray, t: float, kd: float, ka: float) -> List[float]:
        """
        Sistema EDO de Streeter-Phelps:
            dL/dt = -kd * L
            dD/dt =  kd * L - ka * D
        donde L = DBO última (mg/L) y D = Déficit de Oxígeno Disuelto (mg/L).
        """
        L, D = y
        dL_dt = -kd * L
        dD_dt = kd * L - ka * D
        return [dL_dt, dD_dt]

    def calcular_degradacion_dbo(self, dbo5_0: float, t_dias: np.ndarray, temperatura_c: float) -> np.ndarray:
        """Cinética de primer orden para DBO5(t) = DBO5_0 * exp(-kd(T) * t)."""
        kd = self.ajustar_temperatura(self.reach.kd_20, self.THETA_KD, temperatura_c)
        return dbo5_0 * np.exp(-kd * t_dias)

    def calcular_decaimiento_ecoli(self, ecoli_0: float, t_dias: np.ndarray, temperatura_c: float) -> np.ndarray:
        """Ley de Chick de primer orden para E. coli(t) = E.coli_0 * exp(-kb(T) * t)."""
        k_ec = self.ajustar_temperatura(self.reach.k_ecoli_20, self.THETA_BACTERIA, temperatura_c)
        return ecoli_0 * np.exp(-k_ec * t_dias)

    def calcular_curva_oxigeno_streeter_phelps(
        self,
        dbo5_0: float,
        od_0: float,
        t_dias: np.ndarray,
        temperatura_c: float,
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, float]:
        """
        Resuelve numéricamente la curva de abatimiento de oxígeno (Streeter-Phelps)
        con `scipy.integrate.odeint`.

        Retorna:
            (L_ultima, od_mg_l, porcentaje_od_sat, od_sat)
        """
        kd = self.ajustar_temperatura(self.reach.kd_20, self.THETA_KD, temperatura_c)
        ka = self.obtener_ka(temperatura_c)
        od_sat = self.calcular_od_saturacion(temperatura_c, self.reach.altitud_msnm)

        # Conversión de DBO5 a DBO última L0: DBO5 = L0 * (1 - exp(-5 * kd))
        denom = max(1.0 - np.exp(-5.0 * kd), 1e-6)
        L_0 = dbo5_0 / denom
        D_0 = max(od_sat - od_0, 0.0)

        sol = odeint(self._sistema_streeter_phelps, [L_0, D_0], t_dias, args=(kd, ka))
        L_t = np.maximum(sol[:, 0], 0.0)
        D_t = np.maximum(sol[:, 1], 0.0)

        od_t = np.clip(od_sat - D_t, 0.0, od_sat * 1.5)
        od_sat_pct = (od_t / od_sat) * 100.0
        return L_t, od_t, od_sat_pct, od_sat

    def simular_tramo(
        self,
        descargas: List[DischargeSource] | None = None,
        pasos_por_km: int = 4,
        factor_descarga: float = 1.0,
    ) -> List[Dict[str, Any]]:
        """
        Simula el perfil longitudinal 1D completo a lo largo del tramo de río,
        aplicando balance de masa en cada descarga puntual y evaluando el semáforo CONAGUA.
        """
        descargas_ordenadas = sorted(descargas or [], key=lambda d: d.ubicacion_km)
        puntos_corte = [0.0] + [
            d.ubicacion_km for d in descargas_ordenadas if 0.0 < d.ubicacion_km < self.reach.longitud_km
        ] + [self.reach.longitud_km]
        puntos_corte = sorted(set(puntos_corte))

        # Descargas justo en km 0 se mezclan antes de iniciar
        q_actual = self.reach.caudal_m3_s
        estado_actual = self.initial_state
        for d in descargas_ordenadas:
            if np.isclose(d.ubicacion_km, 0.0):
                q_actual, estado_actual = self.mezclar_descarga(q_actual, estado_actual, d, factor_descarga)

        velocidad_km_dia = self.reach.velocidad_m_s * 86.4  # 1 m/s = 86.4 km/día
        resultados: List[Dict[str, Any]] = []

        for idx in range(len(puntos_corte) - 1):
            x_ini = puntos_corte[idx]
            x_fin = puntos_corte[idx + 1]
            delta_km = x_fin - x_ini
            if delta_km <= 0:
                continue

            # Mezclar descargas ubicadas en x_ini (si x_ini > 0)
            if x_ini > 0:
                for d in descargas_ordenadas:
                    if np.isclose(d.ubicacion_km, x_ini):
                        q_actual, estado_actual = self.mezclar_descarga(q_actual, estado_actual, d, factor_descarga)

            n_pts = max(int(np.ceil(delta_km * pasos_por_km)) + 1, 2)
            x_sub = np.linspace(x_ini, x_fin, n_pts)
            t_dias = (x_sub - x_ini) / velocidad_km_dia
            temp = estado_actual.temperatura_c

            # 1. Streeter-Phelps (OD y DBO última) + DBO5
            _, od_t, od_sat_pct, od_sat = self.calcular_curva_oxigeno_streeter_phelps(
                estado_actual.dbo5, estado_actual.od_mg_l, t_dias, temp
            )
            dbo5_t = self.calcular_degradacion_dbo(estado_actual.dbo5, t_dias, temp)

            # 2. Cinéticas de primer orden para los otros 5 indicadores CONAGUA
            k_dqo = self.ajustar_temperatura(self.reach.k_dqo_20, self.THETA_GENERAL, temp)
            dqo_nb = estado_actual.dqo * self.reach.fraccion_dqo_refractaria
            dqo_t = dqo_nb + (estado_actual.dqo - dqo_nb) * np.exp(-k_dqo * t_dias)

            k_sst = self.ajustar_temperatura(self.reach.k_sst_20, self.THETA_GENERAL, temp)
            sst_t = estado_actual.sst * np.exp(-k_sst * t_dias)

            k_cf = self.ajustar_temperatura(self.reach.k_cf_20, self.THETA_BACTERIA, temp)
            cf_t = estado_actual.cf * np.exp(-k_cf * t_dias)

            ecoli_t = self.calcular_decaimiento_ecoli(estado_actual.e_coli, t_dias, temp)

            k_tox = self.ajustar_temperatura(self.reach.k_tox_20, self.THETA_GENERAL, temp)
            tox_t = estado_actual.tox * np.exp(-k_tox * t_dias)

            # Evitar duplicar el punto inicial si no es el primer sub-tramo
            start_i = 0 if idx == 0 else 1
            for i in range(start_i, n_pts):
                indicadores = {
                    "dbo5": float(dbo5_t[i]),
                    "dqo": float(dqo_t[i]),
                    "sst": float(sst_t[i]),
                    "cf": float(cf_t[i]),
                    "e_coli": float(ecoli_t[i]),
                    "tox": float(tox_t[i]),
                    "od_sat": float(od_sat_pct[i]),
                }
                semaforo = evaluar_semaforo_conagua(indicadores)
                resultados.append({
                    "km": round(float(x_sub[i]), 3),
                    "caudal_m3_s": round(q_actual, 3),
                    "od_mg_l": round(float(od_t[i]), 3),
                    "od_sat_mg_l": round(od_sat, 3),
                    "indicadores": {k: round(v, 3) for k, v in indicadores.items()},
                    "semaforo": semaforo["semaforo_global"],
                    "semaforo_detalle": semaforo["detalle"],
                })

            # Actualizar estado al final del sub-tramo para encadenar con el siguiente
            estado_actual = WaterQualityState(
                dbo5=float(dbo5_t[-1]),
                dqo=float(dqo_t[-1]),
                sst=float(sst_t[-1]),
                cf=float(cf_t[-1]),
                e_coli=float(ecoli_t[-1]),
                tox=float(tox_t[-1]),
                od_mg_l=float(od_t[-1]),
                temperatura_c=temp,
            )

        return resultados
