const allDias = [
  {
    data: "18/07",
    horarios: [
      { codProf: 1, nome: "A", horarios: [{ horario: "10:00" }] }
    ]
  },
  {
    data: "18/07",
    horarios: [
      { codProf: 1, nome: "A", horarios: [{ horario: "14:00" }] }
    ]
  }
];

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

console.log(JSON.stringify(Array.from(mergedMap.values()), null, 2));

// Test what happens to allDias[0]
console.log("allDias[0] mutated?", JSON.stringify(allDias[0], null, 2));
