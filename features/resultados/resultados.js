// =========================================================================
// ARCHIVO: features/resultados/resultados.js
// =========================================================================

let chartEstudiante = null;
let chartDocente = null;
let chartEmprendimiento = null;

window.calcularResultadosEnTiempoReal = async function() {
    try {
        const resConf = await fetch('/api/configuraciones');
        const conf = await resConf.json();
        
        const fechaResultados = new Date(conf.fecha_resultados);
        const ahora = new Date();
        const rolActual = localStorage.getItem("feria_rol") || "";

        const contenedorPrincipal = document.querySelector('#resultados .container');
        const idsA_Ocultar = ['bloque-res-est', 'bloque-res-doc', 'bloque-res-emp', 'btn-mas-detalle', 'tabla-detalles'];

        let cartelBloqueo = document.getElementById('panel-candado-resultados');
        if (!cartelBloqueo) {
            cartelBloqueo = document.createElement('div');
            cartelBloqueo.id = 'panel-candado-resultados';
            const headerModulo = document.querySelector('#resultados .header-module');
            if (headerModulo) headerModulo.insertAdjacentElement('afterend', cartelBloqueo);
        }

        let alertaAdmin = document.getElementById('alerta-admin-resultados');
        if (!alertaAdmin) {
            alertaAdmin = document.createElement('div');
            alertaAdmin.id = 'alerta-admin-resultados';
            alertaAdmin.style.cssText = 'background: rgba(255, 193, 7, 0.15); border: 1px solid rgba(255, 193, 7, 0.5); color: #ffc107; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center; font-weight: bold;';
            cartelBloqueo.insertAdjacentElement('afterend', alertaAdmin);
        }

        if (!isNaN(fechaResultados.getTime()) && ahora < fechaResultados && rolActual !== "ADMIN") {
            
            idsA_Ocultar.forEach(id => { const el = document.getElementById(id); if(el) el.style.display = 'none'; });
            alertaAdmin.style.display = 'none';
            
            if(chartEstudiante) { chartEstudiante.destroy(); chartEstudiante = null; }
            if(chartDocente) { chartDocente.destroy(); chartDocente = null; }
            if(chartEmprendimiento) { chartEmprendimiento.destroy(); chartEmprendimiento = null; }

            const opcionesFecha = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
            cartelBloqueo.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; background: rgba(255, 255, 255, 0.05); border-radius: 15px; border: 2px dashed rgba(255,255,255,0.2); margin-top: 30px; backdrop-filter: blur(10px);">
                    <i class="fas fa-lock" style="font-size: 5rem; color: #ff6b6b; margin-bottom: 20px;"></i>
                    <h2 style="color: #ffffff; margin-bottom: 15px;">Ranking Protegido</h2>
                    <p style="color: #cbd5e1; font-size: 1.1rem; max-width: 500px; margin: 0 auto;">Los proyectos se encuentran en etapa de evaluación. Los resultados oficiales se revelarán automáticamente el:<br>
                    <strong style="color: #4db8ff; font-size: 1.3rem; display: block; margin-top: 15px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px;">${fechaResultados.toLocaleDateString('es-ES', opcionesFecha)}</strong></p>
                </div>`;
            cartelBloqueo.style.display = 'block';
            
            const msgVacio = document.getElementById('mensaje-sin-ranking');
            if (msgVacio) msgVacio.style.display = 'none';

        } else {
            cartelBloqueo.style.display = 'none';

            if (rolActual === "ADMIN" && ahora < fechaResultados) {
                alertaAdmin.innerHTML = '<i class="fas fa-eye"></i> <b>Modo Administrador:</b> Estás monitoreando el ranking. El público general tiene esta pantalla bloqueada.';
                alertaAdmin.style.display = 'block';
            } else {
                alertaAdmin.style.display = 'none';
            }

            window.renderizarTablasRanking();
        }
    } catch (error) { console.error("Error en resultados:", error); }
};

window.renderizarTablasRanking = async function() {
    try {
        //  Envía el CI al servidor para demostrar si somos administradores o público
        const ciFeria = localStorage.getItem("feria_ci") || "publico";
        const respuesta = await fetch(`/api/resultados?ci=${ciFeria}`);
        const data = await respuesta.json();

        //  Si el servidor nos mandó a volar porque no es la fecha y no somos admin, cortamos el código aquí.
        if (data.error) {
            console.warn(data.error);
            return;
        }

        const rolActual = localStorage.getItem("feria_rol") || "";
        let verEst = true, verDoc = true, verEmp = true;
        let mostrarAvisoVacio = false;

        if (rolActual === "EXPOSITOR") {
            verEst = false; verDoc = false; verEmp = false;
            mostrarAvisoVacio = true; 
            try {
                const resMiProy = await fetch(`/api/proyectos/${ciFeria}`);
                if (resMiProy.ok) {
                    const miProy = await resMiProy.json();
                    if (miProy && miProy.categoria) {
                        mostrarAvisoVacio = false; 
                        const cat = miProy.categoria.toLowerCase();
                        if (cat.includes('estudiante')) verEst = true;
                        else if (cat.includes('docente')) verDoc = true;
                        else if (cat.includes('emprendimiento')) verEmp = true;
                    }
                }
            } catch(e){}
        } 
        else if (rolActual === "TRIBUNAL") {
            verEst = false; verDoc = false; verEmp = false;
            const correoTribunal = localStorage.getItem("feria_correo");
            try {
                const resTrib = await fetch(`/api/tribunal_correo/${correoTribunal}`);
                if (resTrib.ok) {
                    const trib = await resTrib.json();
                    if (trib && trib.categoria_asignada) {
                        const cat = trib.categoria_asignada.toLowerCase();
                        if (cat.includes('estudiante')) verEst = true;
                        if (cat.includes('docente')) verDoc = true;
                        if (cat.includes('emprendimiento')) verEmp = true;
                    }
                }
            } catch(e){}
        }

        const aplicarVisibilidad = (id, mostrar) => {
            const el = document.getElementById(id);
            if (el) el.style.display = mostrar ? 'block' : 'none';
        };

        aplicarVisibilidad('bloque-res-est', verEst); aplicarVisibilidad('bloque-det-est', verEst);
        aplicarVisibilidad('bloque-res-doc', verDoc); aplicarVisibilidad('bloque-det-doc', verDoc);
        aplicarVisibilidad('bloque-res-emp', verEmp); aplicarVisibilidad('bloque-det-emp', verEmp);

        const btnDetalle = document.getElementById('btn-mas-detalle');
        if (btnDetalle) {
            btnDetalle.style.display = (verEst || verDoc || verEmp) ? 'flex' : 'none';
        }

        let msgVacio = document.getElementById('mensaje-sin-ranking');
        if (!msgVacio) {
            msgVacio = document.createElement('div');
            msgVacio.id = 'mensaje-sin-ranking';
            msgVacio.style.cssText = 'text-align: center; padding: 50px 20px; background: rgba(0, 0, 0, 0.15); border-radius: 12px; margin-top: 20px; color: #a0aec0; border: 2px dashed rgba(255,255,255,0.1);';
            const headerModulo = document.querySelector('#resultados .header-module');
            if (headerModulo) headerModulo.insertAdjacentElement('afterend', msgVacio);
        }

        if (mostrarAvisoVacio) {
            msgVacio.style.display = 'block';
            msgVacio.innerHTML = `
                <i class="fas fa-project-diagram" style="font-size: 3.5rem; color: rgba(255,255,255,0.2); margin-bottom: 15px;"></i>
                <h3 style="color: #ffffff; font-size: 1.3rem; margin-bottom: 10px;">Aún no has registrado tu proyecto</h3>
                <p style="font-size: 0.95rem; max-width: 400px; margin: 0 auto; line-height: 1.5;">Ve a la pestaña <b>"Mi Proyecto"</b>, sube tu documentación y el sistema te asignará a tu ranking correspondiente automáticamente.</p>
            `;
        } else {
            msgVacio.style.display = 'none';
        }

        ['top-estudiantes', 'top-docentes', 'top-emprendimientos', 'ranking-estudiantes', 'ranking-docentes', 'ranking-emprendimientos'].forEach(id => {
            const tb = document.getElementById(id); if (tb) tb.innerHTML = '';
        });

        const inyectarFilas = (arreglo, idTop, idRanking) => {
            const tbTop = document.getElementById(idTop); const tbRank = document.getElementById(idRanking);
            if (!tbTop || !tbRank) return;

            if (arreglo.length === 0) {
                tbTop.innerHTML = '<tr><td colspan="2" style="text-align:center; padding:15px; color:#fff;">Sin proyectos pre-seleccionados</td></tr>';
                tbRank.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:15px;">Sin datos</td></tr>';
                return;
            }

            arreglo.forEach((proy, index) => {
                const medallaHTML = index === 0 ? '<i class="fas fa-trophy" style="color: #FFD700; font-size: 1.5rem;"></i>' : index === 1 ? '<i class="fas fa-trophy" style="color: #C0C0C0; font-size: 1.5rem;"></i>' : index === 2 ? '<i class="fas fa-trophy" style="color: #CD7F32; font-size: 1.5rem;"></i>' : `<b>${index + 1}º</b>`;
                if (index < 3) tbTop.innerHTML += `<tr><td><div style="display:flex; align-items:center; gap:10px;">${medallaHTML} <span>${proy.titulo}</span></div></td><td style="text-align:center; font-weight:bold; font-size:1.1rem; color:#4db8ff;">${proy.nota_final.toFixed(2)}</td></tr>`;
                tbRank.innerHTML += `<tr><td style="text-align:center;">${medallaHTML}</td><td>${proy.titulo}</td><td style="text-align:center;">${proy.tribunal_60.toFixed(2)}</td><td style="text-align:center;">${proy.publico_40.toFixed(2)}</td><td style="text-align:center; font-weight:bold; color:var(--rojo-uab); font-size:1.1rem;">${proy.nota_final.toFixed(2)}</td></tr>`;
            });
        };

        const dataEst = data.filter(p => p.categoria.includes('estudiante'));
        const dataDoc = data.filter(p => p.categoria.includes('docente'));
        const dataEmp = data.filter(p => p.categoria.includes('emprendimiento'));

        inyectarFilas(dataEst, 'top-estudiantes', 'ranking-estudiantes');
        inyectarFilas(dataDoc, 'top-docentes', 'ranking-docentes');
        inyectarFilas(dataEmp, 'top-emprendimientos', 'ranking-emprendimientos');

        const crearGraficoPastel = (canvasId, arregloDatos, chartVariable) => {
            const ctx = document.getElementById(canvasId);
            if (!ctx) return chartVariable;
            
            if (chartVariable !== null) chartVariable.destroy();

            if (arregloDatos.length === 0) {
                ctx.style.display = 'none';
                return null;
            }
            
            ctx.style.display = 'block';

            const top5 = arregloDatos.slice(0, 5);
            const etiquetas = top5.map(p => p.titulo.length > 20 ? p.titulo.substring(0, 20) + "..." : p.titulo);
            const puntajes = top5.map(p => p.nota_final.toFixed(2));
            const colores = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'];

            return new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: etiquetas,
                    datasets: [{
                        data: puntajes,
                        backgroundColor: colores.slice(0, top5.length),
                        borderWidth: 2,
                        borderColor: '#2b2b2b'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { color: '#ffffff', font: { size: 12 } }
                        }
                    }
                }
            });
        };

        if (verEst) chartEstudiante = crearGraficoPastel('graficoPastel', dataEst, chartEstudiante);
        if (verDoc) chartDocente = crearGraficoPastel('graficoPastelDocentes', dataDoc, chartDocente);
        if (verEmp) chartEmprendimiento = crearGraficoPastel('graficoPastelEmprendimientos', dataEmp, chartEmprendimiento);

    } catch (error) { console.error(error); }
};

window.alternarDetalles = function() {
    const tabla = document.getElementById('tabla-detalles');
    const btn = document.getElementById('btn-mas-detalle');
    if (tabla.style.display === "none" || tabla.style.display === "") {
        tabla.style.display = "block"; btn.innerHTML = '<i class="fas fa-eye-slash"></i> Ocultar Detalle'; btn.style.backgroundColor = "#6c757d";
    } else {
        tabla.style.display = "none"; btn.innerHTML = '<i class="fas fa-list"></i> Más Detalle'; btn.style.backgroundColor = "var(--azul-uab)";
    }
};