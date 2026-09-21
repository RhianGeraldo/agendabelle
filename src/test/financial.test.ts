import { describe, it, expect, vi } from "vitest";
import { buscarVendasElosgate, isSaleDelinquent, isSaleFullyPaid, type VendaElosgate } from "../lib/api";

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

describe("isSaleDelinquent & isSaleFullyPaid", () => {
  it("should classify an active recurring contract as NOT delinquent (Adimplente)", () => {
    const adimplenteRecurringSale: VendaElosgate = {
      ID: "sale-1",
      Numero: "409315636",
      ReferenciaVenda: "409315636",
      DataCriacao: "2026-06-19 14:13:05",
      DataAlteracao: "2026-09-19 06:20:39",
      Status: 2,
      StatusString: "Adimplente",
      MeiosPagamento: [
        {
          ID: "meio-1",
          Descricao: "Crédito Recorrente",
          NumeroParcelas: 12,
          Valor: 1019.88,
          Status: 3,
          StatusString: "Em Andamento",
          Parcelas: [
            {
              ID: "p-1",
              Numero: 1,
              Valor: 84.99,
              Vencimento: "2026-06-19 00:00:00",
              Pagamento: "2026-06-19 14:13:05",
              Status: 2,
              StatusString: "Efetivada"
            },
            {
              ID: "p-2",
              Numero: 2,
              Valor: 84.99,
              Vencimento: "2026-07-19 00:00:00",
              Pagamento: "2026-07-19 00:35:06",
              Status: 2,
              StatusString: "Efetivada"
            },
            {
              ID: "p-3",
              Numero: 3,
              Valor: 84.99,
              Vencimento: "2026-08-19 00:00:00",
              Pagamento: "2026-08-19 09:34:53",
              Status: 2,
              StatusString: "Efetivada"
            },
            {
              ID: "p-4",
              Numero: 4,
              Valor: 84.99,
              Vencimento: "2026-09-19 00:00:00",
              Pagamento: "2026-09-19 06:20:39",
              Status: 2,
              StatusString: "Efetivada"
            },
            {
              ID: "p-5",
              Numero: 5,
              Valor: 84.99,
              Vencimento: "2026-10-19 00:00:00",
              Pagamento: "",
              Status: 1,
              StatusString: "Agendada"
            }
          ]
        }
      ]
    };

    expect(isSaleDelinquent(adimplenteRecurringSale)).toBe(false);
    expect(isSaleFullyPaid(adimplenteRecurringSale)).toBe(false);
  });

  it("should classify a sale with overdue parcelas as delinquent (Inadimplente)", () => {
    const delinquentSale: VendaElosgate = {
      ID: "sale-2",
      Numero: "408777827",
      ReferenciaVenda: "408777827",
      DataCriacao: "2026-01-21 15:46:08",
      DataAlteracao: "2026-09-10 04:47:10",
      Status: 3,
      StatusString: "Inadimplente",
      MeiosPagamento: [
        {
          ID: "meio-2",
          Descricao: "Crédito Recorrente",
          NumeroParcelas: 12,
          Valor: 1078.80,
          Status: 3,
          StatusString: "Em Andamento",
          Parcelas: [
            {
              ID: "p-1",
              Numero: 1,
              Valor: 134.85,
              Vencimento: "2026-01-21 00:00:00",
              Pagamento: "2026-01-21 15:46:08",
              Status: 2,
              StatusString: "Efetivada"
            },
            {
              ID: "p-2",
              Numero: 2,
              Valor: 134.85,
              Vencimento: "2026-02-21 00:00:00",
              Pagamento: "",
              Status: 3,
              StatusString: "Atrasada"
            }
          ]
        }
      ]
    };

    expect(isSaleDelinquent(delinquentSale)).toBe(true);
    expect(isSaleFullyPaid(delinquentSale)).toBe(false);
  });

  it("should classify a finalized sale as fully paid and not delinquent", () => {
    const fullyPaidSale: VendaElosgate = {
      ID: "sale-3",
      Numero: "408122568",
      ReferenciaVenda: "408122568",
      DataCriacao: "2026-05-10 10:00:00",
      DataAlteracao: "2026-05-10 10:05:00",
      Status: 4,
      StatusString: "Finalizada",
      MeiosPagamento: [
        {
          ID: "meio-3",
          Descricao: "Pix",
          NumeroParcelas: 1,
          Valor: 250.00,
          Status: 2,
          StatusString: "Pago",
          Parcelas: [
            {
              ID: "p-1",
              Numero: 1,
              Valor: 250.00,
              Vencimento: "2026-05-10 00:00:00",
              Pagamento: "2026-05-10 10:05:00",
              Status: 16,
              StatusString: "Pagamento Com Pix"
            }
          ]
        }
      ]
    };

    expect(isSaleDelinquent(fullyPaidSale)).toBe(false);
    expect(isSaleFullyPaid(fullyPaidSale)).toBe(true);
  });
});
