// =========================================================================
// ARCHIVO: features/RestablecerContra/RestablecerContra.js
// FUNCIÓN: Restablecimiento directo de contraseña sin depender de EmailJS
// =========================================================================

window.recuperarContrasena = async function(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    
    // Obtenemos los 3 datos del formulario
    const ciInput = document.getElementById('recoverCI').value.trim();
    const emailInput = document.getElementById('recoverEmail').value.trim();
    const newPassInput = document.getElementById('recoverNewPass').value.trim();

    if (!ciInput || !emailInput || !newPassInput) {
        alert("⚠️ Por favor, complete todos los campos requeridos.");
        return;
    }

    if (newPassInput.length < 6) {
        alert("⚠️ La nueva contraseña debe tener al menos 6 caracteres.");
        return;
    }

    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';
    btn.disabled = true;

    try {
        // Enviamos la petición directa a PostgreSQL
        const res = await fetch('/api/restablecer_password_directo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                ci: ciInput, 
                correo: emailInput, 
                nuevaPassword: newPassInput 
            })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || "Error al procesar la solicitud.");
        }

        // Si todo sale bien
        alert(`✅ ¡ÉXITO!\n\n${data.mensaje}\nYa puedes iniciar sesión con tu nueva contraseña.`);
        
        // Limpiamos los campos
        document.getElementById('recoverCI').value = '';
        document.getElementById('recoverEmail').value = '';
        document.getElementById('recoverNewPass').value = '';
        
        // Volvemos a la pantalla principal animada
        const eventMock = { preventDefault: () => {} };
        if(typeof window.toggleAuthMode === 'function') {
            window.toggleAuthMode(eventMock, 'login');
        }

    } catch (error) {
        alert("❌ " + error.message);
    } finally {
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
    }
};