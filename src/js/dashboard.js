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

setTimeout(() => dashMap.invalidateSize(), 300);

// 2. Carga de reportes desde PostgreSQL
const tabla = document.getElementById('tabla-prioridades');
const buscador = document.getElementById('buscador-calles');

async function cargarDatos() {
    try {
        const response = await fetch(`${API_BASE}/api/reportes`);
        const data = await response.json();

        if (response.ok) {
            reportesDB = data;
            actualizarContadores();
            renderizarTabla();
            if (reportesDB.length > 0 && !reporteSeleccionado) {
                seleccionarCalle(reportesDB[0].id);
            }
        } else {
            console.error("Error del backend:", data.error);
            tabla.innerHTML = `<tr><td colspan="4" class="px-6 py-12 text-center text-red-600 font-medium">Error al consultar reportes: ${data.error || 'Error del servidor'}</td></tr>`;
        }
    } catch (error) {
        console.error("No se pudo conectar con la BD:", error);
        tabla.innerHTML = `<tr><td colspan="4" class="px-6 py-12 text-center text-amber-700 font-medium">No se pudo conectar con el servidor (localhost:3000). Asegúrate de iniciar backend.js.</td></tr>`;
    }
}

function actualizarContadores() {
    const catFiltro = document.getElementById('filtro-categoria') ? document.getElementById('filtro-categoria').value : "";
    let baseData = reportesDB;
    if (catFiltro !== "") {
        baseData = reportesDB.filter(r => r.categoria && r.categoria === catFiltro);
    }

    document.getElementById('badge-todos').innerText = baseData.length;
    document.getElementById('badge-validando').innerText = baseData.filter(r => r.estado && r.estado.toLowerCase().includes('validando')).length;
    document.getElementById('badge-inspeccion').innerText = baseData.filter(r => r.estado && r.estado.toLowerCase().includes('inspecci')).length;
    document.getElementById('badge-reparacion').innerText = baseData.filter(r => r.estado && r.estado.toLowerCase().includes('reparaci')).length;
    document.getElementById('badge-concluidos').innerText = baseData.filter(r => r.estado && r.estado.toLowerCase().includes('concluido')).length;
}

function renderizarTabla(textoBusqueda = "") {
    actualizarContadores();
    tabla.innerHTML = "";

    let filtrados = reportesDB;

    if (estadoFiltro !== "") {
        const searchEstado = estadoFiltro.toLowerCase().replace('ó', 'o');
        filtrados = filtrados.filter(r => r.estado && r.estado.toLowerCase().replace('ó', 'o').includes(searchEstado));
    }

    const catFiltro = document.getElementById('filtro-categoria').value;
    const tituloMapa = document.getElementById('titulo-mapa-calor');
    if (tituloMapa) {
        tituloMapa.textContent = catFiltro === ""
            ? "Mapa de Ríos Monitoreados - Puebla"
            : `Mapa de Ríos Monitoreados · ${catFiltro}`;
    }

    if (catFiltro !== "") {
        filtrados = filtrados.filter(r => r.categoria && r.categoria === catFiltro);
    }

    if (textoBusqueda !== "") {
        const txt = textoBusqueda.toLowerCase();
        filtrados = filtrados.filter(r =>
            (r.id && r.id.toLowerCase().includes(txt)) ||
            (r.ubicacion && r.ubicacion.toLowerCase().includes(txt)) ||
            (r.categoria && r.categoria.toLowerCase().includes(txt)) ||
            (r.descripcion && r.descripcion.toLowerCase().includes(txt))
        );
    }

    const contadorBandeja = document.getElementById('contador-bandeja');
    if (contadorBandeja) {
        contadorBandeja.textContent = `${filtrados.length} ${filtrados.length === 1 ? 'queja' : 'quejas'}`;
    }

    if (filtrados.length === 0) {
        tabla.innerHTML = `<tr><td colspan="4" class="px-6 py-12 text-center text-gray-500 font-medium">No se encontraron quejas registradas.</td></tr>`;
        return;
    }

    filtrados.forEach(calle => {
        let badgeClass = "bg-blue-50 text-blue-700 border-blue-200";
        let dotClass = "bg-blue-600";

        const safeEstado = calle.estado || "Desconocido";
        const lowerEstado = safeEstado.toLowerCase();

        if (lowerEstado.includes('inspecci') || lowerEstado.includes('asignada')) {
            badgeClass = "bg-purple-50 text-purple-700 border-purple-200";
            dotClass = "bg-purple-600";
        } else if (lowerEstado.includes('reparaci')) {
            badgeClass = "bg-yellow-50 text-yellow-700 border-yellow-200";
            dotClass = "bg-yellow-500";
        } else if (lowerEstado.includes('concluido') || lowerEstado.includes('resuelta')) {
            badgeClass = "bg-green-50 text-green-700 border-green-200";
            dotClass = "bg-green-600";
        }

        const isSelected = reporteSeleccionado && reporteSeleccionado.id === calle.id;
        const rowClass = isSelected ? "bg-gray-50 border-l-4 border-l-primary" : "hover:bg-gray-50 border-l-4 border-l-transparent";

        tabla.innerHTML += `
            <tr class="${rowClass} transition-colors cursor-pointer border-b border-gray-50" onclick="seleccionarCalle('${calle.id}')">
                <td class="px-6 py-4">
                    <p class="text-sm font-bold text-gray-900">${calle.id || '-'}</p>
                    <p class="text-xs text-gray-500">${calle.categoria || 'Sin Categoría'}</p>
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

window.seleccionarCalle = function (id) {
    const info = reportesDB.find(c => c.id === id);
    if (!info) return;

    reporteSeleccionado = info;
    renderizarTabla(buscador.value);

    document.getElementById('detalle-categoria').textContent = info.categoria;
    document.getElementById('detalle-costo').textContent = info.costo ? info.costo : "Pendiente";
    const correoInfo = info.correo ? `<br><span class="text-xs opacity-80">Contacto: ${info.correo}</span>` : '';
    document.getElementById('detalle-analisis').innerHTML = `<strong>Folio ${info.id}</strong> (${info.fecha || 'Sin fecha'})<br><span class="text-xs opacity-85">${info.ubicacion || ''}</span>${correoInfo}<br><br>${info.descripcion}`;

    document.getElementById('card-bg-imagen').style.backgroundImage = `url('${info.img || getCategoriaImg(info.categoria)}')`;

    const containerBtn = document.getElementById('btn-accion-container');
    const safeEstado = (info.estado || "").toLowerCase();

    if (safeEstado.includes('validando') || safeEstado.includes('reportado') || safeEstado.includes('recibida')) {
        containerBtn.innerHTML = `
            <div class="mt-4">
                <label class="block text-[10px] font-bold text-white mb-2 uppercase tracking-widest flex items-center gap-1">
                    <span class="material-symbols-outlined text-[16px]">calendar_month</span> Fecha de Inspección Ambiental / Muestreo:
                </label>
                <input type="date" id="fecha-inspeccion" class="block w-full rounded-lg border-none text-gray-800 shadow-sm focus:ring-2 focus:ring-white sm:text-sm px-4 py-2.5 mb-3 bg-white/90">
                <button onclick="agendarInspeccion('${info.id}')" id="btn-magico" class="w-full py-3 bg-white text-primary font-bold rounded-lg hover:bg-gray-100 transition-all shadow-md active:scale-95 text-sm uppercase tracking-wider flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined">event_available</span> Programar Inspección
                </button>
            </div>`;
    } else if (safeEstado.includes('inspecci') || safeEstado.includes('asignada')) {
        containerBtn.innerHTML = `
            <button onclick="lanzarDron('${info.id}')" id="btn-magico" class="w-full py-3 bg-white text-primary font-bold rounded-lg hover:bg-gray-100 transition-all shadow-md active:scale-95 text-sm uppercase tracking-wider flex items-center justify-center gap-2">
                <span class="material-symbols-outlined">payments</span> Asignar Presupuesto y Saneamiento
            </button>`;
    } else if (safeEstado.includes('reparaci')) {
        containerBtn.innerHTML = `
            <button onclick="concluirServicio('${info.id}')" id="btn-magico" class="w-full py-3 bg-green-500 hover:bg-green-400 text-white font-bold rounded-lg transition-all shadow-md active:scale-95 text-sm uppercase tracking-wider flex items-center justify-center gap-2 border border-green-400">
                <span class="material-symbols-outlined">task_alt</span> Concluir Atención
            </button>`;
    } else {
        containerBtn.innerHTML = `
            <button disabled class="w-full py-3 bg-white/20 text-white/50 font-bold rounded-lg cursor-not-allowed text-sm uppercase tracking-wider border border-white/20">
                Atención Concluida
            </button>`;
    }
};

window.agendarInspeccion = function (id) {
    const fechaInput = document.getElementById('fecha-inspeccion').value;
    if (!fechaInput) {
        alert("Por favor, selecciona una fecha en el calendario para agendar la inspección.");
        return;
    }

    const partesFecha = fechaInput.split('-');
    const fechaFormateada = `${partesFecha[2]}/${partesFecha[1]}/${partesFecha[0]}`;
    const btn = document.getElementById('btn-magico');
    btn.innerHTML = `<span class="material-symbols-outlined animate-spin">sync</span> Agendando...`;
    btn.classList.add('opacity-90', 'cursor-not-allowed');

    setTimeout(() => {
        const idx = reportesDB.findIndex(r => r.id === id);
        if (idx !== -1) {
            reportesDB[idx].estado = "Inspección Programada";
            const correo = reportesDB[idx].correo;
            renderizarTabla(buscador.value);
            seleccionarCalle(id);

            fetch(`${API_BASE}/api/notificar-estado`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    correo: correo || '',
                    folio: id,
                    nuevoEstado: "Inspección Programada",
                    mensaje: `Tu queja ambiental ha sido validada. Hemos programado una brigada de inspección ambiental y muestreo del Estado de Puebla para acudir al punto del río el día <strong>${fechaFormateada}</strong> y evaluar las acciones de saneamiento necesarias.`
                })
            }).catch(e => console.error("Error al actualizar/enviar email:", e));

            alert(`Inspección ambiental agendada para el ${fechaFormateada}.\nSe ha notificado el cambio de estado.`);
        }
    }, 1000);
};

window.lanzarDron = function (id) {
    const btn = document.getElementById('btn-magico');
    btn.innerHTML = `<span class="material-symbols-outlined animate-spin">sync</span> Procesando Presupuesto...`;
    btn.classList.add('opacity-90', 'cursor-not-allowed');

    setTimeout(() => {
        const idx = reportesDB.findIndex(r => r.id === id);
        if (idx !== -1) {
            reportesDB[idx].estado = "En reparación";
            reportesDB[idx].costo = (Math.floor(Math.random() * 50) + 10).toLocaleString() + ",000";
            const correo = reportesDB[idx].correo;
            renderizarTabla(buscador.value);
            seleccionarCalle(id);

            fetch(`${API_BASE}/api/notificar-estado`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    correo: correo || '',
                    folio: id,
                    nuevoEstado: "En Reparación",
                    mensaje: `La inspección ambiental concluyó y se ha asignado un presupuesto oficial de $${reportesDB[idx].costo} MXN. La brigada de saneamiento se encuentra atendiendo el punto reportado.`
                })
            }).catch(e => console.error("Error al actualizar/enviar email:", e));

            alert(`Inspección Finalizada.\nPresupuesto de saneamiento asignado: $${reportesDB[idx].costo} MXN.\nQueja en atención y notificada por correo.`);
        }
    }, 1500);
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
            seleccionarCalle(id);

            fetch(`${API_BASE}/api/notificar-estado`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    correo: correo || '',
                    folio: id,
                    nuevoEstado: "Concluido",
                    mensaje: "¡Buenas noticias! Tu queja ambiental sobre el río ha sido atendida y concluida exitosamente. Puedes consultar el estatus de tu folio en el portal ciudadano."
                })
            }).catch(e => console.error("Error al actualizar/enviar email:", e));

            alert(`Queja marcada como Concluida.\nEl ciudadano ha sido notificado.`);
        }
    }, 1000);
};

window.abrirModal = function (event, id) {
    event.stopPropagation();
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

// 3. Navegación entre Bandeja de Quejas y Proyección de Ríos (Gráfica base)
let chartPrediccion = null;

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

    const titulo = document.getElementById('titulo-grafica-prediccion');
    if (titulo) titulo.textContent = `Tendencia y Proyección · ${rio}`;

    const etiquetas = horizonte === '30d'
        ? ['Sem -3', 'Sem -2', 'Sem -1', 'Actual', 'Sem +1', 'Sem +2', 'Sem +3', 'Sem +4']
        : (horizonte === '3m'
            ? ['Mes -2', 'Mes -1', 'Actual', 'Mes +1', 'Mes +2', 'Mes +3']
            : ['Mes -2', 'Mes -1', 'Actual', 'Mes +1', 'Mes +2', 'Mes +3', 'Mes +4', 'Mes +5', 'Mes +6']);

    const basePorRio = {
        'Río Atoyac': 74,
        'Río Alseseca': 68,
        'Río Zahuapan': 61,
        'Río Nexapa': 52,
        'Río Prieto': 58
    };
    const base = basePorRio[rio] || 60;
    const kpiActual = document.getElementById('kpi-indice-actual');
    if (kpiActual) kpiActual.textContent = base;

    const splitIdx = etiquetas.indexOf('Actual');
    const historico = etiquetas.map((_, idx) => idx <= splitIdx ? Math.max(20, Math.min(95, base - (splitIdx - idx) * 2)) : null);
    const proyeccion = etiquetas.map((_, idx) => idx >= splitIdx ? Math.max(20, Math.min(98, base + (idx - splitIdx) * 3)) : null);

    if (chartPrediccion) chartPrediccion.destroy();

    chartPrediccion = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: etiquetas,
            datasets: [
                {
                    label: 'Histórico registrado (base)',
                    data: historico,
                    borderColor: '#951a3e',
                    backgroundColor: 'rgba(149, 26, 62, 0.12)',
                    borderWidth: 3,
                    pointRadius: 4,
                    tension: 0.35,
                    fill: true
                },
                {
                    label: 'Proyección estimada (espacio para modelo IA)',
                    data: proyeccion,
                    borderColor: '#0369a1',
                    backgroundColor: 'rgba(3, 105, 161, 0.08)',
                    borderWidth: 3,
                    borderDash: [6, 6],
                    pointRadius: 4,
                    tension: 0.35,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'bottom' }
            },
            scales: {
                y: {
                    min: 0,
                    max: 100,
                    title: { display: true, text: 'Índice de Riesgo / Contaminación (0-100)' }
                }
            }
        }
    });
};
