import { useState } from "react";
import { LoginStep } from "@/components/scheduling/LoginStep";
import { PlansStep } from "@/components/scheduling/PlansStep";
import { ScheduleStep } from "@/components/scheduling/ScheduleStep";
import { ConfirmationStep } from "@/components/scheduling/ConfirmationStep";
import type { Cliente, Plano, Servico } from "@/lib/api";

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

  const handleClienteFound = (u: string, c: Cliente) => {
    setUnit(u);
    setCliente(c);
    setStep("plans");
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
    setStep("login");
    setUnit("");
    setCliente(null);
    setPlano(null);
    setServicos([]);
    setBookingResult(null);
    setDataAgendamento("");
    setHorario("");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">
            Agendamento Online
          </h1>
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
          <PlansStep
            unit={unit}
            cliente={cliente}
            onPlanSelected={handlePlanSelected}
            onBack={() => handleBack("login")}
          />
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
