// =========================================================================
// ARCHIVO: features/proyecto/proyecto.js
// FUNCIÓN: Subida y Vista de Estado (PostgreSQL + Firebase Storage)
// =========================================================================

//  AHORA LEE DIRECTAMENTE DESDE LA BASE DE DATOS
window.verificarFechaLimite = async function() {
    try {
        const res = await fetch('/api/configuraciones');
        const conf = await res.json();
        const limite = new Date(conf.fecha_subida);
        if (isNaN(limite.getTime())) return true; 
        return new Date() > limite;
    } catch(e) {
        console.error(e);
        return true; 
    }
};

window.validarPDF = function(input) {
    if (input.files && input.files.length > 0) {
        const archivo = input.files[0];
        const nombreArchivo = archivo.name.toLowerCase();
        const pesoMinimo = 30 * 1024;
        const pesoMaximo = 15 * 1024 * 1024;

        if (archivo.type !== "application/pdf" || !nombreArchivo.endsWith(".pdf")) {
            alert("🛑 BLOQUEO DE SEGURIDAD\n\nÚNICAMENTE se aceptan documentos en formato .PDF legítimo.");
            input.value = ""; return false;
        }
        if (archivo.size < pesoMinimo) {
            alert(`🛑 ARCHIVO DEMASIADO LIGERO\n\nEl documento parece estar vacío o dañado.`);
            input.value = ""; return false;
        }
        if (archivo.size > pesoMaximo) {
            alert(`🛑 ARCHIVO DEMASIADO PESADO\n\nEl límite máximo permitido es de 15 MB.`);
            input.value = ""; return false;
        }
        return true;
    }
    return false;
};

window.buscarProyectoUsuario = async function(email) {
    try {
        const respuesta = await fetch(`/api/proyectos/${email}`);
        const data = await respuesta.json();
        if (data) {
            return {
                data: {
                    tituloProyecto: data.titulo,
                    tipoExpositor: data.categoria,
                    integrantes: data.integrantes,
                    ejeTematico: data.eje_tematico,
                    enlacePDF: data.enlace_pdf,
                    estadoEvaluacion: data.estado_evaluacion,
                    notaTribunal: data.nota_tribunal,
                    notaPonderada: data.nota_ponderada,
                    observacionesTribunal: data.observaciones_tribunal
                }
            };
        }
        return null; 
    } catch (error) {
        console.error("Error buscando en PostgreSQL:", error);
        return null;
    }
};

window.cargarDatosProyecto = async function() {
    if (!window.auth || !window.auth.currentUser) return;
    const usuarioActual = window.auth.currentUser;

    try {
        const proyectoExistente = await window.buscarProyectoUsuario(usuarioActual.email);
        const inputTitulo = document.getElementById('proyTitulo');
        if (!inputTitulo) return;
        const formElement = inputTitulo.closest('form');
        if (!formElement) return;

        let divEstado = document.getElementById('panel-estado-proyecto');
        if (!divEstado) {
            divEstado = document.createElement('div');
            divEstado.id = 'panel-estado-proyecto';
            formElement.parentNode.insertBefore(divEstado, formElement);
        }

        const btnSubir = document.getElementById('btnSubirProyecto');
        const archivoInput = document.getElementById('proyArchivo');
        
        //  Validamos contra PostgreSQL
        const tiempoAgotado = await window.verificarFechaLimite(); 
        
        // Obtenemos la fecha visual para el usuario
        let fechaFormateada = "Fecha Inválida (Modificaciones Bloqueadas)";
        try {
            const resConf = await fetch('/api/configuraciones');
            const dataConf = await resConf.json();
            const limiteVisual = new Date(dataConf.fecha_subida);
            if (!isNaN(limiteVisual.getTime())) {
                const opcionesFecha = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
                fechaFormateada = limiteVisual.toLocaleDateString('es-ES', opcionesFecha);
            }
        } catch(e){}

        const cartelFechaFormulario = `
            <div id="aviso-fecha-form" style="background-color: #e8f4fd; color: #0056b3; padding: 12px 15px; border-radius: 6px; margin-bottom: 20px; font-size: 0.95rem; border-left: 5px solid #0056b3;">
                <i class="fas fa-calendar-alt"></i> <b>Recordatorio:</b> Tienes hasta el <b>${fechaFormateada}</b> para subir o modificar tu proyecto.
            </div>`;
        const viejoAviso = document.getElementById('aviso-fecha-form');
        if (viejoAviso) viejoAviso.remove();

        if (proyectoExistente) {
            formElement.style.display = 'none'; 
            divEstado.style.display = 'block';  
            
            const urlPDF = proyectoExistente.data.enlacePDF;
            const estadoActual = proyectoExistente.data.estadoEvaluacion || "Pendiente";
            
            let tituloCartel = "¡Proyecto en Evaluación!";
            let iconoCartel = "fas fa-check-circle";
            let colorPrimario = "#2ecc71";
            let colorFondo = "rgba(0, 0, 0, 0.25)";
            let colorBorde = "rgba(46, 204, 113, 0.4)";
            let mensajeEstado = "Usted ya subió un proyecto para ser evaluado en la feria.";

            if (estadoActual === "Pre-seleccionado") {
                tituloCartel = "¡Felicidades! Etapa Superada";
                iconoCartel = "fas fa-trophy";
                colorPrimario = "#ffc107";
                colorFondo = "rgba(255, 193, 7, 0.12)";
                colorBorde = "rgba(255, 193, 7, 0.5)";
                mensajeEstado = "Tu proyecto ha sido <b style='color: #ffc107;'>PRE-SELECCIONADO</b> por el Tribunal.";
            } else if (estadoActual === "Evaluado (No clasifica)") {
                //  NUEVA INTERFAZ PARA REINTENTO
                tituloCartel = "Proyecto Observado (Requiere Mejoras)";
                iconoCartel = "fas fa-sync-alt"; // Icono de reciclaje / intentar de nuevo
                colorPrimario = "#f39c12"; // Naranja de advertencia
                colorFondo = "rgba(243, 156, 18, 0.1)";
                colorBorde = "rgba(243, 156, 18, 0.3)";
                mensajeEstado = "Tu proyecto fue evaluado pero no alcanzó la nota mínima de 51 puntos. <b>¡No te rindas! Corrige las observaciones del tribunal y vuelve a subirlo.</b>";
            }

            let notasHTML = "";
            if (estadoActual !== "Pendiente") {
                const notaT = proyectoExistente.data.notaTribunal || 0;
                const notaP = proyectoExistente.data.notaPonderada || 0;
                const obsT = proyectoExistente.data.observacionesTribunal || "Sin comentarios adicionales.";
                notasHTML = `
                <div style="text-align: left; background: rgba(0, 43, 92, 0.4); padding: 20px; border-radius: 8px; border: 1px solid rgba(100, 181, 246, 0.3); border-left: 5px solid #3b82f6; margin-bottom: 20px; font-size: 0.95rem; color: #ffffff;">
                    <h4 style="margin-top: 0; color: #60a5fa; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 10px;">Resultados de Evaluación</h4>
                    <p><b>Nota Tribunal:</b> ${notaT} / 100 pts</p>
                    <p><b>Nota Ponderada:</b> ${notaP} / 60 pts</p>
                    <p style="margin-top: 10px; color: #ffc107;"><b>Observaciones a corregir:</b><br>"${obsT}"</p>
                </div>`;
            }

            let botonEdicionHTML = "";
            let mensajeExtra = "";
            
            //  YA NO BLOQUEAMOS POR REPROBACIÓN, SOLO POR FECHA LÍMITE
            if (tiempoAgotado) {
                mensajeExtra = `
                <div style="background: rgba(220, 53, 69, 0.15); color: #ff6b6b; padding: 15px; margin-bottom: 20px; border-radius: 6px; border: 1px solid rgba(220, 53, 69, 0.3);">
                    <i class="fas fa-lock"></i> <b>Bloqueado:</b> El plazo de modificaciones ha finalizado.
                </div>`;
            } else {
                mensajeExtra = `<div style="background: rgba(59, 130, 246, 0.15); color: #93c5fd; padding: 12px; margin-bottom: 20px;">Puedes hacer modificaciones hasta el <b>${fechaFormateada}</b>.</div>`;
                
                // Si está reprobado, el botón es rojo llamativo para que reintente
                if (estadoActual === "Evaluado (No clasifica)") {
                    botonEdicionHTML = `<button type="button" id="btnActivarEdicion" style="background: #e74c3c; padding: 12px 25px; border-radius: 6px; font-weight: bold; cursor: pointer; border:none; color: #fff;"><i class="fas fa-upload"></i> Subir Versión Corregida</button>`;
                } else {
                    botonEdicionHTML = `<button type="button" id="btnActivarEdicion" style="background: #ffc107; padding: 12px 25px; border-radius: 6px; font-weight: bold; cursor: pointer; border:none; color: #000;"><i class="fas fa-edit"></i> Editar Proyecto</button>`;
                }
            }

            divEstado.innerHTML = `
                <div style="text-align: center; padding: 40px 25px; background: ${colorFondo}; border-radius: 12px; border: 2px dashed ${colorBorde}; margin-bottom: 20px;">
                    <i class="${iconoCartel}" style="font-size: 55px; color: ${colorPrimario}; margin-bottom: 15px;"></i>
                    <h3 style="color: ${colorPrimario}; margin-bottom: 10px;">${tituloCartel}</h3>
                    <p style="color: #e2e8f0; margin-bottom: 25px;">${mensajeEstado}</p>
                    ${mensajeExtra}${notasHTML}
                    <div style="text-align: left; background: rgba(0, 0, 0, 0.3); padding: 22px; border-radius: 8px; margin-bottom: 25px; color: #ffffff;">
                        <p style="margin-bottom: 10px;"><b>📌 Título:</b> ${proyectoExistente.data.tituloProyecto}</p>
                        <p style="margin-bottom: 10px;"><b>📁 Categoría:</b> ${proyectoExistente.data.tipoExpositor}</p>
                        <p style="margin-bottom: 10px;"><b>👥 Integrantes:</b> ${proyectoExistente.data.integrantes}</p>
                        <p style="margin-bottom: 0;"><b>🎯 Eje Temático:</b> ${proyectoExistente.data.ejeTematico}</p>
                    </div>
                    <button type="button" onclick="window.abrirVisorPDF('${urlPDF}')" style="padding: 12px 20px; background: #0056b3; color: white; border-radius: 6px; cursor: pointer; border:none; font-weight:bold;">Ver PDF Actual</button>
                    <br><br>${botonEdicionHTML}
                </div>
            `;

            if (!tiempoAgotado) {
                document.getElementById('btnActivarEdicion').addEventListener('click', () => {
                    divEstado.style.display = 'none';
                    formElement.style.display = 'block';
                    
                    document.getElementById('proyTitulo').value = proyectoExistente.data.tituloProyecto;
                    document.getElementById('proyTipo').value = proyectoExistente.data.tipoExpositor;
                    document.getElementById('proyIntegrantes').value = proyectoExistente.data.integrantes;
                    document.getElementById('proyEje').value = proyectoExistente.data.ejeTematico;

                    // Si está pre-seleccionado bloqueamos títulos, pero si está reprobado lo dejamos corregir todo
                    if (estadoActual === "Pre-seleccionado") {
                        document.getElementById('proyTitulo').disabled = true;
                        document.getElementById('proyTipo').disabled = true;
                        document.getElementById('proyIntegrantes').disabled = true;
                        document.getElementById('proyEje').disabled = true;
                    } else if (estadoActual === "Evaluado (No clasifica)") {
                        // REGLA DE SEGURIDAD: Puede cambiar todo el proyecto, pero NO su categoría
                        document.getElementById('proyTipo').disabled = true;
                    }

                    if(btnSubir) {
                        btnSubir.innerHTML = estadoActual === "Evaluado (No clasifica)" ? 'Re-enviar a Evaluación' : 'Actualizar Proyecto';
                    }
                    if(archivoInput) archivoInput.removeAttribute('required');
                });
            }
        } else {
            if (tiempoAgotado) {
                formElement.style.display = 'none';
                divEstado.style.display = 'block';
                divEstado.innerHTML = `
                <div style="text-align: center; padding: 40px; background: rgba(220, 53, 69, 0.15); border: 1px solid rgba(220, 53, 69, 0.3); border-radius: 12px; color: #ff6b6b;">
                    <i class="fas fa-lock" style="font-size: 3rem; margin-bottom: 15px;"></i>
                    <h3>Inscripciones Cerradas</h3>
                    <p>El plazo oficial para registrar proyectos o modificaciones ha finalizado.</p>
                </div>`;
            } else {
                divEstado.style.display = 'none';
                formElement.style.display = 'block';
                formElement.insertAdjacentHTML('afterbegin', cartelFechaFormulario);
                if(archivoInput) archivoInput.setAttribute('required', 'true');
            }
        }
    } catch (error) {
        console.error("Error al cargar datos:", error);
    }
};

window.subirProyectoFeria = async function(e) {
    e.preventDefault();
    if (await window.verificarFechaLimite()) {
        alert("❌ Error de Seguridad: El plazo límite ha finalizado."); return;
    }
    const usuarioActual = window.auth ? window.auth.currentUser : null;
    if (!usuarioActual) {
        alert("❌ Error: Su sesión caducó."); return;
    }

    const btn = document.getElementById('btnSubirProyecto');
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = 'Guardando...';
    btn.disabled = true;

    try {
        const proyectoExistente = await window.buscarProyectoUsuario(usuarioActual.email);
        
        let titulo = document.getElementById('proyTitulo').value;
        let tipoValor = document.getElementById('proyTipo').value; 
        let integrantes = document.getElementById('proyIntegrantes').value;
        let eje = document.getElementById('proyEje').value;

        if (proyectoExistente && proyectoExistente.data.estadoEvaluacion === "Pre-seleccionado") {
            titulo = proyectoExistente.data.tituloProyecto;
            tipoValor = proyectoExistente.data.tipoExpositor;
            integrantes = proyectoExistente.data.integrantes;
            eje = proyectoExistente.data.ejeTematico;
        }

        const archivoInput = document.getElementById('proyArchivo');
        const archivoFisico = archivoInput.files.length > 0 ? archivoInput.files[0] : null;
        
        if (archivoFisico && !window.validarPDF(archivoInput)) {
            btn.innerHTML = textoOriginal; btn.disabled = false; return;
        }

        let urlDescargaPDF = "";
        if (archivoFisico) {
            const rutaStorage = `proyectos_feria/${usuarioActual.uid}/${archivoFisico.name}`;
            const referenciaEspacio = window.ref(window.storage, rutaStorage);
            await window.uploadBytes(referenciaEspacio, archivoFisico);
            urlDescargaPDF = await window.getDownloadURL(referenciaEspacio);
        } else if (proyectoExistente && proyectoExistente.data.enlacePDF) {
            urlDescargaPDF = proyectoExistente.data.enlacePDF;
        }

        const res = await fetch('/api/proyectos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                correoPropietario: usuarioActual.email,
                titulo: titulo,
                categoria: tipoValor,
                integrantes: integrantes,
                ejeTematico: eje,
                enlacePdf: urlDescargaPDF
            })
        });

        if (!res.ok) throw new Error("Error en PostgreSQL");

        alert("✅ Proyecto guardado correctamente. Si estabas corrigiendo observaciones, tu proyecto ha vuelto a entrar a la cola de Evaluación.");
        await window.cargarDatosProyecto();
    } catch (error) {
        console.error("Error:", error);
        alert("❌ Error: " + error.message);
    } finally {
        if(btn) { btn.innerHTML = textoOriginal; btn.disabled = false; }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    let intentos = 0;
    const checarAuth = setInterval(() => {
        if (window.auth && typeof window.auth.onAuthStateChanged === 'function') {
            clearInterval(checarAuth); 
            window.auth.onAuthStateChanged((user) => {
                if (user) { setTimeout(() => window.cargarDatosProyecto(), 500); }
            });
        }
        intentos++;
        if(intentos > 10) clearInterval(checarAuth); 
    }, 500); 
});

document.addEventListener('click', function(e) {
    const elemento = e.target.closest('a');
    if (elemento && (elemento.textContent || "").toUpperCase().includes("MI PROYECTO")) {
        setTimeout(() => window.cargarDatosProyecto(), 500); 
    }
});