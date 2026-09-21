import { describe, it, expect } from "vitest";
import { isRemocaoTatuagem, isPlanTattooRemoval } from "../lib/api";

describe("isRemocaoTatuagem", () => {
  it("should return true for various forms of tattoo removal", () => {
    expect(isRemocaoTatuagem("Remoção de Tatuagem")).toBe(true);
    expect(isRemocaoTatuagem("remocao de tatuagem")).toBe(true);
    expect(isRemocaoTatuagem("REMOÇÃO DE TATUAGEM - ÁREA P")).toBe(true);
    expect(isRemocaoTatuagem("Laser Tattoo Removal")).toBe(true);
    expect(isRemocaoTatuagem("Sessão Tatuagem")).toBe(true);
    expect(isRemocaoTatuagem("Remoção Tat")).toBe(true);
  });

  it("should return false for unrelated procedures", () => {
    expect(isRemocaoTatuagem("Depilação a Laser - Axilas")).toBe(false);
    expect(isRemocaoTatuagem("Clareamento Íntimo")).toBe(false);
    expect(isRemocaoTatuagem("Rejuvenescimento Facial")).toBe(false);
    expect(isRemocaoTatuagem("Combo Verão")).toBe(false);
    expect(isRemocaoTatuagem("")).toBe(false);
    expect(isRemocaoTatuagem(null)).toBe(false);
    expect(isRemocaoTatuagem(undefined)).toBe(false);
  });
});

describe("isPlanTattooRemoval", () => {
  it("should detect plan when plan name contains tattoo removal", () => {
    const plano = {
      codPlano: 123,
      nome: "Pacote Remoção de Tatuagem (10ss)",
      label: "123 - Pacote Remoção de Tatuagem (10ss)",
      servicos: []
    };
    expect(isPlanTattooRemoval(plano)).toBe(true);
  });

  it("should detect plan when service contains tattoo removal", () => {
    const plano = {
      codPlano: 456,
      nome: "Tratamento Especial",
      label: "456 - Tratamento Especial",
      servicos: [
        { codServico: 1, nome: "Remoção de Tatuagem - Área M" }
      ]
    };
    expect(isPlanTattooRemoval(plano)).toBe(true);
  });

  it("should detect plan when fetched services contain tattoo removal", () => {
    const plano = {
      codPlano: 789,
      nome: "Plano Personalizado",
      label: "789 - Plano Personalizado",
      servicos: []
    };
    const fetchedServicos = [
      { codServico: 99, nome: "Sessão Laser Tattoo" }
    ];
    expect(isPlanTattooRemoval(plano, fetchedServicos)).toBe(true);
  });

  it("should return false for regular plans", () => {
    const plano = {
      codPlano: 101,
      nome: "Combo Verão",
      label: "101 - Combo Verão",
      servicos: [
        { codServico: 1, nome: "Axilas (P) - depilação a laser" }
      ]
    };
    expect(isPlanTattooRemoval(plano)).toBe(false);
  });
});
