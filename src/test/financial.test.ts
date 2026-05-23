import { describe, it, expect, vi } from "vitest";
import { buscarVendasElosgate } from "../lib/api";

describe("buscarVendasElosgate", () => {
  it("should successfully fetch and return sales array", async () => {
    const mockSales = [
      {
        Data: "2026-05-23T10:00:00Z",
        Descricao: "Sessão de Drenagem Linfática",
        Valor: 180.50,
        Status: "Pago",
        LinkPagamento: "https://pay.elosgate.com.br/123",
        MeioPagamento: "Pix"
      }
    ];

    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ Errors: [], Total: 1, Vendas: mockSales })
      })
    );

    global.fetch = mockFetch;

    const sales = await buscarVendasElosgate("mantena", "123.456.789-00");
    
    expect(mockFetch).toHaveBeenCalled();
    expect(sales).toHaveLength(1);
    expect(sales[0].Descricao).toBe("Sessão de Drenagem Linfática");
    expect(sales[0].Valor).toBe(180.50);
  });

  it("should fail gracefully if API returns non-ok response", async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 500
      })
    );

    await expect(buscarVendasElosgate("mantena", "123.456.789-00")).rejects.toThrow();
  });
});
