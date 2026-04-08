import { useState, useEffect } from "react";
import { LoginStep } from "@/components/scheduling/LoginStep";
import { PlansStep } from "@/components/scheduling/PlansStep";
import { ScheduleStep } from "@/components/scheduling/ScheduleStep";
import { ConfirmationStep } from "@/components/scheduling/ConfirmationStep";
import { AppointmentsStep } from "@/components/scheduling/AppointmentsStep";
import { buscarHistoricoAgenda, buscarAgendamentosAbertos, buscarAgendamentosFinalizados, alterarStatusAgendamento, type Cliente, type Plano, type Servico, type AgendamentoHistorico } from "@/lib/api";
import { format, subDays, addDays, subMonths, addMonths, parse } from "date-fns";
import { toast } from "sonner";

type Step = "login" | "plans" | "schedule" | "confirmation";

const Index = () => {
  const [step, setStep] = useState<Step>("login");
  const [unit, setUnit] = useState("");
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [plano, setPlano] = useState<Plano | null>(null);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [bookingResult, setBookingResult] = useState<Record<string, unknown> | null>(null);
  const [dataAgendamento, setDataAgendamento] = useState("");
  const [horario, setHorario] = useState("");
  
  const [appointments, setAppointments] = useState<AgendamentoHistorico[]>([]);
  const [loadingAppts, setLoadingAppts] = useState(false);

  useEffect(() => {
    if (step === "plans" && unit && cliente) {
      let mounted = true;
      const fetchAll = async () => {
        try {
          setLoadingAppts(true);
          const hoje = new Date();
          
          const pastStart = format(subMonths(hoje, 2), "dd/MM/yyyy");
          const pastEnd = format(hoje, "dd/MM/yyyy");
          
          const futureStart = format(hoje, "dd/MM/yyyy");
          const futureEnd = format(addMonths(hoje, 2), "dd/MM/yyyy");

          const results = await Promise.allSettled([
            buscarAgendamentosAbertos(unit, 1, pastStart, pastEnd),
            buscarAgendamentosAbertos(unit, 1, futureStart, futureEnd),
            buscarAgendamentosFinalizados(unit, 1, pastStart, pastEnd),
            buscarAgendamentosFinalizados(unit, 1, futureStart, futureEnd)
          ]);

          if (!mounted) return;

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
            if (dateA.getTime() === dateB.getTime()) {
               return b.hrConsulta.localeCompare(a.hrConsulta);
            }
            return dateB.getTime() - dateA.getTime();
          });

          setAppointments(sortedArray);
        } catch (err) {
          console.error(err);
          if (mounted) toast.error("Não foi possível carregar os agendamentos.");
        } finally {
          if (mounted) setLoadingAppts(false);
        }
      };

      fetchAll();
      return () => { mounted = false; };
    }
  }, [step, unit, cliente]);

  const handleClienteFound = (u: string, c: Cliente) => {
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

  const handlePlanSelected = (p: Plano, s: Servico[]) => {
    setPlano(p);
    setServicos(s);
    setStep("schedule");
  };

  const handleBooked = (result: Record<string, unknown>, data: string, hr: string) => {
    setBookingResult(result);
    setDataAgendamento(data);
    setHorario(hr);
    setStep("confirmation");
  };

  const handleBack = (target: Step) => setStep(target);

  const handleRestart = () => {
    setStep("plans");
    setPlano(null);
    setServicos([]);
    setBookingResult(null);
    setDataAgendamento("");
    setHorario("");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
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
            <PlansStep
              unit={unit}
              cliente={cliente}
              appointments={appointments}
              onPlanSelected={handlePlanSelected}
              onBack={() => handleBack("login")}
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
        {step === "schedule" && cliente && plano && (
          <ScheduleStep
            unit={unit}
            cliente={cliente}
            plano={plano}
            servicos={servicos}
            onBooked={handleBooked}
            onBack={() => handleBack("plans")}
          />
        )}
        {step === "confirmation" && (
          <ConfirmationStep
            cliente={cliente!}
            plano={plano!}
            bookingResult={bookingResult}
            dataAgendamento={dataAgendamento}
            horario={horario}
            tempoTotal={servicos.reduce((sum, s) => sum + s.tempo, 0)}
            onRestart={handleRestart}
          />
        )}
      </div>
    </div>
  );
};

export default Index;
