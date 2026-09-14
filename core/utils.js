// =========================================================================
// ARCHIVO: core/utils.js
// FUNCIÓN: Herramientas globales y efectos visuales de la UI
// =========================================================================

let currentRole = "";

function validarPuntaje(input, maximo) {
    if (input.value.includes('-')) { input.value = input.value.replace('-', ''); }
    if (parseFloat(input.value) > maximo) { input.value = maximo; }
}

function imprimirElemento(id) {
    document.body.classList.add('printing');
    const elemento = document.getElementById(id);
    elemento.classList.add('print-target');
    window.print();
    document.body.classList.remove('printing');
    elemento.classList.remove('print-target');
}

window.toggleMenu = function() {
    const navLinks = document.getElementById('nav-links-menu');
    if (window.innerWidth <= 1024) {
        navLinks.classList.toggle('active');
    }
}

let prevScrollpos = window.pageYOffset;
window.onscroll = function() {
    let currentScrollPos = window.pageYOffset;
    let header = document.getElementById("main-header");
    let navLinks = document.getElementById('nav-links-menu');
    
    if (navLinks && navLinks.classList.contains('active')) return;

    if (prevScrollpos > currentScrollPos) {
        header.style.top = "0";
    } else {
        if (currentScrollPos > 50) {
            header.style.top = "-100px"; 
        }
    }
    prevScrollpos = currentScrollPos;
}

// MOTOR DE ANIMACIÓN AL HACER SCROLL
document.addEventListener("DOMContentLoaded", () => {
    const observadorScroll = new IntersectionObserver((entradas) => {
        entradas.forEach(entrada => {
            if (entrada.isIntersecting) {
                entrada.target.classList.add('is-visible');
            } else {
                entrada.target.classList.remove('is-visible');
            }
        });
    }, { threshold: 0.1 });

    const elementosAAnimar = document.querySelectorAll('.info-card-item, .form-card, .eval-card, .dashboard-oscuro, .modern-form-wrapper');
    elementosAAnimar.forEach(elemento => {
        elemento.classList.add('fade-scroll');
        observadorScroll.observe(elemento);
    });
});

// ABRIR PDF EN MODAL DE CRISTAL
window.abrirVisorPDF = function(url) {
    if (!url || url === "undefined" || url === "") {
        alert('⚠️ Este proyecto no tiene un documento PDF subido.');
        return;
    }

    const esMovil = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    let urlFinal = esMovil ? "https://docs.google.com/viewer?url=" + encodeURIComponent(url) + "&embedded=true" : url + "#toolbar=0&navpanes=0&scrollbar=0";

    const modal = document.createElement('div');
    modal.id = 'modal-visor-pdf-global';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,25,50,0.85); z-index: 9999999; display: flex; flex-direction: column; align-items: center; justify-content: center; backdrop-filter: blur(8px);';
    
    const btnCerrar = document.createElement('button');
    btnCerrar.innerHTML = '<i class="fas fa-times"></i> Cerrar Documento';
    btnCerrar.style.cssText = 'background: #d32f2f; color: white; border: none; padding: 12px 25px; font-size: 1.1rem; font-weight: bold; border-radius: 8px; margin-bottom: 15px; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.3); transition: 0.3s;';
    btnCerrar.onclick = () => document.body.removeChild(modal);
    
    const iframe = document.createElement('iframe');
    iframe.src = urlFinal;
    iframe.style.cssText = 'width: 90%; max-width: 1000px; height: 80vh; border: none; border-radius: 12px; background: white; box-shadow: 0 15px 40px rgba(0,0,0,0.5);';
    
    modal.appendChild(btnCerrar);
    modal.appendChild(iframe);
    document.body.appendChild(modal);
};

// MODO PÚBLICO
window.activarModoPublico = function() {
    if (localStorage.getItem("feria_rol")) return;

    const url = window.location.href;
    const esModoPublico = url.includes('idProy=') || url.includes('#/votar') || url.includes('action=registro_visitante') || url.includes('action=registro_expositor');

    if (esModoPublico) {
        document.querySelectorAll('.navbar, header, #main-header').forEach(barra => {
            barra.style.setProperty('display', 'none', 'important');
        });
        const contenido = document.getElementById('main-content') || document.body;
        if (contenido) contenido.style.setProperty('padding-top', '0px', 'important');
    }
};

document.addEventListener("DOMContentLoaded", window.activarModoPublico);
window.addEventListener("hashchange", window.activarModoPublico);
setTimeout(window.activarModoPublico, 300);