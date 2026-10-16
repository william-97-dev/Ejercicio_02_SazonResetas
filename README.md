# Sazón — Explorador de Recetas (Electron)

**Proyecto académico en HTML, CSS, JavaScript y Electron con API pública TheMealDB.**

Una aplicación de escritorio en español para descubrir recetas de cocina. Usa la API TheMealDB y muestra tarjetas, filtros, búsqueda, detalles e ingredientes sin ejecutar servidores locales.

## Iniciar en Windows desde VS Code

1. Instala Node.js LTS desde https://nodejs.org/.
2. Extrae el archivo ZIP. Abre en VS Code la carpeta que contiene `package.json`.
3. Abre **Terminal > Nuevo terminal**.
4. Comprueba la instalación: `node -v` y `npm -v`.
5. Instala las dependencias: `npm install`.
6. Ejecuta la app: `npm start`.
7. Espera a que se abra la ventana de Electron y prueba búsqueda y filtros.

> Si PowerShell restringe `npm`, prueba `npm.cmd install` y `npm.cmd start`, o usa la terminal CMD.

## Comandos

| Comando | Para qué sirve |
| --- | --- |
| `npm install` | Instalar Electron y electron-builder |
| `npm start` | Ejecutar la aplicación de escritorio |
| `npm test` | Ejecutar pruebas automatizadas sin internet |
| `npm run pack:win` | Generar app Windows desempaquetada, sin instalador |
| `npm run dist:win` | Crear un instalador NSIS .exe de Windows |

> El instalador se genera en `dist/` al compilar en Windows. No se incluye un `.exe` en el ZIP.

## Funcionalidades

- Listado de recetas con imagen y nombre.
- Búsqueda global por **nombre** (`search.php?s=...`).
- Filtro por **categoría** (`filter.php?c=...`).
- Filtro por **región** (`filter.php?a=...`).
- Ambos filtros combinados: intersección de IDs de ambas respuestas.
- Combinación de nombre con categoría y región.
- Detalle de cada plato (`lookup.php?i=...`): ingredientes, cantidades e instrucciones.
- Receta aleatoria (`random.php`); video de YouTube cuando esté disponible.
- Estados de carga, error, sin resultados y paginación de 12 tarjetas por página.
- Interfaz adaptable, seguridad de Electron e icono propio.

## Estructura

```text
Sazon_Recetas_Electron/
├── package.json                 Configuración y comandos
├── main.js                      Proceso principal de Electron (ventana e IPC)
├── preload.js                   Puente seguro de funciones a la interfaz
├── src/
│   ├── index.html               Interfaz
│   ├── css/styles.css           Estilos y diseño responsive
│   ├── js/app.js                Buscador, filtros, cards, modal, paginación
│   └── main/recipes-service.js  Peticiones REST a TheMealDB
├── assets/
│   ├── icon.png                 Icono de la ventana
│   ├── icon.ico                 Icono del instalador Windows
│   └── no-image.png             Fallback de imagen
├── tests/recipes-service.test.js Pruebas automatizadas
└── docs/GUIA_PASO_A_PASO.md     Guía de explicación y entrega
```

## Cómo funciona

1. `main.js` crea la ventana con `BrowserWindow` y carga `src/index.html` directamente como archivo local.
2. `src/js/app.js` captura búsquedas y filtros del usuario.
3. El renderer llama a los cinco métodos limitados publicados por `preload.js` vía `contextBridge`.
4. `main.js` acepta mensajes IPC exclusivamente de su ventana; delega las peticiones a `recipes-service.js`.
5. `recipes-service.js` solicita JSON por HTTPS a `https://www.themealdb.com/api/json/v1/1/` con la clave de pruebas pública `1`.
6. La UI procesa el resultado y construye las tarjetas, filtros y vista de detalle.

**Sin servidor local**. Se necesita internet para descargar datos e imágenes de la API. Los títulos e instrucciones pueden estar en inglés porque son los proporcionados por el servicio.

### Filtros combinados

TheMealDB V1 no ofrece un filtro gratuito de categoría+región en un solo endpoint. En ausencia de texto de búsqueda, hacemos ambas consultas y nos quedamos con los IDs presentes en las dos respuestas. Cuando hay texto, consultamos `search.php?s=` y filtramos en JavaScript usando `strCategory` y `strArea`.

### Listado inicial

La versión de API gratuita no permite recuperar *todo* el catálogo con un solo endpoint; al abrir la app se muestra una **selección inicial de platos que empiezan por B**. El subtítulo lo indica. Buscar por nombre o usar filtros consulta el catálogo disponible a través de los endpoints correspondientes, sin limitarse a esa selección inicial.

## Seguridad

- `nodeIntegration: false` y `contextIsolation: true`.
- Renderer con `sandbox: true` y política CSP restrictiva.
- `preload.js` no expone `ipcRenderer` completo, ni `require`, ni `fs`.
- Se valida el emisor de cada llamada IPC.
- Consulta a URLs internas fijas de la API; no se envían URL arbitrarias desde la interfaz.
- Se bloquean nuevas ventanas, navegación no autorizada y solicitudes de permisos.
- La apertura externa de videos se limita a HTTPS y dominios de YouTube.
- Los valores de texto recibidos de la API se escapan antes de insertar HTML.

## API usada, uso académico y atribución

- Documentación: https://www.themealdb.com/api.php
- Guía: https://www.themealdb.com/docs_api_guide.php
- Condiciones: https://www.themealdb.com/terms_of_use.php

**TheMealDB permite el uso de la clave pública `1` para aprendizaje y desarrollo.** Si se publica la aplicación en una tienda de apps, el proveedor exige una suscripción de soporte/clave de producción. Fotografías y datos pertenecen a sus autores y al servicio TheMealDB.

## Notas para presentar el proyecto

Lee también `docs/GUIA_PASO_A_PASO.md`, que incluye los requisitos cumplidos, explicación por archivo, pruebas manuales, errores frecuentes y capturas recomendadas.
