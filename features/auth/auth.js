// =========================================================================
// ARCHIVO: features/auth/auth.js
// FUNCIÓN: Manejo de interfaz de usuario, Login de Roles y Seguridad
// =========================================================================

window.toggleAuthMode = function(event, mode) {
    if (event) event.preventDefault(); 
    const tarjetas = ['login-card', 'register-card', 'recover-card', 'preregister-card'];
    tarjetas.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.style.display = 'none';
    });
    const tarjetaDestino = document.getElementById(mode + '-card');
    if (tarjetaDestino) tarjetaDestino.style.display = 'block';
}

window.handleLogin = async function(e) {
    if(e && typeof e.preventDefault === 'function') e.preventDefault();
    
    const ciIngresado = document.getElementById('userInput').value.trim();
    const p = document.getElementById('passInput').value.trim();

    const btn = e.target.querySelector('button[type="submit"]');
    const textoOriginal = btn.innerHTML;
    
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando credenciales...';
    btn.disabled = true;
    btn.style.cursor = "not-allowed";
    btn.style.opacity = "0.8";

    try {
        if (ciIngresado.includes("@")) {
            alert("⚠️ Por favor, ingrese su Usuario o Carnet de Identidad (CI).");
            return;
        }

        const respuesta = await fetch(`/api/usuarios/${ciIngresado}`);

        if (!respuesta.ok) {
            alert("❌ Usuario o contraseña incorrectos.");
            document.getElementById('passInput').value = "";
            return;
        }

        const data = await respuesta.json();
        const rol = data.rol;
        const usuarioDB = data.datos;
        const tokenBD = data.token; //  Obtenemos el nuevo Ticket Digital

        if (rol === "VISITANTE") {
            if (ciIngresado === p) {
                darAccesoAlSistema("VISITANTE", (usuarioDB.nombre_completo || "Visitante") + " (Público)", ciIngresado, tokenBD);
                return;
            } else {
                alert("❌ Contraseña incorrecta para el visitante.");
                document.getElementById('passInput').value = "";
                return;
            }
        }

        let correoReal = usuarioDB.correo; 
        let nombreMostrar = "";

        const partesNombre = (usuarioDB.nombre_completo || "Usuario").trim().split(" ");
        let nombreCorto = partesNombre[0] + (partesNombre.length > 1 ? " " + partesNombre[1] : "");

        if (rol === "ADMIN") {
            nombreMostrar = nombreCorto + " (Administrador)";
        } else if (rol === "EXPOSITOR") {
            nombreMostrar = nombreCorto + " (Expositor)";
        } else if (rol === "TRIBUNAL") {
            nombreMostrar = (usuarioDB.nombre_completo || "Tribunal") + " (Tribunal)";
        }

        if (!correoReal) correoReal = `${ciIngresado}@tecnoferia.com`;

        await window.signInWithEmailAndPassword(window.auth, correoReal, p);
        darAccesoAlSistema(rol, nombreMostrar, ciIngresado, tokenBD); // 🛡️ Pasamos los datos extra

    } catch (error) {
        console.error("[Error Interno]:", error);
        if (error.code) {
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                alert("❌ Usuario o contraseña incorrectos.");
            } else if (error.code === 'auth/too-many-requests') {
                alert("⚠️ Acceso bloqueado temporalmente debido a múltiples intentos fallidos. Intente más tarde.");
            } else {
                alert("❌ Ocurrió un error al acceder al sistema.");
            }
        } else {
            alert("❌ No se pudo conectar al servidor. Verifique que el Backend (Node.js) esté encendido.");
        }
        const passInput = document.getElementById('passInput');
        if (passInput) { passInput.value = ""; passInput.focus(); }
    } finally {
        if (document.getElementById('login-screen').style.display !== "none") {
            btn.innerHTML = textoOriginal;
            btn.disabled = false;
            btn.style.cursor = "pointer";
            btn.style.opacity = "1";
        }
    }
}

// =========================================================================
// 4. FUNCIONES AUXILIARES Y CIERRE DE SESIÓN SEGURO
// =========================================================================
window.darAccesoAlSistema = function(rol, nombreMostrar, ciUsuario, tokenUsuario) {
    localStorage.setItem("feria_rol", rol);
    localStorage.setItem("feria_nombre", nombreMostrar);
    
    //  Guardamos el Ticket de Sesión si nos lo envían
    if (ciUsuario && tokenUsuario) {
        localStorage.setItem("feria_ci", ciUsuario);
        localStorage.setItem("feria_token", tokenUsuario);
    }

    document.getElementById('login-screen').style.display = "none";
    document.getElementById('main-content').style.display = "block";
    document.body.classList.remove('login-active');
    
    if (typeof window.applyPermissions === 'function') {
        window.applyPermissions(rol, nombreMostrar);
    }
    
    if (typeof window.reiniciarRelojInactividad === 'function') {
        window.reiniciarRelojInactividad();
    }

    //  Encendemos el radar para verificar si alguien más entra con esta cuenta
    window.iniciarMonitoreoSesion();
}

window.logout = function() { 
    localStorage.removeItem("feria_rol");
    localStorage.removeItem("feria_nombre");
    localStorage.removeItem("feria_ci");     //  Borramos las credenciales locales
    localStorage.removeItem("feria_token");

    if (window.intervaloMonitoreo) clearInterval(window.intervaloMonitoreo);

    if (typeof window.signOut === 'function' && window.auth && window.auth.currentUser) {
        window.signOut(window.auth).then(() => {
            window.location.reload(); 
        }).catch((error) => {
            console.error("Error cerrando Firebase:", error);
            window.location.reload();
        });
    } else {
        window.location.reload();
    }
}

// =========================================================================
//  NUEVO: RADAR DE SESIÓN ÚNICA ACTIVA
// =========================================================================
window.intervaloMonitoreo = null;
window.iniciarMonitoreoSesion = function() {
    const ci = localStorage.getItem("feria_ci");
    const token = localStorage.getItem("feria_token");
    
    if (!ci || !token) return;

    if (window.intervaloMonitoreo) clearInterval(window.intervaloMonitoreo);

    // Cada 10 segundos, el celular le preguntará a la BD si su ticket sigue siendo el oficial
    window.intervaloMonitoreo = setInterval(async () => {
        try {
            const res = await fetch(`/api/verificar_sesion/${ci}/${token}`);
            if (res.ok) {
                const data = await res.json();
                if (!data.valida) {
                    //  ¡El ticket cambió en la BD! Alguien más inició sesión.
                    clearInterval(window.intervaloMonitoreo);
                    alert("🛑 SESIÓN CERRADA AUTOMÁTICAMENTE\n\nEl sistema detectó que alguien ha iniciado sesión con tu cuenta en otro dispositivo.\nPor motivos de seguridad, tu acceso en este dispositivo ha sido desconectado.");
                    window.logout(); 
                }
            }
        } catch (e) {
            // Si hay problemas de internet momentáneos, no hacemos nada y esperamos a que regrese
        }
    }, 10000); 
};

// =========================================================================
// 5. AUTO-LOGIN UNIVERSAL
// =========================================================================
window.addEventListener('DOMContentLoaded', () => {
    const parametros = new URLSearchParams(window.location.search);
    const accion = parametros.get('action');
    const idProy = parametros.get('idProy'); 

    if (idProy) { return; }

    if (accion) {
        localStorage.removeItem("feria_rol");
        localStorage.removeItem("feria_nombre");
        localStorage.removeItem("feria_ci");
        localStorage.removeItem("feria_token");
        if (window.intervaloMonitoreo) clearInterval(window.intervaloMonitoreo);

        if (window.auth && typeof window.signOut === 'function') {
            window.signOut(window.auth).catch(e => console.log(e));
        }

        document.getElementById('login-screen').style.display = ""; 
        document.getElementById('main-content').style.display = "none";
        document.body.classList.add('login-active');

        if (accion === 'registro_expositor') {
            window.toggleAuthMode(null, 'register');
        } else if (accion === 'registro_visitante' || accion === 'preregistro') {
            window.toggleAuthMode(null, 'preregister'); 
        }
        return; 
    }

    const rolGuardado = localStorage.getItem("feria_rol");
    const nombreGuardado = localStorage.getItem("feria_nombre");

    if (rolGuardado === "VISITANTE") {
        document.getElementById('login-screen').style.display = "none";
        document.getElementById('main-content').style.display = "block";
        document.body.classList.remove('login-active');
        if (typeof window.applyPermissions === 'function') window.applyPermissions(rolGuardado, nombreGuardado);
        if (typeof window.reiniciarRelojInactividad === 'function') window.reiniciarRelojInactividad();
        window.iniciarMonitoreoSesion(); //  Activamos el radar
        return; 
    }

    if (window.auth) {
        window.auth.onAuthStateChanged((user) => {
            if (user && rolGuardado) {
                document.getElementById('login-screen').style.display = "none";
                document.getElementById('main-content').style.display = "block";
                document.body.classList.remove('login-active');
                
                if (typeof window.applyPermissions === 'function') window.applyPermissions(rolGuardado, nombreGuardado);
                if (typeof window.reiniciarRelojInactividad === 'function') window.reiniciarRelojInactividad();
                window.iniciarMonitoreoSesion(); // 🛡️ Activamos el radar
            } else {
                document.getElementById('login-screen').style.display = ""; 
                document.getElementById('main-content').style.display = "none";
                document.body.classList.add('login-active');
            }
        });
    }
});

// =========================================================================
// 6. SEGURIDAD: TEMPORIZADOR DE INACTIVIDAD (AUTO-LOGOUT)
// =========================================================================
const TIEMPO_MAXIMO_INACTIVIDAD = 15 * 60 * 1000; 
let temporizadorInactividad;

window.reiniciarRelojInactividad = function() {
    const pantallaPrincipal = document.getElementById('main-content');
    if (pantallaPrincipal && pantallaPrincipal.style.display === "block") {
        clearTimeout(temporizadorInactividad);
        temporizadorInactividad = setTimeout(() => {
            alert("⏳ Por motivos de seguridad, su sesión ha caducado debido a inactividad.\n\nPor favor, vuelva a iniciar sesión.");
            window.logout(); 
        }, TIEMPO_MAXIMO_INACTIVIDAD);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('mousemove', window.reiniciarRelojInactividad);
    window.addEventListener('touchmove', window.reiniciarRelojInactividad);
    window.addEventListener('touchstart', window.reiniciarRelojInactividad);
    window.addEventListener('click', window.reiniciarRelojInactividad);
    window.addEventListener('scroll', window.reiniciarRelojInactividad, true);
    window.addEventListener('keydown', window.reiniciarRelojInactividad);
});
//.\ngrok http 300