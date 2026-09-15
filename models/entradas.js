const fs = require('fs');
const path = require('path');

// Entidad entrada 
class Entrada {
    constructor(id, eventoId, clienteId, precio, estado ="VALIDA"){
        this.id = id;
        this.eventoId = eventoId;
        this.clienteId = clienteId;
        this.precio = precio;
        this.estado = estado;
    }
}
// Arma la ruta absoluta al archivo clientes.json
// __dirname es la carpeta actual (models),  y entra a data
const filePath = path.join(__dirname, '..', 'data', 'entradas.json');

//Devuelve array de todas las entradas
function getAllEntradas(){
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
}

function getEntradaById(id) {
  return getAllEntradas().find((e) => e.id === Number(id));
}

//Devuelve una Entrada en particular por medio del ID
function createEntrada(data){
    const entradas = getAllEntradas();
    const nuevoId = entradas.length ? Math.max(...entradas.map((e)=> e.id)) + 1 : 1;
    const nuevaEntrada = new Entrada(nuevoId, data.eventoId, data.clienteId, data.precio);
    entradas.push(nuevaEntrada);
    fs.writeFileSync(filePath, JSON.stringify(entradas, null, 2), 'utf-8');
    return nuevaEntrada;
}

//Actualiza una entrada por Id 
function updateEntradaById(id, data){
    const entradas = getAllEntradas();
    const idx = entradas.findIndex((e) => e.id === (id));
    if(idx === -1) return null;


//Acá se filtran los campos undefined para no "pisar" valores existentes
const cambios = Object.fromEntries(
    Object.entries(data).filter(([, valor]) => valor !== undefined)
);

entradas[idx] = {...entradas[idx], ...cambios, id:entradas[idx].id};
fs.writeFileSync(filePath, JSON.stringify(entradas, null, 2), 'uth-8');
return entradas[idx];
};

//Elimina entradas por id
function removeEntrada(id){
    const entradas = getAllEntradas();
    const idx = entradas.findIndex((e) => e.id === Number(id));
    if (idx === -1) return false;
    entradas.splice(idx, 1);
    fs.writeFileSync(filePath, JSON.stringify(entradas, null, 2), 'utf-8');
    return true
}

module.exports = {getAllEntradas, getEntradaById, createEntrada, updateEntradaById, removeEntrada}


