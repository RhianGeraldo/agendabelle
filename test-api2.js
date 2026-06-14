const token = 'd4fd49c6235cbe09ea4cb0827f51f575'; // aracruz token
const url = 'https://app.bellesoftware.com.br/api/release/controller/IntegracaoExterna/v1.0/agenda/disponibilidade?codEstab=1&dtAgenda=18/07/2026&periodo=tarde&tpAgd=s';

async function test() {
  try {
    const res = await fetch(url, { headers: { Authorization: token } });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
  }
}
test();
