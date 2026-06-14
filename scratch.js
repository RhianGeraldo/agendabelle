const UNIT_TOKENS = {
  mantena: '452166ad16be9184c85db73a97832d55',
  'sao-mateus': '47ad4592f0438b5f4ba37c05e2ffc7e9',
  linhares: '76683f1105194b9f9544cb9f1b356a5b',
  aracruz: 'd4fd49c6235cbe09ea4cb0827f51f575',
  serra: '8471d37f86e5c2d2cb213d8e092f2c64',
};

async function test() {
  const res = await fetch('https://app.bellesoftware.com.br/api/release/controller/IntegracaoExterna/v1.0/cliente/agenda?codEstab=1&codCliente=1&dtInicio=01/01/2026&dtFim=31/01/2026', {
    headers: { Authorization: UNIT_TOKENS['mantena'] }
  });
  console.log(res.status);
  console.log(await res.text());
}
test();
