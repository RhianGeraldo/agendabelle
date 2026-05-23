import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type VendaElosgate, obterURLVenda } from "@/lib/api";
import { cn } from "@/lib/utils";
import { 
  CreditCard, 
  Calendar, 
  DollarSign, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Wallet,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  RefreshCw
} from "lucide-react";

interface PaymentsStepProps {
  vendas: VendaElosgate[];
  loading: boolean;
  unit: string;
  onBack: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}

export function PaymentsStep({ 
  vendas, 
  loading, 
  unit, 
  onBack, 
  onRefresh, 
  refreshing 
}: PaymentsStepProps) {
  const [expandedSales, setExpandedSales] = useState<Record<string, boolean>>({});
  const [generatingLink, setGeneratingLink] = useState<Record<string, boolean>>({});

  const toggleSale = (saleId: string) => {
    setExpandedSales(prev => ({
      ...prev,
      [saleId]: !prev[saleId]
    }));
  };

  const handleGenerateLink = async (saleId: string, numeroVenda: string) => {
    if (!numeroVenda) return;
    
    setGeneratingLink(prev => ({ ...prev, [saleId]: true }));
    try {
      const url = await obterURLVenda(unit, numeroVenda);
      if (url) {
        window.open(url, "_blank");
      } else {
        alert("Não foi possível obter o link de pagamento para esta venda.");
      }
    } catch (err) {
      console.error(err);
      alert("Ocorreu um erro ao buscar o link de pagamento.");
    } finally {
      setGeneratingLink(prev => ({ ...prev, [saleId]: false }));
    }
  };

  const getSaleDescription = (sale: VendaElosgate) => {
    if (sale.Numero) {
      return `Venda #${sale.Numero}`;
    }
    if (sale.ReferenciaVenda) {
      return `Venda #${sale.ReferenciaVenda}`;
    }
    const val = (
      sale.Descricao ||
      sale.DescricaoServico ||
      sale.NomeServico ||
      sale.Produto ||
      sale.Pacote ||
      sale.descricao ||
      "Procedimento / Venda"
    );
    return String(val);
  };

  const getFormattedDate = (rawDate: any) => {
    if (!rawDate) return "";
    
    // Format standard YYYY-MM-DD HH:mm:ss to DD/MM/YYYY
    if (typeof rawDate === "string" && rawDate.includes("-")) {
      const datePart = rawDate.split(" ")[0];
      const parts = datePart.split("-");
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    
    // If it's already a formatted string like dd/MM/yyyy
    if (typeof rawDate === "string" && rawDate.includes("/")) {
      return rawDate;
    }
    
    // Otherwise try parsing it
    try {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("pt-BR");
      }
    } catch {}
    
    return String(rawDate);
  };

  const getSaleDate = (sale: VendaElosgate) => {
    const rawDate = sale.DataCriacao || sale.Data || sale.DataVenda || sale.dtVenda || sale.data;
    return getFormattedDate(rawDate) || "Data não informada";
  };

  const getSaleValue = (sale: VendaElosgate) => {
    if (sale.MeiosPagamento && sale.MeiosPagamento.length > 0) {
      return sale.MeiosPagamento[0].Valor || 0;
    }
    const val = sale.Valor || sale.ValorVenda || sale.ValorTotal || sale.value;
    if (val === undefined || val === null) return 0;
    
    if (typeof val === "number") return val;
    
    // Try to parse string
    const cleaned = String(val)
      .replace("R$", "")
      .replace(/\s/g, "")
      .replace(".", "")
      .replace(",", ".");
      
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const getSaleStatus = (sale: VendaElosgate) => {
    const saleStatusStr = String(sale.StatusString || "").trim().toLowerCase();
    
    // Check main sale cancel status first
    if (saleStatusStr.includes("cancel") || saleStatusStr === "pedido cancelado" || String(sale.Status) === "5") {
      return "Cancelado";
    }
    
    // Check main sale default/late status
    if (saleStatusStr.includes("inadimpl") || saleStatusStr.includes("atrasa") || String(sale.Status) === "3") {
      return "Atrasada";
    }

    // Check main sale good standing status
    if (saleStatusStr === "adimplente" || saleStatusStr === "regular" || String(sale.Status) === "2") {
      return "Regular";
    }

    const meio = sale.MeiosPagamento?.[0];
    const rawStatus = sale.StatusString || meio?.StatusString || sale.Status || sale.status || "Pendente";
    const status = String(rawStatus).trim().toLowerCase();

    if (
      status.includes("cancel") ||
      status.includes("estorn") ||
      status.includes("recus") ||
      ["cancelado", "estornado", "recusado", "2", "5", "inactive", "rejeitado", "pedido cancelado", "solicitação cancelada"].includes(status)
    ) {
      return "Cancelado";
    }

    if (
      status === "adimplente" ||
      status === "regular" ||
      status === "em dia"
    ) {
      return "Regular";
    }

    if (
      status.includes("pago") ||
      status.includes("aprov") ||
      status.includes("confirm") ||
      status.includes("sucess") ||
      status.includes("captur") ||
      status.includes("efetiv") ||
      ["pago", "aprovado", "confirmado", "sucesso", "capturado", "1", "active", "finalizada", "efetivada"].includes(status)
    ) {
      return "Pago";
    }

    if (
      status.includes("atrasa") ||
      status.includes("inadimpl") ||
      ["atrasada", "atrasado", "inadimplente", "3"].includes(status)
    ) {
      return "Atrasada";
    }

    return "Pendente";
  };

  const getPaymentLink = (sale: VendaElosgate) => {
    const meio = sale.MeiosPagamento?.[0];
    const link = sale.Link ||
      sale.LinkPagamento ||
      sale.Url ||
      sale.UrlPagamento ||
      sale.link ||
      meio?.Link ||
      meio?.LinkPagamento ||
      meio?.Parcelas?.[0]?.Link ||
      meio?.Parcelas?.[0]?.LinkPagamento ||
      null;
    return link;
  };

  const getPaymentMethod = (sale: VendaElosgate) => {
    const meio = sale.MeiosPagamento?.[0];
    if (meio) {
      const parcelaMeio = meio.Parcelas?.[0]?.MeioPagamento;
      if (parcelaMeio) return parcelaMeio;
      
      if (meio.Descricao && meio.Descricao !== "Não Definido") {
        return meio.Descricao;
      }
    }
    const method = (
      sale.FormaPagamento ||
      sale.MeioPagamento ||
      sale.formaPagamento ||
      "Cartão de Crédito"
    );
    return String(method);
  };

  const getInstallments = (sale: VendaElosgate) => {
    const meio = sale.MeiosPagamento?.[0];
    if (meio && typeof meio.NumeroParcelas === "number") {
      return meio.NumeroParcelas;
    }
    return sale.Parcelas || 1;
  };

  const getPaidParcelasCount = (sale: VendaElosgate) => {
    const parcelas = sale.MeiosPagamento?.[0]?.Parcelas || [];
    return parcelas.filter(
      p => p.Pagamento !== null && p.Pagamento !== undefined && String(p.Pagamento).trim() !== ""
    ).length;
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);
  };

  return (
    <Card className="border-0 shadow-lg shadow-primary/5">
      <CardHeader className="pb-2">
        {/* Navigation Action Header */}
        <div className="flex items-center justify-between w-full mb-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onBack} 
            className="w-fit -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onRefresh}
            className="text-primary hover:text-primary hover:bg-primary/10 transition-all font-medium"
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-1", refreshing && "animate-spin")} /> Atualizar
          </Button>
        </div>

        <CardTitle className="font-display text-xl flex items-center gap-2 mt-1">
          <Wallet className="h-5 w-5 text-primary" /> Financeiro e Pagamentos
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Consulte suas faturas, links de pagamentos e histórico financeiro.
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground space-y-4">
            <Clock className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm animate-pulse">Carregando dados financeiros...</p>
          </div>
        ) : vendas.length === 0 ? (
          <div className="text-center py-8 bg-muted/20 rounded-lg border">
            <DollarSign className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-muted-foreground">Nenhum registro financeiro encontrado.</p>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {vendas.map((sale, idx) => {
              const desc = getSaleDescription(sale);
              const dateStr = getSaleDate(sale);
              const val = getSaleValue(sale);
              const status = getSaleStatus(sale);
              const link = getPaymentLink(sale);
              const method = getPaymentMethod(sale);
              const installments = getInstallments(sale);
              
              const parcelas = sale.MeiosPagamento?.[0]?.Parcelas || [];
              const paidParcelasCount = getPaidParcelasCount(sale);
              const saleId = sale.ID || String(idx);
              const isExpanded = !!expandedSales[saleId];

              return (
                <div 
                  key={saleId} 
                  className="border rounded-md p-4 bg-background/50 hover:border-primary/20 hover:bg-background/80 transition-all duration-300 relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                  
                  <div className="flex justify-between items-start mb-2 pl-2">
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="font-semibold text-sm text-foreground leading-snug truncate" title={desc}>
                        {desc}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Calendar className="h-3 w-3" />
                        Comprado em {dateStr}
                      </p>
                    </div>
                    <div>
                      {status === "Pago" && (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10 flex items-center gap-1 font-semibold">
                          <CheckCircle2 className="h-3 w-3" /> Pago
                        </Badge>
                      )}
                      {status === "Regular" && (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10 flex items-center gap-1 font-semibold">
                          <CheckCircle2 className="h-3 w-3" /> Regular
                        </Badge>
                      )}
                      {status === "Cancelado" && (
                        <Badge className="bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/10 flex items-center gap-1 font-semibold">
                          <XCircle className="h-3 w-3" /> Cancelado
                        </Badge>
                      )}
                      {status === "Atrasada" && (
                        <Badge className="bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/10 flex items-center gap-1 font-semibold">
                          <Clock className="h-3 w-3" /> Atrasada
                        </Badge>
                      )}
                      {status === "Pendente" && (
                        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/10 flex items-center gap-1 font-semibold">
                          <Clock className="h-3 w-3 animate-pulse" /> Pendente
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="pl-2 grid grid-cols-2 gap-2 py-3 border-t border-b border-border/40 my-3 text-xs bg-muted/20 rounded-sm">
                    <div>
                      <p className="text-muted-foreground font-medium mb-0.5">Valor Total</p>
                      <p className="font-bold text-sm text-foreground">
                        {formatCurrency(val)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground font-medium mb-0.5">Forma de Pagamento</p>
                      <p className="font-medium text-foreground truncate" title={method}>
                        {method} {installments > 1 && `(${installments}x)`}
                      </p>
                    </div>
                  </div>

                  {/* Parcelas counter and Toggle Button */}
                  <div className="pl-2 flex items-center justify-between text-xs mt-3">
                    <span className="font-medium text-muted-foreground">
                      Parcelas: <span className="font-semibold text-foreground">{paidParcelasCount} / {installments}</span>
                    </span>
                    {parcelas.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSale(saleId)}
                        className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/5 px-2 flex items-center gap-1 font-semibold"
                      >
                        {isExpanded ? (
                          <>Ocultar Parcelas <ChevronUp className="h-3.5 w-3.5" /></>
                        ) : (
                          <>Ver Parcelas <ChevronDown className="h-3.5 w-3.5" /></>
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Expanded Installments Details */}
                  {isExpanded && parcelas.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-dashed border-border/60 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-2 mb-1">
                        Detalhamento das Parcelas
                      </p>
                      <div className="space-y-1.5 pl-2">
                        {parcelas.map((p, pIdx) => {
                          const isPaid = p.Pagamento !== null && p.Pagamento !== undefined && String(p.Pagamento).trim() !== "";
                          const pStatusStr = String(p.StatusString || p.Status || "").trim().toLowerCase();
                          const isAtrasada = pStatusStr === "atrasada" || pStatusStr === "atrasado" || String(p.Status) === "3";
                          
                          const formattedVenc = getFormattedDate(p.Vencimento);
                          const formattedPag = isPaid ? getFormattedDate(p.Pagamento) : "";
                          const pVal = p.Valor || 0;
                          
                          return (
                            <div 
                              key={p.ID || pIdx} 
                              className="flex justify-between items-center p-2.5 rounded bg-muted/40 border border-border/30 text-xs"
                            >
                              <div className="space-y-0.5">
                                <p className="font-semibold text-foreground">
                                  Parcela {p.Numero || (pIdx + 1)}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  Vencimento: {formattedVenc}
                                </p>
                                {isPaid && (
                                  <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-0.5 mt-0.5">
                                    <CheckCircle2 className="h-3 w-3" /> Pago em {formattedPag}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-foreground pr-1">{formatCurrency(pVal)}</span>
                                {isPaid ? (
                                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10 h-5 text-[10px] font-semibold">
                                    Pago
                                  </Badge>
                                ) : isAtrasada ? (
                                  <Badge className="bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/10 h-5 text-[10px] font-semibold">
                                    Atrasada
                                  </Badge>
                                ) : (
                                  <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/10 h-5 text-[10px] font-semibold">
                                    Pendente
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Payment Button with Dynamic Link Generation Fallback */}
                  {(status === "Pendente" || status === "Atrasada") && (
                    <div className="pl-2 mt-3">
                      {link ? (
                        <Button 
                          asChild 
                          className="w-full text-xs font-semibold h-9 bg-primary hover:bg-primary/90 flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <a href={link} target="_blank" rel="noopener noreferrer">
                            <CreditCard className="h-3.5 w-3.5" />
                            Efetuar Pagamento
                            <ExternalLink className="h-3 w-3 ml-0.5" />
                          </a>
                        </Button>
                      ) : (
                        <Button 
                          onClick={() => handleGenerateLink(saleId, sale.Numero || sale.ReferenciaVenda)}
                          disabled={generatingLink[saleId]}
                          className="w-full text-xs font-semibold h-9 bg-primary hover:bg-primary/90 flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          {generatingLink[saleId] ? (
                            <>
                              <Clock className="h-3.5 w-3.5 animate-spin" />
                              Gerando Link...
                            </>
                          ) : (
                            <>
                              <CreditCard className="h-3.5 w-3.5" />
                              Gerar Link de Pagamento
                              <ExternalLink className="h-3 w-3 ml-0.5" />
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
