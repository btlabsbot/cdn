# 🪐 LynxNodes CDN

CDN distribuido en fase **beta**, estructurado como **monorepo con npm
workspaces**: una red de nodos de cacheo/edge (`cdn-engine`) coordinados
por un gateway central (`api-gateway`) que expone su estado a través de un
dashboard (`lynx-hub`). Código y mensajes en español.

## 🏗️ Arquitectura
```
lynx-shared  →  cdn-engine (cachea/sirve contenido)
                     │  se registra y manda heartbeat
                     ▼
             api-gateway (registra nodos, autentica, persiste en disco)
                     ▲
                     │  consulta login + estado de nodos
             lynx-hub (dashboard en vivo, Next.js)
```

- **`cdn-engine`** 🌐 — nodo edge (Express). Cachea en memoria peticiones a
  orígenes externos vía `/proxy` (estrategia LRU) y sirve archivos propios
  subidos vía `/upload` / `GET /:filename`, funcionando como origin/edge
  estático. Cada instancia se identifica con `NODE_ID` y `NODE_REGION`; el
  despliegue soporta N instancias en paralelo (ver "Segundo nodo").
- **`api-gateway`** 🛰️ — servicio de control (Express). Recibe registro y
  heartbeat de cada `cdn-engine`, persiste el estado de la flota en disco,
  y gestiona autenticación (credenciales, emisión/verificación de sesión)
  para el dashboard y las rutas de gestión de archivos.
- **`lynx-hub`** 📊 — frontend (Next.js App Router). Dashboard de estado de
  nodos, flujo de login/registro, e interfaz de subida de archivos que
  habla directamente contra `cdn-engine`.
- **`shared`** 📦 — paquete interno (`@lynxnodes/shared`) con tipos, schemas
  de validación y utilidades de auth (cookies, firma/verificación de
  sesión) compartidos entre `api-gateway` y `cdn-engine`, para garantizar
  un contrato de datos y esquema de sesión consistentes entre ambos.

## 📁 Estructura del repositorio
```
lynxnodes-cdn/
├── README.md                  # este archivo
├── package.json              # raíz del monorepo (npm workspaces + script "dev")
├── tsconfig.base.json        # config de TypeScript compartida
└── packages/
    ├── shared/                # tipos, schemas y auth compartidos
    │   └── src/
    │       ├── auth/          # cookies.ts, session.ts (firma/verifica lynx_session)
    │       ├── schemas/       # validación (auth.schema.ts, node.schema.ts)
    │       └── types/         # node.types.ts, cache.types.ts
    │
    ├── cdn-engine/             # el "nodo" CDN (Express, puerto 8080)
    │   └── src/
    │       ├── cache/          # LRU en memoria (strategies/lru.ts, storage/memory.ts)
    │       ├── storage/        # assetStore.ts — archivos subidos, persistidos en disco
    │       ├── routes/         # proxy.ts, upload.ts, assets.ts, health.ts
    │       ├── services/       # gatewayClient.ts — registro + heartbeat al gateway
    │       ├── middleware/     # cors.ts, logging.ts, requireAuth.ts
    │       └── server.ts, index.ts
    │
    ├── api-gateway/            # panel central (Express, puerto 3000)
    │   └── src/
    │       ├── controllers/    # auth.controller.ts, nodes.controller.ts
    │       ├── services/       # auth.service.ts, node.service.ts, store.ts,
    │       │                   # credentialStore.ts
    │       ├── routes/v1/      # auth.routes.ts, nodes.routes.ts
    │       ├── middleware/     # requireAuth.ts, errorHandler.ts
    │       └── config/env.ts, index.ts
    │
    └── lynx-hub/                # dashboard (Next.js App Router, puerto 3001)
        ├── app/
        │   ├── page.tsx         # portada
        │   ├── login/           # inicio de sesión
        │   ├── register/        # alta (deshabilitado por defecto)
        │   ├── dashboard/        # lista de nodos en vivo
        │   ├── upload/           # subir/gestionar archivos
        │   └── settings/         # cuenta / restablecer contraseña
        ├── components/            # AuthCard, Banner, FormField, PageHeader...
        └── lib/                   # apiClient.ts, useRequireAuth.ts
```

## 🔄 Flujo de datos
1. **Arranque de un nodo**: al iniciar, `cdn-engine` llama a
   `services/gatewayClient.ts`, que hace `POST /api/v1/nodes` contra
   `api-gateway` para registrarse (id, región, URL) y luego repite un
   `POST /api/v1/nodes/:id/heartbeat` cada `HEARTBEAT_INTERVAL_MS`
   (10s por defecto) para reportar sus stats de caché.
2. **Persistencia en el gateway**: `api-gateway` guarda ese registro en
   `packages/api-gateway/data/nodes.json`, así que un nodo ya conocido
   reaparece tras reiniciar (solo espera su próximo heartbeat).
3. **Login**: `lynx-hub` pide credenciales en `/login`; `api-gateway` las
   valida contra `packages/api-gateway/data/auth.json` (solo guarda
   salt+hash) y emite la cookie firmada `lynx_session`. Esa misma cookie la
   verifican **tanto** `api-gateway` **como** `cdn-engine` (por eso
   `AUTH_SECRET` debe ser idéntico en ambos) — así las rutas de archivos en
   el `cdn-engine` también quedan protegidas, no solo el dashboard.
4. **Dashboard**: con sesión activa, `lynx-hub` consulta
   `GET /api/v1/nodes` para pintar la lista de nodos y su estado
   (`cacheHitRate`, región, última vez visto, etc.) en `/dashboard`.
5. **Cache de proxy**: `GET /proxy?url=...` en `cdn-engine` cachea en
   memoria (LRU) la respuesta del origen externo y responde con
   `X-Cache: MISS` (primera vez) o `X-Cache: HIT` (repetidas).
6. **Subida y servido de archivos**: `POST /upload` (multipart, campo
   `file`) guarda el archivo en disco vía `storage/assetStore.ts`
   (persiste entre reinicios, a diferencia del caché LRU), y queda
   accesible al instante en `GET /:filename` — el "router de dominio" que
   sirve cada archivo por su nombre, como un CDN estático real.

## 🔌 Qué endpoints expone cada servicio

**`api-gateway` (puerto 3000, prefijo `/api/v1`)**

| Ruta | Método | Auth | Qué hace |
|---|---|---|---|
| `/auth/config` | GET | No | Config pública (p.ej. si el registro está activo) |
| `/auth/login` | POST | No | Inicia sesión, emite cookie `lynx_session` |
| `/auth/register` | POST | No* | Alta de cuenta (*rechazada si `ALLOW_REGISTRATION` no es `true`) |
| `/auth/logout` | POST | No | Cierra sesión |
| `/auth/me` | GET | Sí | Datos del usuario logueado |
| `/auth/change-password` | POST | Sí | Cambia contraseña |
| `/nodes` | POST | No* | Un `cdn-engine` se registra a sí mismo (*sin sesión, es máquina a máquina) |
| `/nodes` | GET | Sí | Lista de nodos para el dashboard |
| `/nodes/:id` | GET | Sí | Detalle de un nodo |
| `/nodes/:id/heartbeat` | POST | No* | Un `cdn-engine` reporta su estado (*idem) |

**`cdn-engine` (puerto 8080)**

| Ruta | Método | Auth | Qué hace |
|---|---|---|---|
| `/health` | GET | No | Estado del nodo + stats de caché |
| `/proxy?url=...` | GET | No | Cachea y sirve contenido de un origen externo |
| `/upload` | POST | Sí | Sube un archivo (form-data, campo `file`) |
| `/upload` | GET | Sí | Lista los archivos subidos |
| `/upload/:filename` | DELETE | Sí | Borra un archivo |
| `/:filename` | GET | No | Sirve un archivo ya subido (catch-all, va al final) |

## 🚀 Puesta en marcha

### 1️⃣ Instalar dependencias
Monorepo con **npm workspaces**, instalación única desde la raíz:
```powershell
npm install
```

### 2️⃣ Levantar el stack completo
```powershell
npm run dev
```

Ejecuta `concurrently`, que levanta `api-gateway` (puerto 3000), una
instancia de `cdn-engine` (puerto 8080, `GATEWAY_URL=http://localhost:3000`)
y `lynx-hub` (puerto 3001) en un solo proceso, con logs prefijados por
servicio (`gateway`, `cdn-engine`, `hub`).

`Ctrl+C` en esa terminal termina los tres procesos.

En `http://localhost:3001` se sirve el dashboard; el nodo `node-local-1`
aparece automáticamente tras el registro y primer heartbeat.

### 3️⃣ Verificación manual del cache (opcional)
```powershell
Invoke-RestMethod http://localhost:8080/health
Invoke-WebRequest "http://localhost:8080/proxy?url=https://httpbin.org/json" -UseBasicParsing | Select-Object -ExpandProperty Headers
```
Primera vez: `X-Cache: MISS`. Repite la llamada: `X-Cache: HIT`.

### 3.1 📤 Subida de archivos y routing por nombre
`cdn-engine` acepta subidas y sirve cada archivo directamente por su
nombre (routing estático):

```powershell
# Subir un archivo (form-data, campo "file")
Invoke-RestMethod -Uri http://localhost:8080/upload -Method Post -Form @{ file = Get-Item .\imagen.png }

# Queda disponible al instante en:
# http://localhost:8080/imagen.png

# Listar todo lo subido
Invoke-RestMethod http://localhost:8080/upload
```

Interfaz de subida drag-and-drop en `http://localhost:3001/upload`.

Los archivos se guardan en `packages/cdn-engine/uploads/` (configurable con
`UPLOADS_DIR`) y persisten entre reinicios, a diferencia del cache LRU de
`/proxy`, que es solo en memoria.

### 3.2 🔐 Autenticación
`/dashboard` y `/upload` requieren sesión activa. `npm run dev` provisiona
credenciales por defecto:

```
usuario:     admin
contraseña:  admin
```

Configurables en el primer arranque vía variables de entorno en
`api-gateway` (solo se leen la primera vez, ver nota debajo):

```powershell
$env:ADMIN_USERNAME="tu-usuario"; $env:ADMIN_PASSWORD="tu-contraseña"
```

> ⚠️ **Persistencia de credenciales:** en el primer arranque, `api-gateway`
> toma `ADMIN_USERNAME`/`ADMIN_PASSWORD` (default `admin`/`admin`) y crea
> la cuenta inicial en `packages/api-gateway/data/auth.json` (solo
> salt + hash, sin texto plano). A partir de ahí esas variables se ignoran
> para esa cuenta; el cambio de contraseña se hace desde
> **Panel → Cuenta → Restablecer contraseña** y persiste entre reinicios.
> Para resetear por completo, eliminar el archivo y reiniciar
> `api-gateway`.

El registro de cuentas está **deshabilitado por defecto**: `/login` no
expone el enlace de registro, `/register` devuelve un aviso en lugar del
formulario, y la API rechaza la petición aunque se invoque directamente.
Habilitarlo permite que cualquier cliente con acceso a la URL cree una
cuenta con acceso completo al panel (lectura de nodos, subida/borrado de
archivos):

```powershell
$env:ALLOW_REGISTRATION="true"
```

La sesión es una cookie firmada (`lynx_session`) emitida por `api-gateway`
en login/registro y verificada tanto por `api-gateway` como por
`cdn-engine` con el mismo secreto, lo que extiende la protección a las
rutas de gestión de archivos (`GET/POST /upload`, `DELETE /upload/:filename`)
además del dashboard. Requiere **`AUTH_SECRET` idéntico en ambos
servicios**:

```powershell
$env:AUTH_SECRET="una-cadena-larga-y-aleatoria"
```

Sin definir, ambos servicios usan el mismo valor de desarrollo por defecto
para que `npm run dev` funcione sin configuración adicional — 🚫 no apto
para producción.

Rutas sin autenticación por diseño: `POST /api/v1/nodes` y
`POST /api/v1/nodes/:id/heartbeat` (llamadas machine-to-machine desde
`cdn-engine`, sin sesión de navegador), y `GET /:filename` en `cdn-engine`
(servir un archivo subido es el propósito del link público del CDN).

### 4️⃣ Segundo nodo (opcional)

`npm run dev` levanta un solo nodo por defecto. Para añadir uno más, en
una terminal aparte:

```powershell
cd packages\cdn-engine
$env:NODE_ID="node-local-2"; $env:NODE_REGION="eu-west"; $env:PORT="8081"; $env:GATEWAY_URL="http://localhost:3000"; npm run dev
```

Solicitar contenido distinto (`/proxy?url=...` en el `:8081`) hace divergir
su `cacheHitRate` del primero, visible en el dashboard.

### 5️⃣ 💾 Persistencia
`api-gateway` persiste el registro de nodos en
`packages/api-gateway/data/nodes.json`. Tras un reinicio de `npm run dev`,
los nodos previamente conocidos reaparecen con el mismo `id`, a la espera
del siguiente heartbeat del `cdn-engine` correspondiente.

Verificación:
```powershell
Get-Content packages\api-gateway\data\nodes.json
```
Al relanzar `npm run dev`, el log de `gateway` reporta
`loaded 1 node(s) from ...`.

## 🛠️ Utilidades CLI (`lynxcdn`)

El proyecto incluye un script de utilidades para gestionar la configuración global del entorno. Puedes invocarlo desde la raíz del monorepo usando `npm run lynxcdn`:

- **`npm run lynxcdn reset`**
  Borra la configuración guardada actualmente en el archivo `lynxnodes.config.json`.
- **`npm run lynxcdn reset --yes`**
  Ejecuta el borrado de la configuración sin pedir confirmación por consola (ideal para usarlo de forma automatizada en scripts o pipelines de CI).
- **`npm run lynxcdn config`**
  Muestra en pantalla la configuración que está guardada en este momento.
- **`npm run lynxcdn help`**
  Muestra el panel de ayuda con este menú de comandos disponibles.
  
## ⚠️ Estado actual (beta)
- El cache del `/proxy` sigue siendo solo en memoria (LRU); los archivos
  subidos por `/upload` sí persisten en disco (`storage/assetStore.ts`)
- `ttl.ts` — solo LRU, sin expiración por tiempo ⏱️
- `rateLimit.ts` — sin protección todavía 🛡️
- `lynx-term` (CLI) — pendiente 🚧
- Nodos caídos no se marcan `offline` automáticamente (se quedan congelados
  en su último estado conocido si dejan de mandar heartbeat)

### 🗺️ Roadmap
Catch en `api-gateway` para marcar `offline` a nodos sin heartbeat
reciente (umbral configurable, ej. 30s) y reflejarlo en el dashboard, en
lugar de mantener el último estado indefinidamente.

## 🧰 Stack
- **Backend**: Node.js + Express + TypeScript (`api-gateway`, `cdn-engine`)
- **Frontend**: Next.js 14 (App Router) + React 18 (`lynx-hub`)
- **Monorepo**: npm workspaces + `concurrently` para levantar todo con un
  solo `npm run dev`
- **Auth**: cookie de sesión firmada (`lynx_session`), sin dependencias
  externas de auth
