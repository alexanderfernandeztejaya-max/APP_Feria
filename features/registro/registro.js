// =========================================================================
// ARCHIVO: features/registro/registro.js
// FUNCIÓN: Registro de expositores a PostgreSQL
// =========================================================================

window.addEventListener('DOMContentLoaded', () => {
    const parametros = new URLSearchParams(window.location.search);
    const accion = parametros.get('action');

    if (accion === 'registro_expositor' && typeof toggleAuthMode === 'function') {
        toggleAuthMode(null, 'register');
    }

    const soloLetras = function() { this.value = this.value.replace(/[0-9]/g, ''); };
    const soloNumeros = function() { this.value = this.value.replace(/[^0-9]/g, ''); };

    const inputRegName = document.getElementById('regName');
    const inputRegPhone = document.getElementById('regPhone');

    if (inputRegName) inputRegName.addEventListener('input', soloLetras);
    if (inputRegPhone) inputRegPhone.addEventListener('input', soloNumeros);
});

window.handleRegister = async function(e) {
    if(e && typeof e.preventDefault === 'function') e.preventDefault();
    
    const btn = e.target.querySelector('button[type="submit"]');
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando...';
    btn.disabled = true;

    try {
        const resConf = await fetch('/api/configuraciones');
        const dataConf = await resConf.json();
        const FECHA_LIMITE_REGISTRO = new Date(dataConf.fecha_registro);

        if (new Date() > FECHA_LIMITE_REGISTRO) {
            alert("🛑 INSCRIPCIONES CERRADAS\n\nEl plazo oficial ha finalizado.");
            btn.innerHTML = textoOriginal; btn.disabled = false;
            return;
        }

        const name = document.getElementById('regName').value.trim();
        const ci = document.getElementById('regCI').value.trim();
        const institution = document.getElementById('regInstitucion').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const phone = document.getElementById('regPhone').value.trim();
        const pass = document.getElementById('regPass').value;
        
        const res = await fetch('/api/expositores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ci, nombreCompleto: name, institucion: institution, correo: email, celular: phone, password: pass })
        });

        if (!res.ok) throw new Error("Error guardando datos o el C.I. ya existe en el sistema.");

        alert("✅ ¡Cuenta de expositor creada exitosamente!\n\nPor favor, inicie sesión con su Carnet de Identidad y la contraseña que acaba de crear.");

        // 🔥 NUEVO: Limpiar la URL para evitar el bucle al recargar
        window.history.replaceState({}, document.title, window.location.pathname);

        e.target.reset();
        window.toggleAuthMode(null, 'login');

    } catch (error) {
        console.error("Error técnico al registrar:", error);
        alert("❌ Ocurrió un error: " + error.message);
    } finally {
        if (btn) { btn.innerHTML = textoOriginal; btn.disabled = false; }
    }
};