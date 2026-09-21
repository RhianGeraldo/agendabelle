import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  type VendaElosgate, 
  obterURLVenda, 
  isSaleExcluded, 
  isSaleFullyPaid, 
  isSaleDelinquent 
} from "@/lib/api";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
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
  RefreshCw,
  AlertCircle
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

  // Filter out excluded / cancelled orders entirely
  const nonExcludedSales = useMemo(() => {
    return (vendas || []).filter((v) => !isSaleExcluded(v));
  }, [vendas]);

  // Separate active (pending, overdue, in progress) from completed/paid
  const activeSales = useMemo(() => {
    return nonExcludedSales.filter((v) => !isSaleFullyPaid(v));
  }, [nonExcludedSales]);

  const paidSales = useMemo(() => {
    return nonExcludedSales.filter((v) => isSaleFullyPaid(v));
  }, [nonExcludedSales]);

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

  const getValidMeio = (sale: VendaElosgate) => {
    if (!sale.MeiosPagamento || sale.MeiosPagamento.length === 0) return null;
    const valid = sale.MeiosPagamento.filter((m) => {
      const s = String(m.StatusString || "").toLowerCase();
      return (
        !s.includes("exclu") &&
        !s.includes("cancel") &&
        String(m.Status) !== "8" &&
        String(m.Status) !== "4"
      );
    });
    return valid.length > 0 ? valid[0] : sale.MeiosPagamento[0];
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

  const getFormattedDate = (rawDate: string | number | Date | null | undefined) => {
    if (!rawDate) return "";
    
    if (typeof rawDate === "string" && rawDate.includes("-")) {
      const datePart = rawDate.split(" ")[0];
      const parts = datePart.split("-");
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    
    if (typeof rawDate === "string" && rawDate.includes("/")) {
      return rawDate;
    }
    
    try {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("pt-BR");
      }
    } catch {
      // Ignora erro de parsing e cai no fallback
    }
    
    return String(rawDate);
  };

  const getSaleDate = (sale: VendaElosgate) => {
    const rawDate = sale.DataCriacao || sale.Data || sale.DataVenda || sale.dtVenda || sale.data;
    return getFormattedDate(rawDate) || "Data não informada";
  };

  const getSaleValue = (sale: VendaElosgate) => {
    const meio = getValidMeio(sale);
    if (meio && typeof meio.Valor === "number" && meio.Valor > 0) {
      return meio.Valor;
    }
    const val = sale.Valor || sale.ValorVenda || sale.ValorTotal || sale.value;
    if (val === undefined || val === null) return 0;
    
    if (typeof val === "number") return val;
    
    const cleaned = String(val)
      .replace("R$", "")
      .replace(/\s/g, "")
      .replace(".", "")
      .replace(",", ".");
      
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const getSaleStatus = (sale: VendaElosgate) => {
    if (isSaleDelinquent(sale)) {
      return "Inadimplente";
    }

    if (isSaleFullyPaid(sale)) {
      return "Pago";
    }

    const saleStatusStr = String(sale.StatusString || "").trim().toLowerCase();
    if (saleStatusStr === "adimplente" || saleStatusStr === "regular" || String(sale.Status) === "2") {
      return "Adimplente";
    }

    const meio = getValidMeio(sale);
    const meioStatusStr = String(meio?.StatusString || "").trim().toLowerCase();

    if (
      saleStatusStr.includes("andamento") ||
      meioStatusStr.includes("andamento") ||
      saleStatusStr === "em andamento"
    ) {
      return "Em Andamento";
    }

    return "Pendente";
  };

  const getPaymentLink = (sale: VendaElosgate) => {
    const meio = getValidMeio(sale);
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
    const meio = getValidMeio(sale);
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
      "Cartão / Pix"
    );
    return String(method);
  };

  const getInstallments = (sale: VendaElosgate) => {
    const meio = getValidMeio(sale);
    if (meio && typeof meio.NumeroParcelas === "number" && meio.NumeroParcelas > 0) {
      return meio.NumeroParcelas;
    }
    if (meio?.Parcelas && meio.Parcelas.length > 0) {
      return meio.Parcelas.length;
    }
    return sale.Parcelas || 1;
  };

  const getPaidParcelasCount = (sale: VendaElosgate) => {
    const meio = getValidMeio(sale);
    const parcelas = meio?.Parcelas || [];
    return parcelas.filter((p) => {
      const ps = String(p.StatusString || "").toLowerCase();
      return (
        (p.Pagamento !== null && p.Pagamento !== undefined && String(p.Pagamento).trim() !== "") ||
        String(p.Status) === "2" ||
        String(p.Status) === "11" ||
        String(p.Status) === "13" ||
        String(p.Status) === "16" ||
        ps.includes("efetiv") ||
        ps.includes("pago") ||
        ps.includes("pix")
      );
    }).length;
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);
  };

  const renderSaleCard = (sale: VendaElosgate, idx: number, isPaidCard: boolean) => {
    const desc = getSaleDescription(sale);
    const dateStr = getSaleDate(sale);
    const val = getSaleValue(sale);
    const status = getSaleStatus(sale);
    const link = getPaymentLink(sale);
    const method = getPaymentMethod(sale);
    const installments = getInstallments(sale);
    
    const meio = getValidMeio(sale);
    const parcelas = meio?.Parcelas || [];
    const paidParcelasCount = isPaidCard ? installments : getPaidParcelasCount(sale);
    const saleId = sale.ID || `sale-${idx}-${sale.Numero || ""}`;
    const isExpanded = !!expandedSales[saleId];

    return (
      <div 
        key={saleId} 
        className={cn(
          "border rounded-lg p-4 bg-background/60 transition-all duration-300 relative overflow-hidden",
          isPaidCard ? "hover:border-emerald-500/30" : "hover:border-primary/30"
        )}
      >
        <div 
          className={cn(
            "absolute top-0 left-0 w-1.5 h-full",
            isPaidCard || status === "Adimplente" || status === "Regular"
              ? "bg-emerald-500" 
              : status === "Inadimplente" || status === "Atrasada" 
              ? "bg-destructive" 
              : "bg-primary"
          )} 
        />
        
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
            {(status === "Adimplente" || status === "Regular") && (
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="h-3 w-3" /> Adimplente
              </Badge>
            )}
            {status === "Em Andamento" && (
              <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/10 flex items-center gap-1 font-semibold">
                <Clock className="h-3 w-3" /> Em Andamento
              </Badge>
            )}
            {(status === "Inadimplente" || status === "Atrasada") && (
              <Badge className="bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/10 flex items-center gap-1 font-semibold">
                <AlertCircle className="h-3 w-3" /> Inadimplente
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
        <div className="pl-2 flex items-center justify-between text-xs mt-2">
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
                const ps = String(p.StatusString || "").toLowerCase();
                const isPaid = isPaidCard || (
                  (p.Pagamento !== null && p.Pagamento !== undefined && String(p.Pagamento).trim() !== "") ||
                  String(p.Status) === "2" ||
                  String(p.Status) === "11" ||
                  String(p.Status) === "13" ||
                  String(p.Status) === "16" ||
                  ps.includes("efetiv") ||
                  ps.includes("pago") ||
                  ps.includes("pix")
                );
                const pStatusStr = String(p.StatusString || p.Status || "").trim().toLowerCase();
                const isAtrasada = !isPaid && (pStatusStr === "atrasada" || pStatusStr === "atrasado" || String(p.Status) === "3");
                const isAgendada = !isPaid && !isAtrasada && (pStatusStr === "agendada" || String(p.Status) === "1");
                
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
                          <CheckCircle2 className="h-3 w-3" /> Pago {formattedPag ? `em ${formattedPag}` : ""}
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
                      ) : isAgendada ? (
                        <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/10 h-5 text-[10px] font-semibold">
                          Agendada
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

        {/* Payment Button for Active (unpaid / overdue) sales */}
        {!isPaidCard && (status === "Inadimplente" || status === "Atrasada" || status === "Pendente" || Boolean(link)) && (
          <div className="pl-2 mt-3">
            {link ? (
              <Button 
                asChild 
                className="w-full text-xs font-semibold h-9 bg-primary hover:bg-primary/90 flex items-center justify-center gap-1.5 shadow-sm"
              >
                <a href={link} target="_blank" rel="noopener noreferrer">
                  <CreditCard className="h-3.5 w-3.5" />
                  Pagar Agora
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
                    Obter Link de Pagamento
                    <ExternalLink className="h-3 w-3 ml-0.5" />
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {!isPaidCard && (status === "Adimplente" || status === "Regular") && !link && (
          <div className="pl-2 mt-2 pt-2 border-t border-border/40 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>Plano em dia com cobrança recorrente automática.</span>
          </div>
        )}
      </div>
    );
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
          Consulte seus pagamentos em aberto, regularize pendências e veja o histórico de pagamentos.
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground space-y-4">
            <Clock className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm animate-pulse">Carregando dados financeiros...</p>
          </div>
        ) : nonExcludedSales.length === 0 ? (
          <div className="text-center py-8 bg-muted/20 rounded-lg border">
            <DollarSign className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-muted-foreground">Nenhum registro financeiro encontrado.</p>
          </div>
        ) : (
          <div className="space-y-5 pt-2">
            {/* Seção 1: Pagamentos Ativos (Pendentes / Inadimplentes / Em Aberto) */}
            {activeSales.length === 0 ? (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Tudo em dia!</p>
                  <p className="text-xs text-muted-foreground">Você não possui pagamentos ou pendências em aberto no momento.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Pagamentos em Aberto ({activeSales.length})
                </p>
                {activeSales.map((sale, idx) => renderSaleCard(sale, idx, false))}
              </div>
            )}

            {/* Seção 2: Pagamentos Concluídos / Pagos (Toggle Accordion) */}
            {paidSales.length > 0 && (
              <div className="pt-2">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="pagos" className="border rounded-lg px-3 bg-muted/10 shadow-sm border-border/60">
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span className="font-semibold text-sm">Pagamentos Concluídos</span>
                        <span className="text-xs bg-emerald-500/10 text-emerald-700 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/20">
                          {paidSales.length}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-2 space-y-3">
                      {paidSales.map((sale, idx) => renderSaleCard(sale, idx, true))}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
