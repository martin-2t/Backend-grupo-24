# 🎟️ Urbana Cult API

API REST para la gestión de eventos culturales y venta de entradas de **Urbana Cult** —
altas, consultas, actualización y baja de clientes, salas y entradas, evitando la
sobreventa por planillas separadas. Construida con **Node.js + Express**, siguiendo una
arquitectura en capas (Router → Controller → Model) con persistencia en archivos JSON.

Trabajo práctico grupal — Tecnicatura Superior en Desarrollo de Software (IFTS 29),
materia **Desarrollo de Sistemas Web (Back End)**, 2° cuatrimestre 2026. Caso de
estudio N° 3: *"Eventos y Entradas — Urbana Cult"*.

![Node.js](https://img.shields.io/badge/Node.js-express-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![JSON](https://img.shields.io/badge/Persistencia-JSON-informational)
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
- [Panel web](#panel-web)
- [Cómo correrlo en local](#cómo-correrlo-en-local)
- [Documentación adicional](#documentación-adicional)
- [Roadmap](#roadmap)

---

## Contexto del ejercicio

> Caso de estudio N° 3 — Desarrollo de Sistemas Web (Back End), IFTS 29

Urbana Cult organiza eventos culturales y necesita un sistema que reemplace la gestión
por planillas sueltas de eventos y entradas, evitando la sobreventa y permitiendo saber
en todo momento cuántas localidades quedan disponibles por sala.

El foco está puesto en API REST + persistencia + lógica de negocio + validaciones y
manejo de errores. Sobre esa base se sumó un panel web en Pug que consume los mismos
datos. No incluye autenticación ni integraciones externas.

## Integrantes

Equipo **Commit & Chill**:

| Integrante | Módulo a cargo |
|---|---|
| Bravo, Julieta | Ampliación del panel Pug + validaciones y refactor a MVC |
| Mazzitelli, Matías | Sala (CRUD + baja lógica) |
| Piedrabuena, Julián | Entrada (CRUD) |
| Savia, Martín | Cliente (CRUD) + coordinación del equipo |

## Stack técnico

| Categoría | Tecnología |
|---|---|
| Lenguaje / Runtime | Node.js |
| Framework | Express 4 |
| Vistas | Pug |
| Persistencia | Archivos JSON (`/data`) |
| Pruebas de endpoints | Thunder Client |

## Arquitectura

Arquitectura en capas clásica de Express, sin ORM: cada entidad separa Router,
Controller y Model, y el Model lee/escribe directamente su archivo JSON.

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
Model          → reglas de negocio + acceso a datos (lee/escribe su .json)
   │
   ▼
/data/*.json
```

```
├── controllers
│   ├── api            # responden JSON
│   └── paginas        # renderizan las vistas del panel
├── models             # reglas de negocio + acceso a los .json (uno por entidad)
├── routes             # definición de endpoints por recurso
├── views              # plantillas Pug del panel
├── middleware         # logger, notFound, errorHandler
├── public/css         # estilos del panel
├── data               # persistencia (clientes.json, salas.json, entradas.json, ...)
└── index.js           # arranque de la app y montaje de routers
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

**Cliente**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `number` | autogenerado |
| `nombre` | `string` | obligatorio, solo letras |
| `apellido` | `string` | obligatorio, solo letras |
| `email` | `string` | obligatorio, formato válido |
| `telefono` | `string` | opcional; si se carga, solo números y mínimo 10 dígitos |

**Sala**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `number` | autogenerado |
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
| `salaId` | `number` | obligatorio, la sala debe existir y estar `ACTIVA` |
| `precio` | `number` | obligatorio, mayor o igual a cero |
| `estado` | `string` | `PROGRAMADO` / `FINALIZADO` / `CANCELADO` |

**Entrada**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `number` | autogenerado |
| `eventoId` | `number` | obligatorio |
| `clienteId` | `number` | obligatorio |
| `precio` | `number` | obligatorio |
| `estado` | `string` | `VALIDA` / `RESERVADA` / `CANCELADA`, default `VALIDA` |

## Endpoints

**Raíz** — base path `/`

| Método | Ruta | Descripción | Éxito | Errores |
|---|---|---|---|---|
| `GET` | `/` | Índice del servicio: versión y recursos disponibles | `200 OK` | — |

**Clientes** — base path `/clientes`

| Método | Ruta | Descripción | Éxito | Errores |
|---|---|---|---|---|
| `GET` | `/` | Lista todos los clientes | `200 OK` | — |
| `GET` | `/:id` | Obtiene un cliente por id | `200 OK` | `404 Not Found` |
| `POST` | `/` | Crea un cliente | `201 Created` | `400 Bad Request` |
| `PUT` | `/:id` | Actualiza un cliente | `200 OK` | `400`, `404` |
| `DELETE` | `/:id` | Elimina un cliente | `204 No Content` | `400` (tiene entradas vigentes), `404` |

**Salas** — base path `/salas`

| Método | Ruta | Descripción | Éxito | Errores |
|---|---|---|---|---|
| `GET` | `/` | Lista todas las salas | `200 OK` | — |
| `GET` | `/:id` | Obtiene una sala por id | `200 OK` | `404 Not Found` |
| `GET` | `/nombre/:nombre` | Obtiene una sala por nombre | `200 OK` | `404 Not Found` |
| `POST` | `/` | Crea una sala | `201 Created` | `400 Bad Request` |
| `PUT` | `/:id` | Actualiza una sala | `200 OK` | `400`, `404` |
| `PUT` | `/dis/:id` | Habilita/deshabilita una sala (baja lógica) | `200 OK` | `400` (tiene eventos programados), `404` |

**Eventos** — base path `/eventos`

| Método | Ruta | Descripción | Éxito | Errores |
|---|---|---|---|---|
| `GET` | `/` | Lista todos los eventos | `200 OK` | — |
| `GET` | `/proximos` | Eventos programados con fecha futura | `200 OK` | — |
| `GET` | `/:id` | Obtiene un evento por id | `200 OK` | `404 Not Found` |
| `POST` | `/` | Crea un evento asociado a una sala | `201 Created` | `400`, `404` (sala inexistente) |
| `PUT` | `/:id` | Actualiza un evento | `200 OK` | `400`, `404` |
| `PUT` | `/:id/finalizar` | Marca el evento como finalizado | `200 OK` | `400` (no está programado), `404` |
| `PUT` | `/:id/cancelar` | Cancela el evento y sus entradas | `200 OK` | `400` (ya cancelado), `404` |

**Entradas** — base path `/entradas`

| Método | Ruta | Descripción | Éxito | Errores |
|---|---|---|---|---|
| `GET` | `/` | Lista todas las entradas | `200 OK` | — |
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
| `GET` | `/entradas-vendidas` | Entradas vendidas por cada evento | `200 OK` | — |
| `GET` | `/entradas-vendidas/:eventoId` | Entradas vendidas de un evento | `200 OK` | `404 Not Found` |
| `GET` | `/entradas-disponibles/:eventoId` | Capacidad, ocupados y disponibles | `200 OK` | `404 Not Found` |
| `GET` | `/eventos-proximos` | Eventos programados con fecha futura | `200 OK` | — |

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
  "id": 5,
  "nombre": "Teatro Colón",
  "capacidad": 2500,
  "direccion": "Cerrito 628",
  "estado": "ACTIVA"
}
```

</details>

<details>
<summary><strong>Ejemplo — crear una entrada</strong></summary>

`POST /entradas`

```json
{
  "eventoId": 1,
  "clienteId": 2,
  "precio": 15000
}
```

`201 Created`

```json
{
  "id": 1,
  "eventoId": 1,
  "clienteId": 2,
  "precio": 15000,
  "estado": "VALIDA"
}
```

</details>

## Panel web

Interfaz en Pug sobre los mismos datos, montada bajo `/panel`.

| Sección | Ruta | Qué permite |
|---|---|---|
| Inicio | `/panel` | Totales del sistema y próximos eventos |
| Eventos | `/panel/eventos` | Listado con disponibilidad, alta, edición, detalle con sus entradas, finalizar y cancelar |
| Salas | `/panel/salas` | Listado con búsqueda por nombre, alta, edición, detalle y baja/alta lógica |
| Clientes | `/panel/clientes` | Listado, alta, edición, detalle con historial de entradas y eliminación |
| Entradas | `/panel/entradas` | Listado con filtros, venta y reserva, confirmación, cancelación y corrección de precio |
| Consultas | `/panel/consultas` | Vendidas y disponibilidad por evento, y eventos próximos |

Los formularios HTML solo envían `GET` y `POST`, así que las acciones que en la API
son `PUT` (finalizar, cancelar, confirmar, dar de baja) en el panel se exponen como `POST`.

## Cómo correrlo en local

**Prerrequisitos**: Node.js.

```bash
git clone https://github.com/martin-2t/Backend-grupo-24.git
cd Backend-grupo-24
npm install
npm run dev
```

La API queda disponible en `http://localhost:3000` y el panel web en
`http://localhost:3000/panel`.

## Documentación adicional

La documentación completa de la entrega (integrantes, objetivos, alcance y capturas de
las pruebas con Thunder Client) está en el Google Drive del equipo — ver el documento
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
