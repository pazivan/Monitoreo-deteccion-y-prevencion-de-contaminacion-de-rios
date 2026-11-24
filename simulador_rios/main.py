"""
Ejemplo ejecutable de simulación 1D para el Río Atoyac (Puebla).
Compara el escenario base contra un escenario de incremento de +20% en descargas residuales.
"""

from models import RiverReach, WaterQualityState, DischargeSource, RiverModel


def ejecutar_demo() -> None:
    # Tramo representativo del Río Atoyac cruzando la Zona Metropolitana de Puebla
    tramo_atoyac = RiverReach(
        nombre="Río Atoyac · Zona Metropolitana de Puebla",
        longitud_km=25.0,
        caudal_m3_s=4.5,
        velocidad_m_s=0.45,
        profundidad_m=1.1,
        altitud_msnm=2135.0,
    )

    # Condiciones iniciales aguas arriba (punto de monitoreo base)
    estado_inicial = WaterQualityState(
        dbo5=18.0,
        dqo=38.0,
        sst=65.0,
        cf=950.0,
        e_coli=800.0,
        tox=0.9,
        od_mg_l=5.6,
        temperatura_c=18.5,
    )

    # Descargas puntuales simuladas a lo largo del cauce
    descargas = [
        DischargeSource(
            nombre="Descarga Corredor Industrial / Texmelucan",
            ubicacion_km=5.0,
            caudal_m3_s=0.85,
            tipo="industrial",
            calidad=WaterQualityState(
                dbo5=240.0, dqo=480.0, sst=260.0,
                cf=45000.0, e_coli=32000.0, tox=4.2,
                od_mg_l=1.0, temperatura_c=23.0,
            ),
        ),
        DischargeSource(
            nombre="Colector Urbano Zona Poniente",
            ubicacion_km=14.0,
            caudal_m3_s=1.10,
            tipo="municipal",
            calidad=WaterQualityState(
                dbo5=190.0, dqo=350.0, sst=210.0,
                cf=120000.0, e_coli=90000.0, tox=1.8,
                od_mg_l=1.2, temperatura_c=21.0,
            ),
        ),
    ]

    modelo = RiverModel(tramo_atoyac, estado_inicial)

    for nombre_esc, factor in [("Escenario Base (100%)", 1.0), ("Escenario +20% Descargas", 1.20)]:
        perfil = modelo.simular_tramo(descargas=descargas, pasos_por_km=2, factor_descarga=factor)
        print(f"\n=== {nombre_esc} ({tramo_atoyac.nombre}) ===")
        for punto in perfil[::10] + [perfil[-1]]:
            ind = punto["indicadores"]
            sem = punto["semaforo"]
            print(
                f"km {punto['km']:5.1f} | DBO5: {ind['dbo5']:6.1f} mg/L | "
                f"OD: {punto['od_mg_l']:4.2f} mg/L ({ind['od_sat']:5.1f}%) | "
                f"E.coli: {ind['e_coli']:8.0f} | "
                f"Semáforo: {sem['color']:8s} ({sem['etiqueta']}, crítico: {sem['parametro_critico']})"
            )


if __name__ == "__main__":
    ejecutar_demo()
