// =========================================================================
// ARCHIVO: features/resultados/resultados.js
// FUNCIÓN: Gráficos, Ranking y Filtro Inteligente ESTRICTO
// =========================================================================

window.graficoEstudiantes = null;
window.graficoDocentes = null;
window.graficoEmprendimientos = null;

window.calcularResultadosEnTiempoReal = async function() {
    const rolUsuario = localStorage.getItem("feria_rol") || "VISITANTE";
    
    // --- 1. DETERMINAR PERMISOS DE CATEGORÍA ---
    let categoriaPermitida = "TODAS"; 

    if (window.auth && window.auth.currentUser) {
        const email = window.auth.currentUser.email;
        if (rolUsuario === "EXPOSITOR") {
            try {
                const res = await fetch(`/api/proyectos/${email}`);
                const proy = await res.json();
                if (proy) categoriaPermitida = proy.categoria.toLowerCase();
            } catch(e) { console.error("Error al buscar categoría expositor:", e); }
        } else if (rolUsuario === "TRIBUNAL") {
            try {
                const res = await fetch(`/api/tribunal_correo/${email}`);
                const trib = await res.json();
                if (trib) categoriaPermitida = trib.categoria_asignada.toLowerCase();
            } catch(e) { console.error("Error al buscar categoría tribunal:", e); }
        }
    }

    const esAdminOVisitante = (rolUsuario === "ADMIN" || rolUsuario === "VISITANTE");
    const verEstudiantes = esAdminOVisitante || categoriaPermitida.includes('estudiante');
    const verDocentes = esAdminOVisitante || categoriaPermitida.includes('docente');
    const verEmprendimientos = esAdminOVisitante || categoriaPermitida.includes('emprendimiento');

    const aplicarFiltroVisibilidad = () => {
        const ocultarRastros = (ids, palabraClave) => {
            ids.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
            
            document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
                if (h.innerText.toLowerCase().includes(palabraClave)) {
                    h.style.display = 'none'; 
                    let nextEl = h.nextElementSibling;
                    while (nextEl && (nextEl.tagName === 'BR' || nextEl.tagName === 'HR')) {
                        nextEl.style.display = 'none';
                        nextEl = nextEl.nextElementSibling;
                    }
                    if (nextEl) nextEl.style.display = 'none';
                }
            });
        };

        if (!verEstudiantes) ocultarRastros(['bloque-res-est', 'ranking-estudiantes'], 'estudiante');
        if (!verDocentes) ocultarRastros(['bloque-res-doc', 'ranking-docentes'], 'docente');
        if (!verEmprendimientos) ocultarRastros(['bloque-res-emp', 'ranking-emprendimientos'], 'emprendimiento');
    };

    // --- 2. LÓGICA DE CANDADO DE TIEMPO DINÁMICA ---
    let FECHA_PUBLICACION_RESULTADOS = new Date("2026-07-22T18:00:00"); 
    try {
        const resConf = await fetch('/api/configuraciones');
        const dataConf = await resConf.json();
        FECHA_PUBLICACION_RESULTADOS = new Date(dataConf.fecha_resultados);
    } catch(e) { console.error("Error obteniendo fechas del servidor"); }

    const ahora = new Date();

    if (ahora < FECHA_PUBLICACION_RESULTADOS && rolUsuario !== "ADMIN") {
        const btnMasDetalle = document.getElementById('btn-mas-detalle');
        if (btnMasDetalle) btnMasDetalle.style.display = 'none';

        const tbodiesTop = document.querySelectorAll('#resultados .dash-tabla tbody');
        const fechaTexto = FECHA_PUBLICACION_RESULTADOS.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        tbodiesTop.forEach(tbody => {
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="2" style="text-align: center; padding: 50px 20px; background: rgba(0,0,0,0.15);">
                            <i class="fas fa-lock" style="font-size: 3rem; color: #475569; margin-bottom: 15px; display: block;"></i>
                            <h4 style="color: #f1c40f; margin-bottom: 8px; font-size: 1.1rem;">Etapa de Evaluación en Curso</h4>
                            <p style="font-size: 0.85rem; color: #94a3b8; margin: 0;">El Ranking Oficial se revelará el:<br><b style="color: #fff;">${fechaTexto}</b></p>
                        </td>
                    </tr>
                `;
            }
        });

        if (window.graficoEstudiantes) window.graficoEstudiantes.destroy();
        if (window.graficoDocentes) window.graficoDocentes.destroy();
        if (window.graficoEmprendimientos) window.graficoEmprendimientos.destroy();

        aplicarFiltroVisibilidad();
        return; 
    }

    const btnMasDetalle = document.getElementById('btn-mas-detalle');
    if (btnMasDetalle) btnMasDetalle.style.display = 'inline-block';

    try {
        // --- 3. OBTENER RESULTADOS DESDE POSTGRESQL ---
        const respuesta = await fetch('/api/resultados');
        const proyectosBD = await respuesta.json();

        const topEstudiantes = [];
        const topDocentes = [];
        const topEmprendimientos = [];

        proyectosBD.forEach(p => {
            const datosParaTabla = { 
                titulo: p.titulo, 
                notaTribunalFinal: p.tribunal_60, 
                notaPublicoFinal: p.publico_40,   
                notaFinal: p.nota_final           
            };
            if (p.categoria.toLowerCase().includes('estudiante')) topEstudiantes.push(datosParaTabla);
            else if (p.categoria.toLowerCase().includes('docente')) topDocentes.push(datosParaTabla);
            else if (p.categoria.toLowerCase().includes('emprendimiento')) topEmprendimientos.push(datosParaTabla);
        });

        // --- 4. RENDERIZAR TABLAS RESUMEN ---
        const tbodiesTop = document.querySelectorAll('#resultados .dash-tabla tbody');
        
        const renderizarTop = (tbody, datos) => {
            if (!tbody) return;
            tbody.innerHTML = '';
            if (datos.length === 0) {
                tbody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: #aaa;">Sin proyectos registrados.</td></tr>';
                return;
            }
            datos.slice(0, 5).forEach(p => {
                const colorNota = p.notaFinal > 0 ? '#fff' : '#888';
                tbody.innerHTML += `
                    <tr>
                        <td style="color: #ddd;">${p.titulo}</td>
                        <td style="text-align: center; font-weight: bold; color: ${colorNota}; font-size: 1.1rem;">
                            ${p.notaFinal.toFixed(2)}
                        </td>
                    </tr>`;
            });
        };

        renderizarTop(tbodiesTop[0], topEstudiantes);
        renderizarTop(tbodiesTop[1], topDocentes);
        renderizarTop(tbodiesTop[2], topEmprendimientos);

        // --- 5. RENDERIZAR TABLAS DETALLADAS ---
        document.querySelectorAll('#tabla-detalles h4').forEach(h4 => {
            h4.style.color = "#60a5fa"; 
            h4.style.fontSize = "1.25rem";
            h4.style.borderBottom = "1px solid rgba(255, 255, 255, 0.15)";
            h4.style.paddingBottom = "8px";
            h4.style.marginTop = "25px";
        });

        const renderizarDetalle = (idTbody, datos) => {
            const tbody = document.getElementById(idTbody);
            if (!tbody) return;
            tbody.innerHTML = '';
            
            if (datos.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #a0aec0; padding: 20px; background: rgba(0,0,0,0.2) !important;">No hay proyectos para mostrar en esta categoría.</td></tr>';
                return;
            }

            datos.forEach((p, index) => {
                let lugar = index + 1;
                let medallaHTML = `<span style="font-weight: bold; color: #cbd5e1; font-size: 1.1rem;">${lugar}°</span>`;
                
                if (lugar === 1 && p.notaFinal > 0) medallaHTML = '<i class="fas fa-trophy" style="color: #ffc107; font-size: 1.3rem;"></i>';
                else if (lugar === 2 && p.notaFinal > 0) medallaHTML = '<i class="fas fa-trophy" style="color: #e2e8f0; font-size: 1.2rem;"></i>';
                else if (lugar === 3 && p.notaFinal > 0) medallaHTML = '<i class="fas fa-trophy" style="color: #d97706; font-size: 1.1rem;"></i>';

                tbody.innerHTML += `
                    <tr style="background: rgba(15, 23, 42, 0.6) !important; border-bottom: 1px solid rgba(255, 255, 255, 0.1); transition: 0.2s;">
                        <td style="text-align: center; padding: 14px; background: transparent !important; color: #ffffff !important;">${medallaHTML}</td>
                        <td style="padding: 14px; font-weight: bold; background: transparent !important; color: #ffffff !important;">${p.titulo}</td>
                        <td style="padding: 14px; text-align: center; background: transparent !important; color: #93c5fd !important; font-weight: 500;">${p.notaTribunalFinal.toFixed(2)}</td>
                        <td style="padding: 14px; text-align: center; background: transparent !important; color: #34d399 !important; font-weight: 500;">${p.notaPublicoFinal.toFixed(2)}</td>
                        <td class="final-score" style="padding: 14px; text-align: center; font-weight: bold; background: transparent !important; color: #ffc107 !important; font-size: 1.15rem;">${p.notaFinal.toFixed(2)}</td>
                    </tr>
                `;
            });
        };

        renderizarDetalle('ranking-estudiantes', topEstudiantes);
        renderizarDetalle('ranking-docentes', topDocentes);
        renderizarDetalle('ranking-emprendimientos', topEmprendimientos);

        // --- 6. RENDERIZAR GRÁFICOS DINÁMICOS ---
        const paletaColores = ['#3498db', '#e74c3c', '#f1c40f', '#2ecc71', '#9b59b6'];

        const dibujarGrafico = (idCanvas, graficoVariable, datos) => {
            const canvas = document.getElementById(idCanvas);
            if (!canvas) return graficoVariable;

            if (graficoVariable) graficoVariable.destroy();

            const top5 = datos.slice(0, 5);
            const filtrados = top5.filter(d => d.notaFinal >= 0); 
            
            let titulos = filtrados.map(d => d.titulo);
            let notas = filtrados.map(d => d.notaFinal > 0 ? d.notaFinal.toFixed(2) : 1); 
            let colores = paletaColores.slice(0, notas.length);

            if (titulos.length === 0) {
                titulos = ['Esperando Evaluaciones'];
                notas = [1];
                colores = ['#555'];
            }

            const config = {
                type: 'pie',
                data: {
                    labels: titulos,
                    datasets: [{
                        data: notas,
                        backgroundColor: colores,
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right', labels: { color: '#fff', font: { size: 10 } } },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    //  PROTECCIÓN: Si es el gráfico gris de espera, no buscamos notas
                                    if (titulos[0] === 'Esperando Evaluaciones') {
                                        return ' Aún no hay notas registradas';
                                    }
                                    // Usamos 'filtrados' en vez de 'datos' para que los índices cuadren perfectamente
                                    let valorReal = filtrados[context.dataIndex].notaFinal;
                                    return context.label + ': ' + valorReal.toFixed(2) + ' pts';
                                }
                            }
                        }
                    }
                }
            };
            return new Chart(canvas, config);
        };

        window.graficoEstudiantes = dibujarGrafico('graficoPastel', window.graficoEstudiantes, topEstudiantes);
        window.graficoDocentes = dibujarGrafico('graficoPastelDocentes', window.graficoDocentes, topDocentes);
        window.graficoEmprendimientos = dibujarGrafico('graficoPastelEmprendimientos', window.graficoEmprendimientos, topEmprendimientos);

        // --- 7. APLICAR EL FILTRO DESTRUCTIVO FINAL ---
        aplicarFiltroVisibilidad();

    } catch (error) {
        console.error("Error al calcular resultados:", error);
    }
};

window.alternarDetalles = function() {
    const tablaDetalles = document.getElementById('tabla-detalles');
    const btnMasDetalle = document.getElementById('btn-mas-detalle');

    if (tablaDetalles.style.display === 'none' || tablaDetalles.style.display === '') {
        tablaDetalles.style.display = 'block';
        btnMasDetalle.innerHTML = '<i class="fas fa-eye-slash"></i> Ocultar Detalles';
    } else {
        tablaDetalles.style.display = 'none';
        btnMasDetalle.innerHTML = '<i class="fas fa-list"></i> Más Detalle';
    }
};