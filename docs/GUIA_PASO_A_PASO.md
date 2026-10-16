# Guía paso a paso — Sazón | Aplicación de recetas con Electron

## 1. Objetivo

Implementar una aplicación de escritorio en HTML, CSS y JavaScript con Electron que consuma una API pública REST JSON, presente datos, permita búsqueda y al menos dos filtros.

**API:** TheMealDB (https://www.themealdb.com/api.php). La clave de prueba `1` se permite para desarrollo y uso educativo, sin registro. **No hay que registrar tarjeta ni pagar para esta práctica.**

## 2. Requisitos previos

- Windows 10/11 de 64 bits (para las instrucciones de instalación de este documento).
- Node.js LTS (incluye npm): https://nodejs.org/.
- Visual Studio Code (opcional pero recomendado).
- Internet para `npm install`, la descarga de datos y las imágenes de las recetas.

## 3. Ejecutar la aplicación desde cero

1. Extrae `Sazon_Recetas_Electron.zip`.
2. Abre Visual Studio Code > **Archivo > Abrir carpeta** y elige `Sazon_Recetas_Electron` (la carpeta donde está `package.json`).
3. Abre **Terminal > Nuevo terminal**.
4. Verifica Node y npm:

   ```powershell
   node -v
   npm -v
   ```

5. Instala las dependencias (solo la primera vez y cuando cambie package.json):

   ```powershell
   npm install
   ```

6. Ejecuta Electron:

   ```powershell
   npm start
   ```

7. Se abrirá **Sazón Recetas**, una ventana independiente. No se necesita Chrome, XAMPP, Live Server ni localhost.
8. Cierra la ventana de Electron para terminar el programa.

**PowerShell:** si muestra que no se pueden ejecutar scripts, usa `npm.cmd install`, `npm.cmd start`, o cambia la terminal a *Símbolo del sistema (CMD)*. No es necesario desactivar permanentemente ninguna política de seguridad.

## 4. Crear instalador de escritorio .EXE (Windows)

Tras comprobar que `npm start` funciona:

```powershell
npm run dist:win
```

El resultado se crea en `dist/`. Ejecútalo en Windows para instalar la aplicación y disponer de acceso directo. El instalador empaqueta Electron: el usuario final no necesita Node.js.

Si solo quieres la carpeta ejecutable sin instalador:

```powershell
npm run pack:win
```

**Nota:** este ZIP contiene código fuente, no un ejecutable ya compilado. El `.exe` se obtiene al ejecutar el comando de empaquetado en Windows.

## 5. Estructura y función de archivos

| Archivo | Función |
| --- | --- |
| `package.json` | Nombre, versión, scripts, dependencias y configuración del instalador. |
| `main.js` | Proceso principal: crea y asegura la ventana; recibe mensajes IPC. |
| `preload.js` | Expone únicamente las operaciones necesarias mediante contextBridge. |
| `src/index.html` | Contenido de la interfaz: tarjetas, buscador, dos selectores, diálogo. |
| `src/css/styles.css` | Diseño, colores, tarjetas y adaptación a ventanas pequeñas. |
| `src/js/app.js` | Consultas desde UI, filtros, estado, paginación y detalle. |
| `src/main/recipes-service.js` | Peticiones HTTPS/REST, JSON, selección y cruces entre filtros. |
| `assets/icon.png` | Icono de la ventana. |
| `assets/icon.ico` | Icono de instalador Windows. |
| `tests/recipes-service.test.js` | Pruebas locales con respuestas simuladas. |

## 6. Flujo de la aplicación

```text
[Usuario escribe una receta / elige filtros]
                 ↓
[src/js/app.js: leer controles]
                 ↓
[preload.js: contextBridge]
                 ↓ IPC (recipes:list)
[main.js: valida ventana emisora]
                 ↓
[src/main/recipes-service.js]
                 ↓ HTTPS REST / JSON
[TheMealDB: search, filter, lookup, list, random]
                 ↓
[Respuesta procesada por JavaScript]
                 ↓
[Interfaz: tarjetas, paginación, modal]
```

## 7. Endpoints principales

Base: `https://www.themealdb.com/api/json/v1/1/`

| Servicio | Endpoint | Retorna |
| --- | --- | --- |
| Buscar por nombre | `search.php?s=chicken` | Recetas cuyo nombre coincide. |
| Filtrar categoría | `filter.php?c=Seafood` | Recetas de mariscos. |
| Filtrar región | `filter.php?a=Italian` | Recetas italianas. |
| Opciones categoría | `list.php?c=list` | Nombres reales de categorías. |
| Opciones región | `list.php?a=list` | Nombres reales de regiones. |
| Detalle | `lookup.php?i=52772` | Ingredientes, medidas, instrucciones, etc. |
| Aleatoria | `random.php` | Una receta sorpresa. |
| Catálogo inicial | `search.php?f=b` | Recetas que comienzan con B. |

**Los filtros están basados en campos reales:** `strCategory` y `strArea`. La búsqueda utiliza `strMeal` mediante la consulta `search.php?s`.

### Por qué se cruzan los filtros

La API gratuita de TheMealDB ofrece `filter.php?c=` y `filter.php?a=` individualmente, pero no una operación directa de *categoría Y región*. Cuando eliges ambas, el servicio obtiene las dos listas y hace la **intersección por `idMeal`**. Así se garantiza que cada resultado cumpla ambos criterios. Cuando escribes un nombre, se realiza búsqueda global por nombre y se aplica el filtro sobre los campos completos de cada receta recibida.

## 8. Cómo probar la aplicación (evidencia)

1. **Carga inicial:** abre `npm start`; aparecen tarjetas con imágenes de TheMealDB.
2. **Buscador:** escribe `chicken` o `pasta` en el buscador; comprueba que cambian las tarjetas.
3. **Filtro categoría:** limpia el texto y elige `Dessert`. Verás postres.
4. **Filtro región:** limpia categoría y selecciona `Italian`.
5. **Ambos filtros:** elige `Pasta` e `Italian`. Deben aparecer únicamente recetas que cumplan ambas condiciones (si la API las ofrece).
6. **Buscar con filtros:** escribe `chicken` y filtra `Chicken` (sin región, o una región compatible).
7. **Detalles:** pulsa `Ver receta` y revisa imagen, ingredientes, cantidades e instrucciones.
8. **Receta sorpresa:** pulsa el botón superior o lateral correspondiente.
9. **Paginación:** selecciona un filtro con más de 12 recetas y pulsa Siguiente y Anterior.
10. **Sin resultados:** escribe una cadena inventada, por ejemplo `zzzzreceta999`, y comprueba el mensaje.
11. **Error de conexión:** desconecta temporalmente Internet y busca algo nuevo; debe mostrarse error con botón de reintento.
12. **Pruebas automatizadas:** `npm test` desde VS Code.


## 9. Seguridad de Electron

- No se habilita Node.js en la página HTML (`nodeIntegration:false`).
- `contextIsolation:true` y `sandbox:true` mantienen aislados los contextos.
- `preload.js` solo publica funciones específicas para consultar recetas.
- Los manejadores IPC verifican el origen (ventana propia).
- Se bloquean navegaciones extra y permisos no requeridos.
- CSP limita scripts y carga de recursos, y los datos JSON se escapan al insertar HTML.

## 10. Posibles errores

**`node` o `npm` no se reconoce:** instalar Node.js LTS y abrir una terminal nueva.

**`npm.ps1` no se puede ejecutar:** utilizar `npm.cmd` o terminal CMD.

**`electron` no se reconoce:** ejecutar `npm install` desde la carpeta con `package.json`.

**La ventana está vacía:** asegurarse de abrir mediante `npm start`, no haciendo doble clic en `index.html`.

**Sin imágenes o API sin resultados:** confirmar acceso a Internet y a `https://www.themealdb.com`; algunos antivirus, redes educativas o bloqueos de red pueden impedir solicitudes HTTPS.

**La API muestra una lista limitada inicialmente:** el endpoint inicial es `search.php?f=b`; utiliza búsqueda/filtros para consultar otras recetas. El servicio gratuito no ofrece un listado general completo en una sola petición.

**El nombre del plato está en inglés:** la API devuelve contenido original en inglés y la app muestra los textos tal como vienen.

## 11. Consideraciones de la API

TheMealDB permite usar su clave de pruebas `1` para aprender y desarrollar. La versión gratuita no permite publicar aplicaciones en tiendas de aplicaciones sin suscripción como supporter. Consultar condiciones oficiales antes de distribuir comercialmente: https://www.themealdb.com/terms_of_use.php.

Este proyecto es un ejemplo académico y reconoce a TheMealDB como fuente de datos e imágenes.
