import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import {
  buscarDisponibilidade,
  gravarAgendamento,
  calcularHorariosDisponiveis,
  addMinutesToTime,
  buscarAgendamentosAbertos,
  buscarAgendamentosFinalizados,
  type Cliente,
  type Plano,
  type Servico,
  type DiaAgenda,
  type AgendamentoHistorico,
} from "@/lib/api";
import { ArrowLeft, Loader2, Calendar, Package } from "lucide-react";
import { toast } from "sonner";
import { format, addDays, subMonths, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ScheduleStepProps {
  unit: string;
  cliente: Cliente;
  selection: { plano: Plano; servicos: Servico[] }[];
  onBooked: (result: Record<string, unknown>, data: string, horario: string) => void;
  onBack: () => void;
}

interface SlotOption {
  horario: string;
  codProf: number;
  nomeProf: string;
}

export function ScheduleStep({ unit, cliente, selection, onBooked, onBack }: ScheduleStepProps) {
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  
  const [minAllowedDate, setMinAllowedDate] = useState<Date | null>(null);
  const [targetDate, setTargetDate] = useState<Date | undefined>(undefined);
  
  const [diasAgenda, setDiasAgenda] = useState<DiaAgenda[]>([]);
  const [agendamentosDoDia, setAgendamentosDoDia] = useState<AgendamentoHistorico[]>([]);
  const [booking, setBooking] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ slot: SlotOption; dia: DiaAgenda } | null>(null);

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
          const reqStart = format(subMonths(hoje, 3), "dd/MM/yyyy");
          const reqEnd = format(hoje, "dd/MM/yyyy");

          const results = await Promise.allSettled([
            buscarAgendamentosFinalizados(unit, 1, reqStart, reqEnd),
            buscarAgendamentosAbertos(unit, 1, reqStart, reqEnd)
          ]);

          const allHist: any[] = [];
          results.forEach((res) => {
            if (res.status === "fulfilled" && Array.isArray(res.value)) {
              const clientAppts = res.value.filter(a => a.cliente && String(a.cliente.cod) === String(cliente.codigo));
              allHist.push(...clientAppts);
            }
          });

          const atendidos = allHist.filter((a: any) => {
            if (!a.status || !a.servicos) return false;
            const statusLower = a.status.trim().toLowerCase();
            const hasSameService = a.servicos.some((as: any) => 
               allServicos.some(s => String(s.codServico) === String(as.cod))
            );
            return (statusLower === "atendido" || statusLower === "aguardando" || statusLower === "em atendimento") && hasSameService;
          });
          
          if (atendidos.length > 0) {
            const sortedHist = [...atendidos].sort((a: any, b: any) => {
              const dA = parse(a.dtAgenda, "dd/MM/yyyy", new Date());
              const dB = parse(b.dtAgenda, "dd/MM/yyyy", new Date());
              if (dB.getTime() === dA.getTime()) {
                return b.hrConsulta.localeCompare(a.hrConsulta);
              }
              return dB.getTime() - dA.getTime();
            });
            const lastApptDate = parse(sortedHist[0].dtAgenda, "dd/MM/yyyy", new Date());
            let suggested = addDays(lastApptDate, 40);
            if (suggested.getDay() === 0) suggested = addDays(suggested, 1);
            foundDate = suggested;
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
  }, [unit, cliente.codigo, allServicos]);

  // 2. Load Availability when targetDate changes
  useEffect(() => {
    if (!targetDate) return;
    
    let mounted = true;
    const loadSlots = async () => {
      try {
        setLoadingSlots(true);
        const datesToFetch = [targetDate];
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

  const availableSlots: { dia: DiaAgenda; prof: { codProf: number; nome: string }; slots: SlotOption[] }[] = [];

  for (const dia of diasAgenda) {
    for (const prof of dia.horarios) {
      if (!prof.nome.toLowerCase().includes('sala')) continue;
      const horarios = calcularHorariosDisponiveis(prof.horarios, tempoTotal);
      if (horarios.length === 0) continue;
      const slots: SlotOption[] = horarios.map(h => ({ horario: h, codProf: prof.codProf, nomeProf: prof.nome }));
      availableSlots.push({ dia, prof: { codProf: prof.codProf, nome: prof.nome }, slots });
    }
  }

  const handleBook = async () => {
    if (!selectedSlot) return;
    const { slot, dia } = selectedSlot;
    
    setBooking(true);
    try {
      let currentStartTime = slot.horario;
      let lastResult = null;

      for (const sel of selection) {
        const planDuration = sel.servicos.reduce((sum, s) => sum + s.tempo, 0);
        
        const bookingData = {
          codCli: cliente.codigo,
          codEstab: 1,
          prof: { cod_usuario: "", nom_usuario: "" },
          dtAgd: dia.data,
          hri: currentStartTime,
          serv: sel.servicos.map((s) => ({
            codServico: String(s.codServico),
            tempo: String(s.tempo),
          })),
          codPlano: String(sel.plano.codPlano),
          agSala: true,
          codSala: slot.codProf,
          codVendedor: "",
          observacao: "Incluso por Agenda Estética e Laser",
        };

        const result = await gravarAgendamento(unit, bookingData) as any;
        
        if (result && result.dis === false) {
          throw new Error(result.msg || "Não foi possível realizar o agendamento no horário selecionado.");
        }
        
        lastResult = result;
        currentStartTime = addMinutesToTime(currentStartTime, planDuration);
      }
      
      toast.success(selection.length > 1 ? "Todos os agendamentos realizados com sucesso!" : "Agendamento realizado com sucesso!");
      onBooked(lastResult, dia.data, slot.horario);
    } catch (err: any) {
      console.error("[AGENDAMENTO] Erro:", err);
      toast.error(err.message || "Erro ao realizar agendamento");
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
              <Accordion type="single" collapsible className="w-full">
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
