import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, CalendarX, PlusCircle, ArrowRightCircle, CheckCircle2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { type Cliente, type AgendamentoHistorico } from "@/lib/api";

interface AppointmentsStepProps {
  unit: string;
  cliente: Cliente;
  appointments: AgendamentoHistorico[];
  loading: boolean;
  onConfirmAppt?: (appt: AgendamentoHistorico) => void;
  onReschedule: (appt: AgendamentoHistorico) => void;
  onNewBooking?: () => void;
  onBack?: () => void;
  isEmbedded?: boolean;
}

export function AppointmentsStep({ cliente, appointments, loading, onNewBooking, onConfirmAppt, onReschedule, onBack, isEmbedded }: AppointmentsStepProps) {
  const [rescheduleConfirmAppt, setRescheduleConfirmAppt] = useState<AgendamentoHistorico | null>(null);

  const grouped = appointments.reduce((acc, appt) => {
    const status = appt.status || "Outros";
    if (!acc[status]) acc[status] = [];
    acc[status].push(appt);
    return acc;
  }, {} as Record<string, AgendamentoHistorico[]>);

  const statusPriority: Record<string, number> = {
    "Marcado": 1,
    "Confirmado": 2,
    "Aguardando": 3,
    "Atendido": 4,
  };

  const sortedStatuses = Object.keys(grouped).sort((a, b) => {
    return (statusPriority[a] || 99) - (statusPriority[b] || 99);
  });

  return (
    <Card className="border-0 shadow-lg shadow-primary/5">
      <CardHeader className="pb-2">
        {!isEmbedded && onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} className="w-fit -ml-2 mb-2" disabled={loading}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
        )}
        <CardTitle className="font-display text-xl">Seus Agendamentos</CardTitle>
        <p className="text-sm text-muted-foreground">
          Histórico e próximos procedimentos agendados para <strong>{cliente.nome.split(" ")[0]}</strong>.
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm animate-pulse">Consultando histórico...</p>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {appointments.length === 0 ? (
              <div className="text-center py-6 bg-muted/20 rounded-lg border">
                <CalendarX className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-muted-foreground">Nenhum agendamento encontrado nos últimos 90 dias.</p>
              </div>
            ) : (
              <Accordion type="multiple" className="w-full space-y-3" defaultValue={["Marcado", "Confirmado"]}>
                {sortedStatuses.map((status) => (
                  <AccordionItem value={status} key={status} className="border rounded-md px-3 bg-card shadow-sm">
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{status}</span>
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                          {grouped[status].length}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-1 pb-3 space-y-3">
                      {grouped[status].map((appt) => {
                        const isReagendavel = appt.status === "Marcado" || appt.status === "Confirmado";
                        const isAtendido = appt.status === "Atendido" || appt.status === "Aguardando";

                        return (
                          <div key={appt.codConsulta} className="border rounded-md p-3 relative bg-background/50 overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                            <div className="flex justify-between items-start mb-2 pl-2">
                              <div>
                                <p className="font-semibold text-sm">{appt.dtAgenda} às {appt.hrConsulta}</p>
                              </div>
                            </div>
                            <div className="pl-2 space-y-1 mb-3">
                              <p className="text-xs font-medium text-primary">Serviços:</p>
                              {appt.servicos.map((s, i) => (
                                <p key={i} className="text-xs text-muted-foreground truncate" title={s.nome}>
                                  • {s.nome}
                                </p>
                              ))}
                            </div>
                            <div className="pl-2 border-t pt-2 flex gap-2">
                              {appt.status === "Marcado" && (
                                <Button variant="default" size="sm" className="w-full text-xs h-8" onClick={() => onConfirmAppt && onConfirmAppt(appt)}>
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Confirmar
                                </Button>
                              )}
                              
                              {isReagendavel && (
                                <Button variant="outline" size="sm" className="w-full text-xs h-8" onClick={() => setRescheduleConfirmAppt(appt)}>
                                  <ArrowRightCircle className="h-3 w-3 mr-1" /> Reagendar
                                </Button>
                              )}

                              {isAtendido && onNewBooking && (
                                <Button variant="outline" size="sm" className="w-full text-xs h-8 border-primary text-primary hover:bg-primary/10" onClick={onNewBooking}>
                                  <PlusCircle className="h-3 w-3 mr-1" /> Agendar Próxima Sessão
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}

            {!isEmbedded && onNewBooking && (
              <Button size="lg" className="w-full font-semibold mt-4" onClick={onNewBooking}>
                <PlusCircle className="mr-2 h-5 w-5" />
                Novo Agendamento
              </Button>
            )}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!rescheduleConfirmAppt} onOpenChange={(open) => !open && setRescheduleConfirmAppt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja realmente reagendar?</AlertDialogTitle>
            <AlertDialogDescription>
              Ao prosseguir, este agendamento será <strong>desmarcado</strong> imediatamente. Você precisará escolher um novo horário na próxima tela.
              <br/><br/>
              <strong>Atenção:</strong> Você pode perder a garantia desta vaga que já está reservada para você.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (rescheduleConfirmAppt) {
                onReschedule(rescheduleConfirmAppt);
              }
            }}>
              Sim, desmarcar e reagendar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
