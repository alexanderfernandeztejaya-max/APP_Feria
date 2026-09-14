// =========================================================================
// ARCHIVO: features/admin/admin.js
// FUNCIÓN: Gestión de Proyectos, QRs, y Monitoreo en Tiempo Real
// =========================================================================

window.cargarProyectosAdmin = async function() {
    const btn = document.getElementById('btnActualizarAdmin');
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';
    btn.disabled = true;

    try {
        const respuesta = await fetch('/api/proyectos_admin');
        const proyectosBD = await respuesta.json();

        const est = proyectosBD.filter(p => p.categoria.includes('estudiante'));
        const doc = proyectosBD.filter(p => p.categoria.includes('docente'));
        const emp = proyectosBD.filter(p => p.categoria.includes('emprendimiento'));

        renderizarTablaSQL(est, 'tabla-estudiantes', 'proyectos_estudiantes');
        renderizarTablaSQL(doc, 'tabla-docentes', 'proyectos_docentes');
        renderizarTablaSQL(emp, 'tabla-emprendimientos', 'proyectos_emprendimientos');

    } catch (error) {
        console.error("Error al cargar la lista de proyectos:", error);
    } finally {
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
    }
};

function renderizarTablaSQL(arregloProyectos, idTabla, nombreColeccion) {
    const tabla = document.getElementById(idTabla);
    if (!tabla) return; 
    
    tabla.innerHTML = ''; 

    if (arregloProyectos.length === 0) {
        tabla.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 15px; color: #666; font-style: italic;">No hay proyectos registrados en esta categoría aún.</td></tr>';
        return;
    }

    arregloProyectos.forEach((proyecto) => {
        const idUnicoProyecto = proyecto.id; 
        const fila = document.createElement('tr');
        
        fila.innerHTML = `
            <td style="padding: 12px; border-bottom: 1px solid #eee;"><strong>${proyecto.titulo}</strong></td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">${proyecto.integrantes}</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">
                <button type="button" onclick="window.abrirVisorPDF('${proyecto.enlace_pdf}')" style="display: inline-block; padding: 6px 12px; margin-right: 5px; background: white; color: #002b5c; border: 1px solid #002b5c; border-radius: 4px; font-weight: bold; cursor: pointer;">
                    <i class="fas fa-file-pdf"></i> Ver PDF
                </button>
                <button onclick="window.crearQRProyecto('${idUnicoProyecto}', '${nombreColeccion}', '${proyecto.titulo.replace(/'/g, "\\'")}')" style="padding: 6px 12px; background: #002b5c; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                    <i class="fas fa-qrcode"></i> Crear QR
                </button>
            </td>
        `;
        
        fila.onmouseover = () => fila.style.backgroundColor = "#f8f9fa";
        fila.onmouseout = () => fila.style.backgroundColor = "transparent";
        
        tabla.appendChild(fila);
    });
}

window.crearQRProyecto = function(idProyecto, categoria, tituloProyecto) {
    const urlDestino = `${window.location.origin}${window.location.pathname}?idProy=${idProyecto}&cat=${categoria}#/votar`;
    const urlQRAPI = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(urlDestino)}`;

    let modal = document.getElementById('qr-modal-admin');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'qr-modal-admin';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.6); display: flex; justify-content: center;
            align-items: center; z-index: 10000; font-family: sans-serif;
        `;
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 8px; text-align: center; max-width: 400px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
            <h3 style="color: #002b5c; margin-top: 0; margin-bottom: 5px;"><i class="fas fa-qrcode"></i> Código QR Generado</h3>
            <p style="font-size: 0.9rem; color: #555; margin-bottom: 20px;"><strong>${tituloProyecto}</strong></p>
            
            <div style="margin-bottom: 20px; padding: 15px; background: #fff; border: 2px dashed #002b5c; display: inline-block; border-radius: 6px;">
                <img src="${urlQRAPI}" alt="QR" style="display: block; width: 200px; height: 200px; margin: 0 auto;">
            </div>
            
            <div style="font-size: 0.75rem; color: #666; margin-bottom: 25px; word-break: break-all; background: #f1f3f5; padding: 8px; border-radius: 4px; text-align: left;">
                <i class="fas fa-link"></i> <strong>Ruta del QR:</strong><br>${urlDestino}
            </div>

            <div style="display: flex; justify-content: space-between; gap: 10px;">
                <button onclick="window.imprimirEsteQR('${tituloProyecto.replace(/'/g, "\\'")}', '${urlQRAPI}')" style="flex: 1; padding: 10px; background: #002b5c; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">
                    <i class="fas fa-print"></i> Imprimir QR
                </button>
                <button onclick="document.getElementById('qr-modal-admin').style.display = 'none'" style="padding: 10px 15px; background: #6c757d; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">
                    Cerrar
                </button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
};

// ==========================================================
//  MOTOR CENTRALIZADO DE IMPRESIÓN DE TICKETS QR
// ==========================================================
window.imprimirTicketQRGen = function(subtitulo, tituloProyecto, urlImg, mensajeFooter, colorBorde) {
    const ventanaImpresion = window.open('', '_blank');
    ventanaImpresion.document.write(`
        <html><head>
            <title>Imprimir QR - ${tituloProyecto}</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 40px; color: #333; }
                .ticket { border: 4px solid ${colorBorde}; padding: 30px; display: inline-block; border-radius: 12px; max-width: 380px; background: #fff; }
                h2 { color: ${colorBorde}; margin: 0 0 5px 0; font-size: 1.8rem; letter-spacing: 1px; }
                h4 { color: #555; margin: 0 0 20px 0; font-size: 1rem; font-weight: normal; }
                img { width: 240px; height: 240px; margin: 15px 0; border: 2px solid #eee; padding: 10px; border-radius: 8px;}
                .project-title { font-size: 1.3rem; font-weight: bold; margin: 15px 0; color: #111; text-transform: uppercase; }
                .footer { margin-top: 20px; font-size: 0.85rem; color: #444; line-height: 1.4; font-weight: bold; }
            </style>
        </head><body>
            <div class="ticket">
                <h2>TECNO FERIA 2026</h2>
                <h4>${subtitulo}</h4>
                <hr style="border: 0; border-top: 2px solid ${colorBorde}; margin: 10px 0;">
                <div class="project-title">${tituloProyecto}</div>
                <img src="${urlImg}" alt="QR Code">
                <div class="footer">${mensajeFooter}</div>
            </div>
            <script>window.onload = function() { window.print(); setTimeout(function(){window.close();}, 300); }</script>
        </body></html>
    `);
    ventanaImpresion.document.close();
};

window.imprimirEsteQR = function(titulo, urlImg) {
    window.imprimirTicketQRGen("U.A.B.J.B.", `STAND: ${titulo}`, urlImg, "Escanee este código con su celular para registrar su calificación.", "#002b5c");
};

window.imprimirQRHabilitacion = function() {
    const url = `${window.location.origin}${window.location.pathname}?action=registro_visitante`;
    window.imprimirTicketQRGen("Registro Oficial de Visitantes", "PUNTO DE HABILITACIÓN", `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`, "Escanee este código en la entrada para registrar su C.I. y quedar habilitado.", "#d93025");
};

window.imprimirQRExpositor = function() {
    const url = `${window.location.origin}${window.location.pathname}?action=registro_expositor`;
    window.imprimirTicketQRGen("U.A.B.J.B.", "REGISTRO DE EXPOSITOR", `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`, "Escanee este código para crear su cuenta y subir la documentación.", "#002b5c");
};

window.cargarVotosPublico = async function() {
    const tbodyEst = document.getElementById('tabla-votos-est');
    const tbodyDoc = document.getElementById('tabla-votos-doc');
    const tbodyEmp = document.getElementById('tabla-votos-emp');

    if (!tbodyEst || !tbodyDoc || !tbodyEmp) return;

    const msjCarga = '<tr><td colspan="3" style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Cargando votos desde la Base de Datos...</td></tr>';
    tbodyEst.innerHTML = msjCarga;
    tbodyDoc.innerHTML = msjCarga;
    tbodyEmp.innerHTML = msjCarga;

    try {
        const respuesta = await fetch('/api/votos_admin');
        const votosBD = await respuesta.json();
        
        let votosEst = [];
        let votosDoc = [];
        let votosEmp = [];

        votosBD.forEach((voto) => {
            if (voto.categoria_proyecto.includes('estudiante')) votosEst.push(voto);
            else if (voto.categoria_proyecto.includes('docente')) votosDoc.push(voto);
            else if (voto.categoria_proyecto.includes('emprendimiento')) votosEmp.push(voto);
        });

        const renderizarTablaVotos = (arregloVotos, contenedorTbody) => {
            contenedorTbody.innerHTML = '';
            if (arregloVotos.length === 0) {
                contenedorTbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px; color: #a0aec0; font-style: italic;">Aún no hay votos registrados en esta categoría.</td></tr>';
                return;
            }

            arregloVotos.forEach(voto => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = "1px solid rgba(255, 255, 255, 0.1)";
                tr.innerHTML = `
                    <td style="padding: 12px;">
                        <b style="color: #ffffff; font-size: 0.95rem;">${voto.nombre_visitante || "Visitante"}</b><br>
                        <span style="color:#93c5fd; font-size:0.75rem;">${voto.institucion || "Sin institución"}</span>
                    </td>
                    <td style="padding: 12px; color: #e2e8f0;">${voto.nombre_proyecto || "Sin nombre"}</td>
                    <td style="padding: 12px; text-align: center; font-weight: bold; color: #ffc107; font-size: 1.1rem;">
                        ${voto.nota} / 10
                        <br>
                        <button onclick="window.eliminarVotoPublico('${voto.id_voto}', '${(voto.nombre_visitante || "Visitante").replace(/'/g, "\\'")}')" style="margin-top: 6px; background: rgba(220, 53, 69, 0.8); color: white; border: 1px solid #ef4444; padding: 4px 10px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; transition: 0.2s;" title="Eliminar este voto y recalcular">
                            <i class="fas fa-trash-alt"></i> Borrar
                        </button>
                    </td>
                `;
                contenedorTbody.appendChild(tr);
            });
        };

        renderizarTablaVotos(votosEst, tbodyEst);
        renderizarTablaVotos(votosDoc, tbodyDoc);
        renderizarTablaVotos(votosEmp, tbodyEmp);

    } catch (error) {
        console.error("Error al cargar los votos:", error);
        const msjError = '<tr><td colspan="3" style="text-align: center; padding: 20px; color: red;">❌ Error de conexión al cargar los votos.</td></tr>';
        tbodyEst.innerHTML = msjError;
        tbodyDoc.innerHTML = msjError;
        tbodyEmp.innerHTML = msjError;
    }
};

window.eliminarVotoPublico = async function(idVoto, nombreVisitante) {
    if (!confirm(`⚠️ ¿Estás seguro de que deseas ELIMINAR el voto emitido por "${nombreVisitante}"?\n\nAl borrarlo, el puntaje final del proyecto se recalculará automáticamente en todo el sistema.`)) {
        return;
    }

    try {
        const respuesta = await fetch(`/api/votos_admin/${idVoto}`, {
            method: 'DELETE'
        });

        if (!respuesta.ok) throw new Error("Error al eliminar en la BD");
        
        alert("✅ Voto eliminado con éxito. El sistema ha recalculado el promedio.");
        window.cargarVotosPublico();
        if (typeof window.calcularResultadosEnTiempoReal === 'function') {
            window.calcularResultadosEnTiempoReal();
        }

    } catch (error) {
        console.error("Error al eliminar el voto:", error);
        alert("❌ Ocurrió un error al intentar eliminar el voto.");
    }
};

window.cargarVotosTribunal = async function() {
    const tbodyEst = document.getElementById('tabla-tribunal-est');
    const tbodyDoc = document.getElementById('tabla-tribunal-doc');
    const tbodyEmp = document.getElementById('tabla-tribunal-emp');

    if (!tbodyEst || !tbodyDoc || !tbodyEmp) return;

    const msjCarga = '<tr><td colspan="3" style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Cargando evaluaciones...</td></tr>';
    tbodyEst.innerHTML = msjCarga;
    tbodyDoc.innerHTML = msjCarga;
    tbodyEmp.innerHTML = msjCarga;

    try {
        const respuesta = await fetch('/api/evaluaciones_admin');
        const evalsBD = await respuesta.json();
        
        let evalEst = [];
        let evalDoc = [];
        let evalEmp = [];

        evalsBD.forEach((voto) => {
            if (voto.categoria.includes('estudiante')) evalEst.push(voto);
            else if (voto.categoria.includes('docente')) evalDoc.push(voto);
            else if (voto.categoria.includes('emprendimiento')) evalEmp.push(voto);
        });

        const renderizarTablaTribunal = (arregloEvals, contenedorTbody) => {
            contenedorTbody.innerHTML = '';
            if (arregloEvals.length === 0) {
                contenedorTbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px; color: #666; font-style: italic;">Aún no hay calificaciones registradas.</td></tr>';
                return;
            }

            arregloEvals.forEach(voto => {
                let nombreExtraido = voto.nombre_tribunal || "Evaluador";
                if(nombreExtraido.includes('@')) nombreExtraido = nombreExtraido.split('@')[0].replace(/\./g, ' ');
                nombreExtraido = nombreExtraido.replace(/^ing\.?\s*/i, '');
                let partesNombre = nombreExtraido.trim().split(/\s+/);
                let nombreFinal = "Ing. " + partesNombre.slice(0, 2).join(" ");
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>
                        <b style="font-size: 0.95rem; text-transform: capitalize;">${nombreFinal}</b><br>
                        <span style="color:#28a745; font-size:0.75rem; font-weight: bold;">Tribunal evaluador</span>
                    </td>
                    <td>${voto.nombre_proyecto || "Proyecto Desconocido"}</td>
                    <td style="text-align: center; font-weight: bold; color: var(--azul-uab); font-size: 1.1rem;">
                        ${voto.nota} / 100
                    </td>
                `;
                contenedorTbody.appendChild(tr);
            });
        };

        renderizarTablaTribunal(evalEst, tbodyEst);
        renderizarTablaTribunal(evalDoc, tbodyDoc);
        renderizarTablaTribunal(evalEmp, tbodyEmp);

    } catch (error) {
        console.error("Error al cargar las evaluaciones del tribunal:", error);
        const msjError = '<tr><td colspan="3" style="text-align: center; padding: 20px; color: red;">❌ Error de conexión al cargar las evaluaciones.</td></tr>';
        tbodyEst.innerHTML = msjError;
        tbodyDoc.innerHTML = msjError;
        tbodyEmp.innerHTML = msjError;
    }
};

window.cargarProyectosParaAsignar = async function() {
    const selCategoria = document.getElementById('tribCategoria');
    const selAlcance = document.getElementById('tribAlcance');
    const contProyectos = document.getElementById('contenedor-lista-proyectos');

    if (!selCategoria || !selAlcance || !contProyectos) return;

    if (selAlcance.value === "ESPECIFICOS" && selCategoria.value !== "") {
        contProyectos.style.display = "block";
        contProyectos.innerHTML = '<p style="color: #60a5fa; font-size: 12px; margin: 0;"><i class="fas fa-spinner fa-spin"></i> Cargando proyectos desde la Base de Datos...</p>';
        
        try {
            const respuesta = await fetch('/api/proyectos_admin');
            const todosLosProyectos = await respuesta.json();

            let palabraClave = "";
            if (selCategoria.value.includes('estudiante')) palabraClave = 'estudiante';
            else if (selCategoria.value.includes('docente')) palabraClave = 'docente';
            else if (selCategoria.value.includes('emprendimiento')) palabraClave = 'emprendimiento';

            const proyectosFiltrados = todosLosProyectos.filter(p => p.categoria.includes(palabraClave));
            
            if (proyectosFiltrados.length === 0) {
                contProyectos.innerHTML = '<p style="color: #f87171; font-size: 12px; margin: 0;">⚠️ No hay proyectos inscritos en esta categoría aún.</p>';
                return;
            }

            let htmlCheckboxes = '<label style="font-size: 11px; color: #cbd5e1; display: block; margin-bottom: 8px; font-weight: bold;">Seleccione los proyectos que evaluará este jurado:</label>';
            
            proyectosFiltrados.forEach(p => {
                const titulo = p.titulo || "Sin título";
                const estado = "Inscrito"; 
                const colorEstado = "#34d399"; 

                htmlCheckboxes += `
                    <div style="margin-bottom: 6px; text-align: left;">
                        <label style="font-size: 12px; color: #fff; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: normal;">
                            <input type="checkbox" name="proy_tribunal_check" value="${p.id}" style="cursor: pointer; width: 16px; height: 16px;">
                            <span>${titulo} <strong style="color: ${colorEstado}; font-size: 10px;">[${estado}]</strong></span>
                        </label>
                    </div>
                `;
            });
            contProyectos.innerHTML = htmlCheckboxes;
        } catch (error) {
            console.error("Error al cargar proyectos para asignar:", error);
            contProyectos.innerHTML = '<p style="color: #f87171; font-size: 12px; margin: 0;">❌ Error al cargar la lista de proyectos.</p>';
        }
    } else {
        contProyectos.style.display = "none";
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const selCat = document.getElementById('tribCategoria');
    const selAlc = document.getElementById('tribAlcance');
    if (selCat) selCat.addEventListener('change', window.cargarProyectosParaAsignar);
    if (selAlc) selAlc.addEventListener('change', window.cargarProyectosParaAsignar);
});

// =========================================================================
// NUEVO: FUNCIONES PARA EL PANEL DE CONFIGURACIÓN DE FECHAS
// =========================================================================
window.cargarFechasActuales = async function() {
    try {
        const res = await fetch('/api/configuraciones');
        const data = await res.json();
        
        const formatoInput = (fechaISO) => {
            if (!fechaISO) return '';
            const d = new Date(fechaISO);
            const tzOffset = d.getTimezoneOffset() * 60000;
            return (new Date(d - tzOffset)).toISOString().slice(0, 16);
        };

        document.getElementById('confFechaRegistro').value = formatoInput(data.fecha_registro);
        document.getElementById('confFechaSubida').value = formatoInput(data.fecha_subida);
        document.getElementById('confFechaResultados').value = formatoInput(data.fecha_resultados);
    } catch (error) {
        console.error("No se pudieron cargar las fechas.", error);
    }
};

window.guardarNuevasFechas = async function() {
    const reg = document.getElementById('confFechaRegistro').value;
    const sub = document.getElementById('confFechaSubida').value;
    const res = document.getElementById('confFechaResultados').value;

    if (!reg || !sub || !res) {
        alert("⚠️ Por favor, seleccione todas las fechas antes de guardar.");
        return;
    }

    try {
        const respuesta = await fetch('/api/configuraciones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fechaRegistro: reg, fechaSubida: sub, fechaResultados: res })
        });
        
        if (!respuesta.ok) throw new Error("Error del servidor");
        
        alert("✅ ¡Las nuevas fechas han sido establecidas exitosamente para todo el sistema!");
    } catch (error) {
        console.error(error);
        alert("❌ Ocurrió un error al intentar guardar las fechas.");
    }
};

// =========================================================================
//  GESTIÓN DINÁMICA DE INSTITUCIONES (COLEGIOS Y UNIVERSIDADES)
// =========================================================================
window.cargarInstitucionesSelects = async function() {
    try {
        const res = await fetch('/api/instituciones');
        const instituciones = await res.json();

        const grupos = {};
        instituciones.forEach(inst => {
            if (!grupos[inst.tipo]) grupos[inst.tipo] = [];
            grupos[inst.tipo].push(inst);
        });

        // 1. LISTA ESTRICTA (Solo BD) - Para Expositores
        let htmlEstricto = '<option value="" disabled selected style="background-color: #ffffff !important; color: #333333 !important;">Seleccione su institución...</option>';
        for (const [tipo, lista] of Object.entries(grupos)) {
            htmlEstricto += `<optgroup label="${tipo}" style="background-color: #f1f5f9 !important; color: #002b5c !important; font-weight: bold !important;">`;
            lista.forEach(inst => {
                htmlEstricto += `<option value="${inst.nombre}" style="background-color: #ffffff !important; color: #000000 !important; font-weight: normal !important;">${inst.nombre}</option>`;
            });
            htmlEstricto += `</optgroup>`;
        }
        
        // 2. LISTA FLEXIBLE (Con "Otro") - Solo para Visitantes/Público
        let htmlFlexible = htmlEstricto + `
            <optgroup label="Visitantes Particulares / Otros" style="background-color: #f1f5f9 !important; color: #002b5c !important; font-weight: bold !important;">
                <option value="OTRO" style="background-color: #ffffff !important; color: #0056b3 !important; font-weight: bold !important;">Escribir manualmente / Otro...</option>
            </optgroup>
        `;

        const selReg = document.getElementById('regInstitucion'); // Formulario Expositor
        const selPre = document.getElementById('preInst');        // Formulario Preregistro
        const selHab = document.getElementById('hab-institucion'); // Formulario Habilitación
        const selAdminHab = document.getElementById('admin-hab-institucion'); // Formulario del Admin
        
        // Asignamos las listas
        if (selReg) selReg.innerHTML = htmlEstricto;
        if (selPre) selPre.innerHTML = htmlFlexible;
        if (selHab) selHab.innerHTML = htmlFlexible;
        if (selAdminHab) selAdminHab.innerHTML = htmlFlexible;

    } catch (error) { console.error("Error cargando instituciones:", error); }
};

document.addEventListener('DOMContentLoaded', window.cargarInstitucionesSelects);

window.cargarTablaInstituciones = async function() {
    const tbody = document.getElementById('tabla-admin-instituciones');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #000000 !important; padding: 15px;">Cargando...</td></tr>';
    
    try {
        const res = await fetch('/api/instituciones');
        const data = await res.json();
        
        tbody.innerHTML = '';
        data.forEach(inst => {
            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #e2e8f0 !important; background-color: #ffffff !important;">
                    <td style="padding: 12px !important;">
                        <!-- 🔥 FORZAMOS LETRA NEGRA DIRECTO EN LA ETIQUETA STRONG -->
                        <strong style="color: #000000 !important; font-size: 1rem !important;">${inst.nombre}</strong>
                    </td>
                    <td style="padding: 12px !important; color: #333333 !important; font-size: 0.95rem !important;">${inst.tipo}</td>
                    <td style="padding: 12px !important; text-align: center !important;">
                        <button onclick="window.eliminarInstitucion(${inst.id}, '${inst.nombre.replace(/'/g, "\\'")}')" style="background-color: #dc3545 !important; color: #ffffff !important; border: none !important; padding: 6px 12px !important; border-radius: 4px !important; cursor: pointer !important; font-weight: bold !important;">
                            <i class="fas fa-trash"></i> Borrar
                        </button>
                    </td>
                </tr>
            `;
        });
    } catch (error) { 
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: red !important;">Error al cargar las instituciones.</td></tr>'; 
    }
};

window.agregarInstitucion = async function(e) {
    e.preventDefault();
    const nombre = document.getElementById('nueva-inst-nombre').value;
    const tipo = document.getElementById('nueva-inst-tipo').value;
    
    try {
        const res = await fetch('/api/instituciones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, tipo })
        });
        if (res.ok) {
            document.getElementById('nueva-inst-nombre').value = '';
            alert("✅ Institución agregada correctamente.");
            window.cargarTablaInstituciones();
            window.cargarInstitucionesSelects(); 
        }
    } catch (error) { alert("❌ Error al agregar."); }
};

window.eliminarInstitucion = async function(id, nombre) {
    if(!confirm(`⚠️ ¿Seguro que deseas eliminar "${nombre}" de la lista?`)) return;
    try {
        await fetch(`/api/instituciones/${id}`, { method: 'DELETE' });
        window.cargarTablaInstituciones();
        window.cargarInstitucionesSelects(); 
    } catch (error) { alert("❌ Error al eliminar."); }
};