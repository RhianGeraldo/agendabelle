import { buscarDisponibilidade, calcularHorariosDisponiveis } from './src/lib/api';

async function test() {
  const unit = 'aracruz';
  const dtStr = '18/07/2026';
  const periods = ["manha", "tarde", "noite"];
  
  const fetchPromises = periods.map(p => buscarDisponibilidade(unit, 1, dtStr, p));
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
