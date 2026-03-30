import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UNITS, buscarCliente, type Cliente } from "@/lib/api";
import { Loader2, MapPin, User } from "lucide-react";
import { toast } from "sonner";

interface LoginStepProps {
  onClienteFound: (unit: string, cliente: Cliente) => void;
}

export function LoginStep({ onClienteFound }: LoginStepProps) {
  const [unit, setUnit] = useState("");
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unit || cpf.replace(/\D/g, "").length !== 11) {
      toast.error("Preencha todos os campos corretamente");
      return;
    }

    setLoading(true);
    try {
      const data = await buscarCliente(unit, cpf.replace(/\D/g, ""));
      if (!data || !data.codigo) {
        toast.error("Cliente não encontrado");
        return;
      }
      onClienteFound(unit, data as Cliente);
    } catch {
      toast.error("Erro ao buscar cliente. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-0 shadow-lg shadow-primary/5">
      <CardHeader className="text-center pb-2">
        <CardTitle className="font-display text-xl">Identificação</CardTitle>
        <p className="text-sm text-muted-foreground">Selecione sua unidade e informe seu CPF</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Unidade
            </label>
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              CPF
            </label>
            <Input
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
              maxLength={14}
            />
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando...
              </>
            ) : (
              "Continuar"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
