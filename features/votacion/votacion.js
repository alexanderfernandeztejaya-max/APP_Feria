// =========================================================================
// ARCHIVO: features/votacion/votacion.js
// FUNCIÓN: Lógica de la pantalla pública de votación por QR con GPS Anti-Fraude
// =========================================================================

let calificacionActual = 0;

//  CONFIGURACIÓN DEL CERCO VIRTUAL (GEOFENCING)
const LATITUD_FERIA = -14.833937564763247;   //mi casa -14.834002316055194, -64.89944331965522, UABJB -14.812559732228735, -64.89515149760588
const LONGITUD_FERIA = -64.899433750549;  
const RADIO_PERMITIDO_METROS = 500; 

function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
    const R = 6371e3; 
    const radLat1 = lat1 * Math.PI / 180;
    const radLat2 = lat2 * Math.PI / 180;
    const deltaLat = (lat2 - lat1) * Math.PI / 180;
    const deltaLon = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(radLat1) * Math.cos(radLat2) *
              Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
}

window.cargarProyectoParaVotar = async function() {
    const params = new URLSearchParams(window.location.search);
    const idProy = params.get('idProy');

    if (idProy) {
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) loginScreen.style.display = 'none';
        document.body.classList.remove('login-active');

        document.querySelectorAll('.navbar, header, #main-header').forEach(b => b.style.setProperty('display', 'none', 'important'));
        
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.style.display = 'block';
            mainContent.style.setProperty('padding-top', '0px', 'important');
        }
        
        document.getElementById('votar-proyecto').style.display = 'block';

        try {
            const res = await fetch(`/api/proyectos_qr/${idProy}`);
            if (res.ok) {
                const proyecto = await res.json();
                document.getElementById('votar-titulo').innerText = proyecto.titulo;
                document.getElementById('voto-idProy').value = proyecto.id;
                document.getElementById('voto-cat').value = proyecto.categoria;
            } else {
                document.getElementById('votar-titulo').innerText = "Proyecto no encontrado.";
                document.getElementById('votar-titulo').style.color = "#d32f2f";
            }
        } catch (error) {
            console.error(error);
        }
    }
};

window.simularVerificacionCI = async function() {
    const ciInput = document.getElementById('voto-ci').value.trim();
    const msj = document.getElementById('mensaje-validacion-ci');
    const btn = document.getElementById('btnEnviarVoto');

    if (ciInput.length < 5) {
        msj.innerHTML = ""; 
        btn.disabled = true; 
        btn.style.opacity = "0.5"; 
        btn.style.cursor = "not-allowed";
        return;
    }

    msj.innerHTML = '<span style="color: #666;"><i class="fas fa-spinner fa-spin"></i> Buscando...</span>';

    try {
        const res = await fetch(`/api/usuarios/${ciInput}`);
        if (res.ok) {
            const data = await res.json();
            if (data && data.datos) {
                msj.innerHTML = `<span style="color: #28a745;"><i class="fas fa-check-circle"></i> Habilitado: ${data.datos.nombre_completo}</span>`;
                if (calificacionActual > 0) {
                    btn.disabled = false;
                    btn.style.opacity = "1";
                    btn.style.cursor = "pointer";
                }
            }
        } else {
            msj.innerHTML = `<span style="color: #d32f2f;"><i class="fas fa-times-circle"></i> CI no habilitado. Regístrese en Habilitación.</span>`;
            btn.disabled = true;
            btn.style.opacity = "0.5";
            btn.style.cursor = "not-allowed";
        }
    } catch(e) {
        msj.innerHTML = `<span style="color: #d32f2f;"><i class="fas fa-exclamation-triangle"></i> Error de conexión.</span>`;
    }
}

window.calificarConEstrellas = function(nota) {
    calificacionActual = nota;
    document.getElementById('voto-puntaje').value = nota * 2; 

    for (let i = 1; i <= 5; i++) {
        const star = document.getElementById(`star-${i}`);
        if (i <= nota) {
            star.style.color = "#FFD700"; 
            star.style.transform = "scale(1.1)";
            star.classList.add('resplandor-estrella');
        } else {
            star.style.color = "#ddd"; 
            star.style.transform = "scale(1)";
            star.classList.remove('resplandor-estrella');
        }
    }
    
    document.getElementById('texto-puntuacion').innerHTML = `Puntuación: <span style="color:var(--azul-uab);">${nota * 2} / 10 puntos</span> (${nota} estrellas)`;
    window.simularVerificacionCI(); 
}

//  FUNCIÓN ESPECIAL: Obliga al sistema a esperar la respuesta del GPS del usuario
function obtenerUbicacionGPS() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Tu dispositivo o navegador no soporta geolocalización."));
        }
        navigator.geolocation.getCurrentPosition(
            (position) => resolve(position),
            (error) => {
                let msg = "Error desconocido al obtener ubicación.";
                if (error.code === 1) msg = "PERMISO DENEGADO: Debes darle 'Permitir' a la solicitud de ubicación GPS en tu pantalla para poder votar.";
                if (error.code === 2) msg = "UBICACIÓN NO DISPONIBLE: No se pudo conectar al satélite GPS. Intenta salir a un lugar más despejado.";
                if (error.code === 3) msg = "TIEMPO AGOTADO: El GPS tardó demasiado en responder.";
                reject(new Error(msg));
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    });
}

//  ENVÍO DE VOTO CON CONTROL ABSOLUTO DE ESTADO
window.enviarCalificacion = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('btnEnviarVoto');
    
    const idProy = document.getElementById('voto-idProy').value;
    const ci = document.getElementById('voto-ci').value.trim();
    const nota = document.getElementById('voto-puntaje').value;

    if (!idProy || !nota || !ci) {
        alert("⚠️ Completa todos los campos y selecciona las estrellas.");
        return;
    }

    // 1. Bloqueamos botón y avisamos que estamos buscando GPS
    btn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Obteniendo GPS...';
    btn.disabled = true;
    btn.style.opacity = "0.7";
    btn.style.cursor = "wait";

    try {
        // 2. Detiene el código aquí hasta que el usuario le de "Permitir" o "Bloquear"
        const position = await obtenerUbicacionGPS();
        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;

        // 3. Calculamos la distancia en el celular
        const distanciaMetros = calcularDistanciaMetros(LATITUD_FERIA, LONGITUD_FERIA, userLat, userLon);

        if (distanciaMetros > RADIO_PERMITIDO_METROS) {
            alert(`⛔ ALERTA DE FRAUDE: ESTÁS DEMASIADO LEJOS\n\nEl sistema detecta que estás a ${distanciaMetros.toFixed(0)} metros de la feria.\nSolo se permite votar dentro del recinto habilitado.`);
            
            // RESTAURA EL BOTÓN SI FALLA LA DISTANCIA (Permite reintentar)
            btn.innerHTML = 'Confirmar Voto';
            btn.disabled = false;
            btn.style.opacity = "1";
            btn.style.cursor = "pointer";
            return;
        }

        // 4. Si la distancia es correcta, enviamos el voto a la base de datos
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando Voto...';
        
        const res = await fetch('/api/votar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                idProyecto: idProy,
                ci: ci,
                nota: nota,
                lat: userLat,
                lon: userLon
            })
        });
        
        const resData = await res.json();
        
        if (!res.ok) throw new Error(resData.error || "Error al registrar el voto.");

        alert("🎉 ¡Voto registrado con éxito! Gracias por participar.");
        localStorage.clear();
        window.location.href = window.location.pathname; 

    } catch (error) {
        // Si el usuario rechazó el permiso GPS o la base de datos falló:
        alert("❌ " + error.message);
        
        // RESTAURA EL BOTÓN INMEDIATAMENTE PARA PERMITIR OTRO INTENTO
        btn.innerHTML = 'Confirmar Voto';
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.style.cursor = "pointer";
    }
};

document.addEventListener("DOMContentLoaded", window.cargarProyectoParaVotar);