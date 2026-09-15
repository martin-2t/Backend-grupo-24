//Importa las funciones del modelo entradas
const entradasModel = require('../models/entradas');

function getAllEntradas(req, res) {
    res.status(200).json(entradasModel.getAllEntradas());
}

function getEntradaById(req, res) {
    const entradaBuscada = entradasModel.getEntradasById(req.params.id);
    if(!entradaBuscada) {
        return res.status(404).json({ error: 'Entrada no encontrada'});
    }
    return res.status(200).json(entradaBuscada);
}

function createEntrada(req, res) {
    const { eventoId, clienteId, precio} = req.body;

    if(!eventoId || typeof eventoId !== 'number') {
        return res.status(400).json({ error: 'El campo "eventoId" es obligatorio y debe ser un número'});
    }
    if(!clienteId || typeof clienteId !== 'number') {
        return res.status(400).json({ error: 'El campo "clienteId" es obligatorio y debe ser un número'});
    }
    if(precio === undefined || typeof precio !== 'number') {
        return res.status(400).json({ error: 'El campo "precio" es obligatorio y debe ser un número'});
    }
    const nueva = entradasModel.createEntrada({ eventoId, clienteId, precio });
    return res.status(201).json(nueva);
}

function updateEntrada(req, res) {
    const entrada = entradasModel.getEntradaById(req.params.id);
    if (!entrada){
        return res.status(404).json({ error: 'Entrada no encontrada' })
    }
    const {eventoId, clienteId, precio, estado}= req.body;

    if (eventoId !== undefined && typeof eventoId !== 'number') {
        return res.status(400).json({ error: 'El campo "eventoId" debe ser un número' });
    }
    if (clienteId !== undefined && typeof clienteId !== 'number') {
        return res.status(400).json({ error: 'El campo "clienteId" debe ser un número' });
    }
    if (precio !== undefined && typeof precio !== 'number') {
        return res.status(400).json({ error: 'El campo "precio" debe ser un número'});
    }
    if (estado !== undefined && !['VALIDA', 'INVALIDA'].includes(estado)){
        return res.status(400).json({ error: 'El campo "estado" debe ser "VALIDA" o "INVALIDA" '})
    }
    const actualizada = entradasModel.updateEntradaById(req.params.id, {eventoId, clienteId, precio, estado});
    return res.status(200).json(actualizada);
}

function deleteEntrada(req, res){
    const eliminada = entradasModel.removeEntrada(req.params.id);
    if (!eliminada){
        return res.status(404).json({ error: 'Entrada no encontrada' })
    }
    return res.status(204).send();

}

module.exports = { getAllEntradas, getEntradaById, createEntrada, updateEntrada, deleteEntrada };