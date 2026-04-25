import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import type { Cliente, Plano } from "@/lib/api";

interface ConfirmationStepProps {
  cliente: Cliente;
  selection: { plano: Plano; servicos: Servico[] }[];
  bookingResult: Record<string, unknown> | null;
  dataAgendamento: string;
  horario: string;
  tempoTotal: number;
  onRestart: () => void;
}

export function ConfirmationStep({ cliente, selection, dataAgendamento, horario, tempoTotal, onRestart }: ConfirmationStepProps) {
  return (
    <Card className="border-0 shadow-lg shadow-primary/5">
      <CardHeader className="text-center pb-2">
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
        </div>
        <CardTitle className="font-display text-xl">Agendamento Confirmado!</CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <div className="border border-border/50 rounded-lg p-4 space-y-2 text-sm bg-card text-left">
          <p className="flex justify-between border-b pb-2 mb-2">
            <span className="text-muted-foreground">Cliente:</span>{" "}
            <span className="font-medium">{cliente.nome}</span>
          </p>
          
          <div className="space-y-2">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">Planos Agendados:</p>
            {selection.map((sel, idx) => (
              <div key={idx} className="bg-muted/50 p-3 rounded border border-border/50">
                <p className="font-medium text-xs">{sel.plano.nome}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {sel.servicos.map((s, si) => (
                    <span key={si} className="text-[10px] text-muted-foreground">• {s.nome.split(" - ")[0]}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 mt-2 border-t space-y-1">
            <p className="flex justify-between">
              <span className="text-muted-foreground">Data:</span>{" "}
              <span className="font-medium">{dataAgendamento}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-muted-foreground">Horário de Início:</span>{" "}
              <span className="font-medium">{horario}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-muted-foreground">Tempo total:</span>{" "}
              <span className="font-medium">{tempoTotal} min</span>
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Seus agendamentos foram enviados para o sistema. Você receberá uma confirmação em breve.
        </p>
        <Button onClick={onRestart} variant="outline" className="w-full">
          Novo Agendamento
        </Button>
      </CardContent>
    </Card>
  );
}
