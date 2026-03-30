import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import type { Cliente, Plano } from "@/lib/api";

interface ConfirmationStepProps {
  cliente: Cliente;
  plano: Plano;
  bookingResult: Record<string, unknown> | null;
  dataAgendamento: string;
  horario: string;
  tempoTotal: number;
  onRestart: () => void;
}

export function ConfirmationStep({ cliente, plano, dataAgendamento, horario, tempoTotal, onRestart }: ConfirmationStepProps) {
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
        <div className="bg-accent/50 rounded-lg p-4 space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Cliente:</span>{" "}
            <span className="font-medium">{cliente.nome}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Plano:</span>{" "}
            <span className="font-medium">{plano.nome}</span>
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Seu agendamento foi enviado para o sistema. Você receberá uma confirmação em breve.
        </p>
        <Button onClick={onRestart} variant="outline" className="w-full">
          Novo Agendamento
        </Button>
      </CardContent>
    </Card>
  );
}
