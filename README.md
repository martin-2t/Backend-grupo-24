<p align="center">
  <img src="docs/commit-chill.svg" alt="Logo de Commit &amp; Chill, equipo 24" width="220">
</p>

# 🎟️ Urbana Cult API

API REST y panel web para la gestión de eventos culturales y la venta de entradas de **Urbana Cult**. Reemplaza las planillas separadas por un único sistema que controla en todo momento cuántos lugares quedan en cada evento y evita la sobreventa, incluso con compras simultáneas.

Trabajo práctico grupal de la Tecnicatura Superior en Desarrollo de Software (IFTS 29), materia **Desarrollo de Sistemas Web (Back End)**, 2° cuatrimestre 2026. Caso de estudio N° 3, *Eventos y Entradas - Urbana Cult*. Equipo 24 | Commit & Chill.

![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white)
![Tests](https://img.shields.io/badge/tests-380%20passing-brightgreen)
![Cobertura](https://img.shields.io/badge/cobertura-94%25-brightgreen)

---

## Índice

- [Qué hace](#qué-hace)
- [Equipo](#equipo)
- [Stack técnico](#stack-técnico)
- [Arquitectura](#arquitectura)
- [Reglas de negocio](#reglas-de-negocio)
- [Modelo de datos](#modelo-de-datos)
- [Autenticación y roles](#autenticación-y-roles)
- [Endpoints](#endpoints)
- [Panel web](#panel-web)
- [Asistente de cartelera](#asistente-de-cartelera)
- [Cómo correrlo en local](#cómo-correrlo-en-local)
- [Tests](#tests)
- [Despliegue](#despliegue)

---

## Qué hace

- **Cartelera y salas.** Eventos asociados a una sala con capacidad máxima, que se pueden crear, editar, finalizar y cancelar.
- **Venta sin sobreventa.** Cada evento tiene un contador de lugares ocupados que se actualiza con operaciones atómicas de MongoDB, así dos compras simultáneas del último lugar no pueden vender de más.
- **Compra web con retención.** El cliente elige hasta 6 entradas, el sistema le retiene los lugares durante 10 minutos, y al pagar (simulado) recibe sus entradas con un código QR.
- **Boletería.** El personal de cada centro vende, reserva, confirma y cancela entradas, y carga clientes.
- **Ingreso con QR.** Cada entrada se valida una sola vez, y solo el día del evento, desde el panel o por la API.
- **Cinco roles con control de acceso.** ADMIN, REPRESENTANTE, EMPLEADO, AUDITOR y CLIENTE, con permisos por rol y por centro.
- **Consultas de negocio.** Entradas vendidas, lugares disponibles, eventos próximos, y para ADMIN y AUDITOR las compras web en curso y las no concretadas.
- **Asistente de cartelera.** Un chat con Gemini que responde en lenguaje natural qué eventos hay y cuántos lugares quedan.

## Equipo

**Commit & Chill (equipo 24)**

| Integrante | GitHub | Aporte principal |
|---|---|---|
| Bravo, Julieta | [@julietanatbravo](https://github.com/julietanatbravo) | Tests automáticos y cobertura |
| Mazzitelli, Matías | [@mdev-repos](https://github.com/mdev-repos) | Control de sobreventa y retención de lugares |
| Piedrabuena, Julián | [@juliganSW](https://github.com/juliganSW) | Diseño responsive y UX/UI del panel |
| Savia, Martín | [@martin-2t](https://github.com/martin-2t) | Login seguro con JWT |

## Stack técnico

| Categoría | Tecnología |
|---|---|
| Runtime y módulos | Node.js 22, ES Modules (`import` / `export`) |
| Framework | Express 4 |
| Vistas | Pug |
| Base de datos | MongoDB Atlas con Mongoose 9 |
| Autenticación | Passport (estrategia local, solo para el login) y JWT firmado con HS256 |
| Contraseñas | PBKDF2 con sal |
| Códigos QR | `qrcode` |
| Asistente | API de Gemini, llamada con `fetch` nativo |
| Tests | Jest, Supertest y mongodb-memory-server |
| Despliegue | Vercel (serverless) |
| Configuración | Variables de entorno con `dotenv` |

## Arquitectura

Arquitectura en capas de Express. Cada entidad separa Router, Controller y Model, y todo el acceso a datos es asincrónico. Si algo falla, el Controller pasa el error con `next(error)` y un middleware central arma la respuesta.

```
Cliente (JSON o navegador)
   |
   v
Router        define las rutas y encadena los middlewares de acceso
   |
   v
Controller    valida la forma del request y elige el status
   |
   v
Model         Schema, reglas de negocio y acceso a datos
   |
   v
MongoDB (Mongoose)
```

```
├── app.js              # arma la aplicación Express (sin levantar el servidor)
├── index.js            # carga el .env, conecta a MongoDB y levanta el servidor
├── config              # conexión a MongoDB, JWT y Passport
├── controllers
│   ├── api             # responden JSON
│   └── paginas         # renderizan las vistas del panel
├── models              # Schema, reglas de negocio y acceso a datos
├── routes              # endpoints de la API y rutas del panel
├── middleware          # autenticación, roles, centro, compras, límite del asistente y errores
├── views               # plantillas Pug
├── public              # estilos y scripts del panel
├── scripts             # seed y datos iniciales en JSON
├── tests               # unitarios, integración y helpers
└── docs                # imágenes del README
```

## Reglas de negocio

- Cada entrada pertenece a un evento y a un cliente.
- No se pueden vender más entradas que la capacidad de la sala. El control es atómico, así que se cumple aunque haya compras simultáneas.
- Un evento finalizado o cancelado no admite nuevas ventas.
- Cancelar un evento anula sus entradas vendidas y reservadas, y vence las compras web en curso.
- Una entrada cancelada libera su lugar.
- Las salas no se borran, se dan de baja. Una sala con eventos programados no se puede dar de baja, y una sala dada de baja no admite eventos nuevos.
- La capacidad de una sala no puede bajar de los lugares ya ocupados en uno de sus eventos.
- Un cliente con entradas vigentes no se puede eliminar.
- Las entradas del cliente se validan una sola vez en la puerta, y solo el día del evento.
- Al tercer login fallido la cuenta se bloquea 15 minutos, o hasta que un administrador la desbloquee.

**Estados de la entrada**

| Estado | Significado |
|---|---|
| `VALIDA` | Entrada vendida. |
| `USADA` | Ya se validó en el ingreso. |
| `RESERVADA` | Reserva de boletería, el lugar está guardado y se paga al retirarla. No vence. |
| `RETENIDA` | Lugar apartado mientras un cliente completa una compra web. Dura 10 minutos y todavía no es una entrada. |
| `VENCIDA` | Compra web que no se concretó, porque se venció el tiempo o el cliente la canceló. Es un dato para las métricas del negocio. |
| `CANCELADA` | Anulada por fuerza mayor. |

Las retenciones vencen al consultar, sin ningún proceso en segundo plano, porque en Vercel no queda un servidor corriendo. El cliente nunca ve las entradas `RETENIDA` ni `VENCIDA`, y el personal de los centros tampoco ve las `RETENIDA`. El ADMIN y el AUDITOR ven todas.

## Modelo de datos

Cinco colecciones en MongoDB. Todas usan el `_id` (ObjectId) que genera la base, y las relaciones se guardan como ObjectId con `ref`.

**Sala** (`salas`)

| Campo | Tipo | Notas |
|---|---|---|
| `nombre` | `string` | obligatorio, solo letras, mínimo 4 caracteres |
| `capacidad` | `number` | entero, mínimo 10 |
| `direccion` | `string` | obligatorio, mínimo 4 caracteres |
| `estado` | `string` | `ACTIVA` o `INACTIVA` (baja lógica) |

**Cliente** (`clientes`)

| Campo | Tipo | Notas |
|---|---|---|
| `nombre`, `apellido` | `string` | obligatorios, solo letras |
| `email` | `string` | obligatorio, formato válido |
| `telefono` | `string` | opcional, solo números y mínimo 10 dígitos |

**Evento** (`eventos`)

| Campo | Tipo | Notas |
|---|---|---|
| `nombre` | `string` | obligatorio, mínimo 4 caracteres |
| `descripcion` | `string` | opcional |
| `fecha` | `Date` | obligatoria, futura al crear |
| `salaId` | `ObjectId` (ref `Sala`) | una sala existente y activa |
| `precio` | `number` | mayor o igual a cero |
| `estado` | `string` | `PROGRAMADO`, `FINALIZADO` o `CANCELADO` |
| `lugaresOcupados` | `number` | contador atómico de lugares vendidos, reservados o retenidos |

**Entrada** (`entradas`)

| Campo | Tipo | Notas |
|---|---|---|
| `eventoId` | `ObjectId` (ref `Evento`) | un evento programado |
| `clienteId` | `ObjectId` (ref `Cliente`) | un cliente existente |
| `precio` | `number` | si no se envía, toma el precio del evento |
| `estado` | `string` | ver la tabla de estados, `VALIDA` por defecto |
| `codigo` | `string` | código aleatorio único que va dentro del QR |
| `compraId` | `ObjectId` | agrupa las entradas de una misma compra web |
| `venceEn` | `Date` | hasta cuándo se retiene el lugar, solo en `RETENIDA` |
| `usadaEn`, `validadaPor` | `Date`, `ObjectId` | cuándo se validó el ingreso y qué usuario lo hizo |

**Usuario** (`usuarios`)

| Campo | Tipo | Notas |
|---|---|---|
| `nombre` | `string` | obligatorio |
| `email` | `string` | único, se guarda en minúsculas |
| `passwordHash`, `salt` | `string` | PBKDF2 con sal, nunca se devuelven en las respuestas |
| `rol` | `string` | `ADMIN`, `REPRESENTANTE`, `EMPLEADO`, `AUDITOR` o `CLIENTE` |
| `salaId` | `ObjectId` | obligatorio para REPRESENTANTE y EMPLEADO, es su centro |
| `clienteId` | `ObjectId` | obligatorio para CLIENTE, es su ficha |
| `estado` | `string` | `ACTIVO` o `SUSPENDIDO` |
| `intentosFallidos`, `bloqueadoHasta` | `number`, `Date` | bloqueo temporal tras 3 logins fallidos |
| `ultimoAcceso` | `Date` | fecha del último login correcto |

## Autenticación y roles

**Cómo se inicia sesión.** `POST /auth/login` valida el email y la contraseña con la estrategia local de Passport, y si son correctos firma un JWT (HS256, dura 2 horas por defecto). El token se entrega en una cookie `httpOnly` para el panel y también en el cuerpo de la respuesta, para usarlo como `Authorization: Bearer <token>` desde Thunder Client o Postman.

**Por qué Passport solo en el login y sin sesiones.** La aplicación corre en Vercel, donde no hay memoria compartida entre peticiones, así que la identidad viaja en el token. Passport resuelve únicamente la verificación de credenciales.

**Capas de control de acceso**, que se aplican en este orden en cada ruta protegida:

1. `autenticar` verifica la firma y el vencimiento del token y vuelve a buscar al usuario en la base, para que uno suspendido o bloqueado pierda el acceso aunque su token siga vigente.
2. `permitir(...roles)` controla el rol (RBAC).
3. `soloSuCentro` limita al personal a lo que pasa en su propio centro (ABAC).
4. `entradaPropia` hace que un cliente solo pueda ver sus entradas.

### Matriz de permisos

| Acción | ADMIN | REPRESENTANTE | EMPLEADO | AUDITOR | CLIENTE |
|---|---|---|---|---|---|
| Usuarios | Todos | Empleados de su centro | No | Ver | No |
| Salas: crear y dar de baja | Sí | No | No | No | No |
| Salas: editar | Sí | Solo la suya | No | No | No |
| Salas: ver | Todas | Solo la suya | Solo la suya | Todas | No |
| Eventos: crear, editar y finalizar | No | Su centro | No | No | No |
| Eventos: cancelar | Sí (fuerza mayor) | Su centro | No | No | No |
| Eventos: ver | Todos | Todos | Todos | Todos | Cartelera |
| Boletería: vender y reservar | No | Su centro | Su centro | No | No |
| Boletería: confirmar y cancelar | No | Su centro | Su centro | No | No |
| Entradas: ver | Toda la red | Su centro | Su centro | Toda la red | Las suyas |
| Clientes: cargar y editar | No | Sí | Sí | No | No |
| Clientes: ver | Sí | Sí | Sí | Sí | No |
| Borrado físico de clientes y entradas | Sí | No | No | No | No |
| Consultas | Toda la red | Su centro | Su centro | Toda la red | No |
| Ingreso con QR en la puerta | No | Su centro | Su centro | No | No |
| Compra web | No | No | No | No | Sí |

El ADMIN es la gestión de la plataforma, por eso no opera la boletería ni la programación de los centros. El AUDITOR es de solo lectura.

### Usuarios de prueba

Los carga `npm run seed`. Son credenciales de desarrollo y en la base se guardan con hash.

| Email | Contraseña | Rol |
|---|---|---|
| `admin@urbanacult.com` | `admin1234` | ADMIN |
| `representante.flores@urbanacult.com` | `representante1234` | REPRESENTANTE de Centro Cultural Flores |
| `representante.usina@urbanacult.com` | `representante1234` | REPRESENTANTE de La Usina de Colegiales |
| `empleado.flores@urbanacult.com` | `flores1234` | EMPLEADO de Centro Cultural Flores |
| `empleado.usina@urbanacult.com` | `usina1234` | EMPLEADO de La Usina de Colegiales |
| `empleado.palermo@urbanacult.com` | `palermo1234` | EMPLEADO suspendido, para probar el bloqueo |
| `auditoria@urbanacult.com` | `auditor1234` | AUDITOR |
| `juanperez@mail.com` | `cliente1234` | CLIENTE |
| `tomasaguirre@mail.com` | `cliente1234` | CLIENTE |

## Endpoints

Las rutas protegidas esperan la cookie `token` o el header `Authorization: Bearer <token>`. Además de los errores de cada tabla, responden `401` si falta un token válido y `403` si el rol no tiene permiso. `GET /` devuelve un índice de lo que ofrece el servicio.

**Autenticación** `/auth`

| Método | Ruta | Descripción | Éxito |
|---|---|---|---|
| `POST` | `/login` | Login con `{ email, password }`, devuelve el token y el usuario | `200` |
| `POST` | `/logout` | Borra la cookie de sesión | `200` |
| `POST` | `/registro` | Alta de un cliente web, crea su ficha y su usuario | `201` |
| `GET` | `/yo` | Usuario autenticado | `200` |
| `GET` | `/mis-entradas` | Entradas del cliente logueado | `200` |

**Usuarios** `/usuarios`

| Método | Ruta | Descripción | Quién |
|---|---|---|---|
| `GET` | `/`, `/:id` | Listar y obtener | ADMIN, AUDITOR |
| `POST` | `/` | Crear | ADMIN |
| `PUT` | `/:id` | Actualizar o suspender con `{ "estado": "SUSPENDIDO" }` | ADMIN |
| `PUT` | `/:id/desbloquear` | Quitar el bloqueo por intentos fallidos | ADMIN |
| `DELETE` | `/:id` | Eliminar | ADMIN |

**Salas** `/salas`

| Método | Ruta | Descripción | Quién |
|---|---|---|---|
| `GET` | `/`, `/:id`, `/nombre/:nombre` | Listar y buscar | Público |
| `POST` | `/` | Crear | ADMIN |
| `PUT` | `/:id` | Editar | ADMIN, REPRESENTANTE de la sala |
| `PUT` | `/dis/:id` | Dar de baja o de alta | ADMIN |

**Eventos** `/eventos`

| Método | Ruta | Descripción | Quién |
|---|---|---|---|
| `GET` | `/`, `/proximos`, `/:id` | Listar, próximos y detalle | Público |
| `POST` | `/` | Crear | REPRESENTANTE de la sala |
| `PUT` | `/:id` | Editar | REPRESENTANTE del centro |
| `PUT` | `/:id/finalizar` | Finalizar | REPRESENTANTE del centro |
| `PUT` | `/:id/cancelar` | Cancelar por fuerza mayor | ADMIN, REPRESENTANTE del centro |

**Clientes** `/clientes`

| Método | Ruta | Descripción | Quién |
|---|---|---|---|
| `GET` | `/`, `/:id` | Listar y obtener | ADMIN, REPRESENTANTE, EMPLEADO, AUDITOR |
| `POST` | `/` | Crear | REPRESENTANTE, EMPLEADO |
| `PUT` | `/:id` | Actualizar | REPRESENTANTE, EMPLEADO |
| `DELETE` | `/:id` | Eliminar (sin entradas vigentes) | ADMIN |

**Entradas** `/entradas`

| Método | Ruta | Descripción | Quién |
|---|---|---|---|
| `GET` | `/` | Listar, con lo que corresponde ver a cada rol | ADMIN, REPRESENTANTE, EMPLEADO, AUDITOR |
| `GET` | `/:id` | Obtener | El dueño, el personal de su centro, ADMIN, AUDITOR |
| `POST` | `/` | Vender | CLIENTE para sí mismo, EMPLEADO, REPRESENTANTE |
| `POST` | `/reservar` | Reservar | CLIENTE, EMPLEADO, REPRESENTANTE |
| `POST` | `/checkin` | Validar el ingreso con `{ "codigo": "..." }` | EMPLEADO, REPRESENTANTE del centro |
| `PUT` | `/:id/confirmar` | Confirmar una reserva | EMPLEADO, REPRESENTANTE |
| `PUT` | `/:id/cancelar` | Cancelar y liberar el lugar | EMPLEADO, REPRESENTANTE |
| `PUT` | `/:id` | Corregir el precio | EMPLEADO, REPRESENTANTE |
| `DELETE` | `/:id` | Eliminar | ADMIN |

**Consultas** `/consultas`

| Método | Ruta | Descripción | Quién |
|---|---|---|---|
| `GET` | `/entradas-vendidas`, `/entradas-vendidas/:eventoId` | Entradas vendidas, en total o de un evento | ADMIN, REPRESENTANTE, EMPLEADO, AUDITOR |
| `GET` | `/entradas-disponibles/:eventoId` | Lugares disponibles de un evento | Público |
| `GET` | `/eventos-proximos` | Eventos próximos | Público |

**Asistente** `/asistente`

| Método | Ruta | Descripción | Quién |
|---|---|---|---|
| `POST` | `/` | Pregunta al asistente con `{ "mensaje": "..." }` | Cualquier usuario con sesión |

Ejemplo de login y de una llamada con el token:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "juanperez@mail.com", "password": "cliente1234" }'

curl http://localhost:3000/auth/mis-entradas \
  -H "Authorization: Bearer <token>"
```

## Panel web

Interfaz en Pug montada bajo `/panel`. El menú y los botones cambian según el rol.

| Sección | Ruta | Quién | Qué permite |
|---|---|---|---|
| Ingresar y crear cuenta | `/panel/login`, `/panel/registro` | Público | Iniciar sesión y registrarse como cliente |
| Inicio | `/panel` | Todos | Resumen del sistema, o próximos eventos y acceso a Mis entradas si es cliente |
| Eventos o Cartelera | `/panel/eventos` | Todos | Listado con filtros, detalle, y alta, edición, finalización y cancelación según el rol. El cliente compra desde el detalle |
| Salas o Mi centro | `/panel/salas` | Todos menos CLIENTE | Listado, alta, edición y baja lógica según el rol |
| Clientes | `/panel/clientes` | Personal, ADMIN, AUDITOR | Listado, alta, edición, historial de entradas y eliminación según el rol |
| Entradas | `/panel/entradas` | Personal, ADMIN, AUDITOR | Listado con filtros, venta, reserva, confirmación y cancelación |
| Consultas | `/panel/consultas` | Personal, ADMIN, AUDITOR | Vendidas y disponibilidad por evento. ADMIN y AUDITOR ven además las compras web en curso y las no concretadas |
| Usuarios | `/panel/usuarios` | ADMIN, REPRESENTANTE, AUDITOR | Listado con filtros, alta, suspensión y desbloqueo. El REPRESENTANTE gestiona a los empleados de su centro |
| Ingreso | `/panel/checkin` | EMPLEADO, REPRESENTANTE | Buscar el código de una entrada y validar el ingreso |
| Compras y Mis entradas | `/panel/compras`, `/panel/mis-entradas` | CLIENTE | Pagar o cancelar la compra en curso, ver las próximas entradas con su QR y el historial |

Los formularios HTML solo envían `GET` y `POST`, por eso las acciones que en la API son `PUT` o `DELETE` se exponen en el panel como `POST`.

## Asistente de cartelera

Un chat desplegable, que aparece como botón **Asistente** en todas las páginas del panel una vez iniciada la sesión. Responde en lenguaje natural qué eventos hay, cuándo y dónde son, cuánto cuestan y cuántos lugares quedan.

- Gemini no consulta la base. En cada pregunta el servidor lee los eventos programados y futuros de MongoDB y se los envía armados, con los agotados marcados, así la respuesta se apoya en datos reales.
- Solo informa, no vende ni reserva entradas.
- Necesita usuario con sesión. El límite es de 8 consultas por minuto por usuario, el mensaje admite hasta 500 caracteres y la llamada a Gemini se corta a los 15 segundos.
- Códigos de error: `400` mensaje inválido, `401` sin sesión, `429` límite o cuota agotada, `502` Gemini no responde, `503` falta configurar `GEMINI_API_KEY`.

## Cómo correrlo en local

**Prerrequisitos.** Node.js 20.19 o superior (la versión 22 es la usada en el desarrollo y el despliegue) y una base MongoDB, local o en MongoDB Atlas.

```bash
git clone https://github.com/martin-2t/Backend-grupo-24.git
cd Backend-grupo-24
npm install
cp .env.example .env    # completar MONGODB_URI y JWT_SECRET
npm run seed            # carga los datos iniciales y los usuarios de prueba (vacía las colecciones antes)
npm run dev
```

La API queda en `http://localhost:3000` y el panel en `http://localhost:3000/panel`.

**Variables de entorno** (archivo `.env`, que no se sube al repositorio)

| Variable | Obligatoria | Para qué sirve |
|---|---|---|
| `MONGODB_URI` | Sí | Cadena de conexión a MongoDB, local o de Atlas |
| `JWT_SECRET` | Sí | Clave con la que se firma el token de sesión |
| `JWT_EXPIRES_IN` | No | Duración de la sesión, `2h` por defecto |
| `PORT` | No | Puerto del servidor, `3000` por defecto |
| `RETENCION_MINUTOS` | No | Minutos que se retienen los lugares de una compra web, `10` por defecto |
| `GEMINI_API_KEY` | No | Clave de la API de Gemini. Sin ella el asistente responde `503` y el resto de la app funciona igual |
| `GEMINI_MODEL` | No | Modelo de Gemini, `gemini-3.5-flash-lite` por defecto |

**Datos iniciales.** El seed carga 25 salas, 4 clientes, 5 eventos, sus entradas y 9 usuarios. Los documentos de `scripts/semillas` traen un `_id` fijo para que las referencias coincidan en la base de cada integrante, y los eventos usan fechas relativas para que la demo siempre muestre eventos futuros, incluido uno que ocurre el mismo día.

**Probar el flujo completo.** Entrá al panel como `juanperez@mail.com` y comprá entradas para *Noche de Cumbia en La Usina*. Después, con `empleado.usina@urbanacult.com`, validá el QR en `/panel/checkin`. Para que un centro pueda operar al 100% necesita al menos un REPRESENTANTE y un EMPLEADO, y la semilla los trae para Centro Cultural Flores y La Usina de Colegiales.

**MongoDB local con Docker**

```bash
docker run -d --name urbana-mongo -p 127.0.0.1:27017:27017 mongo:8
```

Con **MongoDB Atlas**, reemplazá `MONGODB_URI` por la cadena de conexión que da Atlas.

## Tests

Los tests usan **Jest** y **Supertest** contra un MongoDB en memoria (`mongodb-memory-server`), así que no necesitan `.env` ni tocan ninguna base real. La primera vez se descarga el binario de MongoDB y tardan un poco más.

```bash
npm test                  # todos los tests
npm run test:unit         # solo los unitarios
npm run test:integration  # solo los de integración
npm run test:coverage     # todos, con reporte de cobertura (falla si baja del mínimo)
```

**380 tests en 25 suites**, 20 de integración y 5 unitarias, con **94 % de cobertura de líneas**.

| Carpeta | Qué prueba |
|---|---|
| `tests/unitarios` | Reglas puras sin HTTP, como validaciones, contraseñas, gestión de usuarios y middlewares |
| `tests/integracion` | La app entera por HTTP, con cada endpoint de la API, las páginas del panel, los permisos por rol, la sobreventa, el ingreso con QR, las compras web y el asistente |
| `tests/helpers` | La base en memoria y las funciones que crean datos de prueba |

El asistente no llama a Gemini en los tests, porque se simula `fetch`. El mínimo de cobertura es de 90 % de líneas y sentencias, 85 % de ramas y 95 % de funciones, y el reporte detallado queda en `coverage/lcov-report/index.html`.

## Despliegue

La aplicación se despliega en **Vercel** como función serverless, con la base en **MongoDB Atlas**. El archivo `vercel.json` apunta todas las rutas a `index.js` e incluye las vistas y los archivos públicos. Las variables de entorno de la tabla anterior se cargan en *Settings, Environment Variables* de Vercel, y las claves (`JWT_SECRET`, `GEMINI_API_KEY`) como secretas.

Como no queda un servidor corriendo, el sistema no guarda sesiones en memoria y las retenciones de compra se vencen al consultar. El límite de consultas del asistente se guarda en la memoria de cada instancia, así que es aproximado.
