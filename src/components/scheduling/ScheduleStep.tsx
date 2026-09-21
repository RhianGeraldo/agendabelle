import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import {
  buscarDisponibilidade,
  gravarAgendamento,
  gravarAgendamentoSemServico,
  calcularHorariosDisponiveis,
  addMinutesToTime,
  buscarAgendamentosAbertos,
  buscarAgendamentosFinalizados,
  buscarPlanos,
  obterURLVenda,
  buscarVendasElosgate,
  isSaleDelinquent,
  type Cliente,
  type Plano,
  type Servico,
  type DiaAgenda,
  type AgendamentoHistorico,
  type VendaElosgate,
} from "@/lib/api";
import { ArrowLeft, Loader2, Calendar, Package, User, AlertCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format, addDays, subMonths, addMonths, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ScheduleStepProps {
  unit: string;
  cliente: Cliente;
  selection: { plano: Plano; servicos: Servico[] }[];
  appointments?: AgendamentoHistorico[];
  vendas?: VendaElosgate[];
  initialObservation?: string;
  onBooked: (
    result: Record<string, unknown>, 
    data: string, 
    horario: string, 
    successfulSelection?: { plano: Plano; servicos: Servico[] }[],
    failedItems?: { plano: Plano; servicos: Servico[]; motivo: string }[],
    prof?: { cod: string; nome: string } | null
  ) => void;
  onBack: () => void;
}

interface SlotOption {
  horario: string;
  codProf: number;
  nomeProf: string;
}

export function ScheduleStep({ unit, cliente, selection, appointments = [], vendas = [], initialObservation = "", onBooked, onBack }: ScheduleStepProps) {
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  
  const [minAllowedDate, setMinAllowedDate] = useState<Date | null>(null);
  const [targetDate, setTargetDate] = useState<Date | undefined>(undefined);
  
  const [diasAgenda, setDiasAgenda] = useState<DiaAgenda[]>([]);
  const [booking, setBooking] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ slot: SlotOption; dia: DiaAgenda } | null>(null);
  const [clientObservation, setClientObservation] = useState("");
  const [blockedPaymentModal, setBlockedPaymentModal] = useState<{
    isOpen: boolean;
    planoNome: string;
    vendaNumero: string;
    statusString: string;
    paymentUrl: string | null;
  }>({
    isOpen: false,
    planoNome: "",
    vendaNumero: "",
    statusString: "",
    paymentUrl: null,
  });

  const allServicos = useMemo(() => selection.flatMap(s => s.servicos), [selection]);
  const tempoTotal = useMemo(() => allServicos.reduce((sum, s) => sum + s.tempo, 0), [allServicos]);

  // 1. Initial Load: Fetch history and calculate minAllowedDate
  useEffect(() => {
    let mounted = true;
    const fetchHistory = async () => {
      try {
        setLoadingInitial(true);
        const hoje = new Date();
        let foundDate = hoje;
        try {
          const allHist: AgendamentoHistorico[] = appointments && appointments.length > 0 ? [...appointments] : [];

          const isDepilacao = (nome: string) => !!nome && nome.toLowerCase().includes("depila");
          const isClareamento = (nome: string) => !!nome && nome.toLowerCase().includes("clareamento");
          const isFacialArea = (nome: string) => {
            if (!nome) return false;
            const n = nome.toLowerCase();
            return (n.includes("barba") || n.includes("buço") || n.includes("buco") || n.includes("facial")) && !n.includes("rejuvenescimento");
          };
          const isRejuvenescimento = (nome: string) => !!nome && nome.toLowerCase().includes("rejuvenescimento");
          
          const eventosValidos = allHist.filter((a: AgendamentoHistorico) => {
            if (!a.status || !a.servicos) return false;
            const statusLower = a.status.trim().toLowerCase();
            return ["atendido", "aguardando", "em andamento", "marcado", "confirmado"].includes(statusLower);
          });

          // Sort descending (most recent first)
          const sortedHist = [...eventosValidos].sort((a: AgendamentoHistorico, b: AgendamentoHistorico) => {
            const dA = parse(a.dtAgenda, "dd/MM/yyyy", new Date());
            const dB = parse(b.dtAgenda, "dd/MM/yyyy", new Date());
            if (dB.getTime() === dA.getTime()) {
              return b.hrConsulta.localeCompare(a.hrConsulta);
            }
            return dB.getTime() - dA.getTime();
          });

          const agendandoDepil = allServicos.some(s => isDepilacao(s.nome));
          const agendandoClareamento = allServicos.some(s => isClareamento(s.nome));
          const agendandoFacialArea = allServicos.some(s => isFacialArea(s.nome));
          const agendandoRejuvenescimento = allServicos.some(s => isRejuvenescimento(s.nome));

          const latestDepilOrClareamento = sortedHist.find((a: AgendamentoHistorico) => 
            a.servicos.some((s) => isDepilacao(s.nome) || isClareamento(s.nome))
          );

          const latestFacialOrRejuve = sortedHist.find((a: AgendamentoHistorico) => 
            a.servicos.some((s) => isFacialArea(s.nome) || isRejuvenescimento(s.nome))
          );

          const latestSameService = sortedHist.find((a: AgendamentoHistorico) => 
            a.servicos.some((as) => 
                allServicos.some(s => String(s.codServico) === String(as.cod || "").trim())
            )
          );

          let suggestedMin = new Date(hoje);
          suggestedMin.setHours(0, 0, 0, 0);

          // Regra Especial de Cruzamento (Depilação e Clareamento se afetam mutuamente)
          if ((agendandoDepil || agendandoClareamento) && latestDepilOrClareamento) {
            const dtUltimo = parse(latestDepilOrClareamento.dtAgenda, "dd/MM/yyyy", new Date());
            const ultimoFoiDepil = latestDepilOrClareamento.servicos.some((s) => isDepilacao(s.nome));
            const ultimoFoiClareamento = latestDepilOrClareamento.servicos.some((s) => isClareamento(s.nome));

            let dias = 0;
            if (ultimoFoiDepil && agendandoClareamento) dias = 25;
            else if (ultimoFoiClareamento && agendandoDepil) dias = 25;

            if (dias > 0) {
              const d = addDays(dtUltimo, dias);
              if (d > suggestedMin) suggestedMin = d;
            }
          }

          // Regra Especial de Cruzamento (Área Facial vs Rejuvenescimento Facial - 45 dias)
          if ((agendandoFacialArea || agendandoRejuvenescimento) && latestFacialOrRejuve) {
            const dtUltimo = parse(latestFacialOrRejuve.dtAgenda, "dd/MM/yyyy", new Date());
            const ultimoFoiFacialArea = latestFacialOrRejuve.servicos.some((s) => isFacialArea(s.nome));
            const ultimoFoiRejuvenescimento = latestFacialOrRejuve.servicos.some((s) => isRejuvenescimento(s.nome));

            let dias = 0;
            if (ultimoFoiFacialArea && agendandoRejuvenescimento) dias = 45;
            else if (ultimoFoiRejuvenescimento && agendandoFacialArea) dias = 45;

            if (dias > 0) {
              const d = addDays(dtUltimo, dias);
              if (d > suggestedMin) suggestedMin = d;
            }
          }

          // Regra Padrão (Garante o intervalo de 40 dias para o mesmo serviço, sempre)
          if (latestSameService) {
            const dtUltimo = parse(latestSameService.dtAgenda, "dd/MM/yyyy", new Date());
            const d = addDays(dtUltimo, 40);
            if (d > suggestedMin) suggestedMin = d;
          }

          if (suggestedMin > hoje) {
            if (suggestedMin.getDay() === 0) suggestedMin = addDays(suggestedMin, 1);
            foundDate = suggestedMin;
          }

        } catch (err) {
          console.error("Erro ao buscar histórico", err);
        }

        if (!mounted) return;
        setMinAllowedDate(foundDate);
        setTargetDate(foundDate);
      } catch (err) {
        console.error("Erro inicial", err);
      } finally {
        if (mounted) setLoadingInitial(false);
      }
    };

    fetchHistory();
    return () => { mounted = false; };
  }, [unit, cliente.codigo, allServicos, appointments]);

  // 2. Load Availability when targetDate changes
  useEffect(() => {
    if (!targetDate) return;
    
    let mounted = true;
    const loadSlots = async () => {
      try {
        setLoadingSlots(true);
        const datesToFetch = [targetDate];
        // Para garantir até 14 dias (2 semanas), buscamos a data alvo e também a próxima segunda-feira
        const dayOfWeek = targetDate.getDay(); // 0 = Dom, 1 = Seg ... 6 = Sáb
        const daysUntilNextMonday = dayOfWeek === 0 ? 8 : 8 - dayOfWeek;
        datesToFetch.push(addDays(targetDate, daysUntilNextMonday));

        const fetchPromises: Promise<unknown>[] = [];
        
        datesToFetch.forEach(dateObj => {
          const dtStr = format(dateObj, "dd/MM/yyyy");
          fetchPromises.push(buscarDisponibilidade(unit, 1, dtStr));
        });

        const results = await Promise.allSettled(fetchPromises);

        const allDias: DiaAgenda[] = [];
        results.forEach(res => {
          if (res.status === "fulfilled" && Array.isArray(res.value)) {
            const validDias = res.value.filter(dia => {
              if (!minAllowedDate) return true;
              const diaDate = parse(dia.data, "dd/MM/yyyy", new Date());
              diaDate.setHours(0, 0, 0, 0);
              const minDt = new Date(minAllowedDate);
              minDt.setHours(0, 0, 0, 0);
              return diaDate >= minDt;
            });
            allDias.push(...validDias);
          }
        });

        const mergedMap = new Map<string, DiaAgenda>();
        allDias.forEach(dia => {
          if (!mergedMap.has(dia.data)) {
            mergedMap.set(dia.data, { ...dia, horarios: [...dia.horarios] });
          } else {
            const existing = mergedMap.get(dia.data)!;
            dia.horarios.forEach(prof => {
              const existingProf = existing.horarios.find(p => p.codProf === prof.codProf);
              if (existingProf) {
                existingProf.horarios = [...existingProf.horarios, ...prof.horarios];
              } else {
                existing.horarios.push(prof);
              }
            });
          }
        });

        if (mounted) {
          // Exibe até 14 dias (2 semanas completas)
          setDiasAgenda(Array.from(mergedMap.values()).slice(0, 14));
        }
      } catch (err) {
        console.error("Erro ao carregar horários", err);
        if (mounted) toast.error("Erro ao carregar os horários disponíveis.");
      } finally {
        if (mounted) setLoadingSlots(false);
      }
    };

    loadSlots();
    return () => { mounted = false; };
  }, [targetDate, unit, minAllowedDate]);

  const availableSlots: { dia: DiaAgenda; prof: { codProf: number; nome: string }; slots: SlotOption[] }[] = [];
  const isAvaliacaoOnly = selection.length === 1 && selection[0].plano.codPlano === -1;

  for (const dia of diasAgenda) {
    for (const prof of dia.horarios) {
      const profName = prof.nome.toLowerCase();
      const isRoom = profName.includes('sala');
      const isEvaluationRoom = profName.includes('avaliação') || profName.includes('avaliacao');

      // Se for apenas avaliação, exige que o nome contenha avaliação (pode ou não ter "sala" explícito)
      // Se for serviço comum, exige que seja sala
      if (isAvaliacaoOnly) {
        if (!isEvaluationRoom) continue;
      } else {
        if (!isRoom) continue;
      }

      const horarios = calcularHorariosDisponiveis(prof.horarios, tempoTotal);
      if (horarios.length === 0) continue;
      const slots: SlotOption[] = horarios.map(h => ({ horario: h, codProf: prof.codProf, nomeProf: prof.nome }));
      availableSlots.push({ dia, prof: { codProf: prof.codProf, nome: prof.nome }, slots });
    }
  }

  const handleBook = async () => {
    if (!selectedSlot) return;
    const { slot, dia } = selectedSlot;
    
    // Validação Financeira (Elosgate) no clique de confirmar agendamento
    // Se o cliente tiver planos na Elosgate e estiver com inadimplência, ele não deve agendar.
    let currentVendas = vendas;
    if ((!currentVendas || currentVendas.length === 0) && cliente.cpf) {
      try {
        currentVendas = await buscarVendasElosgate(unit, cliente.cpf);
      } catch (err) {
        console.error("[VALIDAÇÃO FINANCEIRA] Erro ao buscar vendas Elosgate:", err);
      }
    }

    if (currentVendas && currentVendas.length > 0) {
      // 1. Prioriza venda inadimplente associada a um dos planos selecionados nesta sessão
      const matchedDelinquentSale = currentVendas.find(
        (v) =>
          selection.some(
            (sel) =>
              sel.plano.codPlano !== -1 &&
              (String(sel.plano.codPlano).trim() === String(v.Numero || "").trim() ||
               String(sel.plano.codPlano).trim() === String(v.ReferenciaVenda || "").trim())
          ) && isSaleDelinquent(v)
      );

      // 2. Se o cliente tiver QUALQUER plano/contrato inadimplente na Elosgate, bloqueia qualquer novo agendamento
      const delinquentSale = matchedDelinquentSale || currentVendas.find((v) => isSaleDelinquent(v));

      if (delinquentSale) {
        // Localiza o nome do plano para exibir com clareza no modal
        let planoNome = "";
        const matchedSelection = selection.find(
          (sel) =>
            sel.plano.codPlano !== -1 &&
            (String(sel.plano.codPlano).trim() === String(delinquentSale.Numero || "").trim() ||
             String(sel.plano.codPlano).trim() === String(delinquentSale.ReferenciaVenda || "").trim())
        );

        if (matchedSelection) {
          planoNome = matchedSelection.plano.nome;
        } else if (cliente.codigo) {
          try {
            const allPlanos = await buscarPlanos(unit, 1, cliente.codigo);
            if (Array.isArray(allPlanos)) {
              const matchedPlano = allPlanos.find(
                (p: Plano) =>
                  String(p.codPlano).trim() === String(delinquentSale.Numero || "").trim()
              );
              if (matchedPlano) {
                planoNome = matchedPlano.nome || matchedPlano.label;
              }
            }
          } catch (err) {
            console.error("[VALIDAÇÃO FINANCEIRA] Erro ao buscar nome do plano inadimplente:", err);
          }
        }

        if (!planoNome) {
          planoNome = `Plano com Pendência Financeira (Contrato #${delinquentSale.Numero})`;
        }

        // Abre o modal de bloqueio imediatamente para feedback instantâneo
        setBlockedPaymentModal({
          isOpen: true,
          planoNome,
          vendaNumero: delinquentSale.Numero,
          statusString: delinquentSale.StatusString || "Inadimplente",
          paymentUrl: null,
        });

        // Busca o link de pagamento em paralelo
        obterURLVenda(unit, delinquentSale.Numero)
          .then((url) => {
            if (url) {
              setBlockedPaymentModal((prev) => ({
                ...prev,
                paymentUrl: url,
              }));
            }
          })
          .catch((err) => {
            console.error("[VALIDAÇÃO FINANCEIRA] Erro ao obter link de pagamento:", err);
          });

        return; // Interrompe o agendamento!
      }
    }

    setBooking(true);
    let lastResult: Record<string, unknown> | null = null;
    let successCount = 0;

    try {
      let currentStartTime = slot.horario;

      for (const sel of selection) {
        const planDuration = sel.servicos.reduce((sum, s) => sum + s.tempo, 0);
        
        const obsParts: string[] = [];
        if (initialObservation && initialObservation.trim()) {
          obsParts.push(initialObservation.trim());
        }
        if (clientObservation && clientObservation.trim()) {
          obsParts.push(clientObservation.trim());
        }
        obsParts.push("Incluso por Agenda Estética e Laser");
        const finalObs = obsParts.join(" - ");

        const bookingData: Record<string, unknown> = {
          codCli: cliente.codigo,
          codEstab: 1,
          prof: { cod_usuario: "", nom_usuario: "" },
          dtAgd: dia.data,
          hri: currentStartTime,
          agSala: true,
          codSala: slot.codProf,
          codVendedor: "",
          observacao: finalObs,
        };

        let result: Record<string, unknown>;

        if (sel.plano.codPlano !== -1) {
          bookingData.serv = sel.servicos.map((s) => ({
            codServico: String(s.codServico),
            tempo: String(s.tempo),
          }));
          bookingData.codPlano = String(sel.plano.codPlano);
          result = (await gravarAgendamento(unit, bookingData)) as Record<string, unknown>;
        } else {
          // Payload específico para Avaliação
          bookingData.tempo = sel.servicos[0]?.tempo || 20;
          bookingData.tipoConsulta = "Avaliação";
          bookingData.temPreferencia = false;
          result = (await gravarAgendamentoSemServico(unit, bookingData)) as Record<string, unknown>;
        }
        
        if (result && result.dis === false) {
          throw new Error(String(result.msg || "Não foi possível realizar o agendamento no horário selecionado."));
        }
        
        successCount++;
        lastResult = result;
        currentStartTime = addMinutesToTime(currentStartTime, planDuration);
      }
      
      toast.success(selection.length > 1 ? "Todos os agendamentos realizados com sucesso!" : "Agendamento realizado com sucesso!");
      onBooked(lastResult!, dia.data, slot.horario, selection, undefined, null);
    } catch (err: unknown) {
      console.error("[AGENDAMENTO] Erro:", err);
      const errMsg = err instanceof Error ? err.message : String(err || "Erro no agendamento");
      // Se agendou parcialmente e quebrou no meio, não deixa o usuário travado.
      if (lastResult !== null) {
         const failedItems = selection.slice(successCount).map(sel => {
           let amigavel = errMsg;
           const nomePlanoEServicos = (sel.plano.nome + " " + sel.servicos.map(s => s.nome).join(" ")).toLowerCase();
           
           if (errMsg.includes("dias após")) {
             if (nomePlanoEServicos.includes("clareamento")) {
               amigavel = "Só pode ser agendado 25 dias após a realização de depilação.";
             } else if (nomePlanoEServicos.includes("depila")) {
               amigavel = "Só pode ser agendado 25 dias após a realização do clareamento.";
             } else if (nomePlanoEServicos.includes("rejuvenescimento")) {
               amigavel = "Só pode ser agendado 45 dias após a realização de depilação facial (barba/buço/facial).";
             } else if (nomePlanoEServicos.includes("barba") || nomePlanoEServicos.includes("buço") || nomePlanoEServicos.includes("buco") || nomePlanoEServicos.includes("facial")) {
               amigavel = "Só pode ser agendado 45 dias após a realização de rejuvenescimento facial.";
             }
           }
           
           return {
             plano: sel.plano,
             servicos: sel.servicos,
             motivo: amigavel
           };
         });
         toast.warning(`Alguns agendamentos falharam. Mas os anteriores foram confirmados.`);
         onBooked(lastResult, dia.data, slot.horario, selection.slice(0, successCount), failedItems, null);
      } else {
         toast.error(err.message || "Erro ao realizar agendamento");
      }
    } finally {
      setBooking(false);
    }
  };

  return (
    <>
      <Card className="border-0 shadow-lg shadow-primary/5">
      <CardHeader className="pb-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="w-fit -ml-2 mb-2" disabled={booking || loadingInitial}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <CardTitle className="font-display text-xl">Escolha o Horário</CardTitle>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" /> 
            {selection.length} {selection.length > 1 ? 'pacotes selecionados' : 'pacote selecionado'}
          </p>
          <p className="text-sm text-muted-foreground">
            Tempo total estimado: <span className="font-semibold text-foreground">{tempoTotal} min</span>
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1.5 pb-2">
          {selection.map((sel) => (
            sel.servicos.map((s) => (
              <span key={`${sel.plano.codPlano}-${s.codServico}`} className="text-[10px] px-2 py-0.5 rounded-full bg-accent/50 text-accent-foreground border border-accent/20">
                {s.nome.split(" - ")[0]} ({s.tempo}min)
              </span>
            ))
          ))}
        </div>
        

        {loadingInitial ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm animate-pulse">Calculando data ideal para retorno...</p>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" /> Data do Atendimento
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !targetDate && "text-muted-foreground")}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    {targetDate ? format(targetDate, "PPP", { locale: ptBR }) : "Selecione uma data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarUI
                    mode="single"
                    selected={targetDate}
                    defaultMonth={targetDate}
                    onSelect={(d) => d && setTargetDate(d)}
                    disabled={(d) => {
                      if (!minAllowedDate) return false;
                      const min = new Date(minAllowedDate);
                      min.setHours(0, 0, 0, 0);
                      return d < min || d > addDays(min, 90);
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Disponibilidades filtradas para o tempo total de {tempoTotal} min.
              </p>
            </div>

            {loadingSlots ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary/60" />
              </div>
            ) : availableSlots.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Não localizamos horários livres para essa duração na data selecionada.
              </p>
            ) : (
              <Accordion type="single" collapsible defaultValue="item-0" className="w-full">
                {[...new Map(availableSlots.map(s => [s.dia.data, s.dia])).values()].map((dia, groupIdx) => {
                  const roomsForDay = availableSlots.filter(s => s.dia.data === dia.data);
                  const totalSlots = roomsForDay.reduce((acc, r) => acc + r.slots.length, 0);
                  if (totalSlots === 0) return null;
                  return (
                    <AccordionItem value={`item-${groupIdx}`} key={dia.data} className="border-b-0 space-y-3 pb-3">
                      <AccordionTrigger className="text-sm font-semibold hover:no-underline border-b pb-2 pt-0 w-full justify-between flex">
                        <span>{dia.nome} - {dia.data}</span>
                        <span className="text-xs font-normal text-muted-foreground mr-2">{totalSlots} {totalSlots === 1 ? 'horário' : 'horários'}</span>
                      </AccordionTrigger>
                      <AccordionContent className="px-1 pt-2">
                        {roomsForDay.map(({ prof, slots }) => (
                          <div key={prof.codProf} className="mb-4">
                            <p className="text-xs font-semibold text-muted-foreground mb-2 border-b pb-1">{prof.nome}</p>
                            <Accordion type="multiple" className="w-full">
                              {["Manhã", "Tarde", "Noite"].map((periodoName) => {
                                const periodSlots = slots.filter((s) => {
                                  const [h] = s.horario.split(':').map(Number);
                                  if (periodoName === "Manhã") return h < 12;
                                  if (periodoName === "Tarde") return h >= 12 && h < 18;
                                  return h >= 18;
                                });
                                if (periodSlots.length === 0) return null;
                                return (
                                  <AccordionItem value={`period-${prof.codProf}-${periodoName}`} key={periodoName} className="border-b-0">
                                    <AccordionTrigger className="text-xs text-muted-foreground font-medium hover:no-underline border-b pb-2 pt-3 w-full justify-between flex">
                                      <span>{periodoName}</span>
                                      <span className="text-[11px] font-normal text-muted-foreground mr-2">{periodSlots.length} {periodSlots.length === 1 ? 'vaga' : 'vagas'}</span>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-3 pb-1">
                                        {periodSlots.map((slot, idx) => {
                                          const isSelected = selectedSlot?.slot.horario === slot.horario && selectedSlot?.dia.data === dia.data && selectedSlot?.slot.codProf === slot.codProf;
                                          return (
                                            <Button
                                              key={`${slot.horario}-${slot.codProf}-${idx}`}
                                              variant={isSelected ? "default" : "outline"}
                                              size="sm"
                                              disabled={booking}
                                              onClick={() => setSelectedSlot({ slot, dia })}
                                              className={cn(
                                                "transition-colors",
                                                !isSelected && "hover:bg-primary/20 hover:text-primary-foreground"
                                              )}
                                              title={slot.nomeProf}
                                            >
                                              {slot.horario}
                                            </Button>
                                          );
                                        })}
                                      </div>
                                    </AccordionContent>
                                  </AccordionItem>
                                );
                              })}
                            </Accordion>
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </div>
        )}
      </CardContent>

      <div className="p-4 border-t bg-muted/20 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Observação (Opcional)
          </label>
          <Input 
            placeholder="Alguma observação para a clínica?" 
            value={clientObservation}
            onChange={(e) => setClientObservation(e.target.value)}
            disabled={booking}
          />
        </div>
        <Button
          size="lg"
          className="w-full font-semibold"
          disabled={!selectedSlot || booking}
          onClick={handleBook}
        >
          {booking ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Agendando...
            </>
          ) : (
            "Confirmar Agendamento"
          )}
        </Button>
      </div>
    </Card>

    <Dialog open={blockedPaymentModal.isOpen} onOpenChange={(open) => {
      if (!open) setBlockedPaymentModal(prev => ({ ...prev, isOpen: false }));
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-lg font-bold">
            Agendamento Bloqueado
          </DialogTitle>
          <DialogDescription className="text-center text-sm space-y-2">
            <span className="block text-muted-foreground">
              Identificamos uma pendência financeira vinculada ao plano:
            </span>
            <span className="block font-semibold text-foreground text-sm">
              {blockedPaymentModal.planoNome}
            </span>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
              Venda #{blockedPaymentModal.vendaNumero} • {blockedPaymentModal.statusString || "Inadimplente"}
            </span>
            <span className="block pt-2 text-xs text-muted-foreground">
              Para confirmar o seu agendamento, regularize o pagamento clicando no botão abaixo.
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col sm:flex-col gap-2 pt-2">
          {blockedPaymentModal.paymentUrl ? (
            <Button
              className="w-full font-semibold gap-2"
              onClick={() => window.open(blockedPaymentModal.paymentUrl!, "_blank")}
            >
              <ExternalLink className="h-4 w-4" />
              Pagar Agora
            </Button>
          ) : (
            <Button
              variant="outline"
              className="w-full gap-2"
              disabled
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando link de pagamento...
            </Button>
          )}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setBlockedPaymentModal(prev => ({ ...prev, isOpen: false }))}
          >
            Voltar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  );
}
