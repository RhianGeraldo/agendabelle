const UNIT_TOKENS = {
  mantena: '452166ad16be9184c85db73a97832d55',
};

function getToken(unit) {
  return UNIT_TOKENS[unit];
}

const BASE_URL = 'https://app.bellesoftware.com.br/api/release/controller/IntegracaoExterna/v1.0';

console.log("buscarCliente:");
console.log(`URL: ${BASE_URL}/cliente/listar?codEstab=1&cpf=...`);
console.log(`Token:`, getToken('mantena'));

console.log("\nbuscarPlanos:");
console.log(`URL: ${BASE_URL}/cliente/planos?codEstab=1&codCliente=123`);
console.log(`Token:`, getToken('mantena'));

console.log("\nbuscarHistoricoAgenda:");
console.log(`URL: ${BASE_URL}/cliente/agenda?codEstab=1&codCliente=123&dtInicio=...&dtFim=...`);
console.log(`Token:`, getToken('mantena'));
