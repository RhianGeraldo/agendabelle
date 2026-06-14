async function testInvalidToken() {
  const res = await fetch('https://app.bellesoftware.com.br/api/release/controller/IntegracaoExterna/v1.0/cliente/agenda?codCliente=12345&codEstab=1&dtInicio=14/04/2026&dtFim=14/05/2026', {
    headers: { Authorization: 'INVALID_TOKEN_123' }
  });
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Body:', text);
}
testInvalidToken();
