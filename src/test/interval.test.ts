import { describe, it, expect } from "vitest";
import { calcularDataMinimaAgendamento, type AgendamentoHistorico } from "../lib/api";
import { format, addDays, parse } from "date-fns";

describe("calcularDataMinimaAgendamento", () => {
  const baseDate = parse("01/06/2026", "dd/MM/yyyy", new Date()); // Monday

  it("should apply 30 days lockout for the same standard service (e.g. depilação)", () => {
    const historico: AgendamentoHistorico[] = [
      {
        codConsulta: 101,
        dtAgenda: "01/06/2026",
        hrConsulta: "14:00",
        status: "Confirmado",
        prof: { cod: "1", nome: "Dra. Ana" },
        sala: { cod: "1", nome: "Sala 1" },
        servicos: [{ cod: "500", nome: "Axilas Depilação a Laser" }],
        observacao: ""
      }
    ];

    const result = calcularDataMinimaAgendamento({
      hoje: baseDate,
      allServicos: [{ codServico: "500", nome: "Axilas Depilação a Laser" }],
      historico
    });

    // 01/06/2026 + 30 days = 01/07/2026 (Wednesday)
    expect(format(result, "dd/MM/yyyy")).toBe("01/07/2026");
  });

  it("should keep 25 days lockout for clareamento same service", () => {
    const historico: AgendamentoHistorico[] = [
      {
        codConsulta: 102,
        dtAgenda: "01/06/2026",
        hrConsulta: "15:00",
        status: "Confirmado",
        prof: { cod: "1", nome: "Dra. Ana" },
        sala: { cod: "1", nome: "Sala 1" },
        servicos: [{ cod: "600", nome: "Clareamento Íntimo" }],
        observacao: ""
      }
    ];

    const result = calcularDataMinimaAgendamento({
      hoje: baseDate,
      allServicos: [{ codServico: "600", nome: "Clareamento Íntimo" }],
      historico
    });

    // 01/06/2026 + 25 days = 26/06/2026 (Friday)
    expect(format(result, "dd/MM/yyyy")).toBe("26/06/2026");
  });

  it("should apply 25 days crossing lockout between depilação and clareamento", () => {
    const historicoDepil: AgendamentoHistorico[] = [
      {
        codConsulta: 103,
        dtAgenda: "01/06/2026",
        hrConsulta: "10:00",
        status: "Atendido",
        prof: { cod: "1", nome: "Dra. Ana" },
        sala: { cod: "1", nome: "Sala 1" },
        servicos: [{ cod: "501", nome: "Virilha Depilação a Laser" }],
        observacao: ""
      }
    ];

    // Scheduling Clareamento after Depilação
    const resultAgendandoClareamento = calcularDataMinimaAgendamento({
      hoje: baseDate,
      allServicos: [{ codServico: "601", nome: "Clareamento de Axilas" }],
      historico: historicoDepil
    });
    expect(format(resultAgendandoClareamento, "dd/MM/yyyy")).toBe("26/06/2026");

    // Scheduling Depilação after Clareamento
    const historicoClareamento: AgendamentoHistorico[] = [
      {
        codConsulta: 104,
        dtAgenda: "01/06/2026",
        hrConsulta: "10:00",
        status: "Atendido",
        prof: { cod: "1", nome: "Dra. Ana" },
        sala: { cod: "1", nome: "Sala 1" },
        servicos: [{ cod: "601", nome: "Clareamento de Axilas" }],
        observacao: ""
      }
    ];

    const resultAgendandoDepil = calcularDataMinimaAgendamento({
      hoje: baseDate,
      allServicos: [{ codServico: "501", nome: "Virilha Depilação a Laser" }],
      historico: historicoClareamento
    });
    expect(format(resultAgendandoDepil, "dd/MM/yyyy")).toBe("26/06/2026");
  });

  it("should maintain 45 days lockout for facial area vs rejuvenescimento facial", () => {
    const historicoFacial: AgendamentoHistorico[] = [
      {
        codConsulta: 105,
        dtAgenda: "01/06/2026",
        hrConsulta: "11:00",
        status: "Atendido",
        prof: { cod: "1", nome: "Dra. Ana" },
        sala: { cod: "1", nome: "Sala 1" },
        servicos: [{ cod: "701", nome: "Buço Depilação a Laser" }],
        observacao: ""
      }
    ];

    const resultRejuvenescimento = calcularDataMinimaAgendamento({
      hoje: baseDate,
      allServicos: [{ codServico: "801", nome: "Rejuvenescimento Facial" }],
      historico: historicoFacial
    });

    // 01/06/2026 + 45 days = 16/07/2026 (Thursday)
    expect(format(resultRejuvenescimento, "dd/MM/yyyy")).toBe("16/07/2026");
  });

  it("should advance to Monday if minimum date falls on a Sunday", () => {
    // 02/05/2026 + 30 days = 01/06/2026 (Monday).
    // Let's pick a date where +30 days lands on Sunday:
    // 08/05/2026 (Friday) + 30 days = 07/06/2026 (Sunday) -> Should advance to 08/06/2026 (Monday).
    const fridayDate = parse("08/05/2026", "dd/MM/yyyy", new Date());
    const historico: AgendamentoHistorico[] = [
      {
        codConsulta: 106,
        dtAgenda: "08/05/2026",
        hrConsulta: "14:00",
        status: "Confirmado",
        prof: { cod: "1", nome: "Dra. Ana" },
        sala: { cod: "1", nome: "Sala 1" },
        servicos: [{ cod: "500", nome: "Pernas Depilação a Laser" }],
        observacao: ""
      }
    ];

    const result = calcularDataMinimaAgendamento({
      hoje: fridayDate,
      allServicos: [{ codServico: "500", nome: "Pernas Depilação a Laser" }],
      historico
    });

    // 08/05/2026 + 30 days = 07/06/2026 (Sunday) -> moved to 08/06/2026 (Monday)
    expect(result.getDay()).toBe(1); // Monday
    expect(format(result, "dd/MM/yyyy")).toBe("08/06/2026");
  });

  it("should return today if there is no previous appointment or history is empty", () => {
    const result = calcularDataMinimaAgendamento({
      hoje: baseDate,
      allServicos: [{ codServico: "500", nome: "Axilas Depilação a Laser" }],
      historico: []
    });

    expect(format(result, "dd/MM/yyyy")).toBe("01/06/2026");
  });
});
