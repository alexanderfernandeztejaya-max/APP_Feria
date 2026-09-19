// =========================================================================
// ARCHIVO: features/auth/auth.js
// FUNCIÓN: Manejo de interfaz de usuario y Login Seguro en PostgreSQL
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

        // Conexión directa a PostgreSQL
        const respuesta = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identificador: ciIngresado, password: p })
        });

        const data = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(data.error || "Usuario o contraseña incorrectos.");
        }

        const rol = data.rol;
        const usuarioDB = data.datos;
        const tokenBD = data.token;

        let nombreMostrar = "";
        const partesNombre = (usuarioDB.nombre_completo || "Usuario").trim().split(" ");
        let nombreCorto = partesNombre[0] + (partesNombre.length > 1 ? " " + partesNombre[1] : "");

        if (rol === "ADMIN") nombreMostrar = nombreCorto + " (Administrador)";
        else if (rol === "EXPOSITOR") nombreMostrar = nombreCorto + " (Expositor)";
        else if (rol === "TRIBUNAL") nombreMostrar = (usuarioDB.nombre_completo || "Tribunal") + " (Tribunal)";
        else if (rol === "VISITANTE") nombreMostrar = (usuarioDB.nombre_completo || "Visitante") + " (Público)";

        // Limpiamos rastro antiguo y guardamos lo nuevo
        localStorage.clear();
        localStorage.setItem("feria_correo", usuarioDB.correo || "");
        
        darAccesoAlSistema(rol, nombreMostrar, ciIngresado, tokenBD);

    } catch (error) {
        console.error("[Error Interno]:", error);
        alert("❌ " + error.message);
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
// FUNCIONES AUXILIARES Y CIERRE DE SESIÓN SEGURO
// =========================================================================
window.darAccesoAlSistema = function(rol, nombreMostrar, ciUsuario, tokenUsuario) {
    localStorage.setItem("feria_rol", rol);
    localStorage.setItem("feria_nombre", nombreMostrar);
    
    if (ciUsuario && tokenUsuario) {
        localStorage.setItem("feria_ci", ciUsuario);
        localStorage.setItem("feria_token", tokenUsuario);
    }

    // Limpia la URL al iniciar sesión
    window.history.replaceState({}, document.title, window.location.pathname);

    document.getElementById('login-screen').style.display = "none";
    document.getElementById('main-content').style.display = "block";
    document.body.classList.remove('login-active');
    
    if (typeof window.applyPermissions === 'function') window.applyPermissions(rol, nombreMostrar);
    if (typeof window.reiniciarRelojInactividad === 'function') window.reiniciarRelojInactividad();

    window.iniciarMonitoreoSesion();
}

window.logout = function() { 
    localStorage.clear();
    if (window.intervaloMonitoreo) clearInterval(window.intervaloMonitoreo);
    window.location.reload();
}

// =========================================================================
// RADAR DE SESIÓN ÚNICA ACTIVA
// =========================================================================
window.intervaloMonitoreo = null;
window.iniciarMonitoreoSesion = function() {
    const ci = localStorage.getItem("feria_ci");
    const token = localStorage.getItem("feria_token");
    
    if (!ci || !token) return;

    if (window.intervaloMonitoreo) clearInterval(window.intervaloMonitoreo);

    window.intervaloMonitoreo = setInterval(async () => {
        try {
            const res = await fetch(`/api/verificar_sesion/${ci}/${token}`);
            if (res.ok) {
                const data = await res.json();
                if (!data.valida) {
                    clearInterval(window.intervaloMonitoreo);
                    alert("🛑 SESIÓN CERRADA AUTOMÁTICAMENTE\n\nEl sistema detectó que alguien ha iniciado sesión con tu cuenta en otro dispositivo.\nPor motivos de seguridad, tu acceso en este dispositivo ha sido desconectado.");
                    window.logout(); 
                }
            }
        } catch (e) {}
    }, 10000); 
};

// =========================================================================
// AUTO-LOGIN UNIVERSAL
// =========================================================================
window.addEventListener('DOMContentLoaded', () => {
    const parametros = new URLSearchParams(window.location.search);
    const accion = parametros.get('action');
    const idProy = parametros.get('idProy'); 

    if (idProy) return;

    if (accion) {
        localStorage.clear();
        if (window.intervaloMonitoreo) clearInterval(window.intervaloMonitoreo);

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
    const tokenActivo = localStorage.getItem("feria_token");

    // Visitantes entran directo
    if (rolGuardado === "VISITANTE") {
        document.getElementById('login-screen').style.display = "none";
        document.getElementById('main-content').style.display = "block";
        document.body.classList.remove('login-active');
        if (typeof window.applyPermissions === 'function') window.applyPermissions(rolGuardado, nombreGuardado);
        if (typeof window.reiniciarRelojInactividad === 'function') window.reiniciarRelojInactividad();
        window.iniciarMonitoreoSesion(); 
        return; 
    }

    // Usuarios normales verifican token
    if (rolGuardado && tokenActivo) {
        document.getElementById('login-screen').style.display = "none";
        document.getElementById('main-content').style.display = "block";
        document.body.classList.remove('login-active');
        
        if (typeof window.applyPermissions === 'function') window.applyPermissions(rolGuardado, nombreGuardado);
        if (typeof window.reiniciarRelojInactividad === 'function') window.reiniciarRelojInactividad();
        window.iniciarMonitoreoSesion();
    } else {
        document.getElementById('login-screen').style.display = ""; 
        document.getElementById('main-content').style.display = "none";
        document.body.classList.add('login-active');
    }
});

// =========================================================================
// SEGURIDAD: TEMPORIZADOR DE INACTIVIDAD (AUTO-LOGOUT)
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