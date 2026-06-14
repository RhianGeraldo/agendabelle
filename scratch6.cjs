const UNIT_TOKENS = {
  mantena: '452166ad16be9184c85db73a97832d55',
};

async function testOrder() {
  // codEstab first
  const res1 = await fetch('https://app.bellesoftware.com.br/api/release/controller/IntegracaoExterna/v1.0/cliente/agenda?codEstab=1&codCliente=12345&dtInicio=14/04/2026&dtFim=14/05/2026', {
    headers: { Authorization: UNIT_TOKENS['mantena'] }
  });
  console.log('codEstab first:', res1.status);

  // codCliente first
  const res2 = await fetch('https://app.bellesoftware.com.br/api/release/controller/IntegracaoExterna/v1.0/cliente/agenda?codCliente=12345&codEstab=1&dtInicio=14/04/2026&dtFim=14/05/2026', {
    headers: { Authorization: UNIT_TOKENS['mantena'] }
  });
  console.log('codCliente first:', res2.status);
}

testOrder();
