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
- [Cómo correrlo en local](#cómo-correrlo-en-local)
- [Documentación adicional](#documentación-adicional)
- [Roadmap](#roadmap)

---

## Contexto del ejercicio

> Caso de estudio N° 3 — Desarrollo de Sistemas Web (Back End), IFTS 29

Urbana Cult organiza eventos culturales y necesita un sistema que reemplace la gestión
por planillas sueltas de eventos y entradas, evitando la sobreventa y permitiendo saber
en todo momento cuántas localidades quedan disponibles por sala.

Para esta primera entrega no se requiere la aplicación completa: el foco está puesto en
API REST + persistencia + lógica de negocio + validaciones + manejo de errores, sin
interfaz gráfica, autenticación ni integraciones externas.

## Integrantes

Equipo **Commit & Chill**:

| Integrante | Módulo a cargo |
|---|---|
| Bravo, Julieta | Modificación de pug's + correciones técnicas & visuales |
| Mazzitelli, Matías | Sala (CRUD + baja lógica) |
| Piedrabuena, Julián | Entrada (CRUD) |
| Savia, Martín | Cliente (CRUD) + coordinación del equipo |

## Stack técnico

| Categoría | Tecnología |
|---|---|
| Lenguaje / Runtime | Node.js |
| Framework | Express 4 |
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
Controller     → valida el request, arma la respuesta y los status codes
   │
   ▼
Model          → lógica de acceso a datos (lee/escribe el .json correspondiente)
   │
   ▼
/data/*.json
```

```
├── controllers        # valida input, arma la respuesta HTTP
├── models             # acceso a los .json (uno por entidad)
├── routes             # definición de endpoints por recurso
├── middleware          # logger, notFound, errorHandler
├── data               # persistencia (clientes.json, salas.json, entradas.json, ...)
└── index.js           # arranque de la app y montaje de routers
```

## Reglas de negocio

- Cada entrada está asociada a un evento y a un cliente.
- Una entrada cancelada libera el lugar ocupado.
- Un evento finalizado no admite nuevas ventas.
- Una sala tiene una capacidad máxima: no pueden venderse más entradas que localidades
  disponibles.
- Las salas no se eliminan físicamente: se dan de baja (borrado lógico), para no perder
  el historial de eventos que tuvieron.

## Modelo de datos

**Cliente**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `number` | autogenerado |
| `nombre` | `string` | obligatorio |
| `apellido` | `string` | obligatorio |
| `email` | `string` | obligatorio, debe contener `@` |
| `telefono` | `string` | opcional |

**Sala**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `number` | autogenerado |
| `nombre` | `string` | obligatorio |
| `capacidad` | `number` | obligatorio |
| `direccion` | `string` | obligatorio |
| `estado` | `string` | `ACTIVA` / `INACTIVA` (borrado lógico) |

**Entrada**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `number` | autogenerado |
| `eventoId` | `number` | obligatorio |
| `clienteId` | `number` | obligatorio |
| `precio` | `number` | obligatorio |
| `estado` | `string` | `VALIDA` / `INVALIDA`, default `VALIDA` |

## Endpoints

**Clientes** — base path `/clientes`

| Método | Ruta | Descripción | Éxito | Errores |
|---|---|---|---|---|
| `GET` | `/` | Lista todos los clientes | `200 OK` | — |
| `GET` | `/:id` | Obtiene un cliente por id | `200 OK` | `404 Not Found` |
| `POST` | `/` | Crea un cliente | `201 Created` | `400 Bad Request` |
| `PUT` | `/:id` | Actualiza un cliente | `200 OK` | `400`, `404` |
| `DELETE` | `/:id` | Elimina un cliente | `204 No Content` | `404 Not Found` |

**Salas** — base path `/salas`

| Método | Ruta | Descripción | Éxito | Errores |
|---|---|---|---|---|
| `GET` | `/` | Lista todas las salas | `200 OK` | — |
| `GET` | `/:id` | Obtiene una sala por id | `200 OK` | `404 Not Found` |
| `GET` | `/nombre/:nombre` | Obtiene una sala por nombre | `200 OK` | `404 Not Found` |
| `POST` | `/` | Crea una sala | `201 Created` | `400 Bad Request` |
| `PUT` | `/:id` | Actualiza una sala | `200 OK` | `400`, `404` |
| `PUT` | `/dis/:id` | Habilita/deshabilita una sala (baja lógica) | `200 OK` | `404 Not Found` |

**Entradas** — base path `/entradas`

| Método | Ruta | Descripción | Éxito | Errores |
|---|---|---|---|---|
| `GET` | `/` | Lista todas las entradas | `200 OK` | — |
| `GET` | `/:id` | Obtiene una entrada por id | `200 OK` | `404 Not Found` |
| `POST` | `/` | Crea una entrada | `201 Created` | `400 Bad Request` |
| `PUT` | `/:id` | Actualiza una entrada | `200 OK` | `400`, `404` |
| `DELETE` | `/:id` | Elimina una entrada | `204 No Content` | `404 Not Found` |

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

## Cómo correrlo en local

**Prerrequisitos**: Node.js.

```bash
git clone https://github.com/mdev-repos/Backend-grupo-24.git
cd Backend-grupo-24
npm install
npm run dev
```

La API queda disponible en `http://localhost:3000`.

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
