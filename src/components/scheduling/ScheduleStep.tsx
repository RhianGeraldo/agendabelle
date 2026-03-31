import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import {
  buscarDisponibilidade,
  gravarAgendamento,
  calcularHorariosDisponiveis,
  buscarHistoricoAgenda,
  buscarAgendamentosAbertos,
  buscarAgendamentosFinalizados,
  type Cliente,
  type Plano,
  type Servico,
  type DiaAgenda,
  type AgendamentoHistorico,
} from "@/lib/api";
import { ArrowLeft, Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format, subDays, addDays, subMonths, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ScheduleStepProps {
  unit: string;
  cliente: Cliente;
  plano: Plano;
  servicos: Servico[];
  onBooked: (result: Record<string, unknown>, data: string, horario: string) => void;
  onBack: () => void;
}

interface SlotOption {
  horario: string;
  codProf: number;
  nomeProf: string;
}

export function ScheduleStep({ unit, cliente, plano, servicos, onBooked, onBack }: ScheduleStepProps) {
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  
  const [minAllowedDate, setMinAllowedDate] = useState<Date | null>(null);
  const [targetDate, setTargetDate] = useState<Date | undefined>(undefined);
  
  const [diasAgenda, setDiasAgenda] = useState<DiaAgenda[]>([]);
  const [agendamentosDoDia, setAgendamentosDoDia] = useState<AgendamentoHistorico[]>([]);
  const [booking, setBooking] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ slot: SlotOption; dia: DiaAgenda } | null>(null);

  const tempoTotal = servicos.reduce((sum, s) => sum + s.tempo, 0);

  // 1. Initial Load: Fetch history and calculate minAllowedDate
  useEffect(() => {
    let mounted = true;
    const fetchHistory = async () => {
      try {
        setLoadingInitial(true);
        const hoje = new Date();
        let foundDate = hoje;
        try {
          // Busca 3 meses para trás para garantir que pegamos a última sessão atendida
          const reqStart = format(subMonths(hoje, 3), "dd/MM/yyyy");
          const reqEnd = format(hoje, "dd/MM/yyyy");

          const results = await Promise.allSettled([
            buscarAgendamentosFinalizados(unit, 1, reqStart, reqEnd)
          ]);

          const allHist: any[] = [];
          results.forEach((res, i) => {
            console.log(`[ScheduleStep REQ ${i+1}] status:`, res.status);
            if (res.status === "fulfilled" && Array.isArray(res.value)) {
              console.log(`[ScheduleStep REQ ${i+1} VALUE]:`, res.value);
              // Filter by client code
              const clientAppts = res.value.filter(a => a.cliente && String(a.cliente.cod) === String(cliente.codigo));
              allHist.push(...clientAppts);
            }
          });

          console.log("[ScheduleStep ALL HIST BEFORE FILTER]", allHist);

          // Filtra estritamente por 'Atendido'
          const atendidos = allHist.filter((a: any) => {
            if (!a.status) return false;
            console.log("[ScheduleStep Checking Status] Original:", `"${a.status}"`, "->", a.status.trim().toLowerCase());
            return a.status.trim().toLowerCase() === "atendido";
          });
          
          console.log("[ScheduleStep ATENDIDOS AFTER FILTER]", atendidos);

          if (atendidos.length > 0) {
            const sortedHist = [...atendidos].sort((a: any, b: any) => {
              const dA = parse(a.dtAgenda, "dd/MM/yyyy", new Date());
              const dB = parse(b.dtAgenda, "dd/MM/yyyy", new Date());
              // Check if they are the same date, then sort by time
              if (dB.getTime() === dA.getTime()) {
                return b.hrConsulta.localeCompare(a.hrConsulta);
              }
              return dB.getTime() - dA.getTime();
            });
            const lastApptDate = parse(sortedHist[0].dtAgenda, "dd/MM/yyyy", new Date());
            let suggested = addDays(lastApptDate, 40);
            // Se cair no domingo, avança para segunda-feira
            if (suggested.getDay() === 0) suggested = addDays(suggested, 1);
            foundDate = suggested;
          }
        } catch (err) {
          console.error("Erro ao buscar histórico, usando data atual.", err);
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
  }, [unit, cliente.codigo]);

  // 2. Load Availability when targetDate changes
  useEffect(() => {
    if (!targetDate) return;
    
    let mounted = true;
    const loadSlots = async () => {
      try {
        setLoadingSlots(true);
        const datesToFetch = [targetDate];
        // Se for no Sábado (6), também busca a próxima segunda (+2 dias)
        // A API retorna a semana toda, garantindo assim que puxe a semana seguinte
        if (targetDate.getDay() === 6) {
          datesToFetch.push(addDays(targetDate, 2));
        }

        const periods = ["manha", "tarde", "noite"];
        const fetchPromises: Promise<any>[] = [];
        const apptPromises: Promise<any>[] = [];
        
        datesToFetch.forEach(dateObj => {
          const dtStr = format(dateObj, "dd/MM/yyyy");
          periods.forEach(p => {
            fetchPromises.push(buscarDisponibilidade(unit, 1, dtStr, p));
          });
          apptPromises.push(buscarAgendamentosAbertos(unit, 1, dtStr, dtStr));
        });

        const [results, apptResults] = await Promise.all([
          Promise.allSettled(fetchPromises),
          Promise.allSettled(apptPromises)
        ]);

        const allAppts: AgendamentoHistorico[] = [];
        apptResults.forEach(res => {
          if (res.status === "fulfilled" && Array.isArray(res.value)) {
            allAppts.push(...res.value);
          }
        });

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
          setAgendamentosDoDia(allAppts);
          setDiasAgenda(Array.from(mergedMap.values()));
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
  }, [targetDate, unit]);

  // Trust the API response per room completely.
  // Each room (prof) gets its OWN slot list derived solely from ITS OWN horarios.
  // Never merge across rooms so a free slot in room B doesn't appear as free in room A.
  const availableSlots: { dia: DiaAgenda; prof: { codProf: number; nome: string }; slots: SlotOption[] }[] = [];

  for (const dia of diasAgenda) {
    for (const prof of dia.horarios) {
      // Only show slots from rooms that are salas (filter out avaliação, procedimentos, etc.)
      if (!prof.nome.toLowerCase().includes('sala')) continue;
      // calcularHorariosDisponiveis already respects gaps (no consecutive slots = not offered).
      // The API omits occupied slots from each room's horarios array, so we trust it fully.
      const horarios = calcularHorariosDisponiveis(prof.horarios, tempoTotal);
      if (horarios.length === 0) continue;
      const slots: SlotOption[] = horarios.map(h => ({ horario: h, codProf: prof.codProf, nomeProf: prof.nome }));
      availableSlots.push({ dia, prof: { codProf: prof.codProf, nome: prof.nome }, slots });
    }
  }

  function timeToMinutes(time: string): number {
    if (!time || !time.includes(":")) return 0;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  const handleBook = async () => {
    if (!selectedSlot) return;
    const { slot, dia } = selectedSlot;
    
    setBooking(true);
    try {
      const bookingData = {
        codCli: cliente.codigo,
        codEstab: 1,
        prof: { cod_usuario: "", nom_usuario: "" },
        dtAgd: dia.data,
        hri: slot.horario,
        serv: servicos.map((s) => ({
          codServico: String(s.codServico),
          tempo: String(s.tempo),
        })),
        codPlano: String(plano.codPlano),
        agSala: true,
        codSala: slot.codProf,
        codVendedor: "",
      };
      
      const result = await gravarAgendamento(unit, bookingData) as any;
      
      if (result && result.dis === false) {
        toast.error(result.msg || "Não foi possível realizar o agendamento no horário selecionado.");
        return;
      }
      
      toast.success("Agendamento realizado com sucesso!");
      onBooked(result, dia.data, slot.horario);
    } catch (err) {
      console.error("[AGENDAMENTO] Erro:", err);
      toast.error("Erro ao realizar agendamento");
    } finally {
      setBooking(false);
    }
  };

  return (
    <Card className="border-0 shadow-lg shadow-primary/5">
      <CardHeader className="pb-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="w-fit -ml-2 mb-2" disabled={booking || loadingInitial}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <CardTitle className="font-display text-xl">Escolha o Horário</CardTitle>
        <p className="text-sm text-muted-foreground">
          Tempo total de serviço: <span className="font-semibold text-foreground">{tempoTotal} min</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1.5 pb-2">
          {servicos.map((s) => (
            <span key={s.codServico} className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
              {s.nome.split(" - ")[0]} ({s.tempo}min)
            </span>
          ))}
        </div>

        {loadingInitial ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm animate-pulse">Calculando data ideal para retorno...</p>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            
            {/* Date Selector allowed after calculated minimum date */}
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
                      return d < min || d > addDays(min, 90); // Liberar a partir do dia alvo ate +90 dias
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                De acordo com seu histórico, os agendamentos estão disponíveis a partir desta data recomendada.
              </p>
            </div>

            {loadingSlots ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary/60" />
              </div>
            ) : availableSlots.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Não localizamos horários livres na data prevista. Tente pesquisar outro dia.
              </p>
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {/* Group by date first */}
                {[...new Map(availableSlots.map(s => [s.dia.data, s.dia])).values()].map((dia, groupIdx) => {
                  const roomsForDay = availableSlots.filter(s => s.dia.data === dia.data);
                  const totalSlots = roomsForDay.reduce((acc, r) => acc + r.slots.length, 0);
                  if (totalSlots === 0) return null;
                  return (
                    <AccordionItem value={`item-${groupIdx}`} key={dia.data} className="border-b-0 space-y-3 pb-3">
                      <AccordionTrigger className="text-sm font-semibold hover:no-underline border-b pb-2 pt-0 w-full justify-between flex">
                        {dia.nome} - {dia.data}
                      </AccordionTrigger>
                      <AccordionContent className="px-1">
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
                                      {periodoName}
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

      <div className="p-4 border-t bg-muted/20">
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
  );
}
