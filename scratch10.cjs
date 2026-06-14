const UNIT_TOKENS = {
  mantena: '452166ad16be9184c85db73a97832d55',
};

async function testParallel() {
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(
      fetch('https://app.bellesoftware.com.br/api/release/controller/IntegracaoExterna/v1.0/cliente/agenda?codCliente=12345&codEstab=1&dtInicio=14/04/2026&dtFim=14/05/2026', {
        headers: { Authorization: UNIT_TOKENS['mantena'] }
      })
    );
  }
  const results = await Promise.all(promises);
  for (const res of results) {
    console.log(res.status, await res.text());
  }
}

testParallel();
