import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { buscarPlanos, buscarServicos, type Cliente, type Plano, type Servico, type AgendamentoHistorico } from "@/lib/api";
import { ArrowLeft, ChevronRight, Loader2, Package, CheckCircle2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const EVALUATION_SELECTION = [{
  plano: { codPlano: -1, nome: "Avaliação Gratuita", label: "Avaliação Gratuita", servicos: [] },
  servicos: [{
    codSaldo: 0,
    codPlano: -1,
    codServico: 0,
    nome: "Avaliação Gratuita",
    label: "Avaliação Gratuita",
    valor: "0",
    saldoAtual: "1",
    saldoRestante: "1",
    saldoTotal: "1",
    tempo: 20,
    usaDia: "N",
    diaRetorno: 0,
    categoria: "Avaliação",
    tipo: "Avaliação"
  }]
}];

interface PlansStepProps {
  unit: string;
  cliente: Cliente;
  appointments: AgendamentoHistorico[];
  onPlanSelected: (selection: { plano: Plano; servicos: Servico[] }[]) => void;
  onBack: () => void;
  onRefresh?: () => void;
}

export function PlansStep({ unit, cliente, appointments, onPlanSelected, onBack, onRefresh }: PlansStepProps) {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectingPlan, setSelectingPlan] = useState<number | string | null>(null);
  const [isMultiSelectOpen, setIsMultiSelectOpen] = useState(false);
  const [selectedPlanIds, setSelectedPlanIds] = useState<number[]>([]);

  const fetchPlanos = async () => {
    try {
      setLoading(true);
      const data = await buscarPlanos(unit, 1, cliente.codigo);
      setPlanos(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Erro ao buscar planos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlanos();
  }, [unit, cliente.codigo]);

  const handleRefresh = () => {
    fetchPlanos();
    onRefresh?.();
  };

  const bookedAreas = useMemo(() => {
    const names = new Set<string>();
    const codes = new Set<string>();
    appointments.forEach(appt => {
      if (appt.status === "Marcado" || appt.status === "Confirmado") {
        (appt.servicos || []).forEach(hs => {
          if (hs.nome) {
            names.add(hs.nome.split(" - ")[0].trim().toLowerCase());
          }
          if (hs.cod) {
            codes.add(String(hs.cod).trim());
          }
        });
      }
    });
    return { names, codes };
  }, [appointments]);

  const handleSelectPlan = async (plano: Plano) => {
    setSelectingPlan(plano.codPlano);
    try {
      const servicosRaw = await buscarServicos(unit, plano.codPlano);
      const servicos = Array.isArray(servicosRaw) ? servicosRaw : [];
      
      const filteredServicos = servicos.filter(s => {
        const key = s.nome.split(" - ")[0].trim().toLowerCase();
        const code = String(s.codServico).trim();
        return !(bookedAreas.names.has(key) || bookedAreas.codes.has(code));
      });

      if (filteredServicos.length === 0) {
        toast.info("Todos os serviços deste plano já estão agendados.");
        return;
      }

      onPlanSelected([{ plano, servicos: filteredServicos }]);
    } catch {
      toast.error("Erro ao buscar serviços do plano");
    } finally {
      setSelectingPlan(null);
    }
  };

  const isDepilacao = (nome: string) => nome.toLowerCase().includes("depila");
  const isClareamento = (nome: string) => nome.toLowerCase().includes("clareamento");
  const isFacialArea = (nome: string) => {
    const n = nome.toLowerCase();
    return (n.includes("barba") || n.includes("buço") || n.includes("buco") || n.includes("facial")) && !n.includes("rejuvenescimento");
  };
  const isRejuvenescimento = (nome: string) => nome.toLowerCase().includes("rejuvenescimento");

  const hasSelectedDepilacao = selectedPlanIds.some(id => {
    const p = planos.find(p => p.codPlano === id);
    return p && (isDepilacao(p.nome) || (p.servicos || []).some(s => isDepilacao(s.nome)));
  });

  const hasSelectedClareamento = selectedPlanIds.some(id => {
    const p = planos.find(p => p.codPlano === id);
    return p && (isClareamento(p.nome) || (p.servicos || []).some(s => isClareamento(s.nome)));
  });

  const hasSelectedFacialArea = selectedPlanIds.some(id => {
    const p = planos.find(p => p.codPlano === id);
    return p && (isFacialArea(p.nome) || (p.servicos || []).some(s => isFacialArea(s.nome)));
  });

  const hasSelectedRejuvenescimento = selectedPlanIds.some(id => {
    const p = planos.find(p => p.codPlano === id);
    return p && (isRejuvenescimento(p.nome) || (p.servicos || []).some(s => isRejuvenescimento(s.nome)));
  });

  const togglePlanSelection = (plano: Plano) => {
    const isSelected = selectedPlanIds.includes(plano.codPlano);
    
    if (!isSelected) {
      const isPlanDepilacao = isDepilacao(plano.nome) || (plano.servicos || []).some(s => isDepilacao(s.nome));
      const isPlanClareamento = isClareamento(plano.nome) || (plano.servicos || []).some(s => isClareamento(s.nome));
      const isPlanFacialArea = isFacialArea(plano.nome) || (plano.servicos || []).some(s => isFacialArea(s.nome));
      const isPlanRejuvenescimento = isRejuvenescimento(plano.nome) || (plano.servicos || []).some(s => isRejuvenescimento(s.nome));

      if (isPlanDepilacao && hasSelectedClareamento) {
        toast.error("Não é possível agendar depilação e clareamento juntos. Os procedimentos exigem um intervalo de 25 dias entre si.");
        return;
      }
      if (isPlanClareamento && hasSelectedDepilacao) {
        toast.error("Não é possível agendar depilação e clareamento juntos. Os procedimentos exigem um intervalo de 25 dias entre si.");
        return;
      }
      if (isPlanFacialArea && hasSelectedRejuvenescimento) {
        toast.error("Não é possível agendar depilação facial (barba/buço/facial) e rejuvenescimento facial juntos. Os procedimentos exigem um intervalo de 45 dias entre si.");
        return;
      }
      if (isPlanRejuvenescimento && hasSelectedFacialArea) {
        toast.error("Não é possível agendar depilação facial (barba/buço/facial) e rejuvenescimento facial juntos. Os procedimentos exigem um intervalo de 45 dias entre si.");
        return;
      }
      
      setSelectedPlanIds(prev => [...prev, plano.codPlano]);
    } else {
      setSelectedPlanIds(prev => prev.filter(id => id !== plano.codPlano));
    }
  };

  const handleMultiSelectSubmit = async () => {
    if (selectedPlanIds.length === 0) {
      toast.info("Selecione pelo menos um pacote.");
      return;
    }

    setSelectingPlan("all");
    try {
      const selectedPlans = planos.filter(p => selectedPlanIds.includes(p.codPlano));
      let selectionRaw = await Promise.all(selectedPlans.map(async (plano) => {
        const servicos = await buscarServicos(unit, plano.codPlano);
        return { plano, servicos: Array.isArray(servicos) ? servicos : [] };
      }));

      selectionRaw.sort((a, b) => b.servicos.length - a.servicos.length);

      const seenServices = new Set<string>();
      const deduplicatedSelection: { plano: Plano; servicos: Servico[] }[] = [];

      for (const item of selectionRaw) {
        const filteredServicos = item.servicos.filter(s => {
          const key = s.nome.split(" - ")[0].trim().toLowerCase();
          const code = String(s.codServico).trim();
          if (seenServices.has(key) || bookedAreas.names.has(key) || bookedAreas.codes.has(code)) {
            return false;
          }
          seenServices.add(key);
          return true;
        });

        if (filteredServicos.length > 0) {
          deduplicatedSelection.push({ ...item, servicos: filteredServicos });
        }
      }

      if (deduplicatedSelection.length === 0) {
        toast.info("Não há serviços válidos para agendar.");
        setSelectingPlan(null);
        return;
      }

      setIsMultiSelectOpen(false);
      onPlanSelected(deduplicatedSelection);
    } catch {
      toast.error("Erro ao buscar serviços dos planos");
    } finally {
      setSelectingPlan(null);
    }
  };

  const isPlanBooked = (plano: Plano) => {
    if (!plano.servicos || plano.servicos.length === 0) return false;
    return plano.servicos.every(s => {
      const area = s.nome.split(" - ")[0].trim().toLowerCase();
      const code = String(s.codServico).trim();
      return bookedAreas.names.has(area) || bookedAreas.codes.has(code);
    });
  };

  const unbookedPlans = planos.filter(p => !isPlanBooked(p));

  return (
    <>
      <Card className="border-0 shadow-lg shadow-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between w-full mb-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="w-fit -ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefresh}
            className="text-primary hover:text-primary hover:bg-primary/10 transition-all"
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} /> Atualizar
          </Button>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="font-display text-xl truncate">
              Olá, {cliente.nome.split(" ")[0]}!
            </CardTitle>
            <p className="text-sm text-muted-foreground">Selecione o plano que deseja agendar</p>
          </div>
          {unbookedPlans.length > 1 && (
            <Button 
              variant="default"
              size="sm" 
              onClick={() => {
                setSelectedPlanIds([]);
                setIsMultiSelectOpen(true);
              }}
              disabled={selectingPlan !== null}
              className="font-semibold w-full sm:w-auto flex items-center justify-center shrink-0"
            >
              <Package className="h-4 w-4 mr-2" />
              Agendar múltiplos pacotes
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : planos.length === 0 ? (
          <div className="py-4 text-center space-y-4">
            <div className="p-6 rounded-xl border border-primary/20 bg-primary/5 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-lg text-foreground">Agende sua Avaliação Gratuita</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Você não possui planos ativos no momento. Escolha o melhor dia e horário para realizar uma avaliação com nossos especialistas.
              </p>
              <Button
                size="lg"
                className="w-full sm:w-auto font-semibold mt-2"
                onClick={() => onPlanSelected(EVALUATION_SELECTION)}
              >
                Agendar Avaliação Gratuita
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {planos.map((plano) => {
              const booked = isPlanBooked(plano);
              
              return (
              <button
                key={plano.codPlano}
                onClick={() => {
                  if (booked) {
                    toast.info(`Já existe um agendamento para esse plano.`);
                    return;
                  }
                  handleSelectPlan(plano);
                }}
                disabled={selectingPlan !== null}
                className={cn(
                  "w-full text-left p-4 rounded-lg border border-border bg-card transition-all group disabled:opacity-50",
                  booked ? "opacity-60 cursor-not-allowed border-orange-200/40" : "hover:border-primary/30 hover:bg-accent/50"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Package className={cn("h-4 w-4 shrink-0", booked ? "text-orange-500" : "text-primary")} />
                      <span className="font-medium text-sm truncate">{plano.nome}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(plano.servicos || []).map((s) => (
                        <span
                          key={s.codServico}
                          className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground"
                        >
                          {s.nome.split(" - ")[0]} ({s.saldoRestante}x)
                        </span>
                      ))}
                    </div>
                    {booked && (
                      <div className="mt-3 flex items-center text-xs font-medium text-orange-600 bg-orange-500/10 w-fit px-2 py-1 rounded-md">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Já existe um agendamento para esse plano.
                      </div>
                    )}
                  </div>
                  {!booked && (
                    selectingPlan === plano.codPlano ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0 mt-1" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 mt-1 transition-colors" />
                    )
                  )}
                </div>
              </button>
            )})}
          </div>
        )}
      </CardContent>
    </Card>

      <Dialog open={isMultiSelectOpen} onOpenChange={setIsMultiSelectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar Pacotes</DialogTitle>
            <DialogDescription>
              Selecione os pacotes que deseja agendar. Lembre-se: depilação e clareamento não podem ser agendados juntos (intervalo de 25 dias), e procedimentos faciais (barba/buço/facial) não podem ser agendados junto com rejuvenescimento facial (intervalo de 45 dias).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            {unbookedPlans.map(plano => {
              const isSelected = selectedPlanIds.includes(plano.codPlano);
              const isPlanDepilacao = isDepilacao(plano.nome) || (plano.servicos || []).some(s => isDepilacao(s.nome));
              const isPlanClareamento = isClareamento(plano.nome) || (plano.servicos || []).some(s => isClareamento(s.nome));
              const isPlanFacialArea = isFacialArea(plano.nome) || (plano.servicos || []).some(s => isFacialArea(s.nome));
              const isPlanRejuvenescimento = isRejuvenescimento(plano.nome) || (plano.servicos || []).some(s => isRejuvenescimento(s.nome));
              
              const isDisabled = 
                (!isSelected && isPlanDepilacao && hasSelectedClareamento) ||
                (!isSelected && isPlanClareamento && hasSelectedDepilacao) ||
                (!isSelected && isPlanFacialArea && hasSelectedRejuvenescimento) ||
                (!isSelected && isPlanRejuvenescimento && hasSelectedFacialArea);

              return (
                <div 
                  key={plano.codPlano}
                  onClick={() => {
                    if (isDisabled) {
                      if ((isPlanFacialArea && hasSelectedRejuvenescimento) || (isPlanRejuvenescimento && hasSelectedFacialArea)) {
                        toast.error("Não é possível agendar depilação facial e rejuvenescimento juntos.");
                      } else {
                        toast.error("Não é possível agendar depilação e clareamento juntos.");
                      }
                      return;
                    }
                    togglePlanSelection(plano);
                  }}
                  className={cn(
                    "flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-all",
                    isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
                    isDisabled && "opacity-50 cursor-not-allowed bg-muted/50"
                  )}
                >
                  <Checkbox 
                    checked={isSelected}
                    onCheckedChange={() => {
                       // handled by parent div click
                    }}
                    disabled={isDisabled}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground">{plano.nome}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(plano.servicos || []).map((s) => (
                        <span key={s.codServico} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {s.nome.split(" - ")[0]}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMultiSelectOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleMultiSelectSubmit}
              disabled={selectedPlanIds.length === 0 || selectingPlan === "all"}
            >
              {selectingPlan === "all" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Continuar ({selectedPlanIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
