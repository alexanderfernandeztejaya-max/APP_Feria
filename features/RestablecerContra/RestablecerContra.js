// =========================================================================
// ARCHIVO: features/RestablecerContra/RestablecerContra.js
// FUNCIÓN: Recuperación de contraseñas (Modo PostgreSQL)
// =========================================================================

window.recuperarContrasena = async function(e) {
    e.preventDefault(); 
    
    alert("⚠️ Por motivos de seguridad y privacidad, la recuperación automática de contraseñas por correo electrónico está desactivada en el servidor central.\n\nPor favor, comuníquese personalmente con Soporte Técnico o con un Administrador de la feria para que le asignen una nueva contraseña temporal.");
    
    document.getElementById('recoverEmail').value = "";
    
    if (typeof window.toggleAuthMode === 'function') {
        window.toggleAuthMode(new Event('click'), 'login'); 
    } else {
        document.getElementById('recover-card').style.display = 'none';
        document.getElementById('login-card').style.display = 'block';
    }
};