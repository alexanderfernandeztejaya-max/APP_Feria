// =========================================================================
// ARCHIVO: core/utils.js
// FUNCIÓN: Herramientas globales, auto-completado y VISOR DE PDF UNIVERSAL
// =========================================================================

let currentRole = "";

function validarPuntaje(input, maximo) {
    if (input.value.includes('-')) { input.value = input.value.replace('-', ''); }
    if (parseFloat(input.value) > maximo) { input.value = maximo; }
}

function imprimirElemento(id) {
    document.body.classList.add('printing');
    const elemento = document.getElementById(id);
    if(elemento) elemento.classList.add('print-target');
    window.print();
    document.body.classList.remove('printing');
    if(elemento) elemento.classList.remove('print-target');
}

window.toggleMenu = function() {
    const navLinks = document.getElementById('nav-links-menu');
    if (navLinks && window.innerWidth <= 1024) { navLinks.classList.toggle('active'); }
}

let prevScrollpos = window.pageYOffset;
window.onscroll = function() {
    let currentScrollPos = window.pageYOffset;
    let header = document.getElementById("main-header");
    let navLinks = document.getElementById('nav-links-menu');
    
    if (navLinks && navLinks.classList.contains('active')) return;
    if (header) {
        if (prevScrollpos > currentScrollPos) { header.style.top = "0"; } 
        else { if (currentScrollPos > 50) { header.style.top = "-100px"; } }
    }
    prevScrollpos = currentScrollPos;
}

document.addEventListener("DOMContentLoaded", () => {
    const observadorScroll = new IntersectionObserver((entradas) => {
        entradas.forEach(entrada => {
            if (entrada.isIntersecting) { entrada.target.classList.add('is-visible'); } 
            else { entrada.target.classList.remove('is-visible'); }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.info-card-item, .form-card, .eval-card, .dashboard-oscuro, .modern-form-wrapper').forEach(elemento => {
        elemento.classList.add('fade-scroll');
        observadorScroll.observe(elemento);
    });
});

//  MAGIA: Jalar datos, autocompletar y BLOQUEAR casillas al escribir CI
document.addEventListener("input", async function(e) {
    const id = e.target.id;
    if (id === 'preCI' || id === 'hab-ci' || id === 'admin-hab-ci') {
        const ciIngresado = e.target.value.trim();
        
        let inputNombre, selectInst;
        if (id === 'preCI') { inputNombre = document.getElementById('preNombre'); selectInst = document.getElementById('preInst'); }
        if (id === 'hab-ci') { inputNombre = document.getElementById('hab-nombre'); selectInst = document.getElementById('hab-institucion'); }
        if (id === 'admin-hab-ci') { inputNombre = document.getElementById('admin-hab-nombre'); selectInst = document.getElementById('admin-hab-institucion'); }

        if (ciIngresado.length < 5) {
            if (inputNombre) { 
                inputNombre.readOnly = false; 
                inputNombre.style.backgroundColor = ""; 
                inputNombre.style.opacity = "1";
                if(inputNombre.dataset.autofilled === "true") { inputNombre.value = ""; inputNombre.dataset.autofilled = "false"; }
            }
            if (selectInst) { 
                selectInst.style.pointerEvents = "auto"; 
                selectInst.style.backgroundColor = ""; 
                selectInst.style.opacity = "1";
                if(selectInst.dataset.autofilled === "true") { selectInst.value = ""; selectInst.dataset.autofilled = "false"; }
            }
            return;
        }

        try {
            const res = await fetch(`/api/usuarios/${ciIngresado}`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.datos) {
                    if (inputNombre) {
                        inputNombre.value = data.datos.nombre_completo;
                        inputNombre.readOnly = true; 
                        inputNombre.style.backgroundColor = "rgba(0,0,0,0.3)";
                        inputNombre.style.opacity = "0.7";
                        inputNombre.dataset.autofilled = "true";
                    }
                    if (selectInst && data.datos.institucion) {
                        let existe = Array.from(selectInst.options).some(opt => opt.value === data.datos.institucion);
                        if (!existe) selectInst.add(new Option(data.datos.institucion, data.datos.institucion));
                        
                        selectInst.value = data.datos.institucion;
                        selectInst.style.pointerEvents = "none"; 
                        selectInst.style.backgroundColor = "rgba(0,0,0,0.3)";
                        selectInst.style.opacity = "0.7";
                        selectInst.dataset.autofilled = "true";
                    }
                }
            }
        } catch(err) {}
    }
});

//  VISOR UNIVERSAL BLINDADO (Usa PDF.js en PC y Móvil para evitar descargas)
window.abrirVisorPDF = function(url) {
    if (!url || url === "undefined" || url === "null" || url === "") {
        alert('⚠️ Este proyecto no tiene un documento PDF subido.'); return;
    }

    // Ruta segura con bypass anti-caché
    let urlSegura = url.startsWith('/archivos_proyectos/') ? url.replace('/archivos_proyectos/', '/ver-pdf/') : url;
    let urlAbsoluta = window.location.origin + urlSegura + "?t=" + new Date().getTime();

    // Eliminar modal anterior si existe
    const modalViejo = document.getElementById('modal-visor-pdf-global');
    if (modalViejo) document.body.removeChild(modalViejo);

    // Crear fondo oscuro del visor
    const modal = document.createElement('div');
    modal.id = 'modal-visor-pdf-global';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,25,50,0.95); z-index: 9999999; display: flex; flex-direction: column; align-items: center; justify-content: center; backdrop-filter: blur(8px);';
    
    // Crear cabecera y botón de cerrar
    const header = document.createElement('div');
    header.style.cssText = 'width: 90%; max-width: 1000px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;';
    header.innerHTML = '<h3 style="color: white; margin: 0; font-family: sans-serif;"><i class="fas fa-file-pdf" style="color: #e74c3c;"></i> Visor Oficial Seguro</h3>';
    
    const btnCerrar = document.createElement('button');
    btnCerrar.innerHTML = '<i class="fas fa-times"></i> Cerrar Visor';
    btnCerrar.style.cssText = 'background: #d32f2f; color: white; border: none; padding: 10px 20px; font-size: 1rem; font-weight: bold; border-radius: 6px; cursor: pointer; transition: 0.2s;';
    btnCerrar.onclick = () => document.body.removeChild(modal);
    header.appendChild(btnCerrar);
    modal.appendChild(header);

    // Contenedor universal donde se dibujará el PDF
    const container = document.createElement('div');
    container.style.cssText = 'width: 90%; max-width: 1000px; height: 82vh; background: #525659; border-radius: 8px; overflow-y: auto; text-align: center; padding: 15px 0; box-shadow: 0 10px 30px rgba(0,0,0,0.8);';
    
    const loadingText = document.createElement('p');
    loadingText.style.cssText = 'color: white; font-size: 1.1rem; margin-top: 50px;';
    loadingText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cargando documento de forma segura...';
    container.appendChild(loadingText);
    modal.appendChild(container);
    document.body.appendChild(modal);

    // INYECCIÓN DE LA LIBRERÍA PDF.JS (Evita la descarga renderizando la imagen)
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
    script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        
        fetch(urlAbsoluta, { headers: { 'ngrok-skip-browser-warning': 'true' } })
            .then(res => res.blob())
            .then(blob => {
                const fileReader = new FileReader();
                fileReader.onload = function() {
                    const typedarray = new Uint8Array(this.result);
                    window.pdfjsLib.getDocument(typedarray).promise.then(pdf => {
                        loadingText.style.display = "none";
                        
                        // Determinamos el zoom según si es PC o Celular para que se lea perfecto
                        const esPC = window.innerWidth > 768;
                        const zoomScale = esPC ? 1.5 : 1.2;

                        for(let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                            pdf.getPage(pageNum).then(page => {
                                const canvas = document.createElement('canvas');
                                canvas.style.cssText = 'max-width: 95%; margin-bottom: 20px; box-shadow: 0 4px 8px rgba(0,0,0,0.5); border-radius: 4px;';
                                const ctx = canvas.getContext('2d');
                                const viewport = page.getViewport({scale: zoomScale});
                                canvas.height = viewport.height;
                                canvas.width = viewport.width;
                                page.render({canvasContext: ctx, viewport: viewport});
                                container.appendChild(canvas);
                            });
                        }
                    });
                };
                fileReader.readAsArrayBuffer(blob);
            })
            .catch(err => { loadingText.innerHTML = '❌ Error al cargar el documento.'; });
    };
    document.head.appendChild(script);
};

window.activarModoPublico = function() {
    if (localStorage.getItem("feria_rol")) return;
    const url = window.location.href;
    const esModoPublico = url.includes('idProy=') || url.includes('#/votar') || url.includes('action=registro_visitante') || url.includes('action=registro_expositor');

    if (esModoPublico) {
        document.querySelectorAll('.navbar, header, #main-header').forEach(barra => { barra.style.setProperty('display', 'none', 'important'); });
        const contenido = document.getElementById('main-content') || document.body;
        if (contenido) contenido.style.setProperty('padding-top', '0px', 'important');
    }
};

document.addEventListener("DOMContentLoaded", window.activarModoPublico);
window.addEventListener("hashchange", window.activarModoPublico);
setTimeout(window.activarModoPublico, 300);