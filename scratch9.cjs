const UNIT_TOKENS = {
  mantena: '452166ad16be9184c85db73a97832d55',
};

async function test(auth) {
  const res = await fetch('https://app.bellesoftware.com.br/api/release/controller/IntegracaoExterna/v1.0/cliente/agenda?codCliente=12345&codEstab=1&dtInicio=14/04/2026&dtFim=14/05/2026', {
    headers: { Authorization: auth }
  });
  console.log(`Auth: ${auth} -> Status: ${res.status}`);
}

test(UNIT_TOKENS['mantena']).then(() => {
  test(`Bearer ${UNIT_TOKENS['mantena']}`);
});
