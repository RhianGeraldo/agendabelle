import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  buscarDisponibilidade,
  gravarAgendamento,
  calcularHorariosDisponiveis,
  type Cliente,
  type Plano,
  type Servico,
  type DiaAgenda,
} from "@/lib/api";
import { ArrowLeft, Calendar, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
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
  const [periodo, setPeriodo] = useState("");
  const [date, setDate] = useState<Date | undefined>();
  const [loading, setLoading] = useState(false);
  const [diasAgenda, setDiasAgenda] = useState<DiaAgenda[]>([]);
  const [searched, setSearched] = useState(false);
  const [booking, setBooking] = useState(false);

  const tempoTotal = servicos.reduce((sum, s) => sum + s.tempo, 0);

  const handleSearch = async () => {
    if (!date || !periodo) {
      toast.error("Selecione a data e o período");
      return;
    }

    setLoading(true);
    setSearched(false);
    try {
      const dtFormatted = format(date, "dd/MM/yyyy");
      const data = await buscarDisponibilidade(unit, 1, dtFormatted, periodo);
      setDiasAgenda(Array.isArray(data) ? data : []);
      setSearched(true);
    } catch {
      toast.error("Erro ao buscar disponibilidade");
    } finally {
      setLoading(false);
    }
  };

  // Calculate available slots
  const availableSlots: { dia: DiaAgenda; slots: SlotOption[] }[] = diasAgenda.map((dia) => {
    const slots: SlotOption[] = [];
    for (const prof of dia.horarios) {
      const horarios = calcularHorariosDisponiveis(prof.horarios, tempoTotal);
      horarios.forEach((h) => {
        slots.push({ horario: h, codProf: prof.codProf, nomeProf: prof.nome });
      });
    }
    return { dia, slots };
  }).filter(d => d.slots.length > 0);

  const handleBook = async (slot: SlotOption, dia: DiaAgenda) => {
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
      const result = await gravarAgendamento(unit, bookingData);
      toast.success("Agendamento realizado com sucesso!");
      onBooked(result);
    } catch {
      toast.error("Erro ao realizar agendamento");
    } finally {
      setBooking(false);
    }
  };

  return (
    <Card className="border-0 shadow-lg shadow-primary/5">
      <CardHeader className="pb-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="w-fit -ml-2 mb-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <CardTitle className="font-display text-xl">Escolha o Horário</CardTitle>
        <p className="text-sm text-muted-foreground">
          Tempo total do procedimento: <span className="font-semibold text-foreground">{tempoTotal} min</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Services summary */}
        <div className="flex flex-wrap gap-1.5">
          {servicos.map((s) => (
            <span key={s.codServico} className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
              {s.nome.split(" - ")[0]} ({s.tempo}min)
            </span>
          ))}
        </div>

        {/* Date picker */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Data
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
              >
                <Calendar className="h-4 w-4 mr-2" />
                {date ? format(date, "PPP", { locale: ptBR }) : "Selecione uma data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarUI
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={(d) => d < new Date() || d > addDays(new Date(), 60)}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Period */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Período
          </label>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manha">Manhã</SelectItem>
              <SelectItem value="tarde">Tarde</SelectItem>
              <SelectItem value="noite">Noite</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSearch} className="w-full" disabled={loading || !date || !periodo}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
            </>
          ) : (
            "Buscar Horários"
          )}
        </Button>

        {/* Results */}
        {searched && (
          <div className="space-y-4 pt-2">
            {availableSlots.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Nenhum horário disponível para esta data e período. Tente outra combinação.
              </p>
            ) : (
              availableSlots.map(({ dia, slots }) => (
                <div key={dia.data} className="space-y-2">
                  <h3 className="text-sm font-semibold">
                    {dia.nome} - {dia.data}
                  </h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {slots.map((slot, idx) => (
                      <Button
                        key={`${slot.horario}-${slot.codProf}-${idx}`}
                        variant="outline"
                        size="sm"
                        disabled={booking}
                        onClick={() => handleBook(slot, dia)}
                        className="hover:bg-primary hover:text-primary-foreground transition-colors"
                        title={slot.nomeProf}
                      >
                        {slot.horario}
                      </Button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
