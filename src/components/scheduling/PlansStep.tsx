import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buscarPlanos, buscarServicos, type Cliente, type Plano, type Servico, type AgendamentoHistorico } from "@/lib/api";
import { ArrowLeft, ChevronRight, Loader2, Package, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PlansStepProps {
  unit: string;
  cliente: Cliente;
  appointments: AgendamentoHistorico[];
  onPlanSelected: (plano: Plano, servicos: Servico[]) => void;
  onBack: () => void;
}

export function PlansStep({ unit, cliente, appointments, onPlanSelected, onBack }: PlansStepProps) {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectingPlan, setSelectingPlan] = useState<number | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await buscarPlanos(unit, 1, cliente.codigo);
        setPlanos(Array.isArray(data) ? data : []);
      } catch {
        toast.error("Erro ao buscar planos");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [unit, cliente.codigo]);

  const handleSelectPlan = async (plano: Plano) => {
    setSelectingPlan(plano.codPlano);
    try {
      const servicos = await buscarServicos(unit, plano.codPlano);
      onPlanSelected(plano, Array.isArray(servicos) ? servicos : []);
    } catch {
      toast.error("Erro ao buscar serviços do plano");
    } finally {
      setSelectingPlan(null);
    }
  };

  const isPlanBooked = (plano: Plano) => {
    return appointments.some(appt => {
      // Confirma que não está checando lixo
      if (appt.status !== "Marcado" && appt.status !== "Confirmado") return false;
      // Checa os serviços do appt se tem match com serviços do plano
      return appt.servicos.some(hs => 
        plano.servicos.some(ps => String(ps.codServico) === String(hs.cod))
      );
    });
  };

  return (
    <Card className="border-0 shadow-lg shadow-primary/5">
      <CardHeader className="pb-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="w-fit -ml-2 mb-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <CardTitle className="font-display text-xl">
          Olá, {cliente.nome.split(" ")[0]}!
        </CardTitle>
        <p className="text-sm text-muted-foreground">Selecione o plano que deseja agendar</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : planos.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum plano encontrado.</p>
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
                      {plano.servicos.map((s) => (
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
  );
}
