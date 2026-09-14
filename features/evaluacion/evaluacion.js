// =========================================================================
// ARCHIVO: features/evaluacion/evaluacion.js
// FUNCIÓN: Módulo de Tribunales conectado a PostgreSQL
// =========================================================================

// 1. Cargar los proyectos en el select (FILTRADOS POR CATEGORÍA Y ASIGNACIÓN)
window.cargarProyectosParaEvaluar = async function() {
    const select = document.getElementById('eval-select-proyecto');
    const btnDoc = document.getElementById('eval-btn-doc');
    if (!select) return;

    select.innerHTML = '<option value="" disabled selected>Buscando proyectos asignados a su perfil...</option>';
    
    try {
        const usuarioActual = window.auth.currentUser;
        if (!usuarioActual) return;

        // A) Buscar qué categoría y proyectos le tocan a este tribunal en PostgreSQL
        const resTribunal = await fetch(`/api/tribunal_correo/${usuarioActual.email}`);
        const datosTribunal = await resTribunal.json();
        
        if (!datosTribunal) {
            select.innerHTML = '<option value="" disabled selected>No se encontraron sus datos de tribunal.</option>';
            return;
        }

        let palabraClaveCategoria = "";
        if (datosTribunal.categoria_asignada.includes('estudiante')) palabraClaveCategoria = 'estudiante';
        else if (datosTribunal.categoria_asignada.includes('docente')) palabraClaveCategoria = 'docente';
        else if (datosTribunal.categoria_asignada.includes('emprendimiento')) palabraClaveCategoria = 'emprendimiento';

        let proyectosAsignadosArray = "TODOS";
        if (datosTribunal.proyectos_asignados && datosTribunal.proyectos_asignados !== "TODOS") {
            try { proyectosAsignadosArray = JSON.parse(datosTribunal.proyectos_asignados); } catch(e){}
        }

        // B) Pedimos todos los proyectos al servidor
        const resProyectos = await fetch('/api/proyectos_admin');
        const todosLosProyectos = await resProyectos.json();

        let opcionesHTML = '<option value="" disabled selected>Seleccione un proyecto a evaluar...</option>';
        let proyectosEncontrados = 0;

        todosLosProyectos.forEach(p => {
            // Filtro 1: Que sea de su categoría
            if (palabraClaveCategoria !== "" && !p.categoria.includes(palabraClaveCategoria)) return;
            
            // Filtro 2: Si tiene proyectos específicos, que esté en su lista
            if (Array.isArray(proyectosAsignadosArray) && !proyectosAsignadosArray.includes(String(p.id))) return;

            opcionesHTML += `<option value="${p.id}" data-url="${p.enlace_pdf || ''}">${p.titulo}</option>`;
            proyectosEncontrados++;
        });

        if (proyectosEncontrados === 0) {
            select.innerHTML = '<option value="" disabled selected>No tienes proyectos pendientes en tu categoría.</option>';
        } else {
            select.innerHTML = opcionesHTML;
        }

        // C) Visor de PDF Dinámico
        select.addEventListener('change', function() {
            const opcionSeleccionada = this.options[this.selectedIndex];
            const url = opcionSeleccionada.getAttribute('data-url');
            
            if (url && url !== "undefined" && url !== "") {
                btnDoc.href = "javascript:void(0)";
                btnDoc.onclick = (e) => { e.preventDefault(); window.abrirVisorPDF(url); };
                btnDoc.style.opacity = "1";
                btnDoc.style.cursor = "pointer";
                btnDoc.style.backgroundColor = "var(--azul-uab)";
            } else {
                btnDoc.onclick = (e) => { e.preventDefault(); alert('⚠️ Este proyecto no tiene un documento PDF subido.'); };
                btnDoc.style.opacity = "0.5";
                btnDoc.style.cursor = "not-allowed";
                btnDoc.style.backgroundColor = "#666";
            }
        });
    } catch (error) {
        console.error("Error al cargar proyectos:", error);
        select.innerHTML = '<option value="" disabled selected>❌ Error de conexión</option>';
    }
};

// 2. Guardar la calificación y BLOQUEAR DOBLE VOTO
window.guardarEvaluacionTribunal = async function(e) {
    e.preventDefault();
    
    const select = document.getElementById('eval-select-proyecto');
    const nota = parseInt(document.getElementById('eval-nota').value);
    const observaciones = document.getElementById('eval-obs').value.trim();
    const btn = document.querySelector('.btn-tribunal');

    if (select.selectedIndex === 0) {
        alert("⚠️ Por favor, seleccione un proyecto de la lista antes de enviar.");
        return;
    }

    if (isNaN(nota) || nota < 1 || nota > 100) {
        alert("⛔ VALOR INVÁLIDO:\nEl puntaje técnico debe ser un número entero entre 1 y 100.");
        return;
    }

    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando y Evaluando...';
    btn.disabled = true;

    try {
        const usuario = window.auth.currentUser;
        const nombreLocal = localStorage.getItem("feria_nombre") || "Ing. Evaluador";
        const nombreReal = nombreLocal.split(" (")[0]; // Para quitarle el "(Tribunal)"

        // Enviamos la evaluación a PostgreSQL
        const respuesta = await fetch('/api/evaluar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                idProyecto: select.value,
                correoTribunal: usuario.email,
                nombreTribunal: nombreReal,
                notaTribunal: nota,
                observaciones: observaciones || "El tribunal no dejó comentarios adicionales."
            })
        });

        const dataRespuesta = await respuesta.json();

        if (!respuesta.ok) {
            alert(dataRespuesta.error);
            btn.innerHTML = textoOriginal; btn.disabled = false; return;
        }

        // --- Enviar Correo con EmailJS ---
        let mensajeCorreo = "";
        if (dataRespuesta.estado === "Pre-seleccionado") {
            mensajeCorreo = `¡Felicidades! Su proyecto "${dataRespuesta.tituloProyecto}" ha sido evaluado.\nObtuvo ${nota}/100 puntos brutos (${dataRespuesta.notaPonderada}/60 ponderados).\n\n📝 Retroalimentación:\n"${observaciones}"\n\n¡Ha superado la etapa de Pre-selección!`;
        } else {
            mensajeCorreo = `Su proyecto "${dataRespuesta.tituloProyecto}" ha sido evaluado.\nObtuvo ${nota}/100 puntos brutos (${dataRespuesta.notaPonderada}/60 ponderados).\n\n📝 Retroalimentación:\n"${observaciones}"\n\nNo alcanzó la nota mínima de aprobación. Gracias por participar.`;
        }

        if (dataRespuesta.correoEstudiante) {
            try {
                await emailjs.send("service_m4ueyce", "template_0a9gr2t", {
                    to_email: dataRespuesta.correoEstudiante,
                    to_name: dataRespuesta.nombreExpositor, 
                    message: mensajeCorreo    
                }, "njcIu3KNPNiVrfy9f");
            } catch (err) {
                console.error("No se pudo enviar el correo:", err);
            }
        }

        alert(`✅ ¡Calificación Guardada Oficialmente!\n\nProyecto: ${dataRespuesta.tituloProyecto}\nNota Bruta: ${nota}/100\nNota Ponderada: ${dataRespuesta.notaPonderada}/60\nEstado: ${dataRespuesta.estado}`);
        
        document.getElementById('form-evaluacion-tribunal').reset();
        document.getElementById('eval-btn-doc').href = "#";
        document.getElementById('eval-btn-doc').style.opacity = "0.5";

    } catch (error) {
        console.error("Error guardando nota:", error);
        alert("❌ Error de conexión al guardar la evaluación. Reintente.");
    } finally {
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
    }
};

// 3. Escudos visuales
document.addEventListener('DOMContentLoaded', () => {
    const inputNotaTribunal = document.getElementById('eval-nota');
    if (inputNotaTribunal) {
        inputNotaTribunal.addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9]/g, '').replace(/^0+/, '');
            if (this.value !== "" && parseInt(this.value) > 100) this.value = '100';
        });
    }
});