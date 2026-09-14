// Importar las librerías
require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const helmet = require('helmet'); 
const rateLimit = require('express-rate-limit'); 
const compression = require('compression'); //  NUEVO: Librería de compresión para producción

const app = express();
//  ¡AGREGA ESTA LÍNEA AQUÍ PARA CONFIAR EN NGROK! 
app.set('trust proxy', 1);

// NUEVO: Comprimir todas las respuestas para que la página cargue en milisegundos
app.use(compression());

// ====================================================================
//  MIDDLEWARES DE SEGURIDAD
// ====================================================================
app.use(helmet({
    contentSecurityPolicy: false, 
}));

const limitadorGlobal = rateLimit({
    windowMs: 10 * 60 * 1000, 
    max: 150, 
    message: { error: "⚠️ Demasiadas peticiones desde esta conexión. Por favor, intenta de nuevo en 10 minutos." }
});
app.use('/api/', limitadorGlobal); 

app.use(cors());
app.use(express.json({ limit: '2mb' })); 

// ====================================================================
//  SERVIR ARCHIVOS ESTÁTICOS CON CACHÉ DE PRODUCCIÓN
// ====================================================================
const rutaFrontend = path.join(__dirname, '../');

//  NUEVO: Guardar imágenes, CSS y JS en el celular del usuario por 1 día (1d)
app.use(express.static(rutaFrontend, {
    maxAge: '1d' 
}));

app.get('/', (req, res) => {
    res.sendFile(path.join(rutaFrontend, 'index.html'));
});

// ====================================================================
//  CONEXIÓN A POSTGRESQL Y CREACIÓN DE TABLAS
// ====================================================================
const db = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS, 
    port: process.env.DB_PORT,
});

db.connect()
    .then(async () => {
        console.log('✅ Conexión exitosa a PostgreSQL (tecno_feria_db)');
        
        //  AUTO-CREAR TABLA PARA SESIONES ÚNICAS
        await db.query(`
            CREATE TABLE IF NOT EXISTS sesiones_activas (
                ci_usuario VARCHAR(50) PRIMARY KEY,
                token VARCHAR(255) NOT NULL
            );
        `);
        console.log('🛡️ Escudo de Sesión Única Activado en BD.');

        //  AUTO-CREAR TABLA DE CONFIGURACIONES GLOBALES (FECHAS)
        await db.query(`
            CREATE TABLE IF NOT EXISTS configuraciones (
                id SERIAL PRIMARY KEY,
                fecha_registro TIMESTAMP,
                fecha_subida TIMESTAMP,
                fecha_resultados TIMESTAMP
            );
        `);
        
        await db.query(`
            INSERT INTO configuraciones (id, fecha_registro, fecha_subida, fecha_resultados)
            VALUES (1, '2026-08-29 22:20:00', '2026-09-06 23:59:59', '2026-07-22 18:00:00')
            ON CONFLICT (id) DO NOTHING;
        `);
        
        //  AUTO-CREAR TABLA DE INSTITUCIONES
        await db.query(`
            CREATE TABLE IF NOT EXISTS instituciones (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL,
                tipo VARCHAR(100) NOT NULL
            );
        `);
        
        // Si la tabla está vacía, le metemos las instituciones por defecto
        const instCheck = await db.query('SELECT COUNT(*) FROM instituciones');
        if(parseInt(instCheck.rows[0].count) === 0) {
            await db.query(`INSERT INTO instituciones (nombre, tipo) VALUES 
                ('Docente UABJB - Ing. de Sistemas', 'Universidad Autónoma del Beni (UABJB)'),
                ('Estudiante UABJB - Ing. de Sistemas', 'Universidad Autónoma del Beni (UABJB)'),
                ('Titulado C.I.S. - Emprendedor Tecnológico', 'Universidad Autónoma del Beni (UABJB)'),
                ('U.E. Nicolas Suarez', 'Unidades Educativas Invitadas'),
                ('U.E. La Salle', 'Unidades Educativas Invitadas'),
                ('U.E. Nuestra Señora de Fatima', 'Unidades Educativas Invitadas'),
                ('U.E. 13 de abril', 'Unidades Educativas Invitadas'),
                ('U.E. 6 de Agosto', 'Unidades Educativas Invitadas')
            `);
            console.log('🏫 Tabla de Instituciones poblada con éxito.');
        }
    })
    .catch(err => console.error('❌ Error de conexión a PostgreSQL:', err.stack));
    
// ====================================================================
// ENDPOINTS DE CONFIGURACIÓN GLOBAL (FECHAS)
// ====================================================================
app.get('/api/configuraciones', async (req, res) => {
    try {
        const conf = await db.query('SELECT * FROM configuraciones WHERE id = 1');
        res.json(conf.rows[0]);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener configuraciones" });
    }
});

app.post('/api/configuraciones', async (req, res) => {
    const { fechaRegistro, fechaSubida, fechaResultados } = req.body;
    try {
        await db.query(
            'UPDATE configuraciones SET fecha_registro=$1, fecha_subida=$2, fecha_resultados=$3 WHERE id = 1',
            [fechaRegistro, fechaSubida, fechaResultados]
        );
        res.json({ mensaje: "Fechas actualizadas correctamente" });
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar fechas" });
    }
});

// ====================================================================
//  ENDPOINTS DE INSTITUCIONES (COLEGIOS / UNIVERSIDADES)
// ====================================================================
app.get('/api/instituciones', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM instituciones ORDER BY tipo DESC, nombre ASC');
        res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Error al obtener instituciones" }); }
});

app.post('/api/instituciones', async (req, res) => {
    const { nombre, tipo } = req.body;
    try {
        await db.query('INSERT INTO instituciones (nombre, tipo) VALUES ($1, $2)', [nombre, tipo]);
        res.json({ mensaje: "Institución agregada" });
    } catch (error) { res.status(500).json({ error: "Error al agregar institución" }); }
});

app.delete('/api/instituciones/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM instituciones WHERE id = $1', [req.params.id]);
        res.json({ mensaje: "Institución eliminada" });
    } catch (error) { res.status(500).json({ error: "Error al eliminar institución" }); }
});

// ====================================================================
// ENDPOINTS DE USUARIOS
// ====================================================================
app.get('/api/usuarios/:identificador', async (req, res) => {
    const { identificador } = req.params;
    try {
        let rolEncontrado = null;
        let datosEncontrados = null;

        const admin = await db.query('SELECT * FROM administradores WHERE ci = $1', [identificador]);
        if (admin.rows.length > 0) { rolEncontrado = 'ADMIN'; datosEncontrados = admin.rows[0]; }

        if (!rolEncontrado) {
            const expositor = await db.query('SELECT * FROM expositores WHERE ci = $1', [identificador]);
            if (expositor.rows.length > 0) { rolEncontrado = 'EXPOSITOR'; datosEncontrados = expositor.rows[0]; }
        }
        
        if (!rolEncontrado) {
            const tribunal = await db.query('SELECT * FROM tribunales WHERE usuario_tribunal = $1', [identificador]);
            if (tribunal.rows.length > 0) { rolEncontrado = 'TRIBUNAL'; datosEncontrados = tribunal.rows[0]; }
        }

        if (!rolEncontrado) {
            const visitante = await db.query('SELECT * FROM visitantes WHERE ci = $1', [identificador]);
            if (visitante.rows.length > 0) { rolEncontrado = 'VISITANTE'; datosEncontrados = visitante.rows[0]; }
        }

        if (!rolEncontrado) {
            return res.status(404).json({ error: "Usuario no encontrado en la base de datos oficial." });
        }

        const nuevoToken = Date.now().toString(36) + Math.random().toString(36).substring(2);
        
        await db.query(`
            INSERT INTO sesiones_activas (ci_usuario, token) 
            VALUES ($1, $2) 
            ON CONFLICT (ci_usuario) DO UPDATE SET token = EXCLUDED.token
        `, [identificador, nuevoToken]);

        res.json({ rol: rolEncontrado, datos: datosEncontrados, token: nuevoToken });
    } catch (error) {
        res.status(500).json({ error: "Error interno del servidor al procesar el login." });
    }
});

app.get('/api/verificar_sesion/:identificador/:token', async (req, res) => {
    try {
        const { identificador, token } = req.params;
        const result = await db.query('SELECT token FROM sesiones_activas WHERE ci_usuario = $1', [identificador]);
        
        if (result.rows.length === 0) return res.json({ valida: false });
        if (result.rows[0].token === token) return res.json({ valida: true }); 
        
        res.json({ valida: false }); 
    } catch (error) {
        res.status(500).json({ valida: true }); 
    }
});


// ====================================================================
//  ENDPOINTS DE EXPOSITORES Y PROYECTOS
// ====================================================================
app.post('/api/expositores', async (req, res) => {
    const { ci, nombreCompleto, institucion, correo, celular } = req.body;
    try {
        const query = `
            INSERT INTO expositores (ci, nombre_completo, institucion, correo, celular) 
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (ci) DO UPDATE 
            SET nombre_completo = EXCLUDED.nombre_completo, institucion = EXCLUDED.institucion, 
                correo = EXCLUDED.correo, celular = EXCLUDED.celular
        `;
        await db.query(query, [ci, nombreCompleto, institucion, correo, celular]);
        res.status(201).json({ mensaje: "Expositor guardado" });
    } catch (error) {
        res.status(500).json({ error: "Error al guardar expositor" });
    }
});

app.post('/api/proyectos', async (req, res) => {
    const { correoPropietario, titulo, categoria, integrantes, ejeTematico, enlacePdf } = req.body;
    try {
        const user = await db.query('SELECT ci FROM expositores WHERE correo = $1', [correoPropietario]);
        if (user.rows.length === 0) return res.status(404).json({ error: "Expositor no encontrado" });
        const ci = user.rows[0].ci;

        // Buscamos si el proyecto ya existe y vemos qué estado tiene
        const check = await db.query('SELECT id, estado_evaluacion FROM proyectos WHERE ci_propietario = $1', [ci]);
        
        if (check.rows.length > 0) {
            const idProyecto = check.rows[0].id;
            const estadoActual = check.rows[0].estado_evaluacion;

            //  MAGIA: Si el proyecto fue evaluado y no clasificó, reseteamos todo para una nueva oportunidad
            if (estadoActual === 'Evaluado (No clasifica)') {
                
                // 1. Borramos la mala nota del historial del tribunal
                await db.query('DELETE FROM evaluaciones_tribunal WHERE id_proyecto = $1', [idProyecto]);
                
                // 2. Actualizamos el proyecto y limpiamos su estado a "Pendiente"
                await db.query(
                    `UPDATE proyectos SET 
                        titulo=$1, categoria=$2, integrantes=$3, eje_tematico=$4, enlace_pdf=$5, fecha_ultima_edicion=CURRENT_TIMESTAMP, 
                        estado_evaluacion=NULL, nota_tribunal=NULL, nota_ponderada=NULL, observaciones_tribunal=NULL 
                    WHERE ci_propietario=$6`,
                    [titulo, categoria, integrantes, ejeTematico, enlacePdf, ci]
                );
            } else {
                // Actualización normal (no reseteamos notas si ya estaba pre-seleccionado o pendiente)
                await db.query(
                    'UPDATE proyectos SET titulo=$1, categoria=$2, integrantes=$3, eje_tematico=$4, enlace_pdf=$5, fecha_ultima_edicion=CURRENT_TIMESTAMP WHERE ci_propietario=$6',
                    [titulo, categoria, integrantes, ejeTematico, enlacePdf, ci]
                );
            }
        } else {
            // Es un proyecto totalmente nuevo
            await db.query(
                'INSERT INTO proyectos (ci_propietario, titulo, categoria, integrantes, eje_tematico, enlace_pdf) VALUES ($1, $2, $3, $4, $5, $6)',
                [ci, titulo, categoria, integrantes, ejeTematico, enlacePdf]
            );
        }
        res.status(201).json({ mensaje: "Proyecto guardado con éxito" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al guardar proyecto" });
    }
});

app.get('/api/proyectos/:correo', async (req, res) => {
    try {
        const user = await db.query('SELECT ci FROM expositores WHERE correo = $1', [req.params.correo]);
        if (user.rows.length === 0) return res.json(null);
        
        const proy = await db.query('SELECT * FROM proyectos WHERE ci_propietario = $1', [user.rows[0].ci]);
        if (proy.rows.length === 0) return res.json(null);
        
        res.json(proy.rows[0]);
    } catch (error) {
        res.status(500).json({ error: "Error al buscar proyecto" });
    }
});

app.get('/api/proyectos_admin', async (req, res) => {
    try {
        const proyectos = await db.query('SELECT id, titulo, categoria, integrantes, enlace_pdf FROM proyectos ORDER BY id DESC');
        res.json(proyectos.rows);
    } catch (error) {
        res.status(500).json({ error: "Error al cargar la lista de proyectos" });
    }
});

app.get('/api/proyectos_qr/:id', async (req, res) => {
    try {
        const proy = await db.query('SELECT * FROM proyectos WHERE id = $1', [req.params.id]);
        if (proy.rows.length === 0) return res.status(404).json({ error: "Proyecto no encontrado" });
        res.json(proy.rows[0]);
    } catch (error) {
        res.status(500).json({ error: "Error interno del servidor" });
    }
});


// ====================================================================
//  ENDPOINTS DE VISITANTES Y VOTOS (PÚBLICO)
// ====================================================================
app.post('/api/visitantes', async (req, res) => {
    const { ci, nombreCompleto, institucion } = req.body;
    try {
        const checkVisitante = await db.query('SELECT * FROM visitantes WHERE ci = $1', [ci]);
        if (checkVisitante.rows.length > 0) return res.status(400).json({ error: "Este Carnet de Identidad ya está habilitado en el sistema." });

        let nombreFinal = nombreCompleto;
        let institucionFinal = institucion;

        const checkExpositor = await db.query('SELECT * FROM expositores WHERE ci = $1', [ci]);
        if (checkExpositor.rows.length > 0) {
            nombreFinal = checkExpositor.rows[0].nombre_completo;
            institucionFinal = checkExpositor.rows[0].institucion;
        }

        const insertQuery = `INSERT INTO visitantes (ci, nombre_completo, institucion) VALUES ($1, $2, $3) RETURNING *`;
        const nuevoVisitante = await db.query(insertQuery, [ci, nombreFinal, institucionFinal]);

        res.status(201).json({ mensaje: "✅ Visitante habilitado correctamente", visitante: nuevoVisitante.rows[0] });
    } catch (error) {
        res.status(500).json({ error: "Ocurrió un error en el servidor al intentar habilitar." });
    }
});

app.post('/api/votar', async (req, res) => {
    const { idProyecto, ci, nota, lat, lon } = req.body;
    try {
        const dup = await db.query('SELECT id FROM votos_publico WHERE ci_visitante = $1 AND id_proyecto = $2', [ci, idProyecto]);
        if (dup.rows.length > 0) return res.status(400).json({ error: "DUPLICADO: Ya calificaste este proyecto anteriormente." });
        
        await db.query(
            'INSERT INTO votos_publico (id_proyecto, ci_visitante, nota, latitud, longitud) VALUES ($1, $2, $3, $4, $5)',
            [idProyecto, ci, nota, lat, lon]
        );
        res.status(201).json({ mensaje: "✅ Voto registrado exitosamente." });
    } catch (error) {
        res.status(500).json({ error: "Error interno al guardar el voto en PostgreSQL." });
    }
});

app.get('/api/votos_admin', async (req, res) => {
    try {
        const query = `
            SELECT v.id as id_voto, v.nota, p.titulo as nombre_proyecto, p.categoria as categoria_proyecto, vis.nombre_completo as nombre_visitante, vis.institucion as institucion
            FROM votos_publico v JOIN proyectos p ON v.id_proyecto = p.id JOIN visitantes vis ON v.ci_visitante = vis.ci ORDER BY v.id DESC
        `;
        const votos = await db.query(query);
        res.json(votos.rows);
    } catch (error) {
        res.status(500).json({ error: "Error al cargar los votos" });
    }
});

app.delete('/api/votos_admin/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM votos_publico WHERE id = $1', [req.params.id]);
        res.json({ mensaje: "Voto eliminado correctamente" });
    } catch (error) {
        res.status(500).json({ error: "Error interno al eliminar el voto" });
    }
});


// ====================================================================
// ENDPOINTS DE TRIBUNALES Y EVALUACIÓN
// ====================================================================
app.post('/api/tribunales', async (req, res) => {
    const { usuario, nombre, especialidad, categoria, proyectosAsignados, correo } = req.body;
    try {
        const query = `INSERT INTO tribunales (usuario_tribunal, nombre_completo, especialidad, categoria_asignada, proyectos_asignados, correo) VALUES ($1, $2, $3, $4, $5, $6)`;
        await db.query(query, [usuario, nombre, especialidad, categoria, proyectosAsignados, correo]);
        res.status(201).json({ mensaje: "✅ Tribunal guardado." });
    } catch (error) {
        if (error.code === '23505') return res.status(400).json({ error: "Ese Usuario o Correo ya está registrado." });
        res.status(500).json({ error: "Error interno al guardar el tribunal." });
    }
});

app.get('/api/tribunal_correo/:correo', async (req, res) => {
    try {
        const tribunal = await db.query('SELECT * FROM tribunales WHERE correo = $1', [req.params.correo]);
        res.json(tribunal.rows[0] || null);
    } catch (error) {
        res.status(500).json({ error: "Error al buscar tribunal" });
    }
});

app.post('/api/evaluar', async (req, res) => {
    const { idProyecto, correoTribunal, notaTribunal, observaciones } = req.body;
    try {
        const tribunalData = await db.query('SELECT usuario_tribunal FROM tribunales WHERE correo = $1', [correoTribunal]);
        if (tribunalData.rows.length === 0) return res.status(404).json({ error: "Tribunal no encontrado." });
        const usuarioTribunal = tribunalData.rows[0].usuario_tribunal;

        const check = await db.query('SELECT id FROM evaluaciones_tribunal WHERE id_proyecto = $1 AND usuario_tribunal = $2', [idProyecto, usuarioTribunal]);
        if (check.rows.length > 0) return res.status(400).json({ error: "⛔ Ya registraste una calificación." });

        await db.query(
            'INSERT INTO evaluaciones_tribunal (id_proyecto, usuario_tribunal, nota, observaciones) VALUES ($1, $2, $3, $4)',
            [idProyecto, usuarioTribunal, notaTribunal, observaciones]
        );

        const notaPonderada = notaTribunal * 0.60;
        let estado = notaPonderada >= 51 ? 'Pre-seleccionado' : 'Evaluado (No clasifica)';

        await db.query(
            'UPDATE proyectos SET nota_tribunal = $1, nota_ponderada = $2, observaciones_tribunal = $3, estado_evaluacion = $4 WHERE id = $5',
            [notaTribunal, notaPonderada, observaciones, estado, idProyecto]
        );

        const proyData = await db.query('SELECT p.titulo, e.correo, e.nombre_completo FROM proyectos p JOIN expositores e ON p.ci_propietario = e.ci WHERE p.id = $1', [idProyecto]);

        res.status(201).json({ 
            mensaje: "✅ Evaluación guardada", estado: estado, notaPonderada: notaPonderada,
            correoEstudiante: proyData.rows.length > 0 ? proyData.rows[0].correo : "",
            nombreExpositor: proyData.rows.length > 0 ? proyData.rows[0].nombre_completo : "",
            tituloProyecto: proyData.rows.length > 0 ? proyData.rows[0].titulo : "Proyecto"
        });
    } catch (error) {
        res.status(500).json({ error: "Error interno al evaluar" });
    }
});

app.get('/api/evaluaciones_admin', async (req, res) => {
    try {
        const query = `
            SELECT COALESCE(t.nombre_completo, e.usuario_tribunal) as nombre_tribunal, e.nota, p.titulo as nombre_proyecto, p.categoria
            FROM evaluaciones_tribunal e JOIN proyectos p ON e.id_proyecto = p.id LEFT JOIN tribunales t ON e.usuario_tribunal = t.usuario_tribunal ORDER BY e.id DESC
        `;
        const evals = await db.query(query);
        res.json(evals.rows);
    } catch (error) {
        res.status(500).json({ error: "Error al cargar las evaluaciones" });
    }
});


// ====================================================================
//  SUPER ENDPOINT: TODOS LOS DATOS PARA LOS INFORMES Y ACTAS
// ====================================================================
app.get('/api/datos_informes', async (req, res) => {
    try {
        const proyectos = await db.query('SELECT * FROM proyectos');
        const expositores = await db.query('SELECT * FROM expositores');
        const tribunales = await db.query('SELECT * FROM tribunales');
        const visitantes = await db.query('SELECT * FROM visitantes');
        const votos = await db.query('SELECT * FROM votos_publico');
        const evaluaciones = await db.query('SELECT * FROM evaluaciones_tribunal');

        res.json({
            proyectos: proyectos.rows,
            expositores: expositores.rows,
            tribunales: tribunales.rows,
            visitantes: visitantes.rows,
            votos: votos.rows,
            evaluaciones: evaluaciones.rows
        });
    } catch (error) {
        console.error("Error al cargar el súper endpoint de informes:", error);
        res.status(500).json({ error: "Error interno al empaquetar los datos para informes" });
    }
});


// ====================================================================
//  ENDPOINT DE RESULTADOS ESTADÍSTICOS
// ====================================================================
app.get('/api/resultados', async (req, res) => {
    try {
        const query = `
            SELECT 
                p.titulo, 
                p.categoria, 
                COALESCE(p.nota_ponderada, 0) as tribunal_60,
                COALESCE((SELECT AVG(nota) FROM votos_publico WHERE id_proyecto::text = p.id::text), 0) as promedio_estrellas
            FROM proyectos p
            WHERE p.estado_evaluacion = 'Pre-seleccionado'
        `;
        const resultados = await db.query(query);
        
        const dataFinal = resultados.rows.map(r => {
            const t60 = parseFloat(r.tribunal_60) || 0;
            const promEstrellas = parseFloat(r.promedio_estrellas) || 0;
            const p40 = promEstrellas * 4; 
            
            return {
                titulo: r.titulo,
                categoria: r.categoria,
                tribunal_60: t60,
                publico_40: p40,
                nota_final: t60 + p40
            };
        });
        
        dataFinal.sort((a, b) => b.nota_final - a.nota_final);
        res.json(dataFinal);
    } catch (error) {
        console.error("Error al calcular estadísticas:", error);
        res.status(500).json({ error: "Error al cargar los datos para las gráficas" });
    }
});

// ====================================================================
//  ENCENDER EL SERVIDOR
// ====================================================================
//  NUEVO: Puerto dinámico para servidores en la nube
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor Backend Seguro corriendo en el puerto: ${PORT}`);
    console.log(`📂 Sirviendo Frontend desde: ${rutaFrontend}`);
});