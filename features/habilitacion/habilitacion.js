// =========================================================================
// ARCHIVO: features/habilitacion/habilitacion.js
// FUNCIÓN: Registro de visitantes, auto-llenado y filtros de seguridad
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
    
    //  ESCUDO: Bloquear números en las cajas de Nombre
    const bloquearNumeros = function() {
        this.value = this.value.replace(/[0-9]/g, '');
    };

    const inputPreNombre = document.getElementById('preNombre');
    const inputHabNombre = document.getElementById('hab-nombre');
    const inputAdminHabNombre = document.getElementById('admin-hab-nombre'); // 🔥 NUEVO ADMIN
    
    if (inputPreNombre) inputPreNombre.addEventListener('input', bloquearNumeros);
    if (inputHabNombre) inputHabNombre.addEventListener('input', bloquearNumeros);
    if (inputAdminHabNombre) inputAdminHabNombre.addEventListener('input', bloquearNumeros);

    //ESCUCHADOR CI: Auto-llenado de Expositores
    const configurarEscuchadorCI = (idCI, idNombre, idSelectInst, idDivOtro, idInputOtro) => {
        const inputCI = document.getElementById(idCI);
        if (inputCI) {
            inputCI.addEventListener('input', async function() {
                this.value = this.value.replace(/[^0-9]/g, ''); 
                const ci = this.value.trim();
                
                if (ci.length >= 4) { 
                    await window.verificarYAutoLlenarExpositor(ci, idNombre, idSelectInst, idDivOtro, idInputOtro);
                } else {
                    window.limpiarSiEstabaAutollenado(idNombre, idSelectInst, idDivOtro, idInputOtro);
                }
            });
        }
    };

    // Conectamos los formularios
    configurarEscuchadorCI('preCI', 'preNombre', 'preInst', 'caja-pre-otro', 'preInstOtro');
    configurarEscuchadorCI('hab-ci', 'hab-nombre', 'hab-institucion', 'caja-hab-otro', 'hab-institucion-otro');
    configurarEscuchadorCI('admin-hab-ci', 'admin-hab-nombre', 'admin-hab-institucion', 'caja-admin-hab-otro', 'admin-hab-institucion-otro'); // 🔥 NUEVO ADMIN
});

//  Función que oculta o muestra la caja de escribir manualmente
window.toggleOtro = function(selectElement, divOtroId, inputOtroId) {
    const divOtro = document.getElementById(divOtroId);
    const inputOtro = document.getElementById(inputOtroId);
    
    if (selectElement.value === "OTRO") {
        divOtro.style.display = "block";
        inputOtro.setAttribute("required", "true");
        inputOtro.focus();
    } else {
        divOtro.style.display = "none";
        inputOtro.removeAttribute("required");
        inputOtro.value = "";
    }
};

// Función global que busca al expositor en PostgreSQL usando el puente de Usuarios
window.verificarYAutoLlenarExpositor = async function(ci, idNombre, idSelectInst, idDivOtro, idInputOtro) {
    const inputNombre = document.getElementById(idNombre);
    const selectInst = document.getElementById(idSelectInst);
    const divOtro = document.getElementById(idDivOtro);
    const inputOtro = document.getElementById(idInputOtro);
    
    if (!inputNombre || !selectInst) return;

    try {
        const respuesta = await fetch(`/api/usuarios/${ci}`);
        
        if (respuesta.ok) {
            const data = await respuesta.json();
            
            if (data.rol === "EXPOSITOR") {
                const datosExpositor = data.datos;
                const nombreCompleto = datosExpositor.nombre_completo || "";
                const institucionReal = datosExpositor.institucion || "Estudiante UABJB - Ing. de Sistemas";

                selectInst.style.display = "none";
                selectInst.removeAttribute("required");
                
                divOtro.style.display = "block";
                inputOtro.value = institucionReal;
                inputOtro.disabled = true;

                inputNombre.value = nombreCompleto;
                inputNombre.disabled = true;
                
                inputNombre.setAttribute("data-autofilled", "true");
                inputOtro.setAttribute("data-autofilled", "true");
                
                inputNombre.style.backgroundColor = "#e2e3e5";
                inputOtro.style.backgroundColor = "#e2e3e5";
                inputOtro.style.color = "#333";
            } else {
                window.limpiarSiEstabaAutollenado(idNombre, idSelectInst, idDivOtro, idInputOtro);
            }
        } else {
            window.limpiarSiEstabaAutollenado(idNombre, idSelectInst, idDivOtro, idInputOtro);
        }
    } catch (error) {
        console.error("Error al consultar expositores en PostgreSQL:", error);
        window.limpiarSiEstabaAutollenado(idNombre, idSelectInst, idDivOtro, idInputOtro);
    }
};

window.limpiarSiEstabaAutollenado = function(idNombre, idSelectInst, idDivOtro, idInputOtro) {
    const inputNombre = document.getElementById(idNombre);
    const selectInst = document.getElementById(idSelectInst);
    const divOtro = document.getElementById(idDivOtro);
    const inputOtro = document.getElementById(idInputOtro);
    
    if (!inputNombre || !selectInst) return;

    if (inputNombre.getAttribute("data-autofilled") === "true") {
        inputNombre.value = "";
        inputNombre.disabled = false;
        inputNombre.removeAttribute("data-autofilled");
        inputNombre.style.backgroundColor = (idNombre === 'admin-hab-nombre') ? "#fff" : "#f9f9f9";

        selectInst.style.display = "block";
        selectInst.value = ""; 
        selectInst.setAttribute("required", "true");

        divOtro.style.display = "none";
        inputOtro.value = "";
        inputOtro.disabled = false;
        inputOtro.removeAttribute("data-autofilled");
        
        if (idInputOtro === 'preInstOtro') {
            inputOtro.style.backgroundColor = "rgba(255,255,255,0.15)";
            inputOtro.style.color = "#fff";
        } else {
            inputOtro.style.backgroundColor = "#fff";
            inputOtro.style.color = "#333";
        }
    }
};

// ====================================================================
// Procesar el envío del formulario de VISITANTES (Multiformulario)
// ====================================================================
window.registrarVisitanteBD = async function(e) {
    e.preventDefault();
    
    let idCI, idNombre, idSelectInst, idInputOtro, idBtn, idDivOtro;

    //  MAGIA DE ENRUTAMIENTO: Detectamos qué formulario se envió
    if (e.target.id === "form-habilitacion") {
        idCI = 'hab-ci'; idNombre = 'hab-nombre'; idSelectInst = 'hab-institucion';
        idInputOtro = 'hab-institucion-otro'; idBtn = 'btnHabilitar'; idDivOtro = 'caja-hab-otro';
    } else if (e.target.id === "form-admin-habilitacion") {
        idCI = 'admin-hab-ci'; idNombre = 'admin-hab-nombre'; idSelectInst = 'admin-hab-institucion';
        idInputOtro = 'admin-hab-institucion-otro'; idBtn = 'btnAdminHabilitar'; idDivOtro = 'caja-admin-hab-otro';
    } else {
        idCI = 'preCI'; idNombre = 'preNombre'; idSelectInst = 'preInst';
        idInputOtro = 'preInstOtro'; idBtn = null; idDivOtro = 'caja-pre-otro';
    }

    const inputNombre = document.getElementById(idNombre);
    const selectInst = document.getElementById(idSelectInst);
    const inputOtro = document.getElementById(idInputOtro);
    const inputCI = document.getElementById(idCI);

    const ciValue = inputCI.value.trim();
    let nombreValue = inputNombre.value.trim();
    let instValue = "";
    
    if (selectInst.style.display === "none" || selectInst.value === "OTRO") {
        instValue = inputOtro.value.trim();
        if (instValue === "") {
            alert("⚠️ Por favor, escriba el nombre de su institución manualmente.");
            inputOtro.focus();
            return;
        }
    } else {
        instValue = selectInst.value;
        if (instValue === "" || instValue === null) {
            alert("⚠️ Por favor, seleccione una institución de la lista.");
            selectInst.focus();
            return;
        }
    }
    
    const btn = idBtn ? document.getElementById(idBtn) : e.target.querySelector('button[type="submit"]');
    const textoOriginal = btn.innerHTML;
    
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    btn.disabled = true;

    try {
        const respuesta = await fetch('/api/visitantes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ci: ciValue,
                nombreCompleto: nombreValue,
                institucion: instValue
            })
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            alert("⚠️ " + (datos.error || "Error desconocido"));
            btn.innerHTML = textoOriginal;
            btn.disabled = false;
            
            e.target.reset();
            window.limpiarSiEstabaAutollenado(idNombre, idSelectInst, idDivOtro, idInputOtro);
            inputCI.focus();
            return; 
        }

        alert(datos.mensaje);
        
        // Limpiamos todo para el siguiente visitante (Modo Kiosco / Modo Venta Múltiple)
        e.target.reset(); 
        
        selectInst.style.display = "block";
        selectInst.setAttribute("required", "true");

        const divOtro = document.getElementById(idDivOtro);
        if (divOtro) divOtro.style.display = "none";

        inputNombre.disabled = false;
        inputNombre.removeAttribute("data-autofilled");
        inputNombre.style.backgroundColor = (idNombre === 'admin-hab-nombre') ? "#fff" : "#f9f9f9";

        inputOtro.disabled = false;
        inputOtro.removeAttribute("required");
        inputOtro.removeAttribute("data-autofilled");

        if (idSelectInst === 'preInst') {
            inputOtro.style.backgroundColor = "rgba(255,255,255,0.15)";
            inputOtro.style.color = "#fff";
        } else {
            inputOtro.style.backgroundColor = "#fff";
            inputOtro.style.color = "#333";
        }

        inputCI.focus();

    } catch (error) {
        console.error("Error de conexión con el Backend:", error);
        alert("❌ No se pudo conectar con el servidor. Verifica que Node.js esté encendido.");
    } finally {
        if (btn) {
            btn.innerHTML = textoOriginal;
            btn.disabled = false;
        }
    }
};

window.handlePreRegistro = window.registrarVisitanteBD;