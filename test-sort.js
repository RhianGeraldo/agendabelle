const profHorarios = [
  { cod: 'l', bloq: 'l', horario: '13:00' },
  { cod: 'l', bloq: 'l', horario: '13:05' },
  { cod: 'l', bloq: 'l', horario: '13:10' },
  { cod: 'l', bloq: 'l', horario: '13:15' },
  { cod: 'l', bloq: 'l', horario: '13:20' },
  { cod: 'l', bloq: 'l', horario: '13:25' },
  { cod: 'l', bloq: 'l', horario: '13:30' },
  { cod: 'l', bloq: 'l', horario: '15:00' },
  { cod: 'l', bloq: 'l', horario: '15:05' },
  { cod: 'l', bloq: 'l', horario: '15:10' },
  { cod: 'l', bloq: 'l', horario: '15:15' },
  { cod: 'l', bloq: 'l', horario: '15:20' },
  { cod: 'l', bloq: 'l', horario: '15:25' },
  { cod: 'l', bloq: 'l', horario: '15:30' }
];

function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

const tempoTotalMinutos = 30;
const slotsNeeded = tempoTotalMinutos / 5;

const freeSlots = Array.from(new Set(
  profHorarios
    .filter(h => h.cod === 'l' && h.bloq === 'l')
    .map(h => h.horario)
)).sort();

console.log("freeSlots:", freeSlots);

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
console.log("validStartTimes:", validStartTimes);
