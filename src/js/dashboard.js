/**
 * Lógica del Panel Receptor de Quejas Ambientales (Puebla)
 */
const API_BASE = 'http://localhost:3000';
let reportesDB = [];
let estadoFiltro = "";
let reporteSeleccionado = null;

// 1. Mapa interactivo de ríos de Puebla (restringido al área de Puebla)
const dashMap = window.RiosPueblaMap.crearMapaPuebla('dashboard-map');

const { capaCalles } = window.RiosPueblaMap.crearCapasBase();
capaCalles.addTo(dashMap);

window.RiosPueblaMap.cargarRiosGeoJSON(dashMap, { paneName: 'dashRiosPane' })
    .catch(err => console.warn('No se pudo cargar rios-puebla.geojson en dashboard:', err));

const marcadoresLayerGroup = L.layerGroup().addTo(dashMap);
const marcadoresPorFolio = new Map();
const climaLayerGroup = L.layerGroup();
let mostrarClimaEnMapa = false;
let ultimosDatosClima = null;
setTimeout(() => dashMap.invalidateSize(), 300);

// 2. Carga de reportes desde PostgreSQL
const tabla = document.getElementById('tabla-prioridades');
const buscador = document.getElementById('buscador-calles');

window.cargarDatos = async function () {
    try {
        const response = await fetch(`${API_BASE}/api/reportes`);
        const data = await response.json();

        if (response.ok) {
            reportesDB = data;
            actualizarContadores();
            renderizarTabla(buscador ? buscador.value : "");
            if (reportesDB.length > 0 && !reporteSeleccionado) {
                seleccionarCalle(reportesDB[0].id, { enfocarMapa: false, recrearPines: false });
            }
        } else {
            console.error("Error del backend:", data.error);
            tabla.innerHTML = `<tr><td colspan="4" class="px-6 py-12 text-center text-red-600 font-medium">Error al consultar reportes: ${data.error || 'Error del servidor'}</td></tr>`;
        }
    } catch (error) {
        console.error("No se pudo conectar con la BD:", error);
        tabla.innerHTML = `<tr><td colspan="4" class="px-6 py-12 text-center text-amber-700 font-medium">No se pudo conectar con el servidor (localhost:3000). Asegúrate de iniciar backend.js.</td></tr>`;
    }
};

window.aplicarFiltrosDashboard = function () {
    reporteSeleccionado = null;
    renderizarTabla(buscador ? buscador.value : "");
};

function actualizarContadores() {
    document.getElementById('badge-todos').innerText = reportesDB.length;
    document.getElementById('badge-validando').innerText = reportesDB.filter(r => r.estado && r.estado.toLowerCase().includes('validando')).length;
    document.getElementById('badge-inspeccion').innerText = reportesDB.filter(r => r.estado && (r.estado.toLowerCase().includes('inspecci') || r.estado.toLowerCase().includes('dron'))).length;
    document.getElementById('badge-reparacion').innerText = reportesDB.filter(r => r.estado && (r.estado.toLowerCase().includes('reparaci') || r.estado.toLowerCase().includes('cuadrilla') || r.estado.toLowerCase().includes('saneamiento'))).length;
    document.getElementById('badge-concluidos').innerText = reportesDB.filter(r => r.estado && r.estado.toLowerCase().includes('concluido')).length;
}

function construirPopupBasicoReporte(r, prio, colorPin) {
    const estadoLimpio = (r.estado || 'Registrado').replace(' (IA / Dron)', '');
    const ubicacionCorta = r.ubicacion || 'Ubicación georreferenciada en cuenca';
    const rioTag = r.rio_nombre ? `<span style="font-weight: 700; color: #951a3e;">${r.rio_nombre}</span> · ` : '';

    return `
        <div style="font-family: 'Montserrat', sans-serif; background: #ffffff;">
            <div style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 9px 30px 8px 12px; display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                <span style="font-weight: 800; font-size: 12px; color: #0f172a; letter-spacing: 0.01em;">${r.id || '-'}</span>
                <span style="font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 2px 7px; border-radius: 9999px; background: ${colorPin}18; color: ${colorPin}; border: 1px solid ${colorPin}40;">
                    ${estadoLimpio}
                </span>
            </div>
            <div style="padding: 10px 12px 12px 12px;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 5px;">
                    <p style="font-size: 11.5px; font-weight: 700; color: #1e293b; margin: 0; line-height: 1.25;">${r.categoria || 'Incidencia Ambiental'}</p>
                </div>
                <p style="font-size: 10.5px; line-height: 1.35; color: #475569; margin: 0 0 10px 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                    ${rioTag}${ubicacionCorta}
                </p>
                <button type="button" onclick="dirigirALaQueja('${r.id}')"
                    style="background: #951a3e; color: #ffffff; border: none; padding: 7px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer; width: 100%; display: flex; align-items: center; justify-content: center; gap: 5px; box-shadow: 0 2px 6px rgba(149, 26, 62, 0.25);">
                    <span>Dirigir a la queja</span>
                    <span class="material-symbols-outlined" style="font-size: 14px;">arrow_downward</span>
                </button>
            </div>
        </div>
    `;
}

function actualizarMarcadoresMapa(reportesParaPintar) {
    if (!marcadoresLayerGroup) return;
    marcadoresLayerGroup.clearLayers();
    marcadoresPorFolio.clear();

    reportesParaPintar.forEach(r => {
        let lat = parseFloat(r.latitud);
        let lng = parseFloat(r.longitud);
        if (isNaN(lat) || isNaN(lng)) return;

        const prio = obtenerPrioridadReporte(r);
        const esConcluido = (r.estado || '').toLowerCase().includes('concluido');

        let colorPin = '#ef4444'; // Red (Crítica)
        if (esConcluido) colorPin = '#10b981'; // Green (Concluido)
        else if (prio.nivel === 4) colorPin = '#f97316'; // Orange (Alta)
        else if (prio.nivel === 3) colorPin = '#eab308'; // Amber (Media)
        else if (prio.nivel <= 2) colorPin = '#3b82f6'; // Blue (Moderada)

        const isSelected = reporteSeleccionado && reporteSeleccionado.id === r.id;
        const sizePx = isSelected ? 32 : 28;
        const ringShadow = isSelected
            ? `0 0 0 4px ${colorPin}45, 0 4px 12px rgba(0,0,0,0.35)`
            : '0 4px 10px rgba(0,0,0,0.3)';

        const markerHtml = `
            <div class="pin-folio-marker" data-folio="${r.id}" style="background-color: ${colorPin}; width: ${sizePx}px; height: ${sizePx}px; border-radius: 9999px; border: 2.5px solid #ffffff; box-shadow: ${ringShadow}; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;" title="${r.id} - ${r.categoria || ''}">
                <span class="material-symbols-outlined" style="font-size: 15px; color: #ffffff;">water_drop</span>
            </div>
        `;

        const icon = L.divIcon({
            html: markerHtml,
            className: 'custom-river-marker',
            iconSize: [sizePx, sizePx],
            iconAnchor: [sizePx / 2, sizePx / 2],
            popupAnchor: [0, -(sizePx / 2) - 2]
        });

        const marker = L.marker([lat, lng], { icon }).addTo(marcadoresLayerGroup);
        marker.bindPopup(construirPopupBasicoReporte(r, prio, colorPin), {
            className: 'sigmah-map-popup',
            maxWidth: 260,
            minWidth: 240,
            autoPan: true,
            autoPanPaddingTopLeft: [24, 32],
            autoPanPaddingBottomRight: [24, 24]
        });

        marcadoresPorFolio.set(r.id, { marker, lat, lng, colorPin });
    });
}

function resaltarFilaSeleccionadaEnDOM(idSeleccionado) {
    if (tabla) {
        const filas = tabla.querySelectorAll('tr[data-folio]');
        filas.forEach(tr => {
            const esActiva = tr.getAttribute('data-folio') === idSeleccionado;
            tr.classList.toggle('bg-primary/5', esActiva);
            tr.classList.toggle('border-l-primary', esActiva);
            tr.classList.toggle('border-l-transparent', !esActiva);
        });
    }

    document.querySelectorAll('.pin-folio-marker').forEach(pin => {
        const folioPin = pin.getAttribute('data-folio');
        const reg = marcadoresPorFolio.get(folioPin);
        const esActivo = folioPin === idSeleccionado;
        pin.style.width = esActivo ? '32px' : '28px';
        pin.style.height = esActivo ? '32px' : '28px';
        pin.style.boxShadow = esActivo && reg
            ? `0 0 0 4px ${reg.colorPin}45, 0 4px 12px rgba(0,0,0,0.35)`
            : '0 4px 10px rgba(0,0,0,0.3)';
    });
}

function enfocarMapaEnReporte(id) {
    const registroPin = marcadoresPorFolio.get(id);
    if (!registroPin) return;

    const scrollCont = document.getElementById('dashboard-scroll-container');
    const mapaCard = document.getElementById('contenedor-mapa-card');

    let requiereScroll = false;
    if (scrollCont && mapaCard) {
        const contRect = scrollCont.getBoundingClientRect();
        const mapaRect = mapaCard.getBoundingClientRect();
        // Si el mapa está cortado arriba o abajo (como al estar a mitad de scroll), subir suavemente al mapa completo
        if (mapaRect.top < contRect.top + 4 || mapaRect.bottom > contRect.bottom + 24) {
            requiereScroll = true;
            mapaCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    const ejecutarVueloYPopup = () => {
        dashMap.invalidateSize();
        const targetZoom = Math.max(dashMap.getZoom(), 15);
        // Desplazar ligeramente el centro hacia el norte para que el pin y su recuadro superior queden centrados
        const puntoPin = dashMap.project([registroPin.lat, registroPin.lng], targetZoom);
        const puntoCentrado = L.point(puntoPin.x, puntoPin.y - 52);
        const latLngCentrado = dashMap.unproject(puntoCentrado, targetZoom);

        dashMap.closePopup();
        let popupAbierto = false;
        const abrir = () => {
            if (popupAbierto) return;
            popupAbierto = true;
            registroPin.marker.openPopup();
        };

        dashMap.once('moveend', abrir);
        dashMap.flyTo(latLngCentrado, targetZoom, { duration: 0.7 });
        setTimeout(abrir, 800);
    };

    if (requiereScroll) {
        setTimeout(ejecutarVueloYPopup, 260);
    } else {
        ejecutarVueloYPopup();
    }
}

window.dirigirALaQueja = function (id) {
    dashMap.closePopup();
    seleccionarCalle(id, { enfocarMapa: false, recrearPines: false });

    const seccionTabla = document.getElementById('seccion-tabla');
    if (seccionTabla) {
        seccionTabla.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    setTimeout(() => {
        const fila = document.getElementById(`fila-queja-${id}`);
        const contTabla = document.getElementById('contenedor-tabla-quejas');
        if (fila && contTabla) {
            const filaTop = fila.offsetTop;
            const targetScroll = Math.max(0, filaTop - (contTabla.clientHeight / 2) + (fila.clientHeight / 2));
            contTabla.scrollTo({ top: targetScroll, behavior: 'smooth' });
            fila.classList.remove('queja-destacada');
            void fila.offsetWidth;
            fila.classList.add('queja-destacada');
        }

        const panelDetalle = document.getElementById('panel-detalle-queja');
        if (panelDetalle) {
            panelDetalle.classList.remove('queja-destacada');
            void panelDetalle.offsetWidth;
            panelDetalle.classList.add('queja-destacada');
        }
    }, 320);
};

function renderizarTabla(textoBusqueda = "") {
    actualizarContadores();
    tabla.innerHTML = "";

    let filtrados = reportesDB;

    // Filtro por Estado (agrupado por etapa institucional)
    if (estadoFiltro !== "") {
        const searchEstado = estadoFiltro.toLowerCase().replace('ó', 'o');
        filtrados = filtrados.filter(r => {
            const st = (r.estado || '').toLowerCase().replace('ó', 'o');
            if (searchEstado === 'inspeccion') {
                return st.includes('inspecci') || st.includes('dron') || st.includes('cuadrilla') || st.includes('asignada');
            }
            if (searchEstado === 'saneamiento' || searchEstado.includes('reparaci')) {
                return st.includes('saneamiento') || st.includes('cotizado') || st.includes('reparaci');
            }
            return st.includes(searchEstado);
        });
    }

    // Filtro por Categoría
    const catFiltro = document.getElementById('filtro-categoria')?.value || "";
    if (catFiltro !== "") {
        filtrados = filtrados.filter(r => (r.categoria || '').toLowerCase().includes(catFiltro.toLowerCase()));
    }

    // Filtro por Río
    const rioFiltro = document.getElementById('filtro-rio')?.value || "";
    if (rioFiltro !== "") {
        filtrados = filtrados.filter(r =>
            (r.rio_nombre && r.rio_nombre.toLowerCase().includes(rioFiltro.toLowerCase())) ||
            (r.ubicacion && r.ubicacion.toLowerCase().includes(rioFiltro.toLowerCase()))
        );
    }

    // Filtro por Buscador de texto
    if (textoBusqueda !== "") {
        const txt = textoBusqueda.toLowerCase();
        filtrados = filtrados.filter(r =>
            (r.id && r.id.toLowerCase().includes(txt)) ||
            (r.ubicacion && r.ubicacion.toLowerCase().includes(txt)) ||
            (r.rio_nombre && r.rio_nombre.toLowerCase().includes(txt)) ||
            (r.municipio && r.municipio.toLowerCase().includes(txt)) ||
            (r.categoria && r.categoria.toLowerCase().includes(txt)) ||
            (r.descripcion && r.descripcion.toLowerCase().includes(txt))
        );
    }

    const contadorBandeja = document.getElementById('contador-bandeja');
    if (contadorBandeja) {
        contadorBandeja.textContent = `${filtrados.length} ${filtrados.length === 1 ? 'queja' : 'quejas'}`;
    }

    // Actualizar pines en el mapa interactivo
    actualizarMarcadoresMapa(filtrados);

    if (filtrados.length === 0) {
        tabla.innerHTML = `<tr><td colspan="4" class="px-6 py-12 text-center text-gray-500 font-medium">No se encontraron quejas con los filtros seleccionados.</td></tr>`;
        return;
    }

    // Ordenar de mayor problema a menor (pendientes primero, luego por severidad descendente)
    filtrados = [...filtrados].sort((a, b) => {
        const aConc = (a.estado || '').toLowerCase().includes('concluido') ? 1 : 0;
        const bConc = (b.estado || '').toLowerCase().includes('concluido') ? 1 : 0;
        if (aConc !== bConc) return aConc - bConc;
        return obtenerPrioridadReporte(b).nivel - obtenerPrioridadReporte(a).nivel;
    });

    filtrados.forEach(calle => {
        const prio = obtenerPrioridadReporte(calle);
        let badgeClass = "bg-blue-50 text-blue-700 border-blue-200";
        let dotClass = "bg-blue-600";

        const safeEstado = calle.estado || "Desconocido";
        const lowerEstado = safeEstado.toLowerCase();

        if (lowerEstado.includes('inspecci') || lowerEstado.includes('asignada') || lowerEstado.includes('dron') || lowerEstado.includes('cuadrilla')) {
            badgeClass = "bg-purple-50 text-purple-700 border-purple-200";
            dotClass = "bg-purple-600";
        } else if (lowerEstado.includes('reparaci') || lowerEstado.includes('saneamiento') || lowerEstado.includes('cotizado')) {
            badgeClass = "bg-yellow-50 text-yellow-700 border-yellow-200";
            dotClass = "bg-yellow-500";
        } else if (lowerEstado.includes('concluido') || lowerEstado.includes('resuelta')) {
            badgeClass = "bg-green-50 text-green-700 border-green-200";
            dotClass = "bg-green-600";
        }

        const isSelected = reporteSeleccionado && reporteSeleccionado.id === calle.id;
        const rowClass = isSelected ? "bg-primary/5 border-l-4 border-l-primary" : "hover:bg-gray-50 border-l-4 border-l-transparent";

        tabla.innerHTML += `
            <tr id="fila-queja-${calle.id}" data-folio="${calle.id}" class="${rowClass} transition-colors cursor-pointer border-b border-gray-50" onclick="seleccionarCalle('${calle.id}', { enfocarMapa: true })">
                <td class="px-6 py-4">
                    <div class="flex items-center gap-2">
                        <p class="text-sm font-bold text-gray-900">${calle.id || '-'}</p>
                        <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${prio.cls}">${prio.etiqueta}</span>
                    </div>
                    <p class="text-xs text-gray-500 mt-0.5">${calle.categoria || 'Sin Categoría'}</p>
                </td>
                <td class="px-6 py-4">
                    <p class="text-sm text-gray-800 line-clamp-1" title="${calle.ubicacion || ''}">${calle.ubicacion || '-'}</p>
                    <p class="text-[10px] text-gray-400 font-bold uppercase">${calle.fecha ? calle.fecha + ' · ' : ''}${calle.dependencia || '-'}</p>
                </td>
                <td class="px-6 py-4">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badgeClass} border uppercase tracking-wider">
                        <span class="size-1.5 rounded-full ${dotClass}"></span> ${safeEstado.replace(' (IA / Dron)', '')}
                    </span>
                </td>
                <td class="px-6 py-4 text-sm">
                    <button type="button" onclick="abrirModal(event, '${calle.id}')" class="text-primary font-bold hover:text-primary-dark cursor-pointer bg-primary/10 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                        <span class="material-symbols-outlined text-[16px]">visibility</span> Ver Queja
                    </button>
                </td>
            </tr>`;
    });
}

window.cambiarCategoriaFiltro = function () {
    reporteSeleccionado = null;
    document.getElementById('detalle-categoria').textContent = "-";
    document.getElementById('detalle-costo').textContent = "-";
    document.getElementById('detalle-analisis').innerHTML = "Selecciona una queja de la lista para ver la descripción y gestionar el flujo de validación.";
    document.getElementById('btn-accion-container').innerHTML = `
        <button disabled class="w-full py-3 bg-white/20 text-white font-bold rounded-lg cursor-not-allowed text-sm uppercase tracking-wider">
            Selecciona un reporte
        </button>`;
    renderizarTabla(buscador.value);
};

window.filtrarEstado = function (estado) {
    if (typeof window.mostrarVista === 'function') window.mostrarVista('bandeja');
    estadoFiltro = estado;
    reporteSeleccionado = null;
    buscador.value = "";
    renderizarTabla();

    document.getElementById('detalle-categoria').textContent = "-";
    document.getElementById('detalle-costo').textContent = "-";
    document.getElementById('detalle-analisis').innerHTML = "Selecciona una queja de la lista para ver la descripción y gestionar el flujo de validación.";
    document.getElementById('card-bg-imagen').style.backgroundImage = "url('./src/assets/fugaAgua.jpeg')";
    document.getElementById('btn-accion-container').innerHTML = `
        <button disabled class="w-full py-3 bg-white/20 text-white font-bold rounded-lg cursor-not-allowed text-sm uppercase tracking-wider">
            Selecciona un reporte
        </button>`;

    document.getElementById('seccion-tabla').scrollIntoView({ behavior: 'smooth' });
};

if (buscador) {
    buscador.addEventListener('input', (e) => renderizarTabla(e.target.value));
}

function getCategoriaImg(cat) {
    if (!cat) return './src/assets/fugaAgua.jpeg';
    const lowerCat = cat.toLowerCase();
    if (lowerCat.includes('descarga') || lowerCat.includes('residual') || lowerCat.includes('drenaje') || lowerCat.includes('taponamiento') || lowerCat.includes('escombro')) return './src/assets/drenaje.jpeg';
    if (lowerCat.includes('basura') || lowerCat.includes('residuo')) return './src/assets/basura.jpeg';
    if (lowerCat.includes('erosi') || lowerCat.includes('arbol')) return './src/assets/arboles.jpeg';
    return './src/assets/fugaAgua.jpeg';
}

// Tarifas operativas reales (CMIC FASAR 1.55 + CONAGUA + EMA NOM-001-SEMARNAT-2021)
const TARIFAS_OPERATIVAS = {
    jornadaCuadrilla: 2850, // 1 oficial hidráulico + 2 ayudantes + cabo (FASAR 1.55)
    trasladoYEPP: 950,      // Unidad móvil, EPP químico/biológico y herramienta menor
    vueloDron: 1200,        // Dron térmico/multiespectral
    muestreoNom001: 9500    // Muestreo compuesto acreditado EMA (7 parámetros + toxicidad)
};

// Respaldo sincronizado con matriz_costos_saneamiento (Excel Base + CONAGUA/CMIC)
let MATRIZ_COSTOS_EXCEL = [
    { incidencia_categoria: 'Descarga de aguas residuales', tratamiento: 'Humedales artificiales', capex_min_mxn: 180000, capex_max_mxn: 450000, capex_prom_mxn: 315000, unidad_capex: 'Por L/s de capacidad instalada (CAPEX)', unidad_medida_corta: 'L/s', opex_min_m3: 0.5, opex_max_m3: 1.5, costo_directo_m3_mxn: null, observaciones: 'Nota del Excel: $1,800–$3,800 MXN/m². Costo principal por L/s instalado (1 L/s = 86.4 m³/día).' },
    { incidencia_categoria: 'Descarga de aguas residuales', tratamiento: 'Sedimentación (desarenadores y clarificadores)', capex_min_mxn: 80000, capex_max_mxn: 220000, capex_prom_mxn: 150000, unidad_capex: 'Por L/s de capacidad instalada (CAPEX)', unidad_medida_corta: 'L/s', opex_min_m3: 0.4, opex_max_m3: 1.2, costo_directo_m3_mxn: null, observaciones: 'Obra civil; requiere purga periódica de lodos primarios.' },
    { incidencia_categoria: 'Descarga de aguas residuales', tratamiento: 'Lodos activados (convencional / aireación extendida)', capex_min_mxn: 350000, capex_max_mxn: 750000, capex_prom_mxn: 550000, unidad_capex: 'Por L/s de capacidad instalada (CAPEX)', unidad_medida_corta: 'L/s', opex_min_m3: 4.5, opex_max_m3: 9.5, costo_directo_m3_mxn: null, observaciones: '50–65% del OPEX corresponde a energía eléctrica para aireación.' },
    { incidencia_categoria: 'Descarga de aguas residuales', tratamiento: 'Biofiltros, MBBR y SBR', capex_min_mxn: 400000, capex_max_mxn: 850000, capex_prom_mxn: 625000, unidad_capex: 'Por L/s de capacidad instalada (CAPEX)', unidad_medida_corta: 'L/s', opex_min_m3: 4.0, opex_max_m3: 8.0, costo_directo_m3_mxn: null, observaciones: 'Menor huella de terreno que lodos activados y tolerancia a variaciones de carga.' },

    { incidencia_categoria: 'Vertido químico o industrial', tratamiento: 'Electrocoagulación', capex_min_mxn: 300000, capex_max_mxn: 850000, capex_prom_mxn: 575000, unidad_capex: 'Por L/s de capacidad instalada (CAPEX)', unidad_medida_corta: 'L/s', opex_min_m3: 4.5, opex_max_m3: 12.0, costo_directo_m3_mxn: null, observaciones: 'El OPEX incluye electricidad y desgaste de electrodos (Al/Fe).' },
    { incidencia_categoria: 'Vertido químico o industrial', tratamiento: 'Flotación por aire disuelto (DAF)', capex_min_mxn: 450000, capex_max_mxn: 1100000, capex_prom_mxn: 775000, unidad_capex: 'Por L/s de capacidad instalada (CAPEX)', unidad_medida_corta: 'L/s', opex_min_m3: 3.5, opex_max_m3: 8.0, costo_directo_m3_mxn: null, observaciones: 'Alta eficiencia en grasas y colorantes textiles.' },
    { incidencia_categoria: 'Vertido químico o industrial', tratamiento: 'Filtración y adsorción (arena / carbón activado)', capex_min_mxn: 150000, capex_max_mxn: 400000, capex_prom_mxn: 275000, unidad_capex: 'Por L/s de capacidad instalada (CAPEX)', unidad_medida_corta: 'L/s', opex_min_m3: 2.0, opex_max_m3: 6.5, costo_directo_m3_mxn: null, observaciones: 'El OPEX incluye retrolavados y recambio de carbón activado.' },
    { incidencia_categoria: 'Vertido químico o industrial', tratamiento: 'Separación y recuperación de aceites e hidrocarburos', capex_min_mxn: 35000, capex_max_mxn: 1500000, capex_prom_mxn: 767500, unidad_capex: 'Por equipo / infraestructura instalada', unidad_medida_corta: 'equipo', opex_min_m3: 0.8, opex_max_m3: 2.5, costo_directo_m3_mxn: null, observaciones: 'Trampas comerciales: $35,000–$180,000; infraestructura mayor: $700,000–$1,500,000.' },

    { incidencia_categoria: 'Basura y residuos en cauce', tratamiento: 'Desazolve mecánico y retiro de residuos (por m³ CONAGUA/CMIC)', capex_min_mxn: 182.81, capex_max_mxn: 340.00, capex_prom_mxn: 297.81, unidad_capex: 'Por m³ extraído y acarreado', unidad_medida_corta: 'm3', opex_min_m3: null, opex_max_m3: null, costo_directo_m3_mxn: 297.81, observaciones: 'Tabulador CONAGUA ($182.81/m³ extracción) + acarreo a tiro autorizado ($115/m³).' },
    { incidencia_categoria: 'Basura y residuos en cauce', tratamiento: 'Barreras de retención de residuos (biobardas / flotantes)', capex_min_mxn: 15000, capex_max_mxn: 1200000, capex_prom_mxn: 607500, unidad_capex: 'Por barrera instalada', unidad_medida_corta: 'barrera', opex_min_m3: null, opex_max_m3: null, costo_directo_m3_mxn: null, observaciones: 'Artesanal/comunitaria (20–40 m): $15,000–$80,000; modular industrial: $250,000–$1,200,000.' },
    { incidencia_categoria: 'Basura y residuos en cauce', tratamiento: 'Recolección de residuos sólidos y desazolve (Campaña anual)', capex_min_mxn: 3000000, capex_max_mxn: 10000000, capex_prom_mxn: 6500000, unidad_capex: 'Por campaña anual municipal', unidad_medida_corta: 'campana', opex_min_m3: null, opex_max_m3: null, costo_directo_m3_mxn: null, observaciones: 'Contratos anuales de desazolve y limpieza en ríos y barrancas.' },

    { incidencia_categoria: 'Espuma, manchas o cambio de color', tratamiento: 'Flotación por aire disuelto (DAF)', capex_min_mxn: 450000, capex_max_mxn: 1100000, capex_prom_mxn: 775000, unidad_capex: 'Por L/s de capacidad instalada (CAPEX)', unidad_medida_corta: 'L/s', opex_min_m3: 3.5, opex_max_m3: 8.0, costo_directo_m3_mxn: null, observaciones: 'Eficiencia en grasas y colorantes textiles; pertinencia sujeta a contaminante.' },
    { incidencia_categoria: 'Espuma, manchas o cambio de color', tratamiento: 'Filtración y adsorción (arena / carbón activado)', capex_min_mxn: 150000, capex_max_mxn: 400000, capex_prom_mxn: 275000, unidad_capex: 'Por L/s de capacidad instalada (CAPEX)', unidad_medida_corta: 'L/s', opex_min_m3: 2.0, opex_max_m3: 6.5, costo_directo_m3_mxn: null, observaciones: 'El medio filtrante depende de la sustancia que origina el color o mancha.' },
    { incidencia_categoria: 'Espuma, manchas o cambio de color', tratamiento: 'Electrocoagulación', capex_min_mxn: 300000, capex_max_mxn: 850000, capex_prom_mxn: 575000, unidad_capex: 'Por L/s de capacidad instalada (CAPEX)', unidad_medida_corta: 'L/s', opex_min_m3: 4.5, opex_max_m3: 12.0, costo_directo_m3_mxn: null, observaciones: 'Método fisicoquímico del Excel; requiere validar aplicabilidad por tipo de espuma.' },
    { incidencia_categoria: 'Espuma, manchas o cambio de color', tratamiento: 'Separación y recuperación de aceites e hidrocarburos', capex_min_mxn: 35000, capex_max_mxn: 1500000, capex_prom_mxn: 767500, unidad_capex: 'Por equipo / infraestructura instalada', unidad_medida_corta: 'equipo', opex_min_m3: 0.8, opex_max_m3: 2.5, costo_directo_m3_mxn: null, observaciones: 'Aplicable cuando las manchas corresponden a aceites o hidrocarburos.' },

    { incidencia_categoria: 'Malos olores o gases tóxicos', tratamiento: 'Humedales artificiales (control biológico de carga)', capex_min_mxn: 180000, capex_max_mxn: 450000, capex_prom_mxn: 315000, unidad_capex: 'Por L/s de capacidad instalada (CAPEX)', unidad_medida_corta: 'L/s', opex_min_m3: 0.5, opex_max_m3: 1.5, costo_directo_m3_mxn: null, observaciones: 'Relación indirecta: tratamiento natural de agua, no sistema específico de desodorización.' },
    { incidencia_categoria: 'Malos olores o gases tóxicos', tratamiento: 'Biofiltros, MBBR y SBR', capex_min_mxn: 400000, capex_max_mxn: 850000, capex_prom_mxn: 625000, unidad_capex: 'Por L/s de capacidad instalada (CAPEX)', unidad_medida_corta: 'L/s', opex_min_m3: 4.0, opex_max_m3: 8.0, costo_directo_m3_mxn: null, observaciones: 'Relación indirecta: tratamiento biológico de agua, no específico para control de gases.' },
    { incidencia_categoria: 'Malos olores o gases tóxicos', tratamiento: 'Lodos activados (convencional / aireación extendida)', capex_min_mxn: 350000, capex_max_mxn: 750000, capex_prom_mxn: 550000, unidad_capex: 'Por L/s de capacidad instalada (CAPEX)', unidad_medida_corta: 'L/s', opex_min_m3: 4.5, opex_max_m3: 9.5, costo_directo_m3_mxn: null, observaciones: 'Relación indirecta mediante oxigenación de carga orgánica en agua.' },

    { incidencia_categoria: 'Escombros o taponamiento del río', tratamiento: 'Desazolve mecánico y retiro de escombro (por m³ CONAGUA/CMIC)', capex_min_mxn: 182.81, capex_max_mxn: 340.00, capex_prom_mxn: 297.81, unidad_capex: 'Por m³ retirado del cauce', unidad_medida_corta: 'm3', opex_min_m3: null, opex_max_m3: null, costo_directo_m3_mxn: 297.81, observaciones: 'Desazolve mecánico CONAGUA ($182.81/m³) + retiro en volteo a tiro autorizado ($115/m³).' },
    { incidencia_categoria: 'Escombros o taponamiento del río', tratamiento: 'Barreras de retención de residuos (biobardas / flotantes)', capex_min_mxn: 15000, capex_max_mxn: 1200000, capex_prom_mxn: 607500, unidad_capex: 'Por barrera instalada', unidad_medida_corta: 'barrera', opex_min_m3: null, opex_max_m3: null, costo_directo_m3_mxn: null, observaciones: 'Medida preventiva para flotantes; no sustituye el retiro mecánico de escombros.' },
    { incidencia_categoria: 'Escombros o taponamiento del río', tratamiento: 'Recolección de residuos sólidos y desazolve (Campaña anual)', capex_min_mxn: 3000000, capex_max_mxn: 10000000, capex_prom_mxn: 6500000, unidad_capex: 'Por campaña anual municipal', unidad_medida_corta: 'campana', opex_min_m3: null, opex_max_m3: null, costo_directo_m3_mxn: null, observaciones: 'Concepto anual municipal para retiro masivo de residuos y azolve.' },

    { incidencia_categoria: 'Desbordamiento o erosión de ribera', tratamiento: 'Estabilización de riberas (gaviones o muros verdes por km)', capex_min_mxn: 1500000, capex_max_mxn: 4500000, capex_prom_mxn: 3000000, unidad_capex: 'Por km de ribera ($1,500–$4,500/m lineal)', unidad_medida_corta: 'km', opex_min_m3: null, opex_max_m3: null, costo_directo_m3_mxn: null, observaciones: 'Gaviones o muros verdes: $1,500,000–$4,500,000 MXN/km.' },
    { incidencia_categoria: 'Desbordamiento o erosión de ribera', tratamiento: 'Reforestación y bioingeniería de ribera (por ha)', capex_min_mxn: 120000, capex_max_mxn: 450000, capex_prom_mxn: 285000, unidad_capex: 'Por hectárea (ha) restaurada', unidad_medida_corta: 'ha', opex_min_m3: null, opex_max_m3: null, costo_directo_m3_mxn: null, observaciones: 'Reforestación de margen: $120,000–$450,000 MXN/ha.' },
    { incidencia_categoria: 'Desbordamiento o erosión de ribera', tratamiento: 'Fitorremediación (islas flotantes / macrófitas por m²)', capex_min_mxn: 2500, capex_max_mxn: 6500, capex_prom_mxn: 4500, unidad_capex: 'Por m² de isla flotante ($25M–$60M proyecto integral)', unidad_medida_corta: 'm2', opex_min_m3: null, opex_max_m3: null, costo_directo_m3_mxn: null, observaciones: 'No controla erosión ni inundación directamente; costo unitario de isla flotante $2,500–$6,500 MXN/m².' }
];

// Cargar matriz actualizada desde PostgreSQL al iniciar
fetch(`${API_BASE}/api/catalogo-costos`)
    .then(r => r.json())
    .then(d => {
        if (d.success && Array.isArray(d.matriz_tratamientos) && d.matriz_tratamientos.length > 0) {
            MATRIZ_COSTOS_EXCEL = d.matriz_tratamientos;
        }
    })
    .catch(() => { /* usa respaldo local */ });

function obtenerPrioridadReporte(r) {
    const cat = (r.categoria || '').toLowerCase();
    const desc = (r.descripcion || '').toLowerCase();
    if (cat.includes('químic') || cat.includes('quimic') || /toxico|tóxico|ácido|acido|solvente/.test(desc)) {
        return { nivel: 5, etiqueta: 'Crítica', cls: 'bg-red-50 text-red-700 border-red-200' };
    }
    if (cat.includes('descarga') || cat.includes('desborde') || cat.includes('escombro') || cat.includes('taponamiento')) {
        return { nivel: 4, etiqueta: 'Alta', cls: 'bg-orange-50 text-orange-700 border-orange-200' };
    }
    if (cat.includes('espuma') || cat.includes('olor')) {
        return { nivel: 3, etiqueta: 'Media', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
    return { nivel: 2, etiqueta: 'Moderada', cls: 'bg-slate-100 text-slate-700 border-slate-200' };
}

function mostrarNotificacionDash(mensaje, tipo = 'success') {
    const cont = document.getElementById('dash-toast-container');
    if (!cont) return;
    const estilos = tipo === 'error'
        ? 'bg-red-50 text-red-800 border-red-200'
        : (tipo === 'info' ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-green-50 text-green-800 border-green-200');
    const icono = tipo === 'error' ? 'error' : (tipo === 'info' ? 'info' : 'check_circle');
    const toast = document.createElement('div');
    toast.className = `pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg text-xs md:text-sm font-semibold ${estilos}`;
    toast.innerHTML = `<span class="material-symbols-outlined text-[18px]">${icono}</span><span>${mensaje}</span>`;
    cont.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

window.recalcularDespliegueSeleccionado = function () {
    const reqCuadrilla = document.getElementById('chk-requiere-cuadrilla')?.checked ?? true;
    const jornadas = Math.max(1, Number(document.getElementById('input-jornadas-cuadrilla')?.value || 1));
    const usarDron = document.getElementById('chk-usar-dron')?.checked ?? false;
    const usarNom001 = document.getElementById('chk-muestreo-nom001')?.checked ?? false;

    const wrapJornadas = document.getElementById('wrap-jornadas-cuadrilla');
    if (wrapJornadas) wrapJornadas.classList.toggle('hidden', !reqCuadrilla);

    let total = 0;
    if (reqCuadrilla) {
        total += (TARIFAS_OPERATIVAS.jornadaCuadrilla * jornadas) + TARIFAS_OPERATIVAS.trasladoYEPP;
    }
    if (usarDron) total += TARIFAS_OPERATIVAS.vueloDron;
    if (usarNom001) total += TARIFAS_OPERATIVAS.muestreoNom001;

    const out = document.getElementById('total-despliegue-calc');
    if (out) out.textContent = `$${total.toLocaleString('es-MX')} MXN`;
    return { total, reqCuadrilla, jornadas, usarDron, usarNom001 };
};

function obtenerOpcionesMatriz(categoria) {
    const cat = (categoria || '').toLowerCase();
    const filtradas = MATRIZ_COSTOS_EXCEL.filter(m =>
        m.incidencia_categoria.toLowerCase() === cat ||
        cat.includes(m.incidencia_categoria.toLowerCase().slice(0, 10))
    );
    return filtradas.length > 0 ? filtradas : MATRIZ_COSTOS_EXCEL.slice(0, 4);
}

window.cambiarTratamientoMatriz = function () {
    const sel = document.getElementById('select-tratamiento-matriz');
    if (!sel) return;
    const opt = sel.options[sel.selectedIndex];
    const unidad = opt?.dataset.unidad || 'L/s';
    const inputMag = document.getElementById('input-magnitud-reparacion');
    const lblMag = document.getElementById('label-magnitud-reparacion');
    const wrapCaudalOpex = document.getElementById('wrap-caudal-equipo');

    const configUnidad = {
        'L/s': { label: 'Caudal estimado de descarga (L/s):', def: 1.5, step: '0.1' },
        'm3': { label: 'Volumen estimado a retirar (m³):', def: 25, step: '1' },
        'barrera': { label: 'Cantidad de biobardas / barreras:', def: 1, step: '1' },
        'equipo': { label: 'Cantidad de equipos separadores:', def: 1, step: '1' },
        'campana': { label: 'Número de campañas municipales:', def: 1, step: '1' },
        'km': { label: 'Longitud afectada en metros lineales (m):', def: 120, step: '10' },
        'ha': { label: 'Superficie de ribera a reforestar (ha):', def: 0.5, step: '0.1' },
        'm2': { label: 'Área de isla flotante / fitorremediación (m²):', def: 40, step: '5' }
    }[unidad] || { label: `Magnitud (${unidad}):`, def: 1, step: '1' };

    if (lblMag) lblMag.textContent = configUnidad.label;
    if (inputMag) {
        inputMag.step = configUnidad.step;
        inputMag.value = configUnidad.def;
    }
    if (wrapCaudalOpex) {
        wrapCaudalOpex.classList.toggle('hidden', unidad !== 'equipo');
    }
    recalcularCotizacionSeleccionada();
};

window.recalcularCotizacionSeleccionada = function () {
    const sel = document.getElementById('select-tratamiento-matriz');
    if (!sel) return;
    const opt = sel.options[sel.selectedIndex];
    if (!opt) return;

    const escenario = document.getElementById('select-escenario-costo')?.value || 'prom';
    const unidad = opt.dataset.unidad || 'L/s';
    const magnitud = Math.max(0.01, Number(document.getElementById('input-magnitud-reparacion')?.value || 1));
    const incluirCuadrilla = document.getElementById('chk-incluir-cuadrilla-cot')?.checked ?? true;
    const incluirNom001 = document.getElementById('chk-incluir-nom001-cot')?.checked ?? false;

    const cMin = Number(opt.dataset.capexMin || 0);
    const cMax = Number(opt.dataset.capexMax || 0);
    const cProm = Number(opt.dataset.capexProm || 0);
    const oMin = opt.dataset.opexMin !== '' ? Number(opt.dataset.opexMin) : null;
    const oMax = opt.dataset.opexMax !== '' ? Number(opt.dataset.opexMax) : null;

    const capexUnit = escenario === 'min' ? cMin : (escenario === 'max' ? cMax : cProm);
    let opexM3 = 0;
    if (oMin !== null && oMax !== null) {
        opexM3 = escenario === 'min' ? oMin : (escenario === 'max' ? oMax : Number(((oMin + oMax) / 2).toFixed(2)));
    }

    let capexTotal = 0;
    let volM3Dia = 0;
    let unidadMostrar = unidad;

    if (unidad === 'L/s') {
        capexTotal = capexUnit * magnitud;
        volM3Dia = Number((magnitud * 86.4).toFixed(1)); // 1 L/s = 86.4 m3/día
    } else if (unidad === 'km') {
        // Usuario captura metros lineales -> convierte a km (1 km = 1,000 m)
        capexTotal = capexUnit * (magnitud / 1000);
        unidadMostrar = 'm lineales';
    } else if (unidad === 'equipo') {
        capexTotal = capexUnit * magnitud;
        const m3Equipo = Number(document.getElementById('input-m3-equipo')?.value || 40);
        volM3Dia = m3Equipo;
    } else {
        capexTotal = capexUnit * magnitud;
    }

    const opexMensual = opexM3 > 0 && volM3Dia > 0 ? Number((opexM3 * volM3Dia * 30).toFixed(2)) : 0;
    const costoDespliegue = (incluirCuadrilla ? (TARIFAS_OPERATIVAS.jornadaCuadrilla + TARIFAS_OPERATIVAS.trasladoYEPP) : 0)
        + (incluirNom001 ? TARIFAS_OPERATIVAS.muestreoNom001 : 0);

    const totalProyecto = Math.round(costoDespliegue + capexTotal + opexMensual);

    const notaEl = document.getElementById('nota-tecnica-excel');
    if (notaEl) notaEl.textContent = opt.dataset.obs || '';

    const desgloseEl = document.getElementById('desglose-unitario-calc');
    if (desgloseEl) {
        const lineaVol = volM3Dia > 0
            ? `<div class="flex justify-between"><span>Volumen tratado (${volM3Dia.toLocaleString('es-MX')} m³/día):</span><strong>${(volM3Dia * 30).toLocaleString('es-MX')} m³/mes</strong></div>`
            : '';
        const lineaOpex = opexM3 > 0
            ? `<div class="flex justify-between"><span>OPEX por m³ ($${opexM3.toFixed(2)}/m³ · 30 días):</span><strong>$${Math.round(opexMensual).toLocaleString('es-MX')} MXN</strong></div>`
            : (unidad === 'm3' ? `<div class="flex justify-between"><span>Costo unitario por m³ (CONAGUA+CMIC):</span><strong>$${capexUnit.toLocaleString('es-MX')} MXN/m³</strong></div>` : '');
        const lineaCapex = `<div class="flex justify-between"><span>${unidad === 'm3' ? 'Extracción + Acarreo' : 'Inversión / Obra'} (${magnitud} ${unidadMostrar}):</span><strong>$${Math.round(capexTotal).toLocaleString('es-MX')} MXN</strong></div>`;
        const lineaCuad = `<div class="flex justify-between"><span>Despliegue cuadrilla / laboratorio:</span><strong>$${costoDespliegue.toLocaleString('es-MX')} MXN</strong></div>`;
        desgloseEl.innerHTML = lineaCuad + lineaCapex + lineaVol + lineaOpex;
    }

    const out = document.getElementById('total-cotizacion-calc');
    if (out) out.textContent = `$${totalProyecto.toLocaleString('es-MX')} MXN`;
    const kpiCosto = document.getElementById('detalle-costo');
    if (kpiCosto && totalProyecto > 0) kpiCosto.textContent = totalProyecto.toLocaleString('es-MX');

    return {
        tratamiento: opt.value,
        unidad: unidadMostrar,
        magnitud,
        volM3Dia,
        opexM3,
        opexMensual: Math.round(opexMensual),
        capexTotal: Math.round(capexTotal),
        costoDespliegue,
        incluirCuadrilla,
        totalProyecto,
        escenario
    };
};

window.seleccionarCalle = function (id, opciones = {}) {
    const { enfocarMapa = true, recrearPines = false } = opciones;
    const info = reportesDB.find(c => c.id === id);
    if (!info) return;

    reporteSeleccionado = info;

    if (recrearPines) {
        renderizarTabla(buscador ? buscador.value : "");
    } else {
        resaltarFilaSeleccionadaEnDOM(id);
    }

    if (enfocarMapa && info.latitud && info.longitud) {
        enfocarMapaEnReporte(id);
    }

    const prio = obtenerPrioridadReporte(info);
    document.getElementById('detalle-categoria').textContent = info.categoria;
    const costoNum = Number(String(info.costo || '0').replace(/,/g, ''));
    document.getElementById('detalle-costo').textContent = costoNum > 0 ? costoNum.toLocaleString('es-MX') : "Pendiente";
    const correoInfo = info.correo ? `<br><span class="text-xs opacity-80">Contacto ciudadano: ${info.correo}</span>` : '';
    const coordsInfo = (info.latitud && info.longitud) ? `<br><span class="text-[11px] opacity-75">Coordenadas: ${Number(info.latitud).toFixed(5)}, ${Number(info.longitud).toFixed(5)}</span>` : '';
    document.getElementById('detalle-analisis').innerHTML = `
        <div class="space-y-2">
            <div>
                <strong>Folio ${info.id}</strong> · Prioridad <strong>${prio.etiqueta}</strong> (${info.fecha || 'Sin fecha'})
                <br><span class="text-xs opacity-90">${info.rio_nombre ? info.rio_nombre + ' · ' : ''}${info.ubicacion || ''}</span>${coordsInfo}${correoInfo}
            </div>
            <p class="text-sm leading-relaxed bg-black/15 p-2.5 rounded-lg border border-white/10">${info.descripcion || 'Sin descripción adicional.'}</p>
            <button type="button" onclick="abrirModal(event, '${info.id}')" class="inline-flex items-center gap-1.5 text-xs font-bold text-white/95 hover:text-white underline underline-offset-2 pt-0.5 cursor-pointer">
                <span class="material-symbols-outlined text-[15px]">photo_library</span> Ver evidencia fotográfica y ficha completa
            </button>
        </div>`;

    document.getElementById('card-bg-imagen').style.backgroundImage = `url('${info.img || getCategoriaImg(info.categoria)}')`;

    const containerBtn = document.getElementById('btn-accion-container');
    const safeEstado = (info.estado || "").toLowerCase();

    if (safeEstado.includes('validando') || safeEstado.includes('reportado') || safeEstado.includes('recibida')) {
        containerBtn.innerHTML = `
            <div class="mt-4 space-y-2.5">
                <p class="text-[11px] text-white/90 leading-snug bg-white/10 p-2.5 rounded-lg border border-white/15">
                    <strong>Evaluación de Despliegue (CMIC/FASAR 1.55):</strong> Define si el reporte requiere cuadrilla en sitio o únicamente verificación aérea previa con dron.
                </p>
                <label class="block text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-1">
                    <span class="material-symbols-outlined text-[16px]">calendar_month</span> Fecha de inspección programada:
                </label>
                <input type="date" id="fecha-inspeccion" class="block w-full rounded-lg border-none text-gray-800 shadow-sm focus:ring-2 focus:ring-white sm:text-sm px-3 py-1.5 bg-white/95">
                <div class="space-y-1.5 bg-white/10 p-2.5 rounded-lg border border-white/15 text-[11px]">
                    <label class="flex items-center justify-between cursor-pointer">
                        <span class="flex items-center gap-2"><input type="checkbox" id="chk-requiere-cuadrilla" checked onchange="recalcularDespliegueSeleccionado()" class="rounded text-primary focus:ring-0"> Desplegar cuadrilla especializada</span>
                        <span class="font-bold">$2,850/j + $950</span>
                    </label>
                    <div id="wrap-jornadas-cuadrilla" class="flex items-center justify-between pl-5 pt-0.5">
                        <span>Jornadas estimadas:</span>
                        <input type="number" id="input-jornadas-cuadrilla" value="1" min="1" max="15" oninput="recalcularDespliegueSeleccionado()" class="w-16 rounded border-none text-gray-900 text-xs font-bold px-2 py-0.5 text-right">
                    </div>
                    <label class="flex items-center justify-between cursor-pointer">
                        <span class="flex items-center gap-2"><input type="checkbox" id="chk-usar-dron" checked onchange="recalcularDespliegueSeleccionado()" class="rounded text-primary focus:ring-0"> Sobrevuelo dron térmico/visual</span>
                        <span class="font-bold">$1,200</span>
                    </label>
                    <label class="flex items-center justify-between cursor-pointer">
                        <span class="flex items-center gap-2"><input type="checkbox" id="chk-muestreo-nom001" onchange="recalcularDespliegueSeleccionado()" class="rounded text-primary focus:ring-0"> Muestreo lab. EMA (NOM-001)</span>
                        <span class="font-bold">$9,500</span>
                    </label>
                </div>
                <div class="flex items-center justify-between bg-white/15 px-3 py-1.5 rounded-lg text-xs font-bold">
                    <span>Costo de despliegue:</span>
                    <span id="total-despliegue-calc">$5,000 MXN</span>
                </div>
                <button onclick="agendarInspeccion('${info.id}')" id="btn-magico" class="w-full py-3 bg-white text-primary font-bold rounded-lg hover:bg-gray-100 transition-all shadow-md active:scale-95 text-xs md:text-sm uppercase tracking-wider flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined text-[18px]">flight_takeoff</span> Autorizar Despliegue
                </button>
            </div>`;
        recalcularDespliegueSeleccionado();
    } else if (safeEstado.includes('inspecci') || safeEstado.includes('asignada') || safeEstado.includes('dron') || safeEstado.includes('cuadrilla')) {
        const opciones = obtenerOpcionesMatriz(info.categoria);
        const optionsHtml = opciones.map(m => `
            <option value="${m.tratamiento}"
                data-unidad="${m.unidad_medida_corta}"
                data-capex-min="${m.capex_min_mxn}"
                data-capex-max="${m.capex_max_mxn}"
                data-capex-prom="${m.capex_prom_mxn}"
                data-opex-min="${m.opex_min_m3 !== null && m.opex_min_m3 !== undefined ? m.opex_min_m3 : ''}"
                data-opex-max="${m.opex_max_m3 !== null && m.opex_max_m3 !== undefined ? m.opex_max_m3 : ''}"
                data-obs="${(m.observaciones || '').replace(/"/g, '&quot;')}">
                ${m.tratamiento}
            </option>`).join('');

        containerBtn.innerHTML = `
            <div class="mt-4 space-y-2.5 text-xs">
                <p class="text-[10px] font-bold text-white uppercase tracking-widest">Estimación Técnica por Unidad de Medida (Matriz Excel):</p>
                <div>
                    <label class="block text-[10px] text-white/80 font-semibold mb-1">Solución / Tratamiento Recomendado:</label>
                    <select id="select-tratamiento-matriz" onchange="cambiarTratamientoMatriz()" class="w-full rounded-lg border-none bg-white text-gray-900 text-xs font-semibold py-1.5 px-2.5">
                        ${optionsHtml}
                    </select>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label id="label-magnitud-reparacion" class="block text-[10px] text-white/80 font-semibold mb-1">Magnitud:</label>
                        <input type="number" id="input-magnitud-reparacion" value="1" min="0.1" step="0.5" oninput="recalcularCotizacionSeleccionada()" class="w-full rounded-lg border-none bg-white text-gray-900 text-xs font-bold py-1.5 px-2.5">
                    </div>
                    <div>
                        <label class="block text-[10px] text-white/80 font-semibold mb-1">Rango del Tabulador:</label>
                        <select id="select-escenario-costo" onchange="recalcularCotizacionSeleccionada()" class="w-full rounded-lg border-none bg-white text-gray-900 text-xs font-semibold py-1.5 px-2">
                            <option value="min">Mínimo (Excel)</option>
                            <option value="prom" selected>Promedio (Excel)</option>
                            <option value="max">Máximo (Excel)</option>
                        </select>
                    </div>
                </div>
                <div id="wrap-caudal-equipo" class="hidden">
                    <label class="block text-[10px] text-white/80 font-semibold mb-1">Volumen diario tratado para OPEX (m³/día):</label>
                    <input type="number" id="input-m3-equipo" value="40" min="1" step="5" oninput="recalcularCotizacionSeleccionada()" class="w-full rounded-lg border-none bg-white text-gray-900 text-xs font-bold py-1.5 px-2.5">
                </div>
                <div class="space-y-1 bg-white/10 p-2 rounded-lg text-[11px]">
                    <label class="flex items-center justify-between cursor-pointer">
                        <span class="flex items-center gap-1.5"><input type="checkbox" id="chk-incluir-cuadrilla-cot" checked onchange="recalcularCotizacionSeleccionada()" class="rounded text-primary focus:ring-0"> Cuadrilla en sitio + traslado</span>
                        <span class="font-bold">$3,800</span>
                    </label>
                    <label class="flex items-center justify-between cursor-pointer">
                        <span class="flex items-center gap-1.5"><input type="checkbox" id="chk-incluir-nom001-cot" checked onchange="recalcularCotizacionSeleccionada()" class="rounded text-primary focus:ring-0"> Análisis lab. NOM-001 EMA</span>
                        <span class="font-bold">$9,500</span>
                    </label>
                </div>
                <p id="nota-tecnica-excel" class="text-[10px] text-white/85 italic leading-snug bg-black/20 p-2 rounded-lg"></p>
                <div id="desglose-unitario-calc" class="space-y-1 text-[11px] bg-white/10 p-2.5 rounded-lg border border-white/15"></div>
                <div class="flex items-center justify-between bg-white/20 px-3 py-2 rounded-lg text-xs font-bold">
                    <span>Total Presupuesto Oficial:</span>
                    <span id="total-cotizacion-calc">$0 MXN</span>
                </div>
                <button onclick="lanzarDron('${info.id}')" id="btn-magico" class="w-full py-3 bg-white text-primary font-bold rounded-lg hover:bg-gray-100 transition-all shadow-md active:scale-95 text-xs md:text-sm uppercase tracking-wider flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined text-[18px]">request_quote</span> Emitir Cotización Oficial
                </button>
            </div>`;
        cambiarTratamientoMatriz();
    } else if (safeEstado.includes('reparaci') || safeEstado.includes('saneamiento') || safeEstado.includes('cotizado')) {
        const tratInfo = info.tratamiento_aplicado
            ? `<div class="bg-white/15 p-3 rounded-lg text-[11px] space-y-1 mb-3 border border-white/20">
                 <p class="font-bold uppercase tracking-wider text-white/80">Solución en Ejecución</p>
                 <p class="font-bold text-white">${info.tratamiento_aplicado}</p>
                 <p>Magnitud: <strong>${info.magnitud_medida || '-'} ${info.unidad_medida || ''}</strong>${Number(info.costo_opex_m3_mxn) > 0 ? ` · OPEX: <strong>$${info.costo_opex_m3_mxn}/m³</strong>` : ''}</p>
               </div>`
            : '';
        containerBtn.innerHTML = `
            ${tratInfo}
            <button onclick="concluirServicio('${info.id}')" id="btn-magico" class="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-all shadow-md active:scale-95 text-sm uppercase tracking-wider flex items-center justify-center gap-2 border border-green-400">
                <span class="material-symbols-outlined">task_alt</span> Concluir Saneamiento
            </button>`;
    } else {
        containerBtn.innerHTML = `
            <a href="reportes.html" class="w-full py-3 bg-white text-primary font-bold rounded-lg hover:bg-gray-100 transition-all shadow-md text-xs md:text-sm uppercase tracking-wider flex items-center justify-center gap-2">
                <span class="material-symbols-outlined text-[18px]">picture_as_pdf</span> Generar Acta en Reportes PDF
            </a>`;
    }
};

window.agendarInspeccion = function (id) {
    const fechaInput = document.getElementById('fecha-inspeccion').value;
    if (!fechaInput) {
        mostrarNotificacionDash("Selecciona una fecha para autorizar el despliegue.", "error");
        return;
    }

    const desp = recalcularDespliegueSeleccionado();
    const partesFecha = fechaInput.split('-');
    const fechaFormateada = `${partesFecha[2]}/${partesFecha[1]}/${partesFecha[0]}`;
    const btn = document.getElementById('btn-magico');
    btn.innerHTML = `<span class="material-symbols-outlined animate-spin">sync</span> Desplegando...`;
    btn.classList.add('opacity-90', 'cursor-not-allowed');

    setTimeout(() => {
        const idx = reportesDB.findIndex(r => r.id === id);
        if (idx !== -1) {
            const nuevoEstado = desp.usarDron ? "Dron en Verificación" : "Cuadrilla Desplegada";
            reportesDB[idx].estado = nuevoEstado;
            reportesDB[idx].costo = desp.total;
            const correo = reportesDB[idx].correo;
            renderizarTabla(buscador.value);
            seleccionarCalle(id, { enfocarMapa: false, recrearPines: false });

            const detalleDron = desp.usarDron
                ? (desp.reqCuadrilla ? "con reconocimiento aéreo mediante dron y verificación presencial de cuadrilla" : "mediante reconocimiento aéreo preliminar con dron")
                : "mediante nuestra cuadrilla técnica especializada en campo";

            fetch(`${API_BASE}/api/notificar-estado`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    correo: correo || '',
                    folio: id,
                    nuevoEstado,
                    requiereCuadrilla: desp.reqCuadrilla,
                    costoDespliegue: desp.total,
                    costoEstimado: desp.total,
                    conceptos: [
                        ...(desp.reqCuadrilla ? [{ concepto: `Despliegue cuadrilla FASAR 1.55 (${desp.jornadas} j.) + traslado`, cantidad: desp.jornadas, subtotal: (TARIFAS_OPERATIVAS.jornadaCuadrilla * desp.jornadas) + TARIFAS_OPERATIVAS.trasladoYEPP }] : []),
                        ...(desp.usarDron ? [{ concepto: 'Sobrevuelo dron térmico/multiespectral', cantidad: 1, subtotal: TARIFAS_OPERATIVAS.vueloDron }] : []),
                        ...(desp.usarNom001 ? [{ concepto: 'Muestreo acreditado EMA NOM-001-SEMARNAT-2021', cantidad: 1, subtotal: TARIFAS_OPERATIVAS.muestreoNom001 }] : [])
                    ],
                    mensaje: `Su expediente ambiental inició fase de verificación técnica. Se autorizó el despliegue ${detalleDron} para el día <strong>${fechaFormateada}</strong>.`
                })
            }).catch(e => console.error("Error al actualizar/enviar email:", e));

            mostrarNotificacionDash(`Despliegue autorizado ($${desp.total.toLocaleString('es-MX')} MXN) para el ${fechaFormateada}.`, "success");
        }
    }, 600);
};

window.lanzarDron = function (id) {
    const calc = recalcularCotizacionSeleccionada();
    if (!calc || calc.totalProyecto <= 0) {
        mostrarNotificacionDash("Verifica las medidas y tratamiento antes de emitir la cotización.", "error");
        return;
    }

    const conceptos = [
        { concepto: `${calc.tratamiento} (${calc.magnitud} ${calc.unidad} - rango ${calc.escenario})`, cantidad: calc.magnitud, subtotal: calc.capexTotal }
    ];
    if (calc.costoDespliegue > 0) {
        conceptos.push({ concepto: 'Despliegue cuadrilla en campo y/o laboratorio NOM-001', cantidad: 1, subtotal: calc.costoDespliegue });
    }
    if (calc.opexMensual > 0) {
        conceptos.push({ concepto: `Operación OPEX primer mes (${calc.volM3Dia} m³/día a $${calc.opexM3}/m³)`, cantidad: 30, subtotal: calc.opexMensual });
    }

    const btn = document.getElementById('btn-magico');
    btn.innerHTML = `<span class="material-symbols-outlined animate-spin">sync</span> Registrando Cotización...`;
    btn.classList.add('opacity-90', 'cursor-not-allowed');

    setTimeout(() => {
        const idx = reportesDB.findIndex(r => r.id === id);
        if (idx !== -1) {
            reportesDB[idx].estado = "Cotizado / En Saneamiento";
            reportesDB[idx].costo = calc.totalProyecto;
            reportesDB[idx].tratamiento_aplicado = calc.tratamiento;
            reportesDB[idx].magnitud_medida = calc.magnitud;
            reportesDB[idx].unidad_medida = calc.unidad;
            reportesDB[idx].costo_opex_m3_mxn = calc.opexM3;
            const correo = reportesDB[idx].correo;
            renderizarTabla(buscador.value);
            seleccionarCalle(id, { enfocarMapa: false, recrearPines: false });

            fetch(`${API_BASE}/api/notificar-estado`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    correo: correo || '',
                    folio: id,
                    nuevoEstado: "Cotizado / En Saneamiento",
                    requiereCuadrilla: calc.incluirCuadrilla,
                    costoDespliegue: calc.costoDespliegue,
                    costoCapex: calc.capexTotal,
                    costoOpexM3: calc.opexM3,
                    costoOpexMensual: calc.opexMensual,
                    magnitud: calc.magnitud,
                    unidadMedida: calc.unidad,
                    volumenM3Dia: calc.volM3Dia,
                    tratamientoAplicado: calc.tratamiento,
                    costoEstimado: calc.totalProyecto,
                    conceptos,
                    mensaje: `La cuadrilla especializada emitió el dictamen técnico para <strong>${calc.tratamiento}</strong> (${calc.magnitud} ${calc.unidad}), con un presupuesto oficial de <strong>$${calc.totalProyecto.toLocaleString('es-MX')} MXN</strong>.`
                })
            }).catch(e => console.error("Error al actualizar/enviar email:", e));

            mostrarNotificacionDash(`Cotización guardada en PostGIS: $${calc.totalProyecto.toLocaleString('es-MX')} MXN.`, "success");
        }
    }, 600);
};

window.concluirServicio = function (id) {
    const btn = document.getElementById('btn-magico');
    btn.innerHTML = `<span class="material-symbols-outlined animate-spin">sync</span> Guardando...`;

    setTimeout(() => {
        const idx = reportesDB.findIndex(r => r.id === id);
        if (idx !== -1) {
            reportesDB[idx].estado = "Concluido";
            const correo = reportesDB[idx].correo;
            renderizarTabla(buscador.value);
            seleccionarCalle(id, { enfocarMapa: false, recrearPines: false });

            fetch(`${API_BASE}/api/notificar-estado`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    correo: correo || '',
                    folio: id,
                    nuevoEstado: "Concluido",
                    mensaje: "Le informamos que la denuncia ambiental registrada bajo este folio ha concluido su proceso de saneamiento e inspección. Puede consultar el dictamen en el Portal Ciudadano."
                })
            }).catch(e => console.error("Error al actualizar/enviar email:", e));

            mostrarNotificacionDash(`Expediente ${id} concluido y disponible en Actas PDF.`, "success");
        }
    }, 600);
};

window.abrirModal = function (event, id) {
    if (event) event.stopPropagation();
    const info = reportesDB.find(c => c.id === id);
    if (info) {
        document.getElementById('modal-titulo').textContent = `Evidencia: ${info.id}`;
        document.getElementById('modal-imagen').src = info.img ? info.img : getCategoriaImg(info.categoria);
        document.getElementById('modal-categoria').textContent = info.categoria || 'Sin categoría';
        document.getElementById('modal-fecha').textContent = info.fecha ? `Fecha: ${info.fecha}` : '';
        document.getElementById('modal-estado').textContent = info.estado || 'Sin estado';
        document.getElementById('modal-ubicacion').textContent = info.ubicacion || '-';
        document.getElementById('modal-descripcion').textContent = `"${info.descripcion || ''}"`;
        document.getElementById('modal-detalle').classList.remove('hidden');
    }
};

window.cerrarModal = function () {
    document.getElementById('modal-detalle').classList.add('hidden');
};

cargarDatos();

// 3. Navegación entre Bandeja de Quejas y Proyección de Ríos (Modelo 1D + Crecimiento + Clima Multipunto)
let chartPrediccion = null;
let climaCargado = false;
let climaIntervalId = null;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function obtenerModoClima() {
    return localStorage.getItem('clima_modo_recoleccion') || 'auto';
}

function pintarEstacionesClima(data) {
    const grid = document.getElementById('grid-estaciones-clima');
    const lblSync = document.getElementById('clima-ultima-sync');
    if (lblSync && data.actualizado_en) {
        const hora = new Date(data.actualizado_en).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        lblSync.textContent = `Actualizado: ${hora} · ${data.desde_cache ? 'Caché 2h' : 'En vivo'}`;
    }

    if (grid && Array.isArray(data.estaciones)) {
        grid.innerHTML = data.estaciones.map(est => {
            const alertaLluvia = est.lluvia_mm_h >= 10
                ? 'border-red-300 bg-red-50/50'
                : (est.lluvia_mm_h > 0 ? 'border-sky-300 bg-sky-50/60' : 'border-slate-200 bg-slate-50/70');
            return `
                <div class="rounded-xl border ${alertaLluvia} p-3.5 flex flex-col gap-1.5">
                    <div class="flex items-start justify-between gap-2">
                        <div>
                            <h4 class="text-xs font-bold text-gray-900">${est.nombre}</h4>
                            <p class="text-[10px] font-semibold text-primary uppercase tracking-wide">${est.cuenca}</p>
                        </div>
                        <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white border border-slate-200 text-sky-800 shrink-0">${est.lluvia_mm_h} mm/h</span>
                    </div>
                    <div class="grid grid-cols-3 gap-2 text-[11px] text-gray-600 pt-1 border-t border-slate-200/70">
                        <span>Temp: <strong class="text-gray-900">${est.temperatura_c}°C</strong></span>
                        <span>Hum: <strong class="text-gray-900">${est.humedad_pct ?? '--'}%</strong></span>
                        <span>24h: <strong class="text-gray-900">${est.lluvia_24h_mm ?? 0} mm</strong></span>
                    </div>
                </div>`;
        }).join('');
    }

    // Actualizar capa meteorológica sobre el mapa de Puebla si está visible
    climaLayerGroup.clearLayers();
    if (Array.isArray(data.estaciones)) {
        data.estaciones.forEach(est => {
            const html = `
                <div style="background: #0369a1; color: #fff; padding: 2px 7px; border-radius: 9999px; font-size: 10px; font-weight: 700; border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.28); white-space: nowrap;">
                    ${est.lluvia_mm_h} mm/h · ${est.temperatura_c}°C
                </div>`;
            const icon = L.divIcon({ html, className: 'clima-pin-puebla', iconSize: [110, 22], iconAnchor: [55, 11] });
            L.marker([est.lat, est.lng], { icon })
                .bindPopup(`<strong>Estación: ${est.nombre}</strong><br>Cuenca: ${est.cuenca}<br>Lluvia actual: <b>${est.lluvia_mm_h} mm/h</b><br>Temperatura: <b>${est.temperatura_c} °C</b><br>Acumulado 24h: <b>${est.lluvia_24h_mm ?? 0} mm</b>`)
                .addTo(climaLayerGroup);
        });
    }
}

window.toggleEstacionesClimaMapa = async function () {
    const btn = document.getElementById('btn-toggle-clima-mapa');
    mostrarClimaEnMapa = !mostrarClimaEnMapa;
    if (mostrarClimaEnMapa) {
        if (!ultimosDatosClima) await sincronizarClimaVivo(false);
        climaLayerGroup.addTo(dashMap);
        if (btn) btn.className = 'px-3 py-1.5 rounded-lg border border-sky-600 bg-sky-600 text-white text-xs font-bold transition-colors flex items-center gap-1.5';
        mostrarNotificacionDash('Estaciones meteorológicas de la zona delimitada activadas en el mapa.', 'info');
    } else {
        dashMap.removeLayer(climaLayerGroup);
        if (btn) btn.className = 'px-3 py-1.5 rounded-lg border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-bold transition-colors flex items-center gap-1.5';
    }
};

window.cambiarModoClima = function () {
    const sel = document.getElementById('select-modo-clima');
    const modo = sel ? sel.value : 'auto';
    localStorage.setItem('clima_modo_recoleccion', modo);
    if (climaIntervalId) {
        clearInterval(climaIntervalId);
        climaIntervalId = null;
    }
    const badge = document.getElementById('badge-clima-estado');
    if (modo === 'auto') {
        climaIntervalId = setInterval(() => sincronizarClimaVivo(true), TWO_HOURS_MS);
        if (badge && ultimosDatosClima) {
            badge.textContent = `Auto (2h): ${ultimosDatosClima.lluvia_mm_h} mm/h · ${ultimosDatosClima.temperatura_c}°C`;
        }
        mostrarNotificacionDash('Modo automático activado: recolección meteorológica cada 2 horas.', 'info');
    } else {
        if (badge) {
            badge.textContent = ultimosDatosClima
                ? `Manual: ${ultimosDatosClima.lluvia_mm_h} mm/h · ${ultimosDatosClima.temperatura_c}°C (solo al dar clic)`
                : 'Modo Manual: presiona "Consultar Clima Ahora"';
        }
        mostrarNotificacionDash('Modo manual activado: el clima se actualizará únicamente cuando des clic.', 'info');
    }
};

function inicializarModoClima() {
    const modo = obtenerModoClima();
    const sel = document.getElementById('select-modo-clima');
    if (sel) sel.value = modo;
    if (climaIntervalId) clearInterval(climaIntervalId);
    if (modo === 'auto') {
        climaIntervalId = setInterval(() => sincronizarClimaVivo(true), TWO_HOURS_MS);
    }
}
inicializarModoClima();

const PARAMETROS_RIOS = {
    'Río Atoyac': { qBase: 4.5, qDescBase: 1.95, dboBase: 68, odBase: 3.4, areaCuencaKm2: 85, escorrentiaC: 0.42 },
    'Río Alseseca': { qBase: 1.8, qDescBase: 0.95, dboBase: 62, odBase: 3.8, areaCuencaKm2: 45, escorrentiaC: 0.48 },
    'Río Zahuapan': { qBase: 2.2, qDescBase: 0.80, dboBase: 52, odBase: 4.3, areaCuencaKm2: 60, escorrentiaC: 0.38 },
    'Río Nexapa': { qBase: 3.1, qDescBase: 0.65, dboBase: 34, odBase: 5.4, areaCuencaKm2: 75, escorrentiaC: 0.35 },
    'Río Prieto': { qBase: 1.2, qDescBase: 0.55, dboBase: 55, odBase: 4.1, areaCuencaKm2: 32, escorrentiaC: 0.45 }
};

function calcularSaturacionODPuebla(tempC) {
    const tk = tempC + 273.15;
    const lnOd = -139.34411 + (1.575701e5 / tk) - (6.642308e7 / (tk ** 2)) + (1.2438e10 / (tk ** 3)) - (8.621949e11 / (tk ** 4));
    const presionPuebla = (1.0 - 2.25577e-5 * 2135.0) ** 5.25588;
    return Math.exp(lnOd) * presionPuebla;
}

function semaforoCONAGUA(dbo5, odPct) {
    if (dbo5 > 120 || odPct <= 10) return { texto: 'Rojo · Crítica', cls: 'bg-red-100 text-red-800 border-red-300' };
    if (dbo5 > 30 || odPct <= 30) return { texto: 'Naranja · Contaminada', cls: 'bg-orange-100 text-orange-800 border-orange-300' };
    if (dbo5 > 6 || odPct <= 50) return { texto: 'Amarillo · Aceptable', cls: 'bg-amber-100 text-amber-800 border-amber-300' };
    if (dbo5 > 3 || odPct <= 70) return { texto: 'Verde · Buena', cls: 'bg-green-100 text-green-800 border-green-300' };
    return { texto: 'Azul · Excelente', cls: 'bg-sky-100 text-sky-800 border-sky-300' };
}

function contarQuejasRio(nombreRio) {
    return reportesDB.filter(r =>
        !(r.estado || '').toLowerCase().includes('concluido') &&
        ((r.ubicacion || '').includes(nombreRio))
    ).length;
}

function simularRio(nombreRio, lluviaMmH, factorDescargaPct, tempC, taponamientos) {
    const p = PARAMETROS_RIOS[nombreRio] || PARAMETROS_RIOS['Río Atoyac'];
    const quejasActivas = contarQuejasRio(nombreRio);
    const factorHumano = Math.max(0.2, 1 + (factorDescargaPct / 100) + quejasActivas * 0.04);

    // Crecimiento de caudal por lluvia (Método Racional: Q = 0.278 * C * i * A_km2 * factor respuesta urbana)
    const qLluvia = 0.278 * p.escorrentiaC * lluviaMmH * (p.areaCuencaKm2 * 0.12);
    const qDescargas = p.qDescBase * factorHumano;
    const qTotal = p.qBase + qLluvia + qDescargas;
    const qReferencia = p.qBase + p.qDescBase;

    // Los taponamientos por basura/escombro elevan el nivel efectivo (efecto remanso)
    const crecimientoPct = Math.max(0, Math.round(((qTotal - qReferencia) / qReferencia) * 100 + taponamientos * 3.5));

    // Contaminación: carga humana + primer lavado por lluvia ("first flush") vs dilución parcial
    const arrastreLluvia = lluviaMmH > 0 ? Math.min(28, lluviaMmH * 0.75) : 0;
    const dilucion = qReferencia / Math.max(qTotal, 0.5);
    const dbo5 = Number(((p.dboBase * factorHumano * dilucion) + arrastreLluvia * 0.6).toFixed(1));

    // Oxígeno Disuelto ajustado por temperatura (Arrhenius) y consumo de DBO (Streeter-Phelps simplificado)
    const odSat = calcularSaturacionODPuebla(tempC);
    const deficitTermico = Math.max(0, (tempC - 18.5) * 0.12);
    const odMgL = Math.max(0.4, Math.min(odSat, p.odBase * dilucion + (lluviaMmH * 0.03) - (dbo5 - p.dboBase) * 0.025 - deficitTermico));
    const odPct = (odMgL / odSat) * 100;

    // Índice compuesto 0-100
    const indiceContam = Math.round(Math.max(10, Math.min(99, (dbo5 * 0.7) + ((100 - odPct) * 0.45) + quejasActivas * 2)));
    const semaforo = semaforoCONAGUA(dbo5, odPct);

    return {
        nombreRio,
        quejasActivas,
        qTotal: Number(qTotal.toFixed(2)),
        crecimientoPct,
        dbo5,
        odMgL: Number(odMgL.toFixed(2)),
        odPct: Number(odPct.toFixed(1)),
        indiceContam,
        semaforo
    };
}

window.sincronizarClimaVivo = async function (forzar = false) {
    const badge = document.getElementById('badge-clima-estado');
    const btn = document.getElementById('btn-consultar-clima');
    const modo = obtenerModoClima();
    if (badge) badge.textContent = 'Consultando 6 estaciones en Puebla...';
    if (btn) btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/api/clima-puebla${forzar ? '?forzar=1' : ''}`);
        const data = await res.json();
        ultimosDatosClima = data;

        const sliderLluvia = document.getElementById('slider-lluvia');
        const sliderTemp = document.getElementById('slider-temp');
        if (sliderLluvia && typeof data.lluvia_mm_h === 'number') {
            sliderLluvia.value = Math.min(50, Math.round(data.lluvia_mm_h));
        }
        if (sliderTemp && typeof data.temperatura_c === 'number') {
            sliderTemp.value = Math.min(30, Math.max(10, data.temperatura_c));
        }

        pintarEstacionesClima(data);

        if (badge) {
            const prefijo = modo === 'manual' ? 'Manual' : 'Auto (2h)';
            badge.textContent = data.success
                ? `${prefijo}: ${data.lluvia_mm_h} mm/h (pico ${data.lluvia_max_mm_h ?? data.lluvia_mm_h}) · ${data.temperatura_c}°C`
                : 'Clima: respaldo local';
        }
        climaCargado = true;
        renderizarGraficaPrediccion();
        if (forzar) {
            mostrarNotificacionDash('Lectura meteorológica en tiempo real actualizada para las 6 zonas de Puebla.', 'success');
        }
    } catch (e) {
        if (badge) badge.textContent = 'Clima: sin conexión al servidor local';
    } finally {
        if (btn) btn.disabled = false;
    }
};

window.mostrarVista = function (vista) {
    const vistaBandeja = document.getElementById('vista-bandeja');
    const vistaPrediccion = document.getElementById('vista-prediccion');
    const navBandeja = document.getElementById('nav-bandeja');
    const navPrediccion = document.getElementById('nav-prediccion');

    const activeClass = "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-white bg-primary rounded-xl shadow-md shadow-primary/20 transition-colors text-left";
    const inactiveClass = "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 rounded-xl hover:bg-gray-50 transition-colors text-left";

    if (vista === 'prediccion') {
        vistaBandeja.classList.add('hidden');
        vistaPrediccion.classList.remove('hidden');
        navPrediccion.className = activeClass;
        navBandeja.className = inactiveClass;
        if (!climaCargado && obtenerModoClima() === 'auto') {
            sincronizarClimaVivo(false);
        } else if (!climaCargado && obtenerModoClima() === 'manual') {
            const badge = document.getElementById('badge-clima-estado');
            if (badge) badge.textContent = 'Modo Manual: presiona "Consultar Clima Ahora"';
        }
        renderizarGraficaPrediccion();
    } else {
        vistaPrediccion.classList.add('hidden');
        vistaBandeja.classList.remove('hidden');
        navBandeja.className = activeClass;
        navPrediccion.className = inactiveClass;
        setTimeout(() => dashMap.invalidateSize(), 150);
    }
};

window.renderizarGraficaPrediccion = function () {
    const canvas = document.getElementById('grafica-prediccion');
    if (!canvas || typeof Chart === 'undefined') return;

    const rio = document.getElementById('select-rio-prediccion').value;
    const horizonte = document.getElementById('select-horizonte-prediccion').value;
    const lluvia = Number(document.getElementById('slider-lluvia')?.value || 0);
    const descargas = Number(document.getElementById('slider-descargas')?.value || 0);
    const temp = Number(document.getElementById('slider-temp')?.value || 18.5);
    const taponamientos = Number(document.getElementById('slider-taponamientos')?.value || 1);

    document.getElementById('val-lluvia').textContent = `${lluvia} mm/h`;
    document.getElementById('val-descargas').textContent = `${descargas >= 0 ? '+' : ''}${descargas}%`;
    document.getElementById('val-temp').textContent = `${temp} °C`;
    document.getElementById('val-taponamientos').textContent = `${taponamientos}`;

    const titulo = document.getElementById('titulo-grafica-prediccion');
    if (titulo) titulo.textContent = `Proyección de Contaminación y Crecimiento · ${rio}`;

    if (chartPrediccion) chartPrediccion.destroy();

    if (rio === 'Todos los ríos') {
        const nombres = Object.keys(PARAMETROS_RIOS);
        const sims = nombres.map(n => simularRio(n, lluvia, descargas, temp, taponamientos));
        const promContam = Math.round(sims.reduce((a, s) => a + s.indiceContam, 0) / sims.length);
        const maxCrec = Math.max(...sims.map(s => s.crecimientoPct));
        const rioCritico = sims.reduce((a, b) => (b.indiceContam > a.indiceContam ? b : a));

        document.getElementById('kpi-indice-actual').textContent = promContam;
        document.getElementById('kpi-crecimiento-rio').textContent = `+${maxCrec}%`;
        document.getElementById('kpi-caudal-m3s').textContent = `Máx. en ${rioCritico.nombreRio}`;
        const badgeSem = document.getElementById('badge-semaforo-pred');
        badgeSem.textContent = rioCritico.semaforo.texto;
        badgeSem.className = `px-3 py-1 border text-xs font-bold rounded-full ${rioCritico.semaforo.cls}`;

        document.getElementById('texto-diagnostico-modelo').textContent =
            `Comparativa simultánea de los 5 ríos con ${lluvia} mm/h de lluvia y ${descargas >= 0 ? '+' : ''}${descargas}% en descargas. El cauce más crítico es ${rioCritico.nombreRio}.`;
        document.getElementById('detalle-metricas-modelo').innerHTML = `
            <p>• Río más afectado: <strong>${rioCritico.nombreRio} (${rioCritico.indiceContam}/100)</strong></p>
            <p>• DBO5 crítica: <strong>${rioCritico.dbo5} mg/L</strong></p>
            <p>• Crecimiento pico: <strong>+${maxCrec}% sobre caudal base</strong></p>`;

        chartPrediccion = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: nombres,
                datasets: [
                    {
                        label: 'Nivel de Contaminación (0 a 100)',
                        data: sims.map(s => s.indiceContam),
                        backgroundColor: 'rgba(149, 26, 62, 0.85)',
                        borderRadius: 6,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Crecimiento del Río (+% caudal)',
                        data: sims.map(s => s.crecimientoPct),
                        backgroundColor: 'rgba(3, 105, 161, 0.78)',
                        borderRadius: 6,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ctx.dataset.yAxisID === 'y'
                                ? `Contaminación: ${ctx.parsed.y} / 100 pts`
                                : `Crecimiento del río: +${ctx.parsed.y}%`
                        }
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        position: 'left',
                        min: 0,
                        max: 100,
                        title: { display: true, text: 'Contaminación (0-100 pts)' }
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        min: 0,
                        suggestedMax: 100,
                        grace: '15%',
                        grid: { drawOnChartArea: false },
                        title: { display: true, text: 'Crecimiento del Río (+%)' }
                    }
                }
            }
        });
        return;
    }

    const sim = simularRio(rio, lluvia, descargas, temp, taponamientos);
    document.getElementById('kpi-indice-actual').textContent = sim.indiceContam;
    document.getElementById('kpi-crecimiento-rio').textContent = `+${sim.crecimientoPct}%`;
    document.getElementById('kpi-caudal-m3s').textContent = `${sim.qTotal} m³/s estimados`;

    const badgeSem = document.getElementById('badge-semaforo-pred');
    badgeSem.textContent = sim.semaforo.texto;
    badgeSem.className = `px-3 py-1 border text-xs font-bold rounded-full ${sim.semaforo.cls}`;

    const estadoNivel = sim.crecimientoPct >= 45
        ? 'Riesgo de desbordamiento'
        : (sim.crecimientoPct >= 20 ? 'Crecimiento moderado' : 'Cauce estable');

    document.getElementById('texto-diagnostico-modelo').textContent =
        sim.crecimientoPct >= 45
            ? `Alerta en ${rio}: la combinación de lluvia (${lluvia} mm/h) y ${taponamientos} taponamiento(s) eleva el caudal +${sim.crecimientoPct}% con riesgo de desborde.`
            : `Proyección para ${rio} aplicando Streeter-Phelps (T=${temp}°C) y escorrentía por lluvia (${lluvia} mm/h).`;

    document.getElementById('detalle-metricas-modelo').innerHTML = `
        <p>• Oxígeno Disuelto (OD): <strong>${sim.odMgL} mg/L (${sim.odPct}%)</strong></p>
        <p>• DBO5 proyectada: <strong>${sim.dbo5} mg/L</strong></p>
        <p>• Nivel de cauce: <strong>${estadoNivel}</strong></p>
        <p>• Quejas activas en este río: <strong>${sim.quejasActivas}</strong></p>`;

    const etiquetas = horizonte === '30d'
        ? ['Sem -2', 'Sem -1', 'Actual', 'Sem +1', 'Sem +2', 'Sem +3', 'Sem +4']
        : (horizonte === '3m'
            ? ['Mes -1', 'Actual', 'Mes +1', 'Mes +2', 'Mes +3']
            : ['Mes -1', 'Actual', 'Mes +1', 'Mes +2', 'Mes +3', 'Mes +4', 'Mes +5', 'Mes +6']);

    const splitIdx = etiquetas.indexOf('Actual');
    const factorPaso = descargas >= 0 ? 1.8 : -1.2;
    const serieContam = etiquetas.map((_, i) => {
        const delta = (i - splitIdx) * factorPaso;
        return Math.round(Math.max(8, Math.min(99, sim.indiceContam + delta)));
    });
    const serieCrecimiento = etiquetas.map((_, i) => {
        const delta = i < splitIdx ? -4 * (splitIdx - i) : (i - splitIdx) * (lluvia > 5 ? 3 : 1);
        return Math.round(Math.max(0, sim.crecimientoPct + delta));
    });

    chartPrediccion = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: etiquetas,
            datasets: [
                {
                    label: 'Contaminación (0 a 100 pts)',
                    data: serieContam,
                    borderColor: '#951a3e',
                    backgroundColor: 'rgba(149, 26, 62, 0.12)',
                    borderWidth: 3,
                    pointRadius: 4,
                    tension: 0.35,
                    fill: true,
                    yAxisID: 'y'
                },
                {
                    label: 'Crecimiento del Río (+% caudal)',
                    data: serieCrecimiento,
                    borderColor: '#0369a1',
                    backgroundColor: 'rgba(3, 105, 161, 0.08)',
                    borderWidth: 3,
                    borderDash: [6, 6],
                    pointRadius: 4,
                    tension: 0.35,
                    fill: true,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ctx.dataset.yAxisID === 'y'
                            ? `Contaminación: ${ctx.parsed.y} / 100 pts`
                            : `Crecimiento del río: +${ctx.parsed.y}%`
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    position: 'left',
                    min: 0,
                    max: 100,
                    title: { display: true, text: 'Contaminación (0-100 pts)' }
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    min: 0,
                    suggestedMax: 100,
                    grace: '15%',
                    grid: { drawOnChartArea: false },
                    title: { display: true, text: 'Crecimiento del Río (+%)' }
                }
            }
        }
    });
};
