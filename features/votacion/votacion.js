// =========================================================================
// ARCHIVO: features/votacion/votacion.js
// FUNCIÓN: Manejo de votación mediante QR y GPS (Conectado a PostgreSQL)
// =========================================================================

let proyectoActualDatos = null; // Guardamos en memoria los datos del proyecto

// --- 1. INICIALIZACIÓN DEL ENTORNO AL ESCANEAR QR ---
window.revisarURLVotacion = async function() {
    const parametros = new URLSearchParams(window.location.search);
    const idProy = parametros.get('idProy');
    const cat = parametros.get('cat');

    if (idProy && cat) {
        console.log("¡QR Detectado! Iniciando entorno seguro de votación...");

        setTimeout(async () => {
            const loginScreen = document.getElementById('login-screen');
            if (loginScreen) loginScreen.style.display = 'none';
            
            const mainContent = document.getElementById('main-content');
            if (mainContent) mainContent.style.display = 'block';
            
            document.querySelectorAll('.module-section').forEach(sec => sec.style.display = 'none');
            
            const votarSec = document.getElementById('votar-proyecto');
            if (votarSec) votarSec.style.display = 'block';

            try {
                // Pedimos los datos del proyecto a PostgreSQL (Ruta Relativa)
                const respuesta = await fetch(`/api/proyectos_qr/${idProy}`);
                if (respuesta.ok) {
                    proyectoActualDatos = await respuesta.json();
                    
                    // 🔴 CANDADO ACTIVADO: ¿Pasó la etapa 1 del Tribunal?
                    if (proyectoActualDatos.estado_evaluacion === "Pre-seleccionado") {
                        document.getElementById('votar-titulo').innerText = proyectoActualDatos.titulo;
                        document.getElementById('voto-idProy').value = idProy;
                        document.getElementById('voto-cat').value = cat;
                    } else {
                        // Si reprobó o aún no ha sido evaluado por el tribunal
                        document.getElementById('votar-titulo').innerHTML = "<span style='color: #dc3545;'><i class='fas fa-lock'></i> Proyecto no habilitado</span><br><small style='color:#666; font-size:12px;'>Este proyecto aún no ha superado la fase de Pre-selección.</small>";
                        document.getElementById('form-votacion').style.display = 'none';
                    }
                } else {
                    document.getElementById('votar-titulo').innerText = "❌ Proyecto no encontrado";
                    document.getElementById('form-votacion').style.display = 'none';
                }
            } catch (error) {
                console.error("Error al cargar datos del QR:", error);
                document.getElementById('votar-titulo').innerText = "❌ Error de conexión con la base de datos";
            }
        }, 200); 
    }
};

window.addEventListener('DOMContentLoaded', () => {
    window.revisarURLVotacion();
});

// --- 2. VALIDACIÓN VISUAL DEL CI EN TIEMPO REAL ---
window.simularVerificacionCI = async function() {
    const ci = document.getElementById('voto-ci').value.trim();
    const mensaje = document.getElementById('mensaje-validacion-ci');
    const btnVotar = document.getElementById('btnEnviarVoto');

    if (ci === "") {
        mensaje.innerHTML = "";
        btnVotar.disabled = false;
        btnVotar.style.opacity = "1";
        return;
    }

    mensaje.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Consultando padrón oficial...';
    mensaje.style.color = "#6c757d";
    btnVotar.disabled = true;
    btnVotar.style.opacity = "0.5";

    try {
        // Usamos el puente de usuarios para saber si es un visitante real (Ruta Relativa)
        const respuesta = await fetch(`/api/usuarios/${ci}`);
        
        if (respuesta.ok) {
            const data = await respuesta.json();
            if (data.rol === "VISITANTE") {
                mensaje.innerHTML = '<i class="fas fa-check-circle"></i> CI habilitado para votar';
                mensaje.style.color = "#28a745"; 
                btnVotar.disabled = false;
                btnVotar.style.opacity = "1";
                return;
            }
        }
        
        mensaje.innerHTML = '<i class="fas fa-times-circle"></i> El CI no está habilitado. Debe registrarse en la entrada.';
        mensaje.style.color = "#dc3545"; 
        
    } catch (error) {
        mensaje.innerHTML = 'Error de conexión. Reintente.';
    }
};

// --- 3. HERRAMIENTAS MATEMÁTICAS Y DE SENSORES (GPS) ---
function calcularDistanciaGPS(lat1, lon1, lat2, lon2) {
    const radioTierra = 6371e3; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return radioTierra * c; 
}

const obtenerUbicacionRobusta = () => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject({ code: 0, message: "Navegador sin GPS" });
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
    });
};

// --- 4. FUNCIÓN PRINCIPAL DE SEGURIDAD Y GUARDADO ---
window.enviarCalificacion = async function(e) {
    e.preventDefault();
    
    const idProy = document.getElementById('voto-idProy').value;
    const ci = document.getElementById('voto-ci').value.trim();
    const puntajeFinal = parseInt(document.getElementById('voto-puntaje').value);

    if(isNaN(puntajeFinal) || puntajeFinal < 2 || puntajeFinal > 10) {
        alert("⭐ Atención: Por favor, selecciona entre 1 y 5 estrellas.");
        return;
    }

    const btn = document.getElementById('btnEnviarVoto');
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando seguridad...';
    btn.disabled = true;

    try {
        // --- FILTRO ANTI-FRAUDE: ¿El que vota es el dueño del proyecto? ---
        if (proyectoActualDatos && ci === proyectoActualDatos.ci_propietario) {
            alert("🛑 ACCESO DENEGADO: Por normas de transparencia de la Tecno Feria, los expositores no pueden votar por su propio proyecto.");
            btn.innerHTML = textoOriginal; btn.disabled = false; return;
        }

        // --- FILTRO GPS ---
        btn.innerHTML = '<i class="fas fa-map-marker-alt fa-pulse"></i> Obteniendo satélites...';
        const posicionGPS = await obtenerUbicacionRobusta();
        
        const latCelular = posicionGPS.coords.latitude;
        const lonCelular = posicionGPS.coords.longitude;
        const latFeria = -14.812506161535874;  //-14.833966217092081, -64.8994602180307
        const lonFeria = -64.89586160070048;    //UAB -14.812506161535874, -64.89586160070048
        
        const distancia = calcularDistanciaGPS(latCelular, lonCelular, latFeria, lonFeria);

        if (distancia > 500) {
            alert(`🚫 ALERTA DE FRAUDE\n\nEl sistema detecta que estás a ${Math.round(distancia)} metros de distancia del evento.\nSolo se permiten votos físicamente dentro del campus.`);
            btn.innerHTML = textoOriginal; btn.disabled = false; return;
        }

        // --- ✅ PASÓ TODO: ENVIAMOS A POSTGRESQL (Ruta Relativa) ---
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando voto...';
        
        const respuesta = await fetch('/api/votar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idProyecto: idProy, ci: ci, nota: puntajeFinal, lat: latCelular, lon: lonCelular })
        });

        const dataRespuesta = await respuesta.json();

        if (!respuesta.ok) {
            alert("❌ Error: " + dataRespuesta.error);
            btn.innerHTML = textoOriginal; btn.disabled = false; return;
        }

        // Pantalla de Éxito
        const cantidadEstrellas = puntajeFinal / 2;
        let estrellasHTML = "";
        for(let i=0; i<cantidadEstrellas; i++) estrellasHTML += '<i class="fas fa-star" style="color: #ffc107;"></i> ';

        e.target.innerHTML = `
            <div style="text-align: center; color: #28a745; margin-top: 15px;">
                <i class="fas fa-check-circle" style="font-size: 4rem; margin-bottom: 10px;"></i>
                <h3 style="margin: 0; color: #002b5c;">¡Voto Confirmado!</h3>
                <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 12px; margin: 15px 0;">
                    <div style="font-size: 1.3rem; margin-bottom: 5px;">${estrellasHTML}</div>
                    <strong style="color: #002b5c; font-size: 1.1rem;">${puntajeFinal} / 10 Puntos</strong>
                </div>
                <p style="color: #666; font-size: 0.85rem; margin-bottom: 25px;">
                    Estás a ${Math.round(distancia)} metros del centro de la feria. Tu calificación ha sido asegurada por GPS.
                </p>
                <button type="button" onclick="window.location.href = window.location.pathname" style="width: 100%; padding: 12px; background: white; color: #555; border: 1px solid #ccc; border-radius: 6px; font-size: 1rem; font-weight: bold; cursor: pointer;">
                    <i class="fas fa-arrow-left"></i> Volver al Inicio
                </button>
            </div>
        `;

    } catch (error) {
        if (error.code === 1) alert("❌ VOTO BLOQUEADO\n\nEs obligatorio encender tu GPS y dar permisos de ubicación para confirmar tu asistencia.");
        else alert("❌ Error al procesar el voto. Revisa tu conexión a internet.");
        
        btn.innerHTML = textoOriginal; btn.disabled = false;
    }
};

window.calificarConEstrellas = function(cantidadEstrellas) {
    const puntos = cantidadEstrellas * 2;
    const inputPuntaje = document.getElementById('voto-puntaje');
    if (inputPuntaje) inputPuntaje.value = puntos;

    for (let i = 1; i <= 5; i++) {
        const estrella = document.getElementById(`star-${i}`);
        if (estrella) {
            if (i <= cantidadEstrellas) {
                estrella.style.color = '#ffc107'; 
                estrella.style.transform = 'scale(1.15)';
                estrella.style.textShadow = '0 2px 5px rgba(255, 193, 7, 0.4)';
            } else {
                estrella.style.color = '#ccc'; 
                estrella.style.transform = 'scale(1)';
                estrella.style.textShadow = 'none';
            }
        }
    }
    const textoPuntuacion = document.getElementById('texto-puntuacion');
    if (textoPuntuacion) {
        textoPuntuacion.innerHTML = `Puntuación asignada: <span style="color: #002b5c; font-size: 1.1rem;">${puntos} / 10 puntos</span> (${cantidadEstrellas} ${cantidadEstrellas === 1 ? 'estrella' : 'estrellas'})`;
    }
};