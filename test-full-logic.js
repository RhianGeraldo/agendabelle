const token = 'd4fd49c6235cbe09ea4cb0827f51f575'; // aracruz token

async function buscarDisponibilidade(unit, codEstab, dtAgenda, periodo) {
  const url = `https://app.bellesoftware.com.br/api/release/controller/IntegracaoExterna/v1.0/agenda/disponibilidade?codEstab=${codEstab}&dtAgenda=${dtAgenda}&periodo=${periodo}&tpAgd=s`;
  const res = await fetch(url, { headers: { Authorization: token } });
  return res.json();
}

function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function calcularHorariosDisponiveis(profHorarios, tempoTotalMinutos) {
  const slotsNeeded = tempoTotalMinutos / 5;
  if (slotsNeeded <= 0 || profHorarios.length === 0) return [];

  const freeSlots = Array.from(new Set(
    profHorarios
      .filter(h => h.cod === 'l' && h.bloq === 'l')
      .map(h => h.horario)
  )).sort();

  const validStartTimes = [];

  for (let i = 0; i <= freeSlots.length - slotsNeeded; i++) {
    let consecutive = true;
    for (let j = 0; j < slotsNeeded - 1; j++) {
      const current = timeToMinutes(freeSlots[i + j]);
      const next = timeToMinutes(freeSlots[i + j + 1]);
      if (next - current !== 5) {
        consecutive = false;
        break;
      }
    }
    if (consecutive) {
      validStartTimes.push(freeSlots[i]);
    }
  }
  return validStartTimes;
}

async function test() {
  const dtStr = '18/07/2026';
  const periods = ["manha", "tarde", "noite"];
  
  const fetchPromises = periods.map(p => buscarDisponibilidade('aracruz', 1, dtStr, p));
  const results = await Promise.allSettled(fetchPromises);
  
  const allDias = [];
  results.forEach(res => {
    if (res.status === "fulfilled" && Array.isArray(res.value)) {
      allDias.push(...res.value);
    }
  });

  const mergedMap = new Map();
  allDias.forEach(dia => {
    if (!mergedMap.has(dia.data)) {
      mergedMap.set(dia.data, { ...dia, horarios: [...dia.horarios] });
    } else {
      const existing = mergedMap.get(dia.data);
      dia.horarios.forEach(prof => {
        const existingProf = existing.horarios.find(p => p.codProf === prof.codProf);
        if (existingProf) {
          existingProf.horarios = [...existingProf.horarios, ...prof.horarios];
        } else {
          existing.horarios.push(prof);
        }
      });
    }
  });

  const diasAgenda = Array.from(mergedMap.values());
  const tempoTotal = 30;

  diasAgenda.forEach(dia => {
    dia.horarios.forEach(prof => {
      if (!prof.nome.toLowerCase().includes('sala')) return;
      const horarios = calcularHorariosDisponiveis(prof.horarios, tempoTotal);
      console.log(`[${dia.data}] ${prof.nome} (${prof.codProf}):`);
      console.log(horarios.join(', '));
    });
  });
}
test();
