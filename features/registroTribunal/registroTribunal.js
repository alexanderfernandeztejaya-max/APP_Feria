// =========================================================================
// ARCHIVO: features/registroTribunal/registroTribunal.js
// FUNCIÓN: Migrado a PostgreSQL (Mantiene Firebase Auth y EmailJS)
// =========================================================================

window.registrarNuevoTribunal = async function(e) {
    e.preventDefault();

    const nombre = document.getElementById('tribNombre').value.trim();
    const especialidad = document.getElementById('tribEspecialidad').value.trim();
    const categoriaValor = document.getElementById('tribCategoria').value; 
    const categoriaTexto = document.getElementById('tribCategoria').options[document.getElementById('tribCategoria').selectedIndex].text; 
    const correo = document.getElementById('tribCorreo').value.trim();
    const usuario = document.getElementById('tribUsuario').value.trim();
    const password = document.getElementById('tribPass').value;

    const btn = document.getElementById('btnGuardarTribunal');
    const textoOriginal = btn.innerHTML;
    
    //  Capturamos si evalúa TODOS o ESPECÍFICOS
    let arrayProyectosAsignados = "TODOS";
    let textoProyectosParaCorreo = "⚡ TODOS LOS PROYECTOS DE LA CATEGORÍA";

    const elAlcance = document.getElementById('tribAlcance');
    if (elAlcance && elAlcance.value === "ESPECIFICOS") {
        const marcados = document.querySelectorAll('input[name="proy_tribunal_check"]:checked');
        
        arrayProyectosAsignados = Array.from(marcados).map(cb => cb.value);
        const nombresProyectos = Array.from(marcados).map(cb => cb.parentElement.textContent.trim());
        textoProyectosParaCorreo = nombresProyectos.join(" \n• ");
        
        if (arrayProyectosAsignados.length === 0) {
            alert("⚠️ ATENCIÓN: Has elegido 'Asignar proyectos específicos' pero no marcaste ningún casillero.");
            return;
        }
    }

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando credenciales...';
    btn.disabled = true;

    try {
        // 1. CREAR CUENTA EN FIREBASE AUTH (App Secundaria)
        const { getAuth, createUserWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js");
        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js");

        // Creamos una app temporal única para evitar errores de choque en registros seguidos
        const appSecundaria = initializeApp(window.auth.app.options, "AppSecundaria_Tribunales_" + Date.now());
        const authSecundario = getAuth(appSecundaria);

        const userCredential = await createUserWithEmailAndPassword(authSecundario, correo, password);
        await authSecundario.signOut(); 

        // 2. GUARDAR EN POSTGRESQL (Enviamos los datos al nuevo puente de Node.js) (Ruta Relativa)
        const payload = {
            usuario: usuario,
            nombre: nombre,
            especialidad: especialidad,
            categoria: categoriaValor,
            // Si es un arreglo (Específicos), lo pasamos a texto, si es "TODOS" pasa directo
            proyectosAsignados: typeof arrayProyectosAsignados === 'string' ? arrayProyectosAsignados : JSON.stringify(arrayProyectosAsignados),
            correo: correo
        };

        const respuesta = await fetch('/api/tribunales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!respuesta.ok) {
            const errorData = await respuesta.json();
            throw new Error(errorData.error || "Error al guardar los datos del tribunal en PostgreSQL.");
        }

        // 3. ENVIAR CORREO (Se mantiene idéntico a tu configuración original)
        console.log("Enviando correo automático a:", correo);
        const serviceID = "service_m4ueyce"; 
        const templateID = "template_c8zd2xj";
        const publicKey = "njcIu3KNPNiVrfy9f";

        const templateParams = {
            nombre_tribunal: nombre,
            correo_destino: correo,
            usuario_asignado: usuario,
            password_asignado: password,
            categoria_asignada: categoriaTexto,
            proyectos_asignados: textoProyectosParaCorreo,
            enlace_sistema: window.location.origin
        };

        try {
            await emailjs.send(serviceID, templateID, templateParams, publicKey);
            console.log("¡Correo enviado con éxito al tribunal!");
        } catch (errorCorreo) {
            console.error("Fallo al enviar correo:", errorCorreo);
            alert("⚠️ El Tribunal fue registrado en la base de datos, pero el correo falló.");
        }

        let detalleAlcance = arrayProyectosAsignados === "TODOS" ? "Todos los de la categoría" : `${arrayProyectosAsignados.length} proyectos específicos`;
        alert(`✅ Tribunal registrado exitosamente.\n\nUsuario: ${usuario}\nCategoría: ${categoriaTexto}\nCarga Asignada: ${detalleAlcance}\n\nContraseña enviada al correo.`);
        
        e.target.reset();
        const contProy = document.getElementById('contenedor-lista-proyectos');
        if (contProy) contProy.style.display = "none";

    } catch (error) {
        console.error("Error al registrar tribunal:", error);
        if (error.code === 'auth/email-already-in-use') {
            alert("⚠️ Error: Ese correo electrónico ya está registrado en el sistema.");
        } else {
            alert("❌ Ocurrió un error: " + error.message);
        }
    } finally {
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
    }
};