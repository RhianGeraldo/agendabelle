const token = 'd4fd49c6235cbe09ea4cb0827f51f575'; // aracruz token

async function test() {
  const url = `https://app.bellesoftware.com.br/api/release/controller/IntegracaoExterna/v1.0/agenda/disponibilidade?codEstab=1&dtAgenda=18/07/2026&periodo=noite&tpAgd=s`;
  const res = await fetch(url, { headers: { Authorization: token } });
  const data = await res.json();
  const dia18 = data.find(d => d.data === "18/07/2026");
  const prof = dia18 ? dia18.horarios.find(p => p.codProf == 25665) : null;
  console.log(prof ? prof.horarios.map(h => h.horario + "(" + h.cod + ")").join(", ") : "no data");
}
test();
