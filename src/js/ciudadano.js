/**
 * Lógica del Portal Ciudadano - Denuncia Ambiental de Ríos (Puebla)
 */
const API_BASE = 'http://localhost:3000';
let reportes = [];
let evidenciaBase64Url = null;
let capaActual = 'calles';
let mapaAmpliado = false;
let geocodeAbort = null;
let geocodeTimer = null;

// 1. Inicializar Mapa de Puebla (restringido al área de Puebla)
const initialCoords = window.RiosPueblaMap.PUEBLA_COORDS;
const map = window.RiosPueblaMap.crearMapaPuebla('map-container', {
    zoomAnimation: true,
    wheelDebounceTime: 25
});

const { capaCalles, capaSatelite } = window.RiosPueblaMap.crearCapasBase();
capaCalles.addTo(map);

function toggleTamanoMapa() {
    const wrapper = document.getElementById('map-wrapper');
    const icon = document.getElementById('icon-expand-map');
    mapaAmpliado = !mapaAmpliado;
    if (mapaAmpliado) {
        wrapper.classList.remove('h-[420px]', 'md:h-[540px]');
        wrapper.classList.add('h-[75vh]');
        icon.textContent = 'close_fullscreen';
    } else {
        wrapper.classList.remove('h-[75vh]');
        wrapper.classList.add('h-[420px]', 'md:h-[540px]');
        icon.textContent = 'open_in_full';
    }
    setTimeout(() => map.invalidateSize(), 310);
}

function cambiarCapaMapa(tipo) {
    if (tipo === capaActual) return;
    const btnCalles = document.getElementById('btn-layer-calles');
    const btnSatelite = document.getElementById('btn-layer-satelite');
    if (tipo === 'satelite') {
        map.removeLayer(capaCalles);
        capaSatelite.addTo(map);
        btnSatelite.className = "px-2.5 py-1.5 rounded-md text-[11px] md:text-xs font-bold bg-primary text-white transition-colors flex items-center gap-1";
        btnCalles.className = "px-2.5 py-1.5 rounded-md text-[11px] md:text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-1";
    } else {
        map.removeLayer(capaSatelite);
        capaCalles.addTo(map);
        btnCalles.className = "px-2.5 py-1.5 rounded-md text-[11px] md:text-xs font-bold bg-primary text-white transition-colors flex items-center gap-1";
        btnSatelite.className = "px-2.5 py-1.5 rounded-md text-[11px] md:text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-1";
    }
    capaActual = tipo;
}

// 2. Marcador y Geocodificación
const marker = L.marker(initialCoords, { draggable: true }).addTo(map);

function actualizarPuntoMapa(lat, lng) {
    if (!window.RiosPueblaMap.PUEBLA_BOUNDS.contains([lat, lng])) {
        showToast("Selecciona una ubicación dentro del Estado de Puebla.", "info");
        marker.setLatLng(initialCoords);
        map.panTo(initialCoords);
        return;
    }
    document.getElementById('ubicacion').value = `Obteniendo dirección (${lat.toFixed(5)}, ${lng.toFixed(5)})...`;
    clearTimeout(geocodeTimer);
    geocodeTimer = setTimeout(() => reverseGeocode(lat, lng), 120);
}

window.RiosPueblaMap.cargarRiosGeoJSON(map, {
    onRiverClick: (e) => {
        L.DomEvent.stopPropagation(e);
        marker.setLatLng(e.latlng);
        actualizarPuntoMapa(e.latlng.lat, e.latlng.lng);
    }
}).then(({ totalTramos }) => {
    const statusEl = document.getElementById('rivers-status-text');
    if (statusEl) statusEl.textContent = `Ríos de Puebla resaltados (${totalTramos} tramos exactos OSM)`;
}).catch(err => {
    console.warn('Error cargando ríos:', err);
});

marker.on('dragend', (e) => {
    const coords = e.target.getLatLng();
    actualizarPuntoMapa(coords.lat, coords.lng);
});

map.on('click', (e) => {
    marker.setLatLng(e.latlng);
    actualizarPuntoMapa(e.latlng.lat, e.latlng.lng);
});

function reverseGeocode(lat, lon, isAutoGPS = false) {
    if (geocodeAbort) geocodeAbort.abort();
    geocodeAbort = new AbortController();
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, { signal: geocodeAbort.signal })
        .then(r => r.json())
        .then(data => {
            const addressStr = data.display_name || `${lat}, ${lon}`;
            document.getElementById('ubicacion').value = addressStr;

            const selectAlcaldia = document.getElementById('alcaldia');
            let found = false;
            const norm = (str) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
            const normalizedAddress = norm(addressStr);

            for (let i = 1; i < selectAlcaldia.options.length; i++) {
                if (normalizedAddress.includes(norm(selectAlcaldia.options[i].value))) {
                    selectAlcaldia.selectedIndex = i;
                    found = true;
                    break;
                }
            }

            if (!found) {
                const parts = data.address || {};
                const arr = [parts.city, parts.municipality, parts.county, parts.town, parts.borough, parts.suburb];
                for (const p of arr) {
                    if (!p) continue;
                    const cleanP = norm(p.replace('Municipio de', '').replace('Heroica', '').trim());
                    for (let i = 1; i < selectAlcaldia.options.length; i++) {
                        const optVal = norm(selectAlcaldia.options[i].value);
                        if (optVal && (cleanP.includes(optVal) || optVal.includes(cleanP))) {
                            selectAlcaldia.selectedIndex = i;
                            found = true;
                            break;
                        }
                    }
                    if (found) break;
                }
            }

            if (!found) {
                const borders = ['cholula', 'tlaxcalancingo', 'momoxpan', 'angelopolis', 'valsequillo'];
                if (borders.some(b => normalizedAddress.includes(b))) {
                    for (let i = 1; i < selectAlcaldia.options.length; i++) {
                        if (selectAlcaldia.options[i].value === "Puebla") {
                            selectAlcaldia.selectedIndex = i;
                            found = true;
                            break;
                        }
                    }
                }
            }

            if (!found && isAutoGPS) {
                showToast("El GPS te ubica fuera de Puebla. Puedes arrastrar el marcador para mayor precisión.", "info");
            }
        })
        .catch(e => {
            if (e.name !== 'AbortError') console.error(e);
        });
}

document.getElementById('btn-gps').addEventListener('click', function () {
    const btn = this;
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span class="material-symbols-outlined text-[18px] animate-spin">sync</span> Buscando...';
    btn.disabled = true;

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const newLatLng = [position.coords.latitude, position.coords.longitude];
                map.setView(newLatLng, 17);
                marker.setLatLng(newLatLng);
                reverseGeocode(newLatLng[0], newLatLng[1], true);

                btn.innerHTML = '<span class="material-symbols-outlined text-[18px] text-green-600">check_circle</span> Centrado';
                setTimeout(() => { btn.innerHTML = originalHTML; btn.disabled = false; }, 3000);
            },
            () => {
                showToast("Sin acceso a GPS. Haz clic o arrastra el marcador en el mapa manualmente.", "error");
                btn.innerHTML = originalHTML;
                btn.disabled = false;
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    } else {
        showToast("Tu navegador no soporta geolocalización.", "error");
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
});

setTimeout(() => map.invalidateSize(), 500);

// 3. Scroll Hero, Evidencia, Consulta de Folio y Toast
function irCrearReporte() {
    const el = document.getElementById('content-reportar');
    if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - 100;
        window.scrollTo({ top: y, behavior: 'smooth' });
    }
    setTimeout(() => map.invalidateSize(), 200);
}

document.getElementById('file-evidencia').addEventListener('change', function (event) {
    const file = event.target.files[0];
    const icon = document.getElementById('photo-icon');
    const text = document.getElementById('photo-text');
    const subtext = document.getElementById('photo-subtext');
    const container = document.getElementById('photo-preview-container');

    const existingImg = document.getElementById('preview-img');
    if (existingImg) existingImg.remove();
    const existingOverlay = document.getElementById('preview-overlay');
    if (existingOverlay) existingOverlay.remove();

    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            icon.innerText = "check_circle";
            icon.classList.remove('text-slate-400');
            icon.classList.add('text-green-500', 'bg-white', 'rounded-full', 'p-1', 'shadow-sm');
            text.innerText = "Foto adjuntada correctamente";
            text.classList.add('bg-white/90', 'px-3', 'py-1', 'rounded-full');
            subtext.innerText = "Toca para cambiar de archivo";
            subtext.classList.add('bg-white/90', 'px-2', 'py-0.5', 'rounded');

            const img = document.createElement('img');
            img.id = 'preview-img';
            img.src = e.target.result;
            evidenciaBase64Url = e.target.result;
            img.className = 'absolute inset-0 w-full h-full object-cover z-0 opacity-40 mix-blend-multiply';
            container.appendChild(img);

            const overlay = document.createElement('div');
            overlay.id = 'preview-overlay';
            overlay.className = 'absolute inset-0 bg-green-50 z-[-1]';
            container.appendChild(overlay);
        };
        reader.readAsDataURL(file);
    }
});

function abrirConsulta() {
    document.getElementById('modal-consultar').classList.remove('hidden');
    document.getElementById('input-buscar-folio').value = '';
    document.getElementById('resultado-busqueda').classList.add('hidden');
    document.getElementById('error-busqueda').classList.add('hidden');
    setTimeout(() => document.getElementById('input-buscar-folio').focus(), 100);
}

function cerrarConsulta() {
    document.getElementById('modal-consultar').classList.add('hidden');
}

function buscarFolio() {
    const input = document.getElementById('input-buscar-folio').value.trim().toUpperCase();
    const resultado = document.getElementById('resultado-busqueda');
    const error = document.getElementById('error-busqueda');
    if (!input) return;
    const reporte = reportes.find(r => r.id.toUpperCase() === input);
    if (reporte) {
        error.classList.add('hidden');
        document.getElementById('res-folio').innerText = reporte.id;
        document.getElementById('res-categoria').innerText = reporte.categoria;
        document.getElementById('res-dependencia').innerText = reporte.dependencia;
        document.getElementById('res-descripcion').innerText = reporte.descripcion;

        const badge = document.getElementById('res-badge');
        if (reporte.estado === "Concluido") {
            badge.className = "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-800 border border-green-200";
            badge.innerText = "Concluido";
        } else if (reporte.estado === "Validando (IA / Dron)") {
            badge.className = "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200";
            badge.innerText = "Validando";
        } else {
            badge.className = "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-yellow-100 text-yellow-800 border border-yellow-200";
            badge.innerText = reporte.estado;
        }
        resultado.classList.remove('hidden');
    } else {
        resultado.classList.add('hidden');
        error.classList.remove('hidden');
    }
}

document.getElementById('input-buscar-folio').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') buscarFolio();
});

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const icon = type === 'success' ? 'check_circle' : (type === 'error' ? 'error' : 'info');
    const color = type === 'success' ? 'bg-green-50 text-green-800 border-green-200' :
        (type === 'error' ? 'bg-red-50 text-red-800 border-red-200' : 'bg-blue-50 text-blue-800 border-blue-200');
    const iconColor = type === 'success' ? 'text-green-500' : (type === 'error' ? 'text-red-500' : 'text-blue-500');
    const toast = document.createElement('div');
    toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg ${color} animate-slide-up pointer-events-auto`;
    toast.innerHTML = `<span class="material-symbols-outlined ${iconColor}">${icon}</span><p class="text-sm font-semibold">${message}</p>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 6000);
}

function mostrarTicket(folio) {
    document.getElementById('ticket-folio').innerText = folio;
    document.getElementById('modal-ticket').classList.remove('hidden');
}

function cerrarTicket() {
    document.getElementById('modal-ticket').classList.add('hidden');
}

// 4. Cargar reportes (para consulta de folio y contador) y Enviar Queja
async function cargarReportesDB() {
    try {
        const res = await fetch(`${API_BASE}/api/reportes`);
        reportes = await res.json();
        const heroCount = document.getElementById('hero-concluidas-count');
        if (heroCount) {
            heroCount.innerText = reportes.filter(r => r.estado === 'Concluido').length.toLocaleString();
        }
    } catch (err) {
        console.error("Error al cargar la DB:", err);
    }
}

const formReporte = document.getElementById('form-reporte');
formReporte.addEventListener('submit', (e) => {
    e.preventDefault();

    const btn = document.getElementById('btn-submit');
    const btnText = document.getElementById('btn-text');
    const btnIcon = document.getElementById('btn-icon');
    const spinner = document.getElementById('btn-spinner');

    btn.classList.add('opacity-90', 'cursor-not-allowed');
    btnText.innerText = "Enviando Queja Ambiental...";
    btnIcon.classList.add('hidden');
    spinner.classList.remove('hidden');

    setTimeout(() => {
        const ubicacion_calle = document.getElementById('ubicacion').value;
        const alcaldia = document.getElementById('alcaldia').value;
        const ubicacion_completa = `${ubicacion_calle}, ${alcaldia}`;
        const descripcion = document.getElementById('descripcion').value;
        const correo = document.getElementById('correo_contacto').value;
        const telefono = document.getElementById('telefono_contacto').value;
        const categoriaNode = document.querySelector('input[name="categoria"]:checked');
        const categoria = categoriaNode ? categoriaNode.value : "Otro";
        const coordsGps = marker.getLatLng();
        const ubicacionGps = `${coordsGps.lat.toFixed(6)}, ${coordsGps.lng.toFixed(6)}`;
        const nuevoFolio = "INC-PUE-" + Math.floor(Math.random() * 9000 + 1000);

        fetch(`${API_BASE}/api/reportes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                correo,
                folio: nuevoFolio,
                categoria,
                ubicacion: ubicacion_completa,
                ubicacionGps,
                descripcion,
                evidenciaBase64: evidenciaBase64Url
            })
        })
            .then(res => res.json())
            .then(data => {
                btn.classList.remove('opacity-90', 'cursor-not-allowed');
                btnText.innerText = "Enviar Queja Ambiental";
                btnIcon.classList.remove('hidden');
                spinner.classList.add('hidden');

                if (data.success) {
                    showToast(correo ? `Queja registrada y acuse enviado a: ${correo}` : `Queja ambiental registrada con folio ${nuevoFolio}`, 'success');
                    cargarReportesDB();

                    formReporte.reset();
                    const existingImg = document.getElementById('preview-img');
                    if (existingImg) existingImg.remove();
                    const existingOverlay = document.getElementById('preview-overlay');
                    if (existingOverlay) existingOverlay.remove();
                    document.getElementById('photo-icon').innerText = "add_a_photo";
                    document.getElementById('photo-icon').className = "material-symbols-outlined text-4xl text-slate-400 group-hover:text-primary transition-colors";
                    document.getElementById('photo-text').innerText = "Toca para tomar una foto o subir archivo";
                    document.getElementById('photo-text').classList.remove('bg-white/90', 'px-3', 'py-1', 'rounded-full');
                    document.getElementById('photo-subtext').innerText = "Las fotografías ayudan a priorizar la inspección ambiental en la ribera del río.";
                    document.getElementById('photo-subtext').classList.remove('bg-white/90', 'px-2', 'py-0.5', 'rounded');
                    evidenciaBase64Url = null;

                    map.setView(initialCoords, 12);
                    marker.setLatLng(initialCoords);
                    mostrarTicket(nuevoFolio);

                    if (telefono && telefono.trim() !== '') {
                        setTimeout(() => {
                            showToast(`📱 (Simulación WhatsApp): Tu folio ${nuevoFolio} está en proceso. Mensaje enviado al ${telefono}`, 'success');
                        }, 2000);
                    }
                } else {
                    showToast(`No se pudo registrar: ${data.error}`, 'error');
                }
            })
            .catch(err => {
                console.error("Error contactando al servidor:", err);
                showToast(`No se pudo conectar al servidor (Asegúrate de que backend.js está corriendo).`, 'warning');
                btn.classList.remove('opacity-90', 'cursor-not-allowed');
                btnText.innerText = "Enviar Queja Ambiental";
                btnIcon.classList.remove('hidden');
                spinner.classList.add('hidden');
            });
    }, 800);
});

document.addEventListener('DOMContentLoaded', cargarReportesDB);
