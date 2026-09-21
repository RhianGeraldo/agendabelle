import { useState, useEffect, useMemo } from "react";
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
  isSaleExcluded,
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

  const validVendas = useMemo(() => {
    return (vendas || []).filter((v) => !isSaleExcluded(v));
  }, [vendas]);

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
          
          const pastStart = format(subMonths(hoje, 3), "dd/MM/yyyy");
          const hojeStr = format(hoje, "dd/MM/yyyy");
          const futureEnd = format(addMonths(hoje, 3), "dd/MM/yyyy");

          const [results, elosgateRes] = await Promise.all([
            Promise.allSettled([
              buscarAgendamentosFinalizados(unit, 1, pastStart, hojeStr, cliente.codigo),
              buscarAgendamentosAbertos(unit, 1, pastStart, hojeStr, cliente.codigo),
              buscarAgendamentosAbertos(unit, 1, hojeStr, futureEnd, cliente.codigo)
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
              res.value.forEach((a: AgendamentoHistorico) => {
                if (a && a.codConsulta) {
                  const statusStr = String(a.status || "").trim().toLowerCase();
                  // Ignorar agendamentos desmarcados ou cancelados
                  if (statusStr.includes("desmarca") || statusStr.includes("cancel")) {
                    return;
                  }
                  const clientCod = a.cliente?.cod ? String(a.cliente.cod).trim() : null;
                  const targetCod = String(cliente.codigo).trim();
                  if (!clientCod || clientCod === targetCod) {
                    allAppointments.set(a.codConsulta, a);
                  }
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
      const sameDayAppts = appointments.filter(a => 
        a.dtAgenda === appt.dtAgenda && 
        (a.status === "Marcado" || a.status === "Confirmado")
      );
      
      await Promise.all(sameDayAppts.map(a => 
        alterarStatusAgendamento(unit, a.codConsulta, "Desmarcado")
      ));
      toast.success(sameDayAppts.length > 1 ? "Os agendamentos foram desmarcados." : "O agendamento anterior foi cancelado. Sinta-se livre para agendar um novo horário!");
      
      const idsToRemove = sameDayAppts.map(a => a.codConsulta);
      setAppointments(prev => prev.filter(a => !idsToRemove.includes(a.codConsulta)));
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      toast.error("Erro ao cancelar agendamento.");
      console.error(err);
    }
  };

  const handleConfirmAppt = async (appt: AgendamentoHistorico) => {
    try {
      const sameDayAppts = appointments.filter(a => a.dtAgenda === appt.dtAgenda && a.status === "Marcado");
      await Promise.all(sameDayAppts.map(a => alterarStatusAgendamento(unit, a.codConsulta, "Confirmado")));
      toast.success(sameDayAppts.length > 1 ? "Agendamentos confirmados com sucesso!" : "Agendamento confirmado com sucesso!");
      
      const idsToUpdate = sameDayAppts.map(a => a.codConsulta);
      setAppointments(prev => prev.map(a => idsToUpdate.includes(a.codConsulta) ? { ...a, status: "Confirmado" } : a));
    } catch (err) {
      toast.error("Erro ao confirmar agendamento.");
      console.error(err);
    }
  };

  const handleCheckIn = async (appt: AgendamentoHistorico) => {
    try {
      const sameDayAppts = appointments.filter(a => a.dtAgenda === appt.dtAgenda && a.status === "Confirmado");
      await Promise.all(sameDayAppts.map(a => alterarStatusAgendamento(unit, a.codConsulta, "Aguardando")));
      toast.success(sameDayAppts.length > 1 ? "Check-in dos agendamentos realizado com sucesso!" : "Check-in realizado com sucesso!");
      
      const idsToUpdate = sameDayAppts.map(a => a.codConsulta);
      setAppointments(prev => prev.map(a => idsToUpdate.includes(a.codConsulta) ? { ...a, status: "Aguardando" } : a));
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
            {validVendas.length > 0 ? (
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
                    refreshKey={refreshKey}
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
                    vendas={validVendas} 
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
                  refreshKey={refreshKey}
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
            appointments={appointments}
            vendas={vendas}
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
