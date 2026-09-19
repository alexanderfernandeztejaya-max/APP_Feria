// =========================================================================
// ARCHIVO: core/router.js
// =========================================================================

window.applyPermissions = function(role, userName) {
    document.querySelectorAll('.navbar, header, #main-header').forEach(barra => { barra.style.removeProperty('display'); });
    const contenidoCentral = document.getElementById('main-content');
    if (contenidoCentral) contenidoCentral.style.removeProperty('padding-top');

    const welcomeMsg = document.getElementById('welcome-message');
    if (welcomeMsg) welcomeMsg.innerText = "Bienvenido, " + userName + " — Gestión Digital Tecno Feria";
    
    const mainHeader = document.getElementById('main-header');
    if (mainHeader) mainHeader.style.display = "block";
    
    const btnPublicExit = document.getElementById('btn-public-exit');
    if (btnPublicExit) btnPublicExit.style.display = "none"; 
    
    const navRegistro = document.getElementById('nav-registro');
    if (navRegistro) navRegistro.style.display = (role === "ADMIN") ? "block" : "none";
    
    const navEvaluacion = document.getElementById('nav-evaluacion');
    if (navEvaluacion) navEvaluacion.style.display = (role === "ADMIN" || role === "TRIBUNAL") ? "block" : "none";
    
    const navMiProyecto = document.getElementById('nav-mi-proyecto');
    if (navMiProyecto) navMiProyecto.style.display = (role === "EXPOSITOR" || role === "ADMIN") ? "block" : "none";
    
    const navInformes = document.getElementById('nav-informes');
    if (navInformes) navInformes.style.display = (role === "ADMIN") ? "block" : "none";
    
    const navResultados = document.getElementById('nav-resultados');
    if (navResultados) navResultados.style.display = "block";
    
    if (typeof window.navigate === 'function') {
        window.navigate('inicio', document.querySelector('.nav-links a'));
    }
}

window.navigate = function(id, el) {
    if(el) {
        document.querySelectorAll('.nav-links a').forEach(l => l.classList.remove('active'));
        el.classList.add('active');
    }
    
    document.querySelectorAll('section').forEach(s => {
        if(s.id !== 'login-screen') s.style.display = "none";
    });
    
    const sec = document.getElementById(id);
    if(sec) sec.style.display = "block"; 

    if(id === 'evaluacion') {
        const inputTribunal = document.querySelector('#panel-tribunal input[type="number"]');
        if(inputTribunal) {
            inputTribunal.setAttribute('min', '0');
            inputTribunal.setAttribute('max', '100');
            inputTribunal.oninput = function() { if(typeof validarPuntaje === 'function') validarPuntaje(this, 100); };
        }
    }
    
    if(id === 'resultados') {
        if (typeof window.calcularResultadosEnTiempoReal === 'function') { window.calcularResultadosEnTiempoReal(); }
    }

    if(id === 'mi-proyecto') {
        // 🔥 MAGIA DE PARPADEO: Ocultamos la tarjeta por JS ANTES de llamar a PostgreSQL
        const formCard = document.querySelector('#mi-proyecto .form-card');
        if (formCard) formCard.style.display = 'none';
        
        if (typeof window.cargarDatosProyecto === 'function') { window.cargarDatosProyecto(); }
    }
}

window.openTab = function(e, n) {
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = "none");
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    
    const targetTab = document.getElementById(n);
    if (targetTab) targetTab.style.display = "block"; 
    
    if (e && e.currentTarget) e.currentTarget.classList.add('active');
}