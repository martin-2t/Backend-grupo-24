// Tests de integración: compra web del cliente con retención de lugares (RF-VEN-02 de Ingeniería).
// El cliente elige la cantidad, sus lugares quedan RETENIDA unos minutos mientras paga, y recién
// al pagar existen las entradas. Para no esperar minutos reales, los tests "adelantan el reloj"
// poniéndole a la compra un vencimiento en el pasado.
import request from 'supertest';
import app from '../../app.js';
import { Entrada } from '../../models/entradas.js';
import { Evento } from '../../models/eventos.js';
import { conectar, limpiar, desconectar } from '../helpers/db.js';
import { crearSala, crearEvento, crearCliente, crearUsuarioConToken } from '../helpers/datos.js';

beforeAll(conectar);
afterEach(limpiar);
afterAll(desconectar);

const UN_MINUTO = 60 * 1000;

let d;
beforeEach(async () => {
  const sala = await crearSala({ capacidad: 10 });
  const evento = await crearEvento(sala.id);
  const juan = await crearCliente(1);
  const ana = await crearCliente(2);
  d = {
    sala,
    evento,
    juan: await crearUsuarioConToken({ rol: 'CLIENTE', clienteId: juan.id, email: 'juan@mail.com' }),
    ana: await crearUsuarioConToken({ rol: 'CLIENTE', clienteId: ana.id, email: 'ana@mail.com' }),
    admin: await crearUsuarioConToken({ rol: 'ADMIN' }),
    empleado: await crearUsuarioConToken({ rol: 'EMPLEADO', salaId: sala.id }),
  };
});

// El panel identifica al usuario por la cookie del JWT
const como = (quien, peticion) => peticion.set('Cookie', `token=${quien.token}`);
// Compra en el panel: devuelve el id de la compra si se creó, o la respuesta si se rechazó
async function comprar(quien, cantidad, eventoId = d.evento.id) {
  const respuesta = await como(quien, request(app).post('/panel/compras').type('form').send({ eventoId, cantidad }));
  const creada = respuesta.headers.location?.match(/^\/panel\/compras\/([a-f0-9]{24})$/);
  return { compraId: creada ? creada[1] : null, respuesta };
}
const pagar = (quien, compraId) => como(quien, request(app).post(`/panel/compras/${compraId}/pagar`));
const cancelar = (quien, compraId) => como(quien, request(app).post(`/panel/compras/${compraId}/cancelar`));
const verCompra = (quien, compraId) => como(quien, request(app).get(`/panel/compras/${compraId}`));

// "Adelanta el reloj": la compra pasa a tener un vencimiento que ya pasó
const hacerVencer = (compraId) =>
  Entrada.updateMany({ compraId }, { $set: { venceEn: new Date(Date.now() - UN_MINUTO) } });
const lugares = async () => (await Evento.findById(d.evento.id)).lugaresOcupados;
const deLaCompra = (compraId) => Entrada.find({ compraId });

describe('Retención de lugares al comprar', () => {
  test('al elegir 3 entradas se retienen 3 lugares por 10 minutos, sin crear entradas todavía', async () => {
    const { compraId } = await comprar(d.juan, 3);

    const retenidas = await deLaCompra(compraId);
    expect(retenidas).toHaveLength(3);
    expect(retenidas.every((e) => e.estado === 'RETENIDA')).toBe(true);
    const faltan = retenidas[0].venceEn - Date.now();
    expect(faltan).toBeGreaterThan(9.9 * UN_MINUTO);
    expect(faltan).toBeLessThanOrEqual(10 * UN_MINUTO);
    expect(await lugares()).toBe(3);
  });

  test('el plazo se puede cambiar con RETENCION_MINUTOS', async () => {
    process.env.RETENCION_MINUTOS = '2';
    try {
      const { compraId } = await comprar(d.juan, 1);
      const [retenida] = await deLaCompra(compraId);
      expect(retenida.venceEn - Date.now()).toBeLessThanOrEqual(2 * UN_MINUTO);
    } finally {
      delete process.env.RETENCION_MINUTOS;
    }
  });

  test('no se pueden comprar más de 6 entradas por compra', async () => {
    const { compraId, respuesta } = await comprar(d.juan, 7);

    expect(compraId).toBeNull();
    expect(decodeURIComponent(respuesta.headers.location)).toMatch(/entre 1 y 6 entradas/);
    expect(await lugares()).toBe(0);
  });

  test('si pide más de las que quedan, se rechaza y avisa cuántas hay', async () => {
    await comprar(d.juan, 6);
    await comprar(d.juan, 2);

    const { compraId, respuesta } = await comprar(d.ana, 3);

    expect(compraId).toBeNull();
    expect(decodeURIComponent(respuesta.headers.location)).toMatch(/Solo quedan 2 lugares/);
    expect(await lugares()).toBe(8);
  });

  test('dos compras a la vez por los últimos 4 lugares: una se los lleva todos y la otra ninguno', async () => {
    await comprar(d.juan, 6);

    const [deJuan, deAna] = await Promise.all([comprar(d.juan, 4), comprar(d.ana, 4)]);

    expect([deJuan.compraId, deAna.compraId].filter(Boolean)).toHaveLength(1);
    expect(await lugares()).toBe(10);
  });

  test('no se pueden comprar entradas para un evento que ya pasó', async () => {
    const pasado = await crearEvento(d.sala.id, { fecha: new Date(Date.now() - 3 * 24 * 60 * UN_MINUTO) });

    const { compraId, respuesta } = await comprar(d.juan, 1, pasado.id);

    expect(compraId).toBeNull();
    expect(decodeURIComponent(respuesta.headers.location)).toMatch(/ya pasó/);
  });
});

describe('Pagar o cancelar la compra', () => {
  test('al pagar, las retenidas pasan a ser entradas VALIDA y la página muestra sus QR', async () => {
    const { compraId } = await comprar(d.juan, 3);

    expect((await pagar(d.juan, compraId)).status).toBe(302);

    const entradas = await deLaCompra(compraId);
    expect(entradas.every((e) => e.estado === 'VALIDA' && !e.venceEn)).toBe(true);
    const pagina = await verCompra(d.juan, compraId);
    expect(pagina.text.match(/data:image\/png;base64/g)).toHaveLength(3);
  });

  test('si se le venció el tiempo, no se puede pagar: queda como compra no concretada', async () => {
    const { compraId } = await comprar(d.juan, 3);
    await hacerVencer(compraId);

    const respuesta = await pagar(d.juan, compraId);

    expect(decodeURIComponent(respuesta.headers.location)).toMatch(/no se concretó/);
    expect((await deLaCompra(compraId)).every((e) => e.estado === 'VENCIDA')).toBe(true);
    expect(await lugares()).toBe(0);
  });

  test('al cancelar, los lugares se liberan en el acto', async () => {
    const { compraId } = await comprar(d.juan, 4);

    await cancelar(d.juan, compraId);

    expect((await deLaCompra(compraId)).every((e) => e.estado === 'VENCIDA')).toBe(true);
    expect(await lugares()).toBe(0);
  });

  test('si varios pedidos vencen la misma compra a la vez, sus lugares se liberan una sola vez', async () => {
    const { compraId } = await comprar(d.juan, 3);
    await comprar(d.ana, 2);
    await hacerVencer(compraId);

    await Promise.all(Array.from({ length: 5 }, () => verCompra(d.juan, compraId)));

    // Quedan los 2 lugares de Ana: si los de Juan se hubieran liberado varias veces, daría 0
    expect(await lugares()).toBe(2);
  });

  test('nadie puede ver ni pagar la compra de otro cliente', async () => {
    const { compraId } = await comprar(d.juan, 2);

    expect((await verCompra(d.ana, compraId)).status).toBe(404);
    expect((await pagar(d.ana, compraId)).status).toBe(404);
    expect((await deLaCompra(compraId)).every((e) => e.estado === 'RETENIDA')).toBe(true);
  });
});

describe('Qué ve cada rol', () => {
  test('el personal no ve las compras en curso; el ADMIN sí', async () => {
    await comprar(d.juan, 2);
    const listar = (quien) => request(app).get('/entradas').set('Authorization', `Bearer ${quien.token}`);

    expect((await listar(d.empleado)).body.some((e) => e.estado === 'RETENIDA')).toBe(false);
    expect((await listar(d.admin)).body.filter((e) => e.estado === 'RETENIDA')).toHaveLength(2);
  });

  test('el cliente solo ve sus entradas reales, nunca las compras en curso ni las no concretadas', async () => {
    const pagada = await comprar(d.juan, 1);
    await pagar(d.juan, pagada.compraId);
    await comprar(d.juan, 2); // queda en curso
    const cancelada = await comprar(d.juan, 1);
    await cancelar(d.juan, cancelada.compraId);

    const api = await request(app).get('/auth/mis-entradas').set('Authorization', `Bearer ${d.juan.token}`);

    expect(api.body).toHaveLength(1);
    expect(api.body[0].estado).toBe('VALIDA');
  });

  test('en el panel, la entrada pagada aparece en Próximas con su QR, y abre su vista grande', async () => {
    const { compraId } = await comprar(d.juan, 1);
    await pagar(d.juan, compraId);
    const [entrada] = await deLaCompra(compraId);

    const lista = await como(d.juan, request(app).get('/panel/mis-entradas'));
    expect(lista.text).toContain(`/panel/mis-entradas/${entrada.id}`);

    const vista = await como(d.juan, request(app).get(`/panel/mis-entradas/${entrada.id}`));
    expect(vista.status).toBe(200);
    expect(vista.text).toContain('data:image/png;base64');
  });

  test('la entrada de otro cliente responde "no encontrada"', async () => {
    const { compraId } = await comprar(d.juan, 1);
    await pagar(d.juan, compraId);
    const [entrada] = await deLaCompra(compraId);

    expect((await como(d.ana, request(app).get(`/panel/mis-entradas/${entrada.id}`))).status).toBe(404);
  });

  test('las compras no concretadas cuentan como métrica solo para el negocio', async () => {
    const { compraId } = await comprar(d.juan, 2);
    await cancelar(d.juan, compraId);

    const admin = await como(d.admin, request(app).get('/panel/consultas'));
    const empleado = await como(d.empleado, request(app).get('/panel/consultas'));
    expect(admin.text).toContain('Compras web no concretadas');
    expect(empleado.text).not.toContain('Compras web no concretadas');
  });

  test('si se cancela el evento, una compra en curso queda no concretada, no "cancelada"', async () => {
    const { compraId } = await comprar(d.juan, 2);

    await request(app).put(`/eventos/${d.evento.id}/cancelar`).set('Authorization', `Bearer ${d.admin.token}`);

    expect((await deLaCompra(compraId)).every((e) => e.estado === 'VENCIDA')).toBe(true);
  });
});

describe('Reserva de boletería', () => {
  test('ya no vence: queda RESERVADA hasta que el personal la confirme o la cancele', async () => {
    const reserva = await request(app)
      .post('/entradas/reservar')
      .set('Authorization', `Bearer ${d.empleado.token}`)
      .send({ eventoId: d.evento.id, clienteId: String(d.juan.usuario.clienteId) });

    expect(reserva.status).toBe(201);
    expect(reserva.body.venceEn).toBeUndefined();
    const consultada = await request(app)
      .get(`/entradas/${reserva.body._id}`)
      .set('Authorization', `Bearer ${d.admin.token}`);
    expect(consultada.body.estado).toBe('RESERVADA');
  });
});

describe('Botón de compra en el detalle del evento', () => {
  test('el selector va de 1 hasta 6, o hasta los lugares que queden si son menos', async () => {
    const pagina = (quien) => como(quien, request(app).get(`/panel/eventos/${d.evento.id}`));

    expect((await pagina(d.juan)).text).toContain('<option value="6">');

    await comprar(d.ana, 6);
    await comprar(d.ana, 1);
    const conTres = (await pagina(d.juan)).text;
    expect(conTres).toContain('<option value="3">');
    expect(conTres).not.toContain('<option value="4">');
  });

  test('el personal no ve el botón de compra', async () => {
    const pagina = await como(d.empleado, request(app).get(`/panel/eventos/${d.evento.id}`));
    expect(pagina.text).not.toContain('action="/panel/compras"');
  });
});
