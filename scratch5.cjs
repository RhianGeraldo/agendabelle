const UNIT_TOKENS = {
  mantena: '452166ad16be9184c85db73a97832d55',
};

async function test() {
  const res = await fetch('https://app.bellesoftware.com.br/api/release/controller/IntegracaoExterna/v1.0/cliente/agenda?codCliente=12345&codEstab=1&dtInicio=14/04/2026&dtFim=14/05/2026', {
    headers: { Authorization: `Token ${UNIT_TOKENS['mantena']}` }
  });
  console.log(res.status);
  const text = await res.text();
  console.log(text);
}
test();
