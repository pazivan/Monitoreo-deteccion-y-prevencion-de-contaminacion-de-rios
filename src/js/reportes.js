/**
 * Módulo de Generación de Reportes Oficiales en PDF (reportes.html)
 */
const API_BASE = 'http://localhost:3000';
let reportesLista = [];

async function cargarReportesParaPDF() {
    const cont = document.getElementById('lista-reportes-pdf');
    try {
        const res = await fetch(`${API_BASE}/api/reportes`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error del servidor');
        reportesLista = Array.isArray(data) ? data : [];
        renderizarReportesPDF();
    } catch (err) {
        cont.innerHTML = `<div class="p-8 text-center text-amber-700 text-sm font-medium">No se pudo conectar con el servidor (localhost:3000). Inicia <code>backend.js</code> para consultar los folios reales.</div>`;
    }
}

window.renderizarReportesPDF = function () {
    const cont = document.getElementById('lista-reportes-pdf');
    const filtroEstado = document.getElementById('filtro-estado-pdf').value;
    const catFiltro = document.getElementById('filtro-categoria-pdf')?.value || '';
    const texto = (document.getElementById('buscador-reportes-pdf').value || '').toLowerCase().trim();

    const concluidos = reportesLista.filter(r => (r.estado || '').toLowerCase().includes('concluido')).length;
    document.getElementById('pdf-kpi-concluidos').textContent = concluidos;
    document.getElementById('pdf-kpi-proceso').textContent = reportesLista.length - concluidos;

    let filtrados = reportesLista;
    if (filtroEstado !== '') {
        filtrados = filtrados.filter(r => (r.estado || '').toLowerCase().includes(filtroEstado.toLowerCase()));
    }
    if (catFiltro !== '') {
        filtrados = filtrados.filter(r => (r.categoria || '').toLowerCase().includes(catFiltro.toLowerCase()));
    }
    if (texto !== '') {
        filtrados = filtrados.filter(r =>
            (r.id && r.id.toLowerCase().includes(texto)) ||
            (r.ubicacion && r.ubicacion.toLowerCase().includes(texto)) ||
            (r.categoria && r.categoria.toLowerCase().includes(texto)) ||
            (r.descripcion && r.descripcion.toLowerCase().includes(texto))
        );
    }

    document.getElementById('pdf-kpi-total').textContent = filtrados.length;
    document.getElementById('pdf-contador').textContent = `${filtrados.length} ${filtrados.length === 1 ? 'registro' : 'registros'}`;

    if (filtrados.length === 0) {
        cont.innerHTML = `<div class="p-10 text-center text-gray-500 text-sm">No hay reportes que coincidan con el filtro seleccionado.</div>`;
        return;
    }

    cont.innerHTML = filtrados.map(r => {
        const esConcluido = (r.estado || '').toLowerCase().includes('concluido');
        const badgeCls = esConcluido
            ? 'bg-green-50 text-green-700 border-green-200'
            : 'bg-amber-50 text-amber-700 border-amber-200';
        return `
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-gray-50 transition-colors group">
                <div class="flex items-start gap-4">
                    <div class="size-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
                        <span class="material-symbols-outlined">description</span>
                    </div>
                    <div>
                        <div class="flex flex-wrap items-center gap-2">
                            <h4 class="text-sm md:text-base font-bold text-gray-900">${r.id} · ${r.categoria || 'Incidencia Ambiental'}</h4>
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${badgeCls}">${r.estado || 'Registrado'}</span>
                        </div>
                        <p class="text-xs md:text-sm text-gray-600 mt-0.5 line-clamp-1">${r.ubicacion || 'Sin ubicación'}</p>
                        <p class="text-xs text-gray-400 mt-1">Fecha: ${r.fecha || 'N/A'} · Área: ${r.dependencia || 'CEASPUE / Puebla'}</p>
                    </div>
                </div>
                <button type="button" onclick="generarPDFIndividual('${r.id}')"
                    class="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary/10 text-primary font-bold rounded-lg hover:bg-primary hover:text-white transition-colors active:scale-95 text-xs md:text-sm shrink-0">
                    <span class="material-symbols-outlined text-[18px]">download</span>
                    Descargar Acta PDF
                </button>
            </div>`;
    }).join('');
};

function crearEncabezadoPDF(doc, tituloDoc) {
    doc.setFillColor(107, 16, 44);
    doc.rect(0, 0, 210, 6, 'F');
    doc.setFillColor(149, 26, 62); // Guinda Puebla
    doc.rect(0, 6, 210, 24, 'F');
    doc.setDrawColor(188, 149, 92); // Dorado Institucional
    doc.setLineWidth(0.8);
    doc.line(0, 30, 210, 30);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('GOBIERNO DEL ESTADO DE PUEBLA', 14, 15);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text('SIGMAH - Sistema de Gestion y Monitoreo Ambiental Hidrico', 118, 15);
    doc.setFontSize(9.5);
    doc.text(tituloDoc, 14, 23);
    doc.setFontSize(8);
    doc.text(`Emitido: ${new Date().toLocaleString('es-MX')}`, 145, 23);
    doc.setTextColor(30, 30, 30);
}

window.generarPDFIndividual = function (folio) {
    if (!window.jspdf) return alert('Cargando librería PDF, intenta en un segundo.');
    const r = reportesLista.find(item => item.id === folio);
    if (!r) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    crearEncabezadoPDF(doc, 'Acta Oficial de Seguimiento y Saneamiento de Cuencas Hídricas');

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Expediente Oficial Folio: ${r.id}`, 14, 42);

    const costoFmt = Number(String(r.costo || '0').replace(/,/g, '')) > 0
        ? `$${Number(String(r.costo).replace(/,/g, '')).toLocaleString('es-MX')} MXN`
        : 'Sin cotización asignada';

    doc.autoTable({
        startY: 48,
        theme: 'grid',
        headStyles: { fillColor: [149, 26, 62] },
        head: [['Campo del Expediente', 'Información Oficial']],
        body: [
            ['Folio Institucional', r.id || '-'],
            ['Clasificación del Problema', r.categoria || '-'],
            ['Cuenca / Río Afectado', r.rio_nombre || '-'],
            ['Municipio', r.municipio || '-'],
            ['Estatus de Atención', r.estado || '-'],
            ['Solución Técnica Asignada', r.tratamiento_aplicado || 'Evaluación general de saneamiento'],
            ['Magnitud / Volumetría Medida', Number(r.magnitud_medida) > 0 ? `${r.magnitud_medida} ${r.unidad_medida || ''}${Number(r.volumen_m3_dia) > 0 ? ` (${r.volumen_m3_dia} m³/día)` : ''}` : 'Por determinar en sitio'],
            ['Despliegue Cuadrilla / Campo', Number(r.costo_despliegue_mxn) > 0 ? `$${Number(r.costo_despliegue_mxn).toLocaleString('es-MX')} MXN` : 'Incluido en operación'],
            ['OPEX Operativo por m³', Number(r.costo_opex_m3_mxn) > 0 ? `$${Number(r.costo_opex_m3_mxn).toFixed(2)} MXN/m³ ($${Number(r.costo_opex_mensual_mxn || 0).toLocaleString('es-MX')} MXN/mes)` : 'N/A según método'],
            ['Presupuesto Total Estimado', costoFmt],
            ['Fecha de Registro', r.fecha || '-'],
            ['Dependencia Responsable', r.dependencia || 'CEASPUE / Dirección de Saneamiento'],
            ['Ubicación Georreferenciada', r.ubicacion || '-'],
            ['Coordenadas (WGS 84)', (r.latitud && r.longitud) ? `${r.latitud}, ${r.longitud}` : 'No registradas'],
            ['Correo de Notificación', r.correo || 'No proporcionado'],
            ['Descripción Técnica / Ciudadana', r.descripcion || '-']
        ]
    });

    const finalY = doc.lastAutoTable.finalY + 14;
    doc.setFontSize(8.5);
    doc.setTextColor(90);
    doc.text('Documento oficial emitido a traves de SIGMAH – Sistema de Gestion y Monitoreo Ambiental Hidrico | Gobierno del Estado de Puebla.', 14, finalY);
    doc.save(`Acta_${r.id}.pdf`);
};

window.generarPDFConsolidado = function () {
    if (!window.jspdf) return alert('Cargando librería PDF, intenta en un segundo.');
    const filtroEstado = document.getElementById('filtro-estado-pdf').value;
    const catFiltro = document.getElementById('filtro-categoria-pdf')?.value || '';
    const texto = (document.getElementById('buscador-reportes-pdf').value || '').toLowerCase().trim();

    let datos = reportesLista;
    if (filtroEstado !== '') {
        datos = datos.filter(r => (r.estado || '').toLowerCase().includes(filtroEstado.toLowerCase()));
    }
    if (catFiltro !== '') {
        datos = datos.filter(r => (r.categoria || '').toLowerCase().includes(catFiltro.toLowerCase()));
    }
    if (texto !== '') {
        datos = datos.filter(r =>
            (r.id && r.id.toLowerCase().includes(texto)) ||
            (r.ubicacion && r.ubicacion.toLowerCase().includes(texto)) ||
            (r.categoria && r.categoria.toLowerCase().includes(texto)) ||
            (r.descripcion && r.descripcion.toLowerCase().includes(texto))
        );
    }

    if (datos.length === 0) {
        alert('No hay registros en la vista actual para exportar a PDF.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    doc.setFillColor(107, 16, 44);
    doc.rect(0, 0, 297, 5, 'F');
    doc.setFillColor(149, 26, 62);
    doc.rect(0, 5, 297, 23, 'F');
    doc.setDrawColor(188, 149, 92);
    doc.setLineWidth(0.8);
    doc.line(0, 28, 297, 28);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13.5);
    doc.setFont('helvetica', 'bold');
    doc.text('GOBIERNO DEL ESTADO DE PUEBLA · REPORTE CONSOLIDADO DE CUENCAS', 14, 14);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text('SIGMAH - Sistema de Gestion y Monitoreo Ambiental Hidrico', 202, 14);
    doc.setFontSize(9);
    doc.text(`Expedientes incluidos: ${datos.length}  |  Filtro categoría: ${catFiltro || 'Todas'}  |  Emitido: ${new Date().toLocaleString('es-MX')}`, 14, 22);

    doc.autoTable({
        startY: 34,
        theme: 'striped',
        headStyles: { fillColor: [149, 26, 62], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        head: [['Folio', 'Clasificación', 'Río / Ubicación', 'Estatus', 'Presupuesto MXN', 'Fecha', 'Descripción']],
        body: datos.map(r => {
            const c = Number(String(r.costo || '0').replace(/,/g, ''));
            return [
                r.id || '-',
                r.categoria || '-',
                r.ubicacion || '-',
                r.estado || '-',
                c > 0 ? `$${c.toLocaleString('es-MX')}` : 'Pendiente',
                r.fecha || '-',
                (r.descripcion || '-').slice(0, 110)
            ];
        })
    });

    doc.save(`Reporte_Oficial_Rios_Puebla_${new Date().toISOString().slice(0, 10)}.pdf`);
};

document.getElementById('buscador-reportes-pdf').addEventListener('input', window.renderizarReportesPDF);
document.addEventListener('DOMContentLoaded', cargarReportesParaPDF);
