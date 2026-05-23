import { useState, useEffect } from "react";
import { LoginStep } from "@/components/scheduling/LoginStep";
import { PlansStep } from "@/components/scheduling/PlansStep";
import { ScheduleStep } from "@/components/scheduling/ScheduleStep";
import { ConfirmationStep } from "@/components/scheduling/ConfirmationStep";
import { AppointmentsStep } from "@/components/scheduling/AppointmentsStep";
import { PaymentsStep } from "@/components/scheduling/PaymentsStep";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  buscarHistoricoAgenda, 
  buscarAgendamentosAbertos, 
  buscarAgendamentosFinalizados, 
  alterarStatusAgendamento, 
  buscarVendasElosgate, 
  type Cliente, 
  type Plano, 
  type Servico, 
  type AgendamentoHistorico, 
  type VendaElosgate 
} from "@/lib/api";
import { format, subDays, addDays, subMonths, addMonths, parse } from "date-fns";
import { toast } from "sonner";

type Step = "login" | "plans" | "schedule" | "confirmation";

const Index = () => {
  const [step, setStep] = useState<Step>("login");
  const [unit, setUnit] = useState("");
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [selection, setSelection] = useState<{ plano: Plano; servicos: Servico[] }[]>([]);
  const [bookingResult, setBookingResult] = useState<Record<string, unknown> | null>(null);
  const [dataAgendamento, setDataAgendamento] = useState("");
  const [horario, setHorario] = useState("");
  const [profAgendado, setProfAgendado] = useState<{ cod: string; nome: string } | null>(null);
  const [failedItems, setFailedItems] = useState<{ plano: Plano; servicos: Servico[]; motivo: string }[]>([]);
  
  const [appointments, setAppointments] = useState<AgendamentoHistorico[]>([]);
  const [loadingAppts, setLoadingAppts] = useState(false);
  const [vendas, setVendas] = useState<VendaElosgate[]>([]);
  const [loadingFinanceiro, setLoadingFinanceiro] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const cachedUnit = localStorage.getItem("agendabelle_unit");
    const cachedCliente = localStorage.getItem("agendabelle_cliente");
    
    if (cachedUnit && cachedCliente) {
      try {
        const parsedCliente = JSON.parse(cachedCliente);
        setUnit(cachedUnit);
        setCliente(parsedCliente);
        setStep("plans");
      } catch (e) {
        localStorage.removeItem("agendabelle_unit");
        localStorage.removeItem("agendabelle_cliente");
      }
    }
  }, []);

  useEffect(() => {
    if (step === "plans" && unit && cliente) {
      let mounted = true;
      const fetchAll = async () => {
        try {
          setLoadingAppts(true);
          setLoadingFinanceiro(true);
          const hoje = new Date();
          
          const pastStart = format(subMonths(hoje, 2), "dd/MM/yyyy");
          const pastEnd = format(hoje, "dd/MM/yyyy");
          
          const futureStart = format(hoje, "dd/MM/yyyy");
          const futureEnd = format(addMonths(hoje, 2), "dd/MM/yyyy");

          const [results, elosgateRes] = await Promise.all([
            Promise.allSettled([
              buscarAgendamentosAbertos(unit, 1, pastStart, pastEnd),
              buscarAgendamentosAbertos(unit, 1, futureStart, futureEnd),
              buscarAgendamentosFinalizados(unit, 1, pastStart, pastEnd),
              buscarAgendamentosFinalizados(unit, 1, futureStart, futureEnd)
            ]),
            Promise.allSettled([
              buscarVendasElosgate(unit, cliente.cpf)
            ])
          ]);

          if (!mounted) return;

          // Parse Elosgate sales
          if (elosgateRes[0].status === "fulfilled") {
            setVendas(elosgateRes[0].value || []);
          } else {
            console.error("Erro ao carregar dados do Elosgate:", elosgateRes[0].reason);
            setVendas([]);
          }

          // Parse Belle Software appointments
          const allAppointments = new Map<number, AgendamentoHistorico>();
          
          results.forEach(res => {
            if (res.status === "fulfilled" && Array.isArray(res.value)) {
              res.value.forEach((a: any) => {
                if (a.cliente && String(a.cliente.cod) === String(cliente.codigo)) {
                  allAppointments.set(a.codConsulta, a);
                }
              });
            }
          });

          const sortedArray = Array.from(allAppointments.values()).sort((a, b) => {
            const dateA = parse(a.dtAgenda, "dd/MM/yyyy", new Date());
            const dateB = parse(b.dtAgenda, "dd/MM/yyyy", new Date());
            
            const hojeNoTime = new Date(hoje);
            hojeNoTime.setHours(0, 0, 0, 0);

            const distA = Math.abs(dateA.getTime() - hojeNoTime.getTime());
            const distB = Math.abs(dateB.getTime() - hojeNoTime.getTime());

            if (distA === distB) {
               return a.hrConsulta.localeCompare(b.hrConsulta);
            }
            return distA - distB;
          });

          setAppointments(sortedArray);
        } catch (err) {
          console.error(err);
          if (mounted) toast.error("Não foi possível carregar os dados.");
        } finally {
          if (mounted) {
            setLoadingAppts(false);
            setLoadingFinanceiro(false);
          }
        }
      };

      fetchAll();
      return () => { mounted = false; };
    }
  }, [step, unit, cliente, refreshKey]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleClienteFound = (u: string, c: Cliente) => {
    localStorage.setItem("agendabelle_unit", u);
    localStorage.setItem("agendabelle_cliente", JSON.stringify(c));
    setUnit(u);
    setCliente(c);
    setStep("plans");
  };

  const handleReschedule = async (appt: AgendamentoHistorico) => {
    try {
      await alterarStatusAgendamento(unit, appt.codConsulta, "Cancelado");
      toast.success("O agendamento anterior foi cancelado. Sinta-se livre para agendar um novo horário!");
      // Filter out the appt so the user can select the plan again immediately
      setAppointments(prev => prev.filter(a => a.codConsulta !== appt.codConsulta));
    } catch (err) {
      toast.error("Erro ao cancelar agendamento.");
      console.error(err);
    }
  };

  const handleConfirmAppt = async (appt: AgendamentoHistorico) => {
    try {
      await alterarStatusAgendamento(unit, appt.codConsulta, "Confirmado");
      toast.success("Agendamento confirmado com sucesso!");
      // Update local state to reflect the change
      setAppointments(prev => prev.map(a => a.codConsulta === appt.codConsulta ? { ...a, status: "Confirmado" } : a));
    } catch (err) {
      toast.error("Erro ao confirmar agendamento.");
      console.error(err);
    }
  };

  const handleCheckIn = async (appt: AgendamentoHistorico) => {
    try {
      await alterarStatusAgendamento(unit, appt.codConsulta, "Aguardando");
      toast.success("Check-in realizado com sucesso!");
      setAppointments(prev => prev.map(a => a.codConsulta === appt.codConsulta ? { ...a, status: "Aguardando" } : a));
    } catch (err) {
      toast.error("Erro ao realizar check-in.");
      console.error(err);
    }
  };

  const handlePlanSelected = (sel: { plano: Plano; servicos: Servico[] }[]) => {
    setSelection(sel);
    setStep("schedule");
  };

  const handleBooked = (
    result: Record<string, unknown>, 
    data: string, 
    hr: string, 
    successfulSelection?: { plano: Plano; servicos: Servico[] }[],
    failed?: { plano: Plano; servicos: Servico[]; motivo: string }[],
    prof?: { cod: string; nome: string } | null
  ) => {
    setBookingResult(result);
    setDataAgendamento(data);
    setHorario(hr);
    setProfAgendado(prof || null);
    if (successfulSelection) {
      setSelection(successfulSelection);
    }
    if (failed) {
      setFailedItems(failed);
    }
    setStep("confirmation");
  };

  const handleBack = (target: Step) => {
    // Mantém o cache e o estado atual para que a tela de login possa ser pré-preenchida
    setStep(target);
  };

  const handleRestart = () => {
    setStep("plans");
    setSelection([]);
    setBookingResult(null);
    setDataAgendamento("");
    setHorario("");
    setProfAgendado(null);
    setFailedItems([]);
  };

  const totalDuration = selection.reduce((acc, s) => acc + s.servicos.reduce((sum, serv) => sum + serv.tempo, 0), 0);

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 py-8 md:py-12">
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center mb-8">
          <img 
            src="/logo.png" 
            alt="Agendamento Online" 
            className="h-20 w-auto mb-2"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
          <p className="text-muted-foreground mt-2">
            Agende seu procedimento de forma rápida e prática
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {["login", "plans", "schedule", "confirmation"].map((s, i) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all duration-300 ${
                s === step
                  ? "w-8 bg-primary"
                  : ["login", "plans", "schedule", "confirmation"].indexOf(step) > i
                  ? "w-4 bg-primary/50"
                  : "w-4 bg-muted"
              }`}
            />
          ))}
        </div>

        {step === "login" && <LoginStep onClienteFound={handleClienteFound} />}
        {step === "plans" && cliente && (
          <div className="space-y-6">
            {vendas.length > 0 ? (
              <Tabs defaultValue="agendamentos" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="agendamentos" className="font-semibold">
                    Agendamentos
                  </TabsTrigger>
                  <TabsTrigger value="pagamentos" className="font-semibold">
                    Pagamentos
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="agendamentos" className="space-y-6 mt-0">
                  <PlansStep
                    unit={unit}
                    cliente={cliente}
                    appointments={appointments}
                    onPlanSelected={handlePlanSelected}
                    onBack={() => handleBack("login")}
                    onRefresh={handleRefresh}
                  />
                  <AppointmentsStep
                    unit={unit}
                    cliente={cliente}
                    appointments={appointments}
                    loading={loadingAppts}
                    onReschedule={handleReschedule}
                    onConfirmAppt={handleConfirmAppt}
                    onCheckIn={handleCheckIn}
                    isEmbedded={true}
                  />
                </TabsContent>
                
                <TabsContent value="pagamentos" className="mt-0">
                  <PaymentsStep 
                    vendas={vendas} 
                    loading={loadingFinanceiro} 
                    unit={unit} 
                    onBack={() => handleBack("login")}
                    onRefresh={handleRefresh}
                    refreshing={loadingFinanceiro}
                  />
                </TabsContent>
              </Tabs>
            ) : (
              <div className="space-y-6">
                <PlansStep
                  unit={unit}
                  cliente={cliente}
                  appointments={appointments}
                  onPlanSelected={handlePlanSelected}
                  onBack={() => handleBack("login")}
                  onRefresh={handleRefresh}
                />
                <AppointmentsStep
                  unit={unit}
                  cliente={cliente}
                  appointments={appointments}
                  loading={loadingAppts}
                  onReschedule={handleReschedule}
                  onConfirmAppt={handleConfirmAppt}
                  onCheckIn={handleCheckIn}
                  isEmbedded={true}
                />
              </div>
            )}
          </div>
        )}
        {step === "schedule" && cliente && selection.length > 0 && (
          <ScheduleStep
            unit={unit}
            cliente={cliente}
            selection={selection}
            onBooked={handleBooked}
            onBack={() => handleBack("plans")}
          />
        )}
        {step === "confirmation" && (
          <ConfirmationStep
            cliente={cliente!}
            selection={selection}
            bookingResult={bookingResult}
            dataAgendamento={dataAgendamento}
            horario={horario}
            tempoTotal={totalDuration}
            prof={profAgendado}
            failedItems={failedItems}
            onRestart={handleRestart}
          />
        )}
      </div>
    </div>
  );
};

export default Index;
