# TRAZA — Angular Frontend

Sistema de control de tráfico con dashboard, incidencias, medición de colas, historial, análisis y evidencias.

## Tecnologías
Angular 19 standalone, TypeScript, CSS responsive, HttpClient, JWT en sesión. API: Spring Boot en `osx-23/TRAZA-BACK`.

## Iniciar
```bash
npm install
npm start
```
Abrir http://localhost:4200

Por defecto llama a `http://localhost:8080/api`. Para despliegue edita `public/config.js` y sustituye la URL por **la URL HTTPS pública del backend**, terminada en `/api`.
Configura `APP_CORS_ORIGINS` en el backend con el dominio frontend (sin slash final).
Para compilar: `npm run build`. La salida está bajo `dist/traza/browser`.

## Pantallas
- Dashboard con KPIs, actividad por día, plazas y últimos registros.
- Formulario de incidencias con situación, ingreso de motorizado, incidente, longitud de cola, observaciones y una foto por categoría.
- Medición de colas por plaza, turno, vía, fecha y hora.
- Historial con filtros, edición, eliminación (SUPERVISOR) y exportación CSV/JSON.
- Análisis por plaza y evolución diaria.
- Evidencias protegidas mediante JWT; SUPERVISOR puede eliminarlas.

## Acceso
No existe usuario de demostración precargado. Configurar `TRAZA_BOOTSTRAP_USERNAME` y `TRAZA_BOOTSTRAP_PASSWORD` en el backend, solo para la primera creación del supervisor. El token se guarda temporalmente en `sessionStorage`.

## Notas
Esta versión trabaja con datos persistidos en Supabase **a través de la API**. No incluye vista previa del formulario, ni usa localStorage para guardar incidencias. El sistema requiere backend activo y una conexión válida a la base de datos.
