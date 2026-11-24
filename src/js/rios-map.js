/**
 * Módulo compartido para inicializar la capa de ríos de Puebla sobre Leaflet
 * usando el archivo local ./src/assets/rios-puebla.geojson y renderizado Canvas.
 */
window.RiosPueblaMap = (function () {
    const PUEBLA_COORDS = [19.0414, -98.2063];
    // Límites acotados a la zona metropolitana y cuenca de Puebla (zoom mínimo 10)
    const PUEBLA_BOUNDS = L.latLngBounds([18.75, -98.75], [19.52, -97.62]);
    const COLOR_RIO = '#0369a1';
    const COLOR_ARROYO = '#0ea5e9';

    function crearMapaPuebla(elementId, extraOpts = {}) {
        return L.map(elementId, Object.assign({
            preferCanvas: true,
            fadeAnimation: false,
            minZoom: 10,
            maxZoom: 19,
            maxBounds: PUEBLA_BOUNDS,
            maxBoundsViscosity: 1.0
        }, extraOpts)).setView(PUEBLA_COORDS, 12);
    }

    function grosorRio(tipo, zoom) {
        const base = tipo === 'river' ? 5 : (tipo === 'canal' ? 3.5 : 2.5);
        const factor = zoom >= 15 ? 1.6 : (zoom >= 13 ? 1.25 : 1);
        return base * factor;
    }

    function crearCapasBase() {
        const capaCalles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            subdomains: ['a', 'b', 'c'],
            maxZoom: 19,
            updateWhenIdle: false,
            updateWhenZooming: false,
            keepBuffer: 4,
            attribution: '© OpenStreetMap'
        });

        const capaSatelite = L.layerGroup([
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                maxZoom: 19,
                updateWhenIdle: false,
                updateWhenZooming: false,
                keepBuffer: 4,
                attribution: '© Esri World Imagery'
            }),
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
                maxZoom: 19,
                updateWhenIdle: false,
                keepBuffer: 4
            })
        ]);

        return { capaCalles, capaSatelite };
    }

    async function cargarRiosGeoJSON(map, options = {}) {
        const paneName = options.paneName || 'riosPane';
        const haloPaneName = `${paneName}_halo`;
        // Dos panes separados: TODOS los halos blancos se pintan debajo (440) y TODAS las líneas azules encima (450),
        // evitando cortes blancos en las uniones entre nodos/tramos consecutivos.
        if (!map.getPane(haloPaneName)) {
            map.createPane(haloPaneName);
            map.getPane(haloPaneName).style.zIndex = 440;
            map.getPane(haloPaneName).style.pointerEvents = 'none';
        }
        if (!map.getPane(paneName)) {
            map.createPane(paneName);
            map.getPane(paneName).style.zIndex = 450;
        }
        const haloRenderer = L.canvas({ pane: haloPaneName, padding: 0.5 });
        const renderer = L.canvas({ pane: paneName, padding: 0.5 });
        const riversLayer = L.layerGroup().addTo(map);
        const riosCargados = new Map();

        const res = await fetch('./src/assets/rios-puebla.geojson');
        if (!res.ok) throw new Error('No se pudo cargar rios-puebla.geojson');
        const geojson = await res.json();

        let totalTramos = 0;
        (geojson.features || []).forEach((feature, idx) => {
            const geom = feature.geometry;
            if (!geom) return;
            const p = feature.properties || {};
            const tipo = p.waterway || 'river';
            const nombre = p.NOMBRE || p.nombre || p.NAME || p.name || 'Río de Puebla';
            const osmId = p.osm_id || ('local-' + idx);

            const lines = geom.type === 'MultiLineString' ? geom.coordinates :
                          (geom.type === 'LineString' ? [geom.coordinates] : []);

            lines.forEach((coords, subIdx) => {
                if (!coords || coords.length < 2) return;
                const latlngs = coords.map(c => [c[1], c[0]]);
                const color = tipo === 'river' ? COLOR_RIO : COLOR_ARROYO;
                const w = grosorRio(tipo, map.getZoom());

                const halo = L.polyline(latlngs, {
                    renderer: haloRenderer, color: '#ffffff', weight: w + 4, opacity: 0.9,
                    lineCap: 'round', lineJoin: 'round', interactive: false
                });
                const osmLink = p.osm_id
                    ? `<br><a href="https://www.openstreetmap.org/way/${p.osm_id}" target="_blank" class="text-xs text-sky-700 underline">Ver tramo en OpenStreetMap</a>`
                    : '';
                const linea = L.polyline(latlngs, {
                    renderer, color, weight: w, opacity: 1,
                    lineCap: 'round', lineJoin: 'round'
                })
                .bindTooltip(nombre, { sticky: true })
                .bindPopup(`<strong>🌊 ${nombre}</strong><br><span class="text-xs text-slate-600">Tipo: ${tipo === 'river' ? 'Río principal' : (tipo === 'canal' ? 'Canal' : 'Arroyo / Afluente')}</span>${osmLink}`);

                linea.on('mouseover', () => linea.setStyle({ color: '#9F2241' }));
                linea.on('mouseout', () => linea.setStyle({ color }));
                if (typeof options.onRiverClick === 'function') {
                    linea.on('click', (e) => options.onRiverClick(e, nombre));
                }

                halo.addTo(riversLayer);
                linea.addTo(riversLayer);
                riosCargados.set(`${osmId}-${subIdx}`, { halo, linea, tipo });
                totalTramos++;
            });
        });

        map.on('zoomend', () => {
            const z = map.getZoom();
            riosCargados.forEach(({ halo, linea, tipo }) => {
                const w = grosorRio(tipo, z);
                linea.setStyle({ weight: w });
                halo.setStyle({ weight: w + 4 });
            });
        });

        return { totalTramos, riversLayer };
    }

    return { PUEBLA_COORDS, PUEBLA_BOUNDS, crearMapaPuebla, crearCapasBase, cargarRiosGeoJSON };
})();
