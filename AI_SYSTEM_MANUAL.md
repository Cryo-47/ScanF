# ScanF - Documentación Integral del Sistema y Manual Técnico para IAs y Desarrolladores

> **Propósito de este documento:** Este archivo contiene toda la arquitectura, lógica operativa, integraciones cloud (Supabase y Power Automate / SharePoint), mecanismos ocultos, credenciales, estructura de datos y catálogo de botones de la aplicación **ScanF**. Diseñado para que cualquier agente de IA (Claude Code, Cursor, ChatGPT, etc.) o ingeniero de software pueda auditar, extender o mantener el sistema sin romper ninguna funcionalidad preexistente.

---

## 1. Resumen Ejecutivo y Propósito de ScanF

**ScanF** es un sistema de escaneo industrial de códigos QR diseñado específicamente para el levantamiento de inventarios físicos en almacenes fiscales (campaña 2026), optimizado para terminales portátiles (**Zebra TC26**) con lector láser integrado de código de barras, así como para paneles de supervisión y gerencia vía web.

### Objetivos Clave del Sistema:
1. **Captura ultra rápida:** Respuesta en menos de 50 ms por escaneo láser mediante emulación de teclado (DataWedge).
2. **Sincronización Dual Simultánea:**
   - **SharePoint Excel (vía Power Automate Webhook):** Inserta cada registro en tablas designadas (`TablaConteo1`, `TablaConteo2`, `TablaConteo3`) del archivo corporativo `Scaneo fiscal 2026.xlsx`.
   - **Supabase Cloud (PostgreSQL / PostgREST):** Almacena en tiempo real los registros en `inventory_scans`, gestiona sesiones de dispositivos en `terminal_sessions` y centraliza el control de rondas en `inventory_round_control`.
3. **Control Cíclico de Inventario por Rondas:**
   - **1er Conteo:** Barrido inicial de todas las ubicaciones y racks.
   - **2do Conteo:** Re-conteo de discrepancias, con autorización individual por operador controlada por Gerencia.
   - **3er Conteo Extraordinario:** Desempates y validaciones finales.
4. **Prevención Estricta de Duplicados:**
   - Si un localizador (ubicación/rack) ya fue escaneado dentro de la **misma ronda**, la app emite una alarma, limpia las casillas de texto y bloquea la subida.
   - Si el mismo localizador se escanea en una **ronda posterior** (2do o 3er conteo), se **permite** sin restricción.

---

## 2. Pila Tecnológica (Tech Stack)

* **Framework Frontend:** React 19 + TypeScript.
* **Empaquetador y Servidor Dev:** Vite 8.
* **Estilos y Diseño:** Tailwind CSS v4 con paleta dark mode industrial (Zinc/Slate/Amber/Emerald).
* **Iconografía:** `lucide-react`.
* **Efectos y Microinteracciones:** `canvas-confetti` y `motion` (Framer Motion).
* **Decodificador QR:** Parser personalizado optimizado para strings industriales concatenados por guion bajo `_` y soporte para `html5-qrcode`.
* **Audio y Háptica:** Web Audio API sintético (`soundManager` en `src/utils/audioHaptics.ts`) para pitidos de éxito, alerta de duplicado y error en almacén sin requerir archivos de audio externos.
* **Despliegue y Distribución:**
  * **Versión Web:** GitHub Pages / Cloud Run.
  * **Versión Handheld (APK):** Empaquetado PWA a través de PWABuilder (Android TWA / WebView).

---

## 3. Arquitectura de Dos Apartados (Modos de Ejecución)

La aplicación tiene dos modos de visualización y comportamiento radicalmente distintos, determinados automáticamente por el entorno o por el rol del usuario:

### APARTADO 1: Modo Operador / Terminal APK (Zebra TC26)

Este modo se activa automáticamente si la app detecta que se ejecuta dentro del APK de Android, en modo standalone o cuando el rol asignado es `OPERADOR_APK`.

#### Características del Modo APK:
* **Cero distracciones:** Se **ocultan todas las pestañas de navegación** (`Historial Excel`, `Enlace SharePoint`). El operador no puede salir de la pantalla del escáner.
* **Pantalla Completa Glove-Friendly:** Botones de gran tamaño táctil (mínimo 48px–56px de alto) pensados para uso con guantes industriales.
* **Captura de Láser Invisible (Hardware Keystroke Wedge):**
  - Un `input` invisible con `autoFocus` y debouncing intercepta las ráfagas rápidas enviadas por el perfil DataWedge del Zebra TC26.
  - Soporta inyección de texto por ráfaga rápida o evento `Enter` final.
* **Estructura Estándar del Código QR:**
  ```text
  SKU_Cantidad_Descripcion_Subinventario_Localizador
  ```
  *Ejemplo:* `C0520-00_15_SARTEN FLAVORSTONE_LINEA_A-3-6`
* **Las 5 Casillas de Captura:**
  1. **SKU / Código del Producto:** Se bloquea tras escanear para evitar alteraciones accidentales. *(Excepción: Fila 1 Picking).*
  2. **Cantidad:** Número de piezas inventariadas.
  3. **Descripción:** Nombre del producto (editable o auto-rellenado).
  4. **Subinventario:** Identificador (por defecto `LINEA`).
  5. **Localizador (Rack / Bin):** Ubicación física con estructura Rack-Columna-Fila (ej. `A-22-1`). Editable con validación automática.
* **Regla Especial de Picking - Fila 1:**
  - Estructura: `Letra de Rack - Columna - Fila` (ej. `A-22-1`, `B-4-1`, `L-12-01`). Si el último segmento corresponde a la fila 1 (nivel suelo / picking), la app detecta `isPickingFila1(localizador)`.
  - Muestra un banner ámbar: *“Ubicación de Picking Detectada: Fila 1”* y **desbloquea automáticamente la casilla de SKU** para permitir corrección o entrada manual del código.
  - **Validación Inmediata de Duplicados en Ingreso Manual:** Al teclear o editar manualmente el localizador o el SKU, el sistema valida inmediatamente en `onBlur`, `Enter` y en el botón de subida (consultando memoria local y Supabase). Si el localizador ya existe en la misma ronda, vacía las casillas y dispara la alerta sonora e interactiva de duplicado.
* **Registro Inicial de Handheld (`HandheldCheckInModal`):**
  - Al iniciar por primera vez o tras un reinicio de Gerencia, la terminal exige:
    1. Nombre completo del operador (mínimo 3 letras).
    2. Selección de un número de usuario del **1 al 10**.
  - **Candado de concurrencia:** No se permite que dos dispositivos seleccionen el mismo número de usuario. Los números ocupados se muestran bloqueados en tiempo real gracias a la tabla `terminal_sessions` de Supabase.
  - Una vez elegido, el número queda vinculado a la terminal durante todo el conteo.
* **Pantalla de Bloqueo en 2do Conteo (`isBlockedInRound2`):**
  - Si Gerencia pasa el sistema al 2do conteo pero no ha autorizado individualmente a ese número de usuario, la pantalla del escáner se bloquea mostrando: *“Usuario X: En espera de asignación para 2do Conteo”*.

---

### APARTADO 2: Modo Web / Gerente y Master Dashboard

Este modo se activa cuando se accede desde un navegador web de escritorio o portátil.

#### Características del Modo Gerente / Master:
* **Barra de Navegación Completa:** Pestañas de `Escáner`, `Historial Excel` y `Enlace SharePoint` (esta última exclusiva del rol `MASTER`).
* **Panel de Control de Rondas (`GerenteRoundControl`):**
  - Permite cambiar la ronda global (`1er Conteo`, `2do Conteo`, `3er Conteo Extraordinario`, `Finalizado`).
  - Habilita o deshabilita autorizaciones para el 2do conteo de manera masiva o por usuario.
* **Panel de Asignación Individual (`GerenteUserAssignmentPanel`):**
  - Muestra tarjetas para los 10 usuarios (Usuario 1 a Usuario 10).
  - Permite a Gerencia avanzar o regresar a un operador individualmente de ronda sin afectar al resto del equipo.
* **Monitoreo en Tiempo Real de Terminales (`DeviceMonitoringPanel`):**
  - Tarjetas en vivo para cada terminal conectada con estado online/inactivo (latido cada 10 s).
  - Métricas de piezas contadas, total de escaneos y último localizador escaneado.
* **Gestión de Sesiones y Reinicio Remoto:**
  - Botón para forzar re-login individual a una terminal.
  - Botón para reiniciar todas las terminales masivamente.

---

## 4. Botones Ocultos, Atajos y Contraseñas

### 1. El Gesto Secreto de los 12 Toques (Acceso Master)
* **Dónde está:** En el logotipo principal **`ScanF`** en la esquina superior izquierda del encabezado (`Header.tsx`).
* **Cómo se activa:** Tocar o hacer clic **12 veces consecutivas** sobre el logo en un lapso menor a **2.5 segundos**.
* **Qué hace:** Emite un tono de éxito y despliega la ventana modal `MasterAuthModal` protegida por PIN.

### 2. Contraseña / PIN Maestro por Defecto
* **PIN por defecto:** `1234`
* **Almacenamiento:** `localStorage.getItem('tc26_master_pin_v2')`.
* **Capacidades al autenticar como Master:**
  1. Configuración de credenciales Supabase (URL y Anon Key).
  2. Configuración de Webhook de Power Automate para SharePoint.
  3. Cambio de rol entre `OPERADOR_APK`, `GERENTE` y `MASTER`.
  4. Respaldo manual masivo de escaneos locales hacia Supabase.
  5. Edición y prueba de endpoints en vivo.

### 3. Detección Forzada de Modo APK mediante URL
Si se requiere probar el comportamiento de terminal Zebra en un navegador web, se pueden usar los siguientes parámetros en la URL:
* `https://tu-app.com/?mode=apk`
* `https://tu-app.com/?apk=1`
* `https://tu-app.com/?twa=1`
* `https://tu-app.com/?source=pwa`

Esto activa `STORAGE_KEYS.IS_APK = 'true'` y oculta los paneles administrativos.

---

## 5. Catálogo Completo de Botones y su Función

### En la Vista del Escáner (`ScannerView.tsx`):
1. **Subir Información a Excel (Verde):**
   - Valida que los 5 campos tengan datos.
   - Ejecuta validación canónica de localizador duplicado local y en Supabase Cloud.
   - Si no hay duplicado, genera un UUID v4, emite confeti, limpia las casillas y envía en segundo plano el escaneo a SharePoint y Supabase.
2. **Reintentar (Ámbar):**
   - Abre modal de confirmación para limpiar las casillas de texto si el código leído fue incorrecto.
3. **Aceptar y Continuar (Modal de Localizador Duplicado):**
   - Cierra la alerta de advertencia y devuelve el foco al lector láser.
4. **Selector de Terminal / Usuario (Barra Superior):**
   - Si no está bloqueado, abre el diálogo `HandheldCheckInModal` para seleccionar nombre y número de usuario.
5. **Divisor de SKU / Código Largo (Botón tijeras):**
   - Si el SKU contiene guiones bajos (pegado accidental de un QR completo en la casilla de SKU), lo desglosa y distribuye automáticamente en los 5 campos.

### En la Vista de Historial / Panel de Gerente (`HistoryView.tsx`):
1. **Forzar Re-login a Todas las TC26 (Ámbar superior):**
   - Envía la señal global `deviceRebootAt` a Supabase.
   - Obliga a todas las terminales conectadas a cerrar sesión, volver al 1er Conteo y pedir nombre y usuario nuevamente.
2. **Pedir Usuario / Re-login (Individual por tarjeta de usuario):**
   - Envía la orden remota `userReboots[userNumber]` y marca la sesión con `status: 'force_relogin'`.
   - La terminal de ese usuario específico se reinicia a 1er Conteo y abre el formulario de identificación.
3. **Habilitar Todos R2 / Deshabilitar Todos R2:**
   - Otorga o revoca permiso masivo a todos los usuarios para participar en el 2do conteo.
4. **Interruptor R2 por Usuario (Switch Verde/Gris):**
   - Autoriza o bloquea individualmente al Usuario 1..10 para el 2do conteo.
5. **Avanzar a 2do Conteo / Volver a 1er Conteo (Botones por usuario):**
   - Cambia la ronda activa de un usuario específico en `inventory_round_control`.
6. **Refrescar desde Supabase (Azul):**
   - Descarga de inmediato la lista autoritativa de escaneos y sesiones en vivo desde Supabase Cloud.
7. **Descargar copia Excel (.CSV):**
   - Exporta todos los escaneos acumulados en un archivo `.csv` local compatible con Excel.
8. **Borrar QR de Supabase / Borrar todos los escaneos (Rojo):**
   - Elimina todos los registros de la tabla `inventory_scans` en Supabase.
   - Emite la señal `globalResetAt` para que ninguna terminal re-suba sus datos viejos (evita el bucle de borrado).
   - Opcionalmente reinicia las sesiones de terminales en vivo.
9. **Editar Enlace Directo a Excel:**
   - Permite al Gerente actualizar la URL que abre el archivo `.xlsx` en la nube de SharePoint.

### En el Panel Master (`MasterAuthModal.tsx` / `PowerAutomateConfig.tsx`):
1. **Guardar Configuración Power Automate:** Guarda y sincroniza la URL del webhook en Supabase (`sharepoint_settings`).
2. **Probar Webhook:** Envía un payload de prueba `TEST-SKU` para verificar que Power Automate responda HTTP 200/202.
3. **Guardar Supabase:** Valida y guarda la URL del proyecto y la Anon Key.
4. **Probar Conexión Supabase:** Ejecuta un `SELECT` a la tabla `inventory_scans` para medir latencia y confirmar permisos RLS.
5. **Subir Escaneos Locales a Supabase (Respaldo):** Envía uno por uno los escaneos almacenados en la memoria local hacia la nube.
6. **Cerrar Sesión Master:** Restablece el rol a Operador o Gerente.

---

## 6. Conexión con Supabase Cloud

### Configuración por Defecto:
* **URL:** `https://rocvksztovacylltjopq.supabase.co/rest/v1/`
* **Anon Key (JWT):**
  ```text
  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvY3Zrc3p0b3ZhY3lsbHRqb3BxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxMzMzMjQsImV4cCI6MjEwODcwOTMyNH0.PH9vUDFX92GF24RRX_dL2x5lCg7mzLapllUolMiiXkw
  ```

### Tablas Utilizadas:

#### 1. `inventory_scans`
Almacena todos los registros de inventario capturados por todas las terminales.
* **Columnas:**
  * `id` (VARCHAR / UUID, Primary Key)
  * `fecha_hora` (TIMESTAMPTZ)
  * `sku` (VARCHAR)
  * `cantidad` (INTEGER)
  * `descripcion` (TEXT)
  * `subinventario` (VARCHAR)
  * `localizador` (VARCHAR)
  * `ronda_conteo` (VARCHAR: `'1ER_CONTEO'`, `'2DO_CONTEO'`, `'3ER_CONTEO'`)
  * `operador` (VARCHAR: `'Usuario 1'`, etc.)
  * `dispositivo` (VARCHAR: `'TC26 - Terminal 01'`, etc.)
  * `user_number` (INTEGER: `1` a `10`)
  * `codigo_qr_raw` (TEXT)
  * `sync_state_sharepoint` (VARCHAR: `'synced'`, `'pending'`, `'failed'`)
  * `created_at` (TIMESTAMPTZ)

#### 2. `terminal_sessions`
Permite el monitoreo en vivo de qué terminal y operador está activo, en qué ronda va y cuántas piezas lleva contadas.
* **Columnas:**
  * `device_id` (VARCHAR, Primary Key)
  * `device_name` (VARCHAR)
  * `operator_name` (VARCHAR)
  * `user_number` (INTEGER)
  * `current_round` (VARCHAR)
  * `total_scans` (INTEGER)
  * `total_piezas` (INTEGER)
  * `last_sku` (VARCHAR)
  * `last_locator` (VARCHAR)
  * `last_active` (TIMESTAMPTZ)
  * `status` (VARCHAR: `'online'`, `'force_relogin'`, `'reset'`)

#### 3. `inventory_round_control`
Fila singleton con `id = 'global_control'` que actúa como bus de comandos entre Gerencia y todas las terminales Zebra.
* **Campos JSON:**
  * `global_round`: Ronda global del sistema.
  * `user_rounds`: Diccionario `{ "1": "1ER_CONTEO", "2": "2DO_CONTEO", ... }`.
  * `round2_authorizations`: Diccionario `{ "1": true, "2": false, ... }`.
  * `global_reset_at`: Timestamp ISO emitido cuando Gerente borra datos.
  * `device_reboot_at`: Timestamp ISO de reinicio masivo.
  * `user_reboots`: Diccionario `{ "1": "2026-11-06T...", ... }` para reinicios individuales.

#### 4. `sharepoint_settings`
Fila con `id = 'global_settings'` que sincroniza la URL del webhook de Power Automate y la URL directa del archivo Excel para que todas las terminales compartan la misma configuración sin tener que configurarlas una a una.

---

## 7. Conexión con Power Automate a SharePoint Excel

### Flujo de Integración:
1. El usuario presiona *"Subir Información a Excel"*.
2. La app genera el payload y realiza una petición `POST` al endpoint del Webhook de Power Automate.
3. El flujo de Power Automate toma el JSON, determina la tabla de destino (`TablaConteo1`, `TablaConteo2`, `TablaConteo3`) según la ronda y agrega la fila en el archivo `Scaneo fiscal 2026.xlsx` alojado en SharePoint / OneDrive.

### Configuración por Defecto del Webhook:
* **Webhook URL:**
  ```text
  https://defaultaa53848cce8346e7a4f67e95722c78.ff.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/03/workflows/2a1f4e5624d6473191e1243e7582b634/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=3v5hb8UU1C-4RCT_fp4x-xbkPTSt4C9F-Nn1WVhBLnc
  ```
* **Archivo Excel Destino:** `Scaneo fiscal 2026.xlsx`
* **Sitio SharePoint:** `https://cvdirectomexico-my.sharepoint.com/personal/darien_perez_cvdirecto_mx`

### Formato Exacto del JSON Payload Enviado a Power Automate:
```json
{
  "id_escaneo": "a3b8c4d2-1234-4567-89ab-cdef01234567",
  "fecha_hora": "2026-11-06T19:30:00.000Z",
  "sku": "C0520-00",
  "cantidad": 15,
  "descripcion": "SARTEN FLAVORSTONE",
  "subinventario": "LINEA",
  "localizador": "A-3-6",
  "ronda_conteo": "1er Conteo",
  "conteo_hoja": "Conteo 1",
  "operador": "Usuario 3",
  "dispositivo": "TC26 - Terminal 51",
  "codigo_qr_raw": "C0520-00_15_SARTEN FLAVORSTONE_LINEA_A-3-6"
}
```
*Nota sobre el operador en Excel:* El valor de `operador` en Excel siempre refleja el número asignado (`Usuario X`), cumpliendo la directiva de control de auditores.

---

## 8. Historial de Mejoras Críticas Implementadas

Durante las auditorías y sesiones de estabilización se corrigieron fallos de arquitectura mayores:

### 1. Detección Canónica de Localizadores Duplicados
* **Problema anterior:** La verificación fallaba porque `syncCloudData` se ejecutaba cada 4 segundos y sobrescribía ciegamente la memoria local con los datos de Supabase antes de que el escaneo nuevo fuera confirmado, vaciando la lista de comparación.
* **Solución aplicada:**
  - `syncCloudData` ahora realiza un **merge seguro**: preserva escaneos locales pendientes (`syncStateSharepoint === 'pending'`) o realizados en los últimos 5 minutos.
  - Validación híbrida: al escanear, se evalúa en memoria (0 ms) y en paralelo se consulta a Supabase mediante `checkCloudDuplicateLocalizador` (< 250 ms) para evitar que dos terminales escaneen el mismo localizador simultáneamente.
  - Al detectar duplicado, **se limpian automáticamente las 5 casillas**, suena la alerta y se despliega la ventana modal indicando hora, operador previo y ronda.
  - **Segregación estricta de rondas:** El localizador duplicado se bloquea **únicamente si pertenece a la misma ronda**. Si se escaneó en 1er Conteo y la terminal está en 2do o 3er Conteo, la app **lo permite libremente**.

### 2. Eliminación del Bucle Infinito de Borrado en Supabase
* **Problema anterior:** Cuando Gerencia borraba la tabla de Supabase, las terminales conectadas que aún tenían escaneos en `localStorage` creían que a la nube le faltaban datos y re-subían todo automáticamente, provocando que los datos borrados volvieran a aparecer infinitamente.
* **Solución aplicada:**
  - Ninguna terminal re-sube datos viejos automáticamente.
  - Al presionar *"Borrar QR de Supabase"*, Gerencia emite un `globalResetAt` a través de `inventory_round_control`.
  - Todas las terminales activas detectan la marca de tiempo más reciente, limpian su memoria y su `localStorage` a cero de forma coordinada.

### 3. Conexión de los Botones de Re-login y Cierre de Sesión
* **Problema anterior:** El botón *"Cerrar sesión de Usuario X y pedir nombre y usuario en 1er conteo"* no hacía nada porque las funciones `onResetUserDevice` y `onResetAllDevices` no estaban pasadas como props a `HistoryView` en `App.tsx`.
* **Solución aplicada:**
  - Se crearon los controladores `handleResetUserDevice` y `handleResetAllDevices` en `App.tsx` y se pasaron a `HistoryView`.
  - Ahora, al presionar el botón y confirmar *"Sí, Forzar Re-login"*, la terminal remota recibe la señal en menos de 4 segundos, desbloquea el usuario, regresa a `1ER_CONTEO` y despliega la pantalla de check-in para ingresar nombre y seleccionar usuario nuevamente.

### 4. Blindaje contra Valores Nulos
* Todas las comparaciones de texto (`localizador`, `sku`, `conteoRound`) utilizan normalización segura:
  ```typescript
  (s.localizador || '').trim().toUpperCase() === cleanLoc
  ```
  evitando excepciones `TypeError: Cannot read properties of undefined (reading 'trim')`.

### 5. Poka-Yoke 4: Cola de Auto-Reintento Silencioso de Subidas a SharePoint (Offline Auto-Retry Queue)
* **Objetivo:** Garantizar cero pérdida de registros ante caídas de señal Wi-Fi o datos celulares en el almacén.
* **Mecanismo:**
  - Si un escaneo no logra conectar con Power Automate o queda en estado `pending` o `failed`, se guarda localmente en `localStorage`.
  - Un proceso en segundo plano en `App.tsx` revisa la cola cada 15 segundos y ante eventos de reconexión (`online`, `visibilitychange`), reintentando en lotes controlados (FIFO de hasta 3 registros por lote) mediante `retryPendingScansQueue`.
  - En la interfaz de `ScannerView` se muestra un indicador amigable: `⏳ X registros pendientes en cola de envío a Excel [Reintentar]` para permitir tanto la sincronización silenciosa automática como el reintento manual inmediato al pulsar el botón.

### 6. Poka-Yoke 5: Modo Escaneo Rápido con Auto-Confirmación (Auto-Upload 1.5s)
* **Objetivo:** Maximizar el rendimiento de conteo masivo eliminando la necesidad de tocar la pantalla tras cada escaneo válido con la pistola láser Zebra TC26.
* **Mecanismo:**
  - El operador puede activar o desactivar libremente el interruptor `⚡ Auto-Subida (1.5s) / Manual` en la barra superior del escáner (guardado en `localStorage`).
  - Al escanear un QR válido no duplicado, se pueblan las 5 casillas y se inicia una cuenta regresiva animada de 1.5 segundos con barra de progreso y botón `[✕ Cancelar]`. Al finalizar los 1.5s, se dispara la subida a Excel automáticamente.
  - Si el operador presiona `[✕ Cancelar]` o toca/edita cualquier casilla, la cuenta regresiva se detiene de inmediato dejando las casillas intactas para revisión manual.
  - **Excepción Poka-Yoke Crítica para Fila 1 (Picking):** Si el localizador corresponde a Fila 1 (ej. `A-22-1`), la auto-subida **NO se dispara automáticamente**. La aplicación pausa el temporizador y notifica al operador para que verifique físicamente las piezas y escriba/verifique el SKU antes de subir.

---

## 9. Convenciones de Código y Reglas de Mantenimiento para Futuras IAs

1. **NO modificar ni eliminar la detección secreta de 12 toques** en el logo `ScanF`. Es el único mecanismo de rescate del Master en terminales bloqueadas.
2. **NO mostrar pestañas ni menús en modo `OPERADOR_APK`.** Las handhelds deben permanecer en la vista de escáner.
3. **NO reactivar re-subidas automáticas masivas a Supabase** sin acción explícita del usuario para no reintroducir el bucle de borrado.
4. **Respetar la regla de Fila 1 (Picking):** Mantener el formato `Rack-Columna-Fila` y pausar la auto-subida para verificación manual de SKU en nivel 1.
5. **Mantener la no-dependencia de librerías nativas pesadas:** Toda la háptica y sonido debe seguir funcionando mediante la Web Audio API estándar para garantizar compatibilidad con Zebra TC26 sin requerir plugins de Cordova/Capacitor.
