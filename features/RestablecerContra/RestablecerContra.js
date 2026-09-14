// features/RestablecerContra/RestablecerContra.js

// 1. Ya NO importamos getAuth, solo la función de enviar el correo
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ==========================================
// FUNCIÓN PARA RECUPERAR CONTRASEÑA
// ==========================================
window.recuperarContrasena = async function(e) {
    e.preventDefault(); // Evita que la página se recargue

    // Obtenemos el correo que el usuario escribió
    const emailInput = document.getElementById('recoverEmail');
    const email = emailInput.value.trim();
    
    //  LA SOLUCIÓN: Usamos la conexión que ya está abierta en tu sistema (firebase-config.js)
    const auth = window.auth;

    // Cambiamos el texto del botón para mostrar que está cargando
    const btn = e.target.querySelector('button[type="submit"]');
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    btn.disabled = true;

    try {
        // Ejecutamos la función nativa de Firebase para enviar el correo
        await sendPasswordResetEmail(auth, email);
        
        alert(`✅ Enlace de recuperación enviado a:\n${email}\n\nPor favor, revise su bandeja de entrada (y la carpeta de Spam) para crear su nueva contraseña.`);
        
        // Limpiamos la casilla y devolvemos al usuario a la pantalla de Login
        emailInput.value = "";
        
        // Usamos la función global para cambiar de pantalla
        if (typeof window.toggleAuthMode === 'function') {
            window.toggleAuthMode(new Event('click'), 'login'); 
        } else {
            document.getElementById('recover-card').style.display = 'none';
            document.getElementById('login-card').style.display = 'block';
        }

    } catch (error) {
        console.error("Error al restablecer contraseña:", error);
        
        // Mensajes de error amigables
        if (error.code === 'auth/user-not-found') {
            alert("⚠️ No existe ninguna cuenta registrada con este correo en el sistema.");
        } else if (error.code === 'auth/invalid-email') {
            alert("⚠️ El formato del correo electrónico es inválido.");
        } else {
            alert("⚠️ Ocurrió un error al intentar enviar el enlace. Intente nuevamente.");
        }
    } finally {
        // Restauramos el botón a la normalidad
        if (btn) {
            btn.innerHTML = textoOriginal;
            btn.disabled = false;
        }
    }
};