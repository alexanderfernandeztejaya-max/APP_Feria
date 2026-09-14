// =========================================================================
// ARCHIVO: features/informes/informes.js
// FUNCIÓN: Generación de reportes dinámicos conectados al Súper Puente SQL
// =========================================================================

//  NUEVO: Función Unificada para Cabeceras Oficiales (Elimina código repetido)
const generarCabeceraOficial = (tituloReporte, notaExtra = "") => {
    const extraHtml = notaExtra ? `<p style="font-family: Arial, sans-serif; font-size: 13px; color: #333; margin-bottom: 15px;"><strong>Nota Explicativa:</strong> ${notaExtra}</p>` : "";
    return `
        <div style="text-align: center; margin-bottom: 30px; font-family: Arial, sans-serif;">
            <h2 style="margin: 0; font-size: 20px; text-transform: uppercase; color: #000;">Instituto de Investigación Interacción Social y Posgrado</h2>
            <h3 style="margin: 5px 0; font-size: 16px; color: #555;">Tecno Feria 2026 - Universidad Autónoma del Beni José Ballivián</h3>
            <h1 style="margin: 20px 0; font-size: 22px; text-decoration: underline; color: #000;">${tituloReporte}</h1>
            <p style="margin: 0; font-size: 12px; color: #333;">Fecha de emisión: ${new Date().toLocaleDateString()}</p>
        </div>
        ${extraHtml}
    `;
};

function inicializarFiltroVisitantes() {
    const tipoSelect = document.getElementById('tipo-informe-select');
    if(!tipoSelect) return;

    tipoSelect.addEventListener('change', async (e) => {
        let subContainer = document.getElementById('sub-filtro-visitantes');
        
        if (e.target.value === 'padron_visitantes') {
            if (!subContainer) {
                subContainer = document.createElement('div');
                subContainer.id = 'sub-filtro-visitantes';
                subContainer.style.margin = '15px 0';
                subContainer.innerHTML = `
                    <label style="display:block; margin-bottom:5px; font-weight:bold; color:#002b5c;">Seleccione la Institución / Colegio:</label>
                    <select id="institucion-select" style="width:100%; padding:10px; border-radius:5px; border:1px solid #ccc; outline:none; font-family: Arial; box-sizing: border-box;">
                        <option value="TODOS">Todas las Instituciones (Padrón General)</option>
                    </select>
                `;
                tipoSelect.parentNode.insertBefore(subContainer, tipoSelect.nextSibling);
                
                try {
                    const res = await fetch('/api/datos_informes');
                    const dbData = await res.json();
                    const instMap = new Map();
                    
                    const procesarInst = (p) => {
                        if (p.institucion) {
                            let inst = p.institucion.trim();
                            instMap.set(inst.toLowerCase(), inst);
                        }
                    };

                    dbData.visitantes.forEach(procesarInst);
                    dbData.expositores.forEach(procesarInst);
                    
                    const selectFiltro = document.getElementById('institucion-select');
                    Array.from(instMap.values()).sort().forEach(inst => {
                        let esColegio = /colegio|unidad educativa|escuela|uab|universidad|normal|instituto|u\.e|fatima|salle|suarez|agosto/i.test(inst);
                        selectFiltro.innerHTML += `<option value="${inst}">${esColegio ? inst : `Visitante Externo - ${inst}`}</option>`;
                    });
                    selectFiltro.addEventListener('change', window.generarVistaPrevia);
                } catch (error) { console.error(error); }
            }
            subContainer.style.display = 'block'; 
        } else {
            if (subContainer) subContainer.style.display = 'none'; 
        }
        window.generarVistaPrevia();
    });
}

document.addEventListener('DOMContentLoaded', inicializarFiltroVisitantes);

window.generarVistaPrevia = async function() {
    const tipoSelect = document.getElementById('tipo-informe-select');
    const valor = tipoSelect.value;
    const areaImpresion = document.getElementById('informe-impresion');
    const btn = document.querySelector('#informes .btn-save');

    if (!valor) return;
    if (btn) { btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando Vista Previa...'; btn.disabled = true; }

    areaImpresion.style.display = 'block';
    areaImpresion.innerHTML = '<div style="text-align: center; padding: 40px; color: #333;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top: 15px; font-weight: bold;">Generando vista previa del documento...</p></div>';

    try {
        const res = await fetch('/api/datos_informes');
        const db = await res.json();
        const { proyectos, expositores, tribunales, visitantes, votos, evaluaciones } = db;

        // 1. CUADRO DE HONOR Y RANKING
        if (valor === "ranking") {
            const diccionarioProyectos = {}; 

            proyectos.forEach(p => {
                if (p.estado_evaluacion === "Pre-seleccionado") {
                    let catName = p.categoria.includes('estudiante') ? "proyectos_estudiantes" :
                                  p.categoria.includes('docente') ? "proyectos_docentes" : "proyectos_emprendimientos";
                    diccionarioProyectos[p.id] = { titulo: p.titulo || "Sin Título", integrantes: p.integrantes || "No registrado", categoria: catName, sumaTribunal: 0, cantidadTribunal: 0, sumaPublico: 0, cantidadPublico: 0 };
                }
            });

            evaluaciones.forEach(ev => {
                if (diccionarioProyectos[ev.id_proyecto]) {
                    diccionarioProyectos[ev.id_proyecto].sumaTribunal += (parseFloat(ev.nota) || 0);
                    diccionarioProyectos[ev.id_proyecto].cantidadTribunal += 1;
                }
            });

            votos.forEach(v => {
                if (diccionarioProyectos[v.id_proyecto]) {
                    let notaP = parseFloat(v.nota) || 0; 
                    if (notaP > 10) notaP = 10;
                    diccionarioProyectos[v.id_proyecto].sumaPublico += notaP;
                    diccionarioProyectos[v.id_proyecto].cantidadPublico += 1;
                }
            });

            const [topEstudiantes, topDocentes, topEmprendimientos] = [[], [], []];

            Object.values(diccionarioProyectos).forEach(proy => {
                const pT = proy.cantidadTribunal > 0 ? (proy.sumaTribunal / proy.cantidadTribunal) : 0;
                const pP = proy.cantidadPublico > 0 ? (proy.sumaPublico / proy.cantidadPublico) : 0;
                const notaF = (pT * 0.60) + (pP * 4);
                const obj = { titulo: proy.titulo, integrantes: proy.integrantes, notaFinal: notaF };
                if (proy.categoria === "proyectos_estudiantes") topEstudiantes.push(obj);
                if (proy.categoria === "proyectos_docentes") topDocentes.push(obj);
                if (proy.categoria === "proyectos_emprendimientos") topEmprendimientos.push(obj);
            });

            const ordenar = (a, b) => b.notaFinal - a.notaFinal;
            topEstudiantes.sort(ordenar); topDocentes.sort(ordenar); topEmprendimientos.sort(ordenar);

            const generarTablaHTML = (tituloCat, datos) => {
                let html = `
                    <h3 style="font-family: Arial, sans-serif; font-size: 14px; color: #fff; background-color: #002b5c; padding: 8px; margin-top: 25px; margin-bottom: 0;">${tituloCat}</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-family: Arial, sans-serif; font-size: 12px; color: #000;">
                        <thead>
                            <tr style="background-color: #f2f2f2; border-bottom: 2px solid #000;">
                                <th style="padding: 10px; border: 1px solid #ccc; text-align: center; width: 12%;">Posición</th>
                                <th style="padding: 10px; border: 1px solid #ccc; text-align: left; width: 38%;">Nombre del Proyecto</th>
                                <th style="padding: 10px; border: 1px solid #ccc; text-align: left; width: 35%;">Expositor / Responsable</th>
                                <th style="padding: 10px; border: 1px solid #ccc; text-align: center; width: 15%;">Nota Final</th>
                            </tr>
                        </thead><tbody>`;
                if (datos.length === 0) { html += `<tr><td colspan="4" style="padding: 10px; border: 1px solid #ccc; text-align: center; color: #666;">No hay proyectos.</td></tr>`; } 
                else {
                    datos.forEach((p, index) => {
                        const lugar = index + 1;
                        let colorFondo = (lugar === 1 && p.notaFinal > 0) ? "#fff9e6" : (lugar === 2 && p.notaFinal > 0) ? "#f2f2f2" : (lugar === 3 && p.notaFinal > 0) ? "#ffe6e6" : "#fff";
                        html += `<tr>
                            <td style="padding: 10px; border: 1px solid #ccc; text-align: center; font-weight: bold; background-color: ${colorFondo};">${lugar}° LUGAR</td>
                            <td style="padding: 10px; border: 1px solid #ccc; font-weight: bold;">${p.titulo}</td>
                            <td style="padding: 10px; border: 1px solid #ccc;">${p.integrantes}</td>
                            <td style="padding: 10px; border: 1px solid #ccc; text-align: center; font-weight: bold; font-size: 14px;">${p.notaFinal.toFixed(2)}</td>
                        </tr>`;
                    });
                }
                return html + `</tbody></table>`;
            };

            areaImpresion.innerHTML = generarCabeceraOficial("CUADRO DE HONOR Y RANKING GENERAL") + 
                generarTablaHTML("1. ESTUDIANTES (PREGRADO)", topEstudiantes) +
                generarTablaHTML("2. DOCENTES INVESTIGADORES", topDocentes) +
                generarTablaHTML("3. EMPRENDIMIENTOS TECNOLÓGICOS", topEmprendimientos) +
                `<div style="display: flex; justify-content: space-around; margin-top: 60px; text-align: center; font-family: Arial, sans-serif; font-size: 13px; color: #000; page-break-inside: avoid;">
                    <div><p style="margin: 0; border-top: 1px solid #000; padding-top: 5px; width: 220px;">Firma y Sello<br>Comité Organizador I.I.S.P.</p></div>
                    <div><p style="margin: 0; border-top: 1px solid #000; padding-top: 5px; width: 220px;">Firma y Sello<br>Director de Carrera UABJB</p></div>
                </div>`;
        } 

        // 2. EJES TEMÁTICOS
        else if (valor === "ejes") {
            const ejesOficiales = ["Sistemas de Información para el Desarrollo Regional", "Tecnologías Emergentes y Transformación Digital", "Ingeniería de Software y Aplicaciones Web/Móviles", "Gobierno Electrónico y Transparencia Pública", "TIC para la Gestión Ambiental y Agropecuaria"];
            const proyectosPorEje = {};
            ejesOficiales.forEach(eje => proyectosPorEje[eje] = []);
            proyectosPorEje["Otros (Líneas Anteriores / No Oficiales)"] = [];

            proyectos.forEach(p => {
                const eje = p.eje_tematico ? p.eje_tematico.trim() : "Sin Línea Definida"; 
                let tipo = p.categoria.includes('docente') ? "Docentes Investigadores" : p.categoria.includes('emprendimiento') ? "Emprendimientos Tecnológicos" : "Estudiantes (Pregrado)";
                if (ejesOficiales.includes(eje)) proyectosPorEje[eje].push({ titulo: p.titulo || "Sin Título", integrantes: p.integrantes || "No registrado", tipo: tipo });
                else proyectosPorEje["Otros (Líneas Anteriores / No Oficiales)"].push({ titulo: p.titulo || "Sin Título", integrantes: p.integrantes || "No registrado", tipo: tipo });
            });

            let htmlEjes = "";
            let contadorEje = 1;

            const armarTablaEje = (nombreEje, lista, numeroStr, colorAlerta = false) => {
                const colorFondoHead = colorAlerta ? "#fff3cd" : "#e9ecef";
                const colorBorde = colorAlerta ? "#856404" : "#001f54";
                let html = `
                    <h3 style="font-family: Arial, sans-serif; font-size: 14px; color: #000; background-color: ${colorFondoHead}; padding: 8px; border-left: 5px solid ${colorBorde}; margin-top: 30px;">${numeroStr} ${nombreEje}</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-family: Arial, sans-serif; font-size: 12px; color: #000;">
                        <thead>
                            <tr style="border-bottom: 2px solid #000;">
                                <th style="padding: 8px; border: 1px solid #ccc; text-align: left; width: 40%;">Nombre del Proyecto</th>
                                <th style="padding: 8px; border: 1px solid #ccc; text-align: left; width: 35%;">Responsables / Integrantes</th>
                                <th style="padding: 8px; border: 1px solid #ccc; text-align: center; width: 25%;">Tipo de Expositor</th>
                            </tr>
                        </thead><tbody>`;
                
                if (lista.length === 0) { html += `<tr><td colspan="3" style="padding: 10px; border: 1px solid #ccc; text-align: center; color: #666; font-style: italic;">No hay proyectos registrados en esta línea.</td></tr>`; } 
                else {
                    lista.forEach(proy => {
                        html += `<tr><td style="padding: 8px; border: 1px solid #ccc; font-weight: bold;">${proy.titulo}</td><td style="padding: 8px; border: 1px solid #ccc;">${proy.integrantes}</td><td style="padding: 8px; border: 1px solid #ccc; text-align: center;">${proy.tipo}</td></tr>`;
                    });
                }
                return html + `</tbody></table>`;
            };

            ejesOficiales.forEach(eje => { htmlEjes += armarTablaEje(eje, proyectosPorEje[eje], contadorEje + "."); contadorEje++; });
            if (proyectosPorEje["Otros (Líneas Anteriores / No Oficiales)"].length > 0) {
                htmlEjes += armarTablaEje("Otros (Líneas Anteriores / No Oficiales)", proyectosPorEje["Otros (Líneas Anteriores / No Oficiales)"], "⚠️", true);
            }

            areaImpresion.innerHTML = generarCabeceraOficial("RESUMEN DE PROYECTOS POR LÍNEAS DE INVESTIGACIÓN") + htmlEjes +
                `<div style="display: flex; justify-content: space-around; margin-top: 60px; text-align: center; font-family: Arial, sans-serif; font-size: 13px; color: #000; page-break-inside: avoid;">
                    <div><p style="margin: 0; border-top: 1px solid #000; padding-top: 5px; width: 220px;">Revisado por:<br>Resp. de Investigación I.I.S.P.</p></div>
                    <div><p style="margin: 0; border-top: 1px solid #000; padding-top: 5px; width: 220px;">Aprobado por:<br>Director de Carrera UABJB</p></div>
                </div>`;
        }

        // 3. ACTA DE TRIBUNALES
        else if (valor === "tribunales") {
            const grupos = { "1. ESTUDIANTES (PREGRADO)": [], "2. DOCENTES INVESTIGADORES": [], "3. EMPRENDIMIENTOS TECNOLÓGICOS": [], "OTRAS EVALUACIONES (Registros sin categoría)": [] };

            evaluaciones.forEach(ev => { 
                const proy = proyectos.find(p => p.id === ev.id_proyecto);
                const trib = tribunales.find(t => t.usuario_tribunal === ev.usuario_tribunal);
                const nombreTribunalReal = trib ? trib.nombre_completo : (ev.usuario_tribunal || "Evaluador");
                let cat = "OTRAS EVALUACIONES (Registros sin categoría)";
                
                if (proy) {
                    cat = proy.categoria.includes('estudiante') ? "1. ESTUDIANTES (PREGRADO)" : proy.categoria.includes('docente') ? "2. DOCENTES INVESTIGADORES" : "3. EMPRENDIMIENTOS TECNOLÓGICOS";
                }
                grupos[cat].push({ tituloProyecto: proy ? proy.titulo : "Proyecto Desconocido", nombreTribunal: nombreTribunalReal, notaTribunal: ev.nota, observaciones: ev.observaciones });
            });

            const generarTabla = (tituloCat, lista) => {
                if (lista.length === 0 && tituloCat === "OTRAS EVALUACIONES (Registros sin categoría)") return "";
                lista.sort((a, b) => (parseFloat(b.notaTribunal) || 0) - (parseFloat(a.notaTribunal) || 0));
                let html = `
                    <h3 style="font-family: Arial, sans-serif; font-size: 14px; color: #fff; background-color: #002b5c; padding: 8px; margin-top: 25px; margin-bottom: 0;">${tituloCat}</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-family: Arial, sans-serif; font-size: 12px; color: #000;">
                        <thead>
                            <tr style="background-color: #f2f2f2; border-bottom: 2px solid #000;">
                                <th style="padding: 10px; border: 1px solid #ccc; text-align: left; width: 20%;">Proyecto Evaluado</th>
                                <th style="padding: 10px; border: 1px solid #ccc; text-align: left; width: 25%;">Tribunal Asignado</th>
                                <th style="padding: 10px; border: 1px solid #ccc; text-align: center; width: 10%;">Puntaje (60%)</th>
                                <th style="padding: 10px; border: 1px solid #ccc; text-align: left; width: 45%;">Observaciones / Retroalimentación</th>
                            </tr>
                        </thead><tbody>`;
                if (lista.length === 0) { html += `<tr><td colspan="4" style="padding: 10px; border: 1px solid #ccc; text-align: center; color: #666;">Aún no se han registrado calificaciones.</td></tr>`; } 
                else {
                    lista.forEach(ev => {
                        let tribunal = ev.nombreTribunal || "Ing. Evaluador";
                        if (!tribunal.toLowerCase().startsWith('ing')) tribunal = "Ing. " + tribunal;
                        const notaConv = ((parseFloat(ev.notaTribunal) || 0) * 0.60).toFixed(2);
                        let obs = ev.observaciones || "Sin observaciones registradas.";
                        if (!obs.startsWith('"')) obs = '"' + obs + '"';

                        html += `<tr>
                                <td style="padding: 10px; border: 1px solid #ccc; font-weight: bold; color: var(--azul-uab);">${ev.tituloProyecto}</td>
                                <td style="padding: 10px; border: 1px solid #ccc; text-transform: capitalize;">${tribunal}</td>
                                <td style="padding: 10px; border: 1px solid #ccc; text-align: center; font-weight: bold; font-size: 14px;">${notaConv}</td>
                                <td style="padding: 10px; border: 1px solid #ccc; font-style: italic;">${obs}</td>
                            </tr>`;
                    });
                }
                return html + `</tbody></table>`;
            };

            areaImpresion.innerHTML = generarCabeceraOficial("ACTA DETALLADA DE CALIFICACIONES DE TRIBUNALES", "El puntaje aquí reflejado representa únicamente la valoración técnica del Tribunal Evaluador, la cual equivale al 60% de la calificación final del proyecto.") + 
                generarTabla("1. ESTUDIANTES (PREGRADO)", grupos["1. ESTUDIANTES (PREGRADO)"]) + generarTabla("2. DOCENTES INVESTIGADORES", grupos["2. DOCENTES INVESTIGADORES"]) + generarTabla("3. EMPRENDIMIENTOS TECNOLÓGICOS", grupos["3. EMPRENDIMIENTOS TECNOLÓGICOS"]) + generarTabla("OTRAS EVALUACIONES (Registros sin categoría)", grupos["OTRAS EVALUACIONES (Registros sin categoría)"]) +
                `<div style="display: flex; justify-content: space-around; margin-top: 60px; text-align: center; font-family: Arial, sans-serif; font-size: 13px; color: #000; page-break-inside: avoid;">
                    <div><p style="margin: 0; border-top: 1px solid #000; padding-top: 5px; width: 220px;">Firma y Sello<br>Representante del Tribunal</p></div>
                    <div><p style="margin: 0; border-top: 1px solid #000; padding-top: 5px; width: 220px;">Firma y Sello<br>Resp. Instituto de Investigación</p></div>
                </div>`;
        }
        
        // 4. VISITANTES Y AFLUENCIA
        else if (valor === "visitantes") {
            const diccProyectos = {};
            proyectos.forEach(p => {
                let cat = p.categoria.includes('estudiante') ? "1. ESTUDIANTES (PREGRADO)" : p.categoria.includes('docente') ? "2. DOCENTES INVESTIGADORES" : "3. EMPRENDIMIENTOS TECNOLÓGICOS";
                diccProyectos[p.id] = { titulo: p.titulo || "Sin Título", categoria: cat, visitas: 0, sumaNotas: 0 };
            });

            const afluenciaInst = {};
            visitantes.forEach(v => {
                const instNorm = (v.institucion || "Independiente").trim().toUpperCase();
                afluenciaInst[instNorm] = (afluenciaInst[instNorm] || 0) + 1;
            });

            votos.forEach(v => {
                if (diccProyectos[v.id_proyecto]) {
                    diccProyectos[v.id_proyecto].visitas += 1;
                    diccProyectos[v.id_proyecto].sumaNotas += Math.min(parseFloat(v.nota) || 0, 10);
                }
            });

            const listaProy = [];
            Object.values(diccProyectos).forEach(p => {
                if (p.visitas > 0) listaProy.push({ titulo: p.titulo, categoria: p.categoria, visitas: p.visitas, prom: p.sumaNotas / p.visitas, pts40: (p.sumaNotas / p.visitas) * 4 });
            });

            const generarTablaV = (cat) => {
                const filtrados = listaProy.filter(p => p.categoria === cat).sort((a, b) => b.pts40 - a.pts40);
                let html = `<h3 style="font-family: Arial, sans-serif; font-size: 14px; color: #fff; background-color: #002b5c; padding: 8px; margin-top: 20px; margin-bottom: 0;">${cat}</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-family: Arial, sans-serif; font-size: 12px; color: #000;">
                        <thead><tr style="background-color: #f2f2f2; border-bottom: 2px solid #000;">
                            <th style="padding: 10px; border: 1px solid #ccc; text-align: left; width: 40%;">Nombre del Proyecto</th>
                            <th style="padding: 10px; border: 1px solid #ccc; text-align: center; width: 20%;">Visitas Recibidas</th>
                            <th style="padding: 10px; border: 1px solid #ccc; text-align: center; width: 20%;">Promedio (1-10)</th>
                            <th style="padding: 10px; border: 1px solid #ccc; text-align: center; color: var(--azul-uab); width: 20%;">Puntaje (40%)</th>
                        </tr></thead><tbody>`;
                if (filtrados.length === 0) { html += `<tr><td colspan="4" style="padding: 10px; border: 1px solid #ccc; text-align: center; color: #666;">Aún no hay votos del público en esta categoría.</td></tr>`; } 
                else {
                    filtrados.forEach(p => {
                        html += `<tr>
                            <td style="padding: 10px; border: 1px solid #ccc; font-weight: bold;">${p.titulo}</td>
                            <td style="padding: 10px; border: 1px solid #ccc; text-align: center;">${p.visitas}</td>
                            <td style="padding: 10px; border: 1px solid #ccc; text-align: center;">${p.prom.toFixed(2)}</td>
                            <td style="padding: 10px; border: 1px solid #ccc; text-align: center; font-weight: bold; font-size: 14px; color: var(--azul-uab);">${p.pts40.toFixed(2)}</td>
                        </tr>`;
                    });
                }
                return html + `</tbody></table>`;
            };

            const listaInst = Object.keys(afluenciaInst).map(i => ({ nombre: i, cant: afluenciaInst[i], pct: visitantes.length > 0 ? Math.round((afluenciaInst[i] / visitantes.length) * 100) : 0 })).sort((a, b) => b.cant - a.cant);
            let htmlInst = "";
            if (listaInst.length === 0) htmlInst = `<tr><td colspan="3" style="padding: 10px; border: 1px solid #ccc; text-align: center; color: #666;">No hay visitantes habilitados registrados.</td></tr>`;
            else listaInst.forEach(i => htmlInst += `<tr><td style="padding: 10px; border: 1px solid #ccc; text-transform: capitalize;">${i.nombre.toLowerCase()}</td><td style="padding: 10px; border: 1px solid #ccc; text-align: center;">${i.cant}</td><td style="padding: 10px; border: 1px solid #ccc; text-align: center;">${i.pct}%</td></tr>`);

            areaImpresion.innerHTML = generarCabeceraOficial("REPORTE DE VOTACIÓN Y AFLUENCIA DEL PÚBLICO") + `
                <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-family: Arial, sans-serif;">
                    <div style="border: 2px solid #001f54; border-radius: 8px; padding: 15px; width: 30%; text-align: center;"><h4 style="margin: 0; color: #555; font-size: 12px; text-transform: uppercase;">Total de Visitantes</h4><p style="margin: 10px 0 0; font-size: 24px; font-weight: bold; color: #000;">${visitantes.length}</p></div>
                    <div style="border: 2px solid #28a745; border-radius: 8px; padding: 15px; width: 30%; text-align: center;"><h4 style="margin: 0; color: #555; font-size: 12px; text-transform: uppercase;">Votos Emitidos</h4><p style="margin: 10px 0 0; font-size: 24px; font-weight: bold; color: #000;">${votos.length}</p></div>
                    <div style="border: 2px solid #ffc107; border-radius: 8px; padding: 15px; width: 30%; text-align: center;"><h4 style="margin: 0; color: #555; font-size: 12px; text-transform: uppercase;">Promedio de Votos/Proyecto</h4><p style="margin: 10px 0 0; font-size: 24px; font-weight: bold; color: #000;">${proyectos.length > 0 ? (votos.length / proyectos.length).toFixed(2) : "0.00"}</p></div>
                </div>
                <h3 style="font-family: Arial, sans-serif; font-size: 15px; color: #000; border-bottom: 2px solid #001f54; padding-bottom: 5px; margin-top: 30px;">A. Desglose de Votación por Proyecto (40% de la Nota Final)</h3>
                ${generarTablaV("1. ESTUDIANTES (PREGRADO)") + generarTablaV("2. DOCENTES INVESTIGADORES") + generarTablaV("3. EMPRENDIMIENTOS TECNOLÓGICOS")}
                <h3 style="font-family: Arial, sans-serif; font-size: 15px; color: #000; border-bottom: 2px solid #001f54; padding-bottom: 5px; margin-top: 40px;">B. Afluencia por Instituciones Externas</h3>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px; font-family: Arial, sans-serif; font-size: 12px; color: #000;">
                    <thead><tr style="background-color: #f2f2f2; border-bottom: 2px solid #000;"><th style="padding: 10px; border: 1px solid #ccc; text-align: left;">Nombre de la Institución</th><th style="padding: 10px; border: 1px solid #ccc; text-align: center;">Cantidad de Visitantes</th><th style="padding: 10px; border: 1px solid #ccc; text-align: center;">Porcentaje del Total</th></tr></thead>
                    <tbody>${htmlInst}</tbody>
                </table>
                <div style="display: flex; justify-content: space-around; margin-top: 60px; text-align: center; font-family: Arial, sans-serif; font-size: 13px; color: #000; page-break-inside: avoid;">
                    <div><p style="margin: 0; border-top: 1px solid #000; padding-top: 5px; width: 220px;">Firma y Sello<br>Resp. de Interacción Social I.I.S.P.</p></div>
                    <div><p style="margin: 0; border-top: 1px solid #000; padding-top: 5px; width: 220px;">Firma y Sello<br>Comité Organizador</p></div>
                </div>`;
        }

        // 5. REPORTES DE DOCUMENTOS RECIBIDOS
        else if (valor === "documentos") {
            const correosConProy = new Set();
            const grupos = { "1. ESTUDIANTES (PREGRADO)": [], "2. DOCENTES INVESTIGADORES": [], "3. EMPRENDIMIENTOS TECNOLÓGICOS": [], "4. PENDIENTES (SIN PROYECTO REGISTRADO)": [] };

            proyectos.forEach(p => {
                const exp = expositores.find(e => e.ci === p.ci_propietario);
                if (exp && exp.correo) correosConProy.add(exp.correo.toLowerCase());
                let cat = p.categoria.includes('estudiante') ? "1. ESTUDIANTES (PREGRADO)" : p.categoria.includes('docente') ? "2. DOCENTES INVESTIGADORES" : "3. EMPRENDIMIENTOS TECNOLÓGICOS";
                grupos[cat].push({ titulo: p.titulo || "Sin Título", integrantes: p.integrantes || "No registrado", eje: p.eje_tematico || "Sin Línea Definida", tienePDF: !!p.enlace_pdf });
            });

            expositores.forEach(exp => {
                if (!correosConProy.has((exp.correo || "").toLowerCase())) grupos["4. PENDIENTES (SIN PROYECTO REGISTRADO)"].push({ titulo: "No registró información", integrantes: exp.nombre_completo, eje: "-", tienePDF: false });
            });

            Object.values(grupos).forEach(g => g.sort((a, b) => a.titulo.localeCompare(b.titulo)));

            const generarTablaD = (tCat, lista) => {
                let html = `<h3 style="font-family: Arial, sans-serif; font-size: 14px; color: #fff; background-color: #002b5c; padding: 8px; margin-top: 25px; margin-bottom: 0;">${tCat} (Total: ${lista.length})</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-family: Arial, sans-serif; font-size: 11px; color: #000;">
                    <thead><tr style="background-color: #f2f2f2; border-bottom: 2px solid #000;">
                        <th style="padding: 10px; border: 1px solid #ccc; text-align: left; width: 30%;">Título del Proyecto</th><th style="padding: 10px; border: 1px solid #ccc; text-align: left; width: 35%;">Autores / Expositores</th><th style="padding: 10px; border: 1px solid #ccc; text-align: left; width: 20%;">Línea de Investigación</th><th style="padding: 10px; border: 1px solid #ccc; text-align: center; width: 15%;">Archivo PDF</th>
                    </tr></thead><tbody>`;
                if (lista.length === 0) html += `<tr><td colspan="4" style="padding: 10px; border: 1px solid #ccc; text-align: center; color: #666;">No hay registros.</td></tr>`;
                else lista.forEach(p => html += `<tr><td style="padding: 10px; border: 1px solid #ccc; ${(p.titulo === "No registró información") ? "color: #dc3545; font-style: italic;" : "font-weight: bold;"}">${p.titulo}</td><td style="padding: 10px; border: 1px solid #ccc;">${p.integrantes}</td><td style="padding: 10px; border: 1px solid #ccc;">${p.eje}</td><td style="padding: 10px; border: 1px solid #ccc; text-align: center; font-size: 11px;">${p.tienePDF ? `<span style="color: #28a745; font-weight: bold;">✓<br>RECIBIDO</span>` : `<span style="color: #dc3545; font-weight: bold;">❌<br>FALTANTE</span>`}</td></tr>`);
                return html + `</tbody></table>`;
            };

            areaImpresion.innerHTML = generarCabeceraOficial("REPORTE DE INSCRIPCIÓN Y CONTROL DE DOCUMENTACIÓN", `Fecha de auditoría: ${new Date().toLocaleDateString()} — Estado: Concluido`) + 
                generarTablaD("1. ESTUDIANTES (PREGRADO)", grupos["1. ESTUDIANTES (PREGRADO)"]) + generarTablaD("2. DOCENTES INVESTIGADORES", grupos["2. DOCENTES INVESTIGADORES"]) + generarTablaD("3. EMPRENDIMIENTOS TECNOLÓGICOS", grupos["3. EMPRENDIMIENTOS TECNOLÓGICOS"]) + generarTablaD("4. PENDIENTES (SIN PROYECTO REGISTRADO)", grupos["4. PENDIENTES (SIN PROYECTO REGISTRADO)"]) +
                `<div style="display: flex; justify-content: space-around; margin-top: 70px; text-align: center; font-family: Arial, sans-serif; font-size: 13px; color: #000; page-break-inside: avoid;">
                    <div><p style="margin: 0; border-top: 1px solid #000; padding-top: 5px; width: 230px;">Recibido y Verificado por:<br>Encargado de Soporte Técnico</p></div>
                    <div><p style="margin: 0; border-top: 1px solid #000; padding-top: 5px; width: 230px;">Sello de Conformidad<br>Instituto de Investigación</p></div>
                </div>`;
        }

        // 6. EXPOSITORES
        else if (valor === "expositores") {
            const grupos = { "1. Estudiantes (Pregrado)": [], "2. Docentes Investigadores": [], "3. Emprendimientos Tecnológicos": [], "4. Registrados sin Proyecto Subido (Pendientes)": [] };

            expositores.forEach(e => {
                const proy = proyectos.find(p => p.ci_propietario === e.ci);
                let cat = "4. Registrados sin Proyecto Subido (Pendientes)";
                if (proy) cat = proy.categoria.includes('estudiante') ? "1. Estudiantes (Pregrado)" : proy.categoria.includes('docente') ? "2. Docentes Investigadores" : "3. Emprendimientos Tecnológicos";
                grupos[cat].push({ nombre: e.nombre_completo || "Sin Nombre", ci: e.ci || "N/A", institucion: e.institucion || "N/A", correo: (e.correo || "").toLowerCase(), celular: e.celular || "N/A" });
            });

            Object.values(grupos).forEach(g => g.sort((a, b) => a.nombre.localeCompare(b.nombre)));

            const generarTablaE = (tCat, lista) => {
                if(lista.length === 0) return ""; 
                let html = `<h3 style="font-family: Arial, sans-serif; font-size: 14px; color: #fff; background-color: #002b5c; padding: 8px; margin-top: 25px; margin-bottom: 0;">${tCat} (Total: ${lista.length})</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-family: Arial, sans-serif; font-size: 11px; color: #000;">
                    <thead><tr style="background-color: #f2f2f2; border-bottom: 2px solid #000;"><th style="padding: 8px; border: 1px solid #ccc; text-align: center; width: 5%;">N°</th><th style="padding: 8px; border: 1px solid #ccc; text-align: left; width: 25%;">Nombre Completo</th><th style="padding: 8px; border: 1px solid #ccc; text-align: center; width: 10%;">C.I.</th><th style="padding: 8px; border: 1px solid #ccc; text-align: left; width: 25%;">Institución</th><th style="padding: 8px; border: 1px solid #ccc; text-align: left; width: 20%;">Correo Electrónico</th><th style="padding: 8px; border: 1px solid #ccc; text-align: center; width: 15%;">Celular</th></tr></thead><tbody>`;
                lista.forEach((e, i) => html += `<tr><td style="padding: 8px; border: 1px solid #ccc; text-align: center;">${i + 1}</td><td style="padding: 8px; border: 1px solid #ccc; font-weight: bold; text-transform: capitalize;">${e.nombre.toLowerCase()}</td><td style="padding: 8px; border: 1px solid #ccc; text-align: center;">${e.ci}</td><td style="padding: 8px; border: 1px solid #ccc;">${e.institucion}</td><td style="padding: 8px; border: 1px solid #ccc; color: #0056b3;">${e.correo}</td><td style="padding: 8px; border: 1px solid #ccc; text-align: center;">${e.celular}</td></tr>`);
                return html + `</tbody></table>`;
            };

            areaImpresion.innerHTML = generarCabeceraOficial("PADRÓN OFICIAL DE EXPOSITORES REGISTRADOS") +
                generarTablaE("1. Estudiantes (Pregrado)", grupos["1. Estudiantes (Pregrado)"]) + generarTablaE("2. Docentes Investigadores", grupos["2. Docentes Investigadores"]) + generarTablaE("3. Emprendimientos Tecnológicos", grupos["3. Emprendimientos Tecnológicos"]) + generarTablaE("4. Registrados sin Proyecto Subido (Pendientes)", grupos["4. Registrados sin Proyecto Subido (Pendientes)"]) +
                `<div style="display: flex; justify-content: space-around; margin-top: 60px; text-align: center; font-family: Arial, sans-serif; font-size: 13px; color: #000; page-break-inside: avoid;">
                    <div><p style="margin: 0; border-top: 1px solid #000; padding-top: 5px; width: 220px;">Firma y Sello<br>Resp. de Registro y Admisión</p></div>
                    <div><p style="margin: 0; border-top: 1px solid #000; padding-top: 5px; width: 220px;">Firma y Sello<br>Comité Organizador</p></div>
                </div>`;
        }

        // 7. VISITANTES PADRON
        else if (valor === "padron_visitantes") {
            const filtroSelect = document.getElementById('institucion-select');
            const institucionElegida = filtroSelect ? filtroSelect.value : "TODOS";
            const ciQueVotaron = new Set(votos.filter(v => v.ci_visitante).map(v => String(v.ci_visitante).trim()));

            const esValido = (tC, nB) => {
                if (!tC || !nB) return false;
                const b = nB.trim().toLowerCase();
                return b.split(/\s+/).length >= 2 && b.length >= 5 && new RegExp(`(\\b|^)${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\b|$)`, "i").test(tC.trim().toLowerCase());
            };

            const lProy = proyectos.map(p => { const e = expositores.find(e => e.ci === p.ci_propietario); return { id: p.ci_propietario, c: e ? (e.correo||"").toLowerCase().trim() : "", t: p.titulo||"Proyecto sin título", int: (p.integrantes||"").trim() }; });

            const lVis = [];
            visitantes.forEach(v => {
                const i = (v.institucion || "N/A").trim();
                if (institucionElegida === "TODOS" || institucionElegida.toLowerCase() === i.toLowerCase()) {
                    let n = v.nombre_completo || "Sin Nombre";
                    const pF = lProy.find(p => esValido(p.int, n));
                    if (pF) n += `<br><span style="color: #008080; font-size: 0.82rem;">🟢 <b>Co-Expositor</b> — <i>"${pF.t}"</i></span>`;
                    lVis.push({ n, ci: String(v.ci).trim(), i, v: ciQueVotaron.has(String(v.ci).trim()) ? `<span style="color:#28a745; font-weight:bold;">✓ SÍ</span>` : `<span style="color:#dc3545; font-weight:bold;">❌ NO</span>` });
                }
            });

            expositores.forEach(e => {
                const i = (e.institucion || "N/A").trim();
                if (institucionElegida === "TODOS" || institucionElegida.toLowerCase() === i.toLowerCase()) {
                    const c = String(e.ci).trim();
                    const correo = (e.correo || "").toLowerCase().trim();
                    let nb = e.nombre_completo || "Sin Nombre";
                    const pF = lProy.find(p => p.id === c || (correo !== "" && p.c === correo) || esValido(p.int, nb));
                    const et = pF ? `<br><span style="color: #0056b3; font-size: 0.82rem;">🔵 <b>Expositor</b> — <i>"${pF.t}"</i></span>` : `<br><span style="color: #dc3545; font-size: 0.82rem;">🔴 <b>Expositor</b> — <i style="color: #dc3545;">No subió proyecto</i></span>`;
                    const idx = lVis.findIndex(v => v.ci === c);
                    if (idx === -1) lVis.push({ n: nb + et, ci: c, i, v: ciQueVotaron.has(c) ? `<span style="color:#28a745; font-weight:bold;">✓ SÍ</span>` : `<span style="color:#dc3545; font-weight:bold;">❌ NO</span>` });
                    else lVis[idx].n = nb + et;
                }
            });

            lVis.sort((a, b) => a.n.localeCompare(b.n));
            let titTab = institucionElegida === "TODOS" ? "Padrón General (Visitantes y Expositores)" : (/colegio|unidad|escuela|uab|universidad|instituto/i.test(institucionElegida)) ? `Lista de Asistencia: ${institucionElegida}` : `Visitantes Externos: ${institucionElegida}`;

            let htmlTabla = `<h3 style="font-family: Arial, sans-serif; font-size: 14px; color: #fff; background-color: #002b5c; padding: 8px; margin-top: 25px; margin-bottom: 0;">${titTab} (Total: ${lVis.length})</h3>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-family: Arial, sans-serif; font-size: 11px; color: #000;">
                <thead><tr style="background-color: #f2f2f2; border-bottom: 2px solid #000;"><th style="padding: 8px; border: 1px solid #ccc; text-align: center; width: 8%;">N°</th><th style="padding: 8px; border: 1px solid #ccc; text-align: left; width: 37%;">Nombre Completo</th><th style="padding: 8px; border: 1px solid #ccc; text-align: center; width: 15%;">C.I.</th><th style="padding: 8px; border: 1px solid #ccc; text-align: left; width: 25%;">Institución</th><th style="padding: 8px; border: 1px solid #ccc; text-align: center; width: 15%;">Votos</th></tr></thead><tbody>`;

            if (lVis.length === 0) htmlTabla += `<tr><td colspan="5" style="padding: 8px; border: 1px solid #ccc; text-align: center; color: #666;">No hay personas registradas en esta institución.</td></tr>`;
            else lVis.forEach((v, i) => htmlTabla += `<tr><td style="padding: 8px; border: 1px solid #ccc; text-align: center;">${i + 1}</td><td style="padding: 8px; border: 1px solid #ccc; text-transform: capitalize;">${v.n}</td><td style="padding: 8px; border: 1px solid #ccc; text-align: center;">${v.ci}</td><td style="padding: 8px; border: 1px solid #ccc;">${v.i}</td><td style="padding: 8px; border: 1px solid #ccc; text-align: center; font-size: 12px;">${v.v}</td></tr>`);
            htmlTabla += `</tbody></table>`;

            areaImpresion.innerHTML = generarCabeceraOficial("PADRÓN OFICIAL DE VISITANTES Y ESTADO DE VOTACIÓN", `Filtro aplicado: ${institucionElegida === "TODOS" ? "Padrón General (Todas las Instituciones)" : institucionElegida}`) + htmlTabla +
                `<div style="display: flex; justify-content: space-around; margin-top: 60px; text-align: center; font-family: Arial, sans-serif; font-size: 13px; color: #000; page-break-inside: avoid;">
                    <div><p style="margin: 0; border-top: 1px solid #000; padding-top: 5px; width: 220px;">Firma y Sello<br>Resp. de Registro y Admisión</p></div>
                    <div><p style="margin: 0; border-top: 1px solid #000; padding-top: 5px; width: 220px;">Firma y Sello<br>Comité Organizador</p></div>
                </div>`;
        }
        
        // 8. PADRON TRIBUNALES
        else if (valor === "padron_tribunales") {
            const lTrib = tribunales.map(t => ({ n: t.nombre_completo || "Sin Nombre", e: t.especialidad || "No especificada", c: t.correo || "No registrado" })).sort((a, b) => a.n.localeCompare(b.n));

            let htmlF = "";
            if (lTrib.length === 0) htmlF = `<tr><td colspan="4" style="padding: 10px; border: 1px solid #ccc; text-align: center; color: #666;">No hay tribunales registrados.</td></tr>`;
            else lTrib.forEach((t, i) => htmlF += `<tr><td style="padding: 10px; border: 1px solid #ccc; text-align: center;">${i + 1}</td><td style="padding: 10px; border: 1px solid #ccc; font-weight: bold; text-transform: capitalize;">${t.n.toLowerCase()}</td><td style="padding: 10px; border: 1px solid #ccc;">${t.e}</td><td style="padding: 10px; border: 1px solid #ccc; color: var(--azul-uab);">${t.c}</td></tr>`);

            areaImpresion.innerHTML = generarCabeceraOficial("PADRÓN OFICIAL DE TRIBUNALES EVALUADORES") + `
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 50px; font-family: Arial, sans-serif; font-size: 12px; color: #000;">
                    <thead><tr style="background-color: #002b5c; color: #fff; border-bottom: 2px solid #000;"><th style="padding: 10px; border: 1px solid #ccc; text-align: center; width: 8%;">N°</th><th style="padding: 10px; border: 1px solid #ccc; text-align: left; width: 42%;">Nombre del Tribunal</th><th style="padding: 10px; border: 1px solid #ccc; text-align: left; width: 25%;">Especialidad</th><th style="padding: 10px; border: 1px solid #ccc; text-align: left; width: 25%;">Correo Electrónico</th></tr></thead>
                    <tbody>${htmlF}</tbody>
                </table>
                <div style="display: flex; justify-content: space-around; margin-top: 70px; text-align: center; font-family: Arial, sans-serif; font-size: 13px; color: #000; page-break-inside: avoid;">
                    <div><p style="margin: 0; border-top: 1px solid #000; padding-top: 5px; width: 230px;">Firma y Sello<br>Resp. de Registro y Admisión</p></div>
                    <div><p style="margin: 0; border-top: 1px solid #000; padding-top: 5px; width: 230px;">Firma y Sello<br>Comité Organizador</p></div>
                </div>`;
        }
        
        // 9. NO CLASIFICADOS
        else if (valor === "9" || valor === "no_clasificados" || valor.includes("No Clasificados")) {
            let html = `<table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; font-family: Arial, sans-serif;">
                <thead><tr style="background-color: #002b5c; color: white;"><th style="padding: 10px; border: 1px solid #ccc; text-align: center; width: 5%;">N°</th><th style="padding: 10px; border: 1px solid #ccc; width: 25%;">Título del Proyecto</th><th style="padding: 10px; border: 1px solid #ccc; width: 15%;">Categoría</th><th style="padding: 10px; border: 1px solid #ccc; width: 20%;">Integrantes</th><th style="padding: 10px; border: 1px solid #ccc; text-align: center; width: 10%;">Nota Tribunal</th><th style="padding: 10px; border: 1px solid #ccc; text-align: center; width: 10%;">Nota Ponderada (60%)</th><th style="padding: 10px; border: 1px solid #ccc; width: 15%;">Observaciones</th></tr></thead><tbody>`;

            let cont = 0;
            proyectos.forEach(p => {
                if (p.estado_evaluacion === "Evaluado (No clasifica)") {
                    cont++;
                    let cat = p.categoria.includes('docente') ? "Docentes" : p.categoria.includes('emprendimiento') ? "Emprendimientos" : "Estudiantes";
                    html += `<tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 8px; border: 1px solid #ccc; text-align: center;"><b>${cont}</b></td>
                        <td style="padding: 8px; border: 1px solid #ccc; font-weight: bold; color: #002b5c;">${p.titulo || "Sin título"}</td>
                        <td style="padding: 8px; border: 1px solid #ccc;">${cat}</td>
                        <td style="padding: 8px; border: 1px solid #ccc;">${p.integrantes || "Desconocido"}</td>
                        <td style="padding: 8px; border: 1px solid #ccc; text-align: center; color: #666;">${p.nota_tribunal ? Number(p.nota_tribunal).toFixed(1) : "0.0"} / 100</td>
                        <td style="padding: 8px; border: 1px solid #ccc; text-align: center; font-weight: bold; color: #d32f2f;">${p.nota_ponderada ? Number(p.nota_ponderada).toFixed(1) : "0.0"} pts</td>
                        <td style="padding: 8px; border: 1px solid #ccc; font-style: italic; color: #444; font-size: 11px;">"${p.observaciones_tribunal || "Sin observaciones."}"</td>
                    </tr>`;
                }
            });

            if (cont === 0) html += `<tr><td colspan="7" style="text-align: center; padding: 25px; color: #666; font-style: italic;">No hay proyectos no clasificados registrados en el sistema en este momento.</td></tr>`;

            areaImpresion.innerHTML = generarCabeceraOficial("REPORTE DE PROYECTOS NO CLASIFICADOS", "Proyectos evaluados en la Etapa 1 que no alcanzaron el puntaje mínimo ponderado de aprobación (51 pts).") + html + `</tbody></table>
                <div style="display: flex; justify-content: space-around; margin-top: 60px; text-align: center; font-family: Arial, sans-serif; font-size: 13px; color: #000; page-break-inside: avoid;">
                    <div><p style="margin: 0; border-top: 1px solid #000; padding-top: 5px; width: 220px;">Firma y Sello<br>Comité Evaluador</p></div>
                    <div><p style="margin: 0; border-top: 1px solid #000; padding-top: 5px; width: 220px;">Firma y Sello<br>Director de Carrera UABJB</p></div>
                </div>`;
        }

        if (btn) { btn.innerHTML = '<i class="fas fa-print"></i> Imprimir Documento'; btn.disabled = false; }

    } catch (error) {
        console.error("Error al generar reporte:", error);
        areaImpresion.innerHTML = '<div style="text-align: center; color: red; padding: 20px;">❌ Error al conectar con la base de datos PostgreSQL.</div>';
        if (btn) { btn.innerHTML = '<i class="fas fa-print"></i> Imprimir Documento'; btn.disabled = false; }
    } 
};

window.imprimirInformeActual = function(event) {
    if (event) event.preventDefault(); 
    const areaImpresion = document.getElementById('informe-impresion');
    if (!areaImpresion || areaImpresion.style.display === 'none' || areaImpresion.innerHTML.trim() === '') {
        alert("Por favor, seleccione un tipo de informe primero para visualizarlo.");
        return;
    }
    imprimirElemento('informe-impresion');
};