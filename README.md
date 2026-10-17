# 🎟️ Urbana Cult API

API REST para la gestión de eventos culturales y venta de entradas de **Urbana Cult** -
altas, consultas, actualización y baja de clientes, salas y entradas, evitando la
sobreventa por planillas separadas. Construida con **Node.js + Express**, siguiendo una
arquitectura en capas (Router → Controller → Model) con persistencia en **MongoDB** mediante
**Mongoose**. *(Migración en curso: Sala, Cliente, Entrada y Usuario ya usan MongoDB; Evento todavía usa
un archivo JSON.)*

Trabajo práctico grupal - Tecnicatura Superior en Desarrollo de Software (IFTS 29),
materia **Desarrollo de Sistemas Web (Back End)**, 2° cuatrimestre 2026. Caso de
estudio N° 3: *"Eventos y Entradas - Urbana Cult"*.

![Node.js](https://img.shields.io/badge/Node.js-express-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white)
![Status](https://img.shields.io/badge/status-en%20desarrollo-yellow)

---

## Índice

- [Contexto del ejercicio](#contexto-del-ejercicio)
- [Integrantes](#integrantes)
- [Stack técnico](#stack-técnico)
- [Arquitectura](#arquitectura)
- [Reglas de negocio](#reglas-de-negocio)
- [Modelo de datos](#modelo-de-datos)
- [Endpoints](#endpoints)
- [Usuarios, roles y login](#usuarios-roles-y-login)
- [Panel web](#panel-web)
- [Cómo correrlo en local](#cómo-correrlo-en-local)
- [Documentación adicional](#documentación-adicional)
- [Roadmap](#roadmap)

---

## Contexto del ejercicio

> Caso de estudio N° 3 - Desarrollo de Sistemas Web (Back End), IFTS 29

Urbana Cult organiza eventos culturales y necesita un sistema que reemplace la gestión
por planillas sueltas de eventos y entradas, evitando la sobreventa y permitiendo saber
en todo momento cuántas localidades quedan disponibles por sala.

El foco está puesto en API REST + persistencia + lógica de negocio + validaciones y
manejo de errores. Sobre esa base se sumó un panel web en Pug que consume los mismos
datos. Incluye usuarios con roles y un login básico (sin sesiones ni tokens), y no tiene
integraciones externas.

## Integrantes

Equipo **Commit & Chill**:

| Integrante | Módulo a cargo |
|---|---|
| Bravo, Julieta | Ampliación del panel Pug + validaciones y refactor a MVC |
| Mazzitelli, Matías | Sala (CRUD + baja lógica) · Base para MongoDB (conexión, seed y manejo de errores), migración de Sala a MongoDB, alta de la base en MongoDB Atlas · Usuarios, roles y login |
| Piedrabuena, Julián | Entrada (CRUD) · migración de Entrada a MongoDB |
| Savia, Martín | Cliente (CRUD) + coordinación del equipo · migración de Cliente a MongoDB (Schema con Mongoose y validaciones, seed, vínculo con Entrada mediante clienteId como ObjectId) |

## Stack técnico

| Categoría | Tecnología |
|---|---|
| Lenguaje / Runtime | Node.js |
| Framework | Express 4 |
| Vistas | Pug |
| Persistencia | MongoDB + Mongoose (Sala, Cliente, Entrada y Usuario) · archivo JSON en `/data` (Evento, en migración) |
| Configuración | Variables de entorno con `dotenv` (archivo `.env`) |
| Pruebas de endpoints | Thunder Client |

## Arquitectura

Arquitectura en capas clásica de Express: cada entidad separa Router, Controller y
Model. El Model define el Schema de Mongoose y accede a su colección de MongoDB (o, mientras
dura la migración, a su archivo JSON). Todo el acceso a datos es asincrónico (`async`/`await`).

```
Cliente (JSON)
   │
   ▼
Router        → define las rutas y delega en el Controller
   │
   ▼
Controller     → valida la forma del request, elige el status y la respuesta
   │
   ▼
Model          → Schema + reglas de negocio + acceso a datos
   │
   ▼
MongoDB (Mongoose)
```

```
├── config             # conexión a MongoDB (db.js)
├── controllers
│   ├── api            # responden JSON
│   └── paginas        # renderizan las vistas del panel
├── models             # Schema + reglas de negocio + acceso a datos (uno por entidad)
├── routes             # definición de endpoints por recurso
├── views              # plantillas Pug del panel
├── middleware         # logger, notFound, errorHandler · auth, centro y compras (control de acceso)
├── public/css         # estilos del panel
├── data               # datos iniciales que carga el seed (y los .json aún no migrados)
├── scripts            # seed.js: carga /data en MongoDB
└── index.js           # conecta a MongoDB y levanta el servidor
```

## Reglas de negocio

- Cada entrada está asociada a un evento y a un cliente.
- Una entrada cancelada libera el lugar ocupado.
- Un evento finalizado o cancelado no admite nuevas ventas.
- Cancelar un evento cancela también sus entradas vendidas y reservadas.
- Una sala tiene una capacidad máxima: no pueden venderse más entradas que localidades
  disponibles.
- Las salas no se eliminan físicamente: se dan de baja (borrado lógico), para no perder
  el historial de eventos que tuvieron.
- Una sala con eventos programados no se puede dar de baja: primero hay que finalizarlos
  o cancelarlos.
- Una sala dada de baja no admite eventos nuevos ni venta de entradas.
- La capacidad de una sala no puede reducirse por debajo de los lugares ya ocupados.
- Un cliente con entradas vigentes no se puede eliminar: primero hay que cancelarlas.

## Modelo de datos

**Cliente** - colección `clientes` en MongoDB

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | `ObjectId` | autogenerado por MongoDB |
| `nombre` | `string` | obligatorio, solo letras |
| `apellido` | `string` | obligatorio, solo letras |
| `email` | `string` | obligatorio, formato válido |
| `telefono` | `string` | opcional; si se carga, solo números y mínimo 10 dígitos |

**Sala** - colección `salas` en MongoDB

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | `ObjectId` | autogenerado por MongoDB |
| `nombre` | `string` | obligatorio, solo letras, mínimo 4 caracteres |
| `capacidad` | `number` | obligatorio, entero, mínimo 10 |
| `direccion` | `string` | obligatorio, mínimo 4 caracteres |
| `estado` | `string` | `ACTIVA` / `INACTIVA` (borrado lógico) |

**Evento**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `number` | autogenerado |
| `nombre` | `string` | obligatorio, mínimo 4 caracteres |
| `descripcion` | `string` | opcional |
| `fecha` | `string` | obligatorio; al crear debe ser futura |
| `salaId` | `string` | obligatorio: el `_id` (ObjectId) de una sala existente y `ACTIVA` |
| `precio` | `number` | obligatorio, mayor o igual a cero |
| `estado` | `string` | `PROGRAMADO` / `FINALIZADO` / `CANCELADO` |

**Entrada** - colección `entradas` en MongoDB

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | `ObjectId` | autogenerado por MongoDB |
| `eventoId` | `number` | obligatorio (el evento todavía está en JSON) |
| `clienteId` | `ObjectId` | obligatorio, referencia a `clientes` |
| `precio` | `number` | obligatorio, mayor o igual a cero |
| `estado` | `string` | `VALIDA` / `RESERVADA` / `CANCELADA`, default `VALIDA` |

**Usuario** - colección `usuarios` en MongoDB

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | `ObjectId` | autogenerado por MongoDB |
| `nombre` | `string` | obligatorio |
| `email` | `string` | obligatorio, único, se guarda en minúsculas |
| `passwordHash` / `salt` | `string` | la contraseña se guarda con hash PBKDF2 + salt (como en la Clase 10); nunca se devuelven en las respuestas |
| `rol` | `string` | `ADMIN` / `EMPLEADO` / `CLIENTE` |
| `salaId` | `ObjectId` | obligatorio si es `EMPLEADO`: el centro donde trabaja |
| `clienteId` | `ObjectId` | obligatorio si es `CLIENTE`: su ficha en `clientes` |
| `estado` | `string` | `ACTIVO` / `SUSPENDIDO`, default `ACTIVO` |
| `intentosFallidos` / `bloqueadoHasta` | `number` / `date` | bloqueo temporal tras 3 logins fallidos |
| `ultimoAcceso` | `date` | fecha del último login correcto |

## Endpoints

Las rutas de escritura y las de información interna requieren el header `x-usuario-id` de un usuario
autorizado (ver [Usuarios, roles y login](#usuarios-roles-y-login)). Además de los errores de cada tabla,
responden `401` si no se envía un usuario válido y `403` si su rol no tiene permiso.

**Raíz** - base path `/`

| Método | Ruta | Descripción | Éxito | Errores |
|---|---|---|---|---|
| `GET` | `/` | Índice del servicio: versión y recursos disponibles | `200 OK` | - |

**Clientes** - base path `/clientes`

| Método | Ruta | Descripción | Éxito | Errores |
|---|---|---|---|---|
| `GET` | `/` | Lista todos los clientes | `200 OK` | - |
| `GET` | `/:id` | Obtiene un cliente por id | `200 OK` | `404 Not Found` |
| `POST` | `/` | Crea un cliente | `201 Created` | `400 Bad Request` |
| `PUT` | `/:id` | Actualiza un cliente | `200 OK` | `400`, `404` |
| `DELETE` | `/:id` | Elimina un cliente | `204 No Content` | `400` (tiene entradas vigentes), `404` |

**Salas** - base path `/salas`

| Método | Ruta | Descripción | Éxito | Errores |
|---|---|---|---|---|
| `GET` | `/` | Lista todas las salas | `200 OK` | - |
| `GET` | `/:id` | Obtiene una sala por id | `200 OK` | `404 Not Found` |
| `GET` | `/nombre/:nombre` | Obtiene una sala por nombre | `200 OK` | `404 Not Found` |
| `POST` | `/` | Crea una sala | `201 Created` | `400 Bad Request` |
| `PUT` | `/:id` | Actualiza una sala | `200 OK` | `400`, `404` |
| `PUT` | `/dis/:id` | Habilita/deshabilita una sala (baja lógica) | `200 OK` | `400` (tiene eventos programados), `404` |

**Eventos** - base path `/eventos`

| Método | Ruta | Descripción | Éxito | Errores |
|---|---|---|---|---|
| `GET` | `/` | Lista todos los eventos | `200 OK` | - |
| `GET` | `/proximos` | Eventos programados con fecha futura | `200 OK` | - |
| `GET` | `/:id` | Obtiene un evento por id | `200 OK` | `404 Not Found` |
| `POST` | `/` | Crea un evento asociado a una sala | `201 Created` | `400`, `404` (sala inexistente) |
| `PUT` | `/:id` | Actualiza un evento | `200 OK` | `400`, `404` |
| `PUT` | `/:id/finalizar` | Marca el evento como finalizado | `200 OK` | `400` (no está programado), `404` |
| `PUT` | `/:id/cancelar` | Cancela el evento y sus entradas | `200 OK` | `400` (ya cancelado), `404` |

**Entradas** — base path `/entradas`

| Método | Ruta | Descripción | Éxito | Errores |
|---|---|---|---|---|
| `GET` | `/` | Lista todas las entradas | `200 OK` | - |
| `GET` | `/:id` | Obtiene una entrada por id | `200 OK` | `404 Not Found` |
| `POST` | `/` | Vende una entrada (queda `VALIDA`) | `201 Created` | `400`, `404` |
| `POST` | `/reservar` | Reserva una entrada (queda `RESERVADA`) | `201 Created` | `400`, `404` |
| `PUT` | `/:id/confirmar` | Convierte una reserva en venta | `200 OK` | `400` (no está reservada), `404` |
| `PUT` | `/:id/cancelar` | Cancela la entrada y libera el lugar | `200 OK` | `400` (ya cancelada), `404` |
| `PUT` | `/:id` | Corrige el precio de una entrada | `200 OK` | `400`, `404` |
| `DELETE` | `/:id` | Elimina una entrada | `204 No Content` | `404 Not Found` |

**Consultas** — base path `/consultas`

| Método | Ruta | Descripción | Éxito | Errores |
|---|---|---|---|---|
| `GET` | `/entradas-vendidas` | Entradas vendidas por cada evento | `200 OK` | - |
| `GET` | `/entradas-vendidas/:eventoId` | Entradas vendidas de un evento | `200 OK` | `404 Not Found` |
| `GET` | `/entradas-disponibles/:eventoId` | Capacidad, ocupados y disponibles | `200 OK` | `404 Not Found` |
| `GET` | `/eventos-proximos` | Eventos programados con fecha futura | `200 OK` | - |

<details>
<summary><strong>Ejemplo — crear una sala</strong></summary>

`POST /salas`

```json
{
  "nombre": "Teatro Colón",
  "capacidad": 2500,
  "direccion": "Cerrito 628"
}
```

`201 Created`

```json
{
  "_id": "6acf79f31fc328eb410c87c0",
  "nombre": "Teatro Colón",
  "direccion": "Cerrito 628",
  "capacidad": 2500,
  "estado": "ACTIVA"
}
```

</details>

<details>
<summary><strong>Ejemplo — crear una entrada</strong></summary>

`POST /entradas` con el header `x-usuario-id: 05e000000000000000000002` (empleada del Centro Cultural
Flores, donde se realiza el evento 1)

```json
{
  "eventoId": 1,
  "clienteId": "5a1c00000000000000000002",
  "precio": 15000
}
```

`201 Created`

```json
{
  "_id": "6ad3c7e0199a54967ed80911",
  "eventoId": 1,
  "clienteId": "5a1c00000000000000000002",
  "precio": 15000,
  "estado": "VALIDA"
}
```

</details>

## Usuarios, roles y login

Login básico **sin sesiones ni tokens**, por indicación de la cátedra para esta etapa:

1. `POST /auth/login` valida email y contraseña contra MongoDB (hash PBKDF2, igual que el login de la Clase 10) y devuelve el usuario con su `_id` y su `rol`.
2. Para operar sobre rutas protegidas, el cliente envía ese `_id` en el header `x-usuario-id`.
3. El middleware `autenticar` busca al usuario en la base en cada petición (y rechaza a los suspendidos y bloqueados); `permitir(...roles)` controla el rol (**RBAC**) y `soloSuCentro` limita a cada empleado a su propio centro (**ABAC**: control por atributos).

**Intentos fallidos:** al tercer login fallido la cuenta queda **bloqueada 15 minutos** (se desbloquea
sola al vencer, o antes si un `ADMIN` usa `PUT /usuarios/:id/desbloquear`). Cada error informa cuántos
intentos quedan, y un login correcto reinicia el contador. Mientras dura el bloqueo tampoco se puede
operar con el header.

> **Limitación conocida:** cualquiera que conozca un `_id` puede enviarlo en el header. Se resuelve
> en la próxima etapa con sesiones o JWT.

**Autenticación** — base path `/auth`

| Método | Ruta | Descripción | Éxito | Errores |
|---|---|---|---|---|
| `POST` | `/login` | Login con `{ email, password }` | `200 OK` | `400`, `401` (credenciales), `403` (suspendido o bloqueado) |
| `POST` | `/registro` | Alta de un cliente web: crea (o reutiliza) su ficha y su usuario `CLIENTE` | `201 Created` | `400`, `409` (email repetido) |
| `GET` | `/yo` | Usuario del header `x-usuario-id` | `200 OK` | `401`, `403` |
| `GET` | `/mis-entradas` | Entradas del cliente logueado (solo `CLIENTE`) | `200 OK` | `401`, `403` |

**Usuarios** — base path `/usuarios` (solo `ADMIN`): `GET /`, `GET /:id`, `POST /`, `PUT /:id` (incluye
suspender con `{ "estado": "SUSPENDIDO" }`), `PUT /:id/desbloquear` y `DELETE /:id`. Errores: `400`,
`404`, `409` (email repetido).

### Matriz de permisos

| Acción | Sin login | CLIENTE | EMPLEADO | ADMIN |
|---|---|---|---|---|
| Ver salas, eventos, próximos y disponibilidad | ✅ | ✅ | ✅ | ✅ |
| Crear y dar de baja salas | ❌ | ❌ | ❌ | ✅ |
| Editar una sala | ❌ | ❌ | solo la suya | ✅ |
| Crear, editar, finalizar y cancelar eventos | ❌ | ❌ | solo de su centro | ✅ |
| Comprar / vender y reservar entradas | ❌ | para sí mismo | solo de su centro | ✅ |
| Confirmar, cancelar y corregir entradas | ❌ | ❌ | solo de su centro | ✅ |
| Ver una entrada | ❌ | solo las propias | solo de su centro | ✅ |
| Gestionar clientes y ver ventas | ❌ | ❌ | ✅ | ✅ |
| Eliminar clientes y entradas · gestionar usuarios | ❌ | ❌ | ❌ | ✅ |

**Compra web vs. boletería:** cuando compra un `CLIENTE`, el `clienteId` y el precio se toman de su
usuario y del evento (no del body). En boletería, el `EMPLEADO` puede enviar un `clienteId` o los datos
del comprador en `"cliente": { nombre, apellido, email, telefono }`: si ya existe un cliente con ese
email se usa su ficha; si no, se crea en el momento.

### Usuarios de prueba (los carga `npm run seed`)

| Email | Contraseña | Rol |
|---|---|---|
| `admin@urbanacult.com` | `admin1234` | ADMIN |
| `empleado.flores@urbanacult.com` | `flores1234` | EMPLEADO - Centro Cultural Flores |
| `empleado.usina@urbanacult.com` | `usina1234` | EMPLEADO - La Usina de Colegiales |
| `empleado.palermo@urbanacult.com` | `palermo1234` | EMPLEADO - suspendido (para probar el bloqueo) |
| `juanperez@mail.com` | `cliente1234` | CLIENTE |
| `tomasaguirre@mail.com` | `cliente1234` | CLIENTE |

Son credenciales de prueba para desarrollo; en la base se guardan con hash.

## Panel web

Interfaz en Pug sobre los mismos datos, montada bajo `/panel`.

| Sección | Ruta | Qué permite |
|---|---|---|
| Ingresar | `/panel/login` | Login: muestra el rol, sus permisos y el id para operar por la API |
| Crear cuenta | `/panel/registro` | Registro web de clientes |
| Inicio | `/panel` | Totales del sistema y próximos eventos |
| Eventos | `/panel/eventos` | Listado con disponibilidad, alta, edición, detalle con sus entradas, finalizar y cancelar |
| Salas | `/panel/salas` | Listado con búsqueda por nombre, alta, edición, detalle y baja/alta lógica |
| Clientes | `/panel/clientes` | Listado, alta, edición, detalle con historial de entradas y eliminación |
| Entradas | `/panel/entradas` | Listado con filtros, venta y reserva, confirmación, cancelación y corrección de precio |
| Consultas | `/panel/consultas` | Vendidas y disponibilidad por evento, y eventos próximos |

Los formularios HTML solo envían `GET` y `POST`, así que las acciones que en la API
son `PUT` (finalizar, cancelar, confirmar, dar de baja) en el panel se exponen como `POST`.

Sin sesiones, el panel no puede "recordar" quién ingresó al pasar de una página a otra, por eso
el control de roles se aplica en la API. El panel queda como herramienta interna hasta incorporar
sesiones.

## Cómo correrlo en local

**Prerrequisitos**: Node.js **20.19 o superior** (lo exige Mongoose 9) y una base MongoDB (local o en MongoDB Atlas).

```bash
git clone https://github.com/martin-2t/Backend-grupo-24.git
cd Backend-grupo-24
npm install
cp .env.example .env    # y completar MONGODB_URI
npm run seed            # carga los datos iniciales y los usuarios de prueba (vacía las colecciones antes)
npm run dev
```

La API queda disponible en `http://localhost:3000` y el panel web en
`http://localhost:3000/panel`.

Para una base MongoDB local con Docker (en `.env`, descomentar la línea local de `.env.example`):

```bash
docker run -d --name urbana-mongo -p 127.0.0.1:27017:27017 mongo:8
```

Con **MongoDB Atlas**, reemplazar `MONGODB_URI` en `.env` por la cadena de conexión que da
Atlas. El archivo `.env` no se sube al repositorio.

En el equipo, cada integrante desarrolla sobre **su propia base** dentro del mismo cluster de
Atlas (por ejemplo, `urbana-cult-martin`), así `npm run seed` nunca borra datos ajenos. La base
`urbana-cult` es la compartida, para integrar y para las pruebas finales.

## Documentación adicional

La documentación completa de la entrega (integrantes, objetivos, alcance y capturas de
las pruebas con Thunder Client) está en el Google Drive del equipo - ver el documento
`DSWB_24_COMMIT&CHILL_2C26`.

## Roadmap

- [x] CRUD de Cliente
- [x] CRUD de Sala + baja lógica
- [x] CRUD de Entrada
- [x] Módulo de Eventos (CRUD, asociado a una sala)
- [x] Validación de capacidad máxima al vender entradas
- [x] Consultas de negocio (entradas vendidas, entradas disponibles, eventos próximos)
- [x] Cancelación de entradas con liberación del lugar
- [x] Reserva de entradas y confirmación de la reserva
- [x] Panel web en Pug con CRUD completo sobre los mismos datos
- [x] Validaciones de campo compartidas por la API y el panel
- [x] Reglas de integridad entre sala, evento y entrada
- [x] Base para MongoDB: conexión con Mongoose, variables de entorno, seed y manejo de errores de Mongoose
- [x] Sala migrada a MongoDB
- [x] Cliente migrado a MongoDB
- [x] Entrada migrada a MongoDB
- [x] Usuarios con roles (ADMIN, EMPLEADO, CLIENTE), login básico y control de acceso (RBAC + centro propio)
- [ ] Evento migrado a MongoDB
- [ ] Proyecto migrado de CommonJS a ES Modules (ECMAScript)
- [ ] Sesiones o JWT (próxima etapa)
