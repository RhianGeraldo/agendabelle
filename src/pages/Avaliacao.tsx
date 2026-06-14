import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScheduleStep } from "@/components/scheduling/ScheduleStep";
import { ConfirmationStep } from "@/components/scheduling/ConfirmationStep";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buscarCliente, gravarCliente, UNITS, type Cliente, type Plano, type Servico } from "@/lib/api";
import { Loader2, User, Phone, Mail, FileText, MapPin } from "lucide-react";
import { toast } from "sonner";

type Step = "login" | "register" | "schedule" | "confirmation";

const formatCpf = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const Avaliacao = () => {
  const [step, setStep] = useState<Step>("login");
  const [unit, setUnit] = useState<string>("");
  const [cliente, setCliente] = useState<Cliente | null>(null);
  
  // Login / Register state
  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState("");
  const [celular, setCelular] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  // Scheduling state
  const [bookingResult, setBookingResult] = useState<Record<string, unknown> | null>(null);
  const [dataAgendamento, setDataAgendamento] = useState("");
  const [horario, setHorario] = useState("");
  const [profAgendado, setProfAgendado] = useState<{ cod: string; nome: string } | null>(null);

  const [hasUrlUnit, setHasUrlUnit] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const unitParam = params.get("unidade");
    const cpfParam = params.get("cpf");

    if (unitParam) {
      setUnit(unitParam);
      setHasUrlUnit(true);
    }
    if (cpfParam) {
      const digits = cpfParam.replace(/\D/g, "").slice(0, 11);
      let formatted = digits;
      if (digits.length > 9) formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
      else if (digits.length > 6) formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
      else if (digits.length > 3) formatted = `${digits.slice(0, 3)}.${digits.slice(3)}`;
      setCpf(formatted);
    }
  }, []);

  const handleSearchCpf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unit) {
      toast.error("Unidade inválida");
      return;
    }
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      toast.error("CPF inválido");
      return;
    }

    setLoading(true);
    try {
      const data = await buscarCliente(unit, cleanCpf);
      if (data && data.codigo) {
        // Cliente existe -> Redirecionar para index com os dados logados
        localStorage.setItem("agendabelle_unit", unit);
        localStorage.setItem("agendabelle_cliente", JSON.stringify(data));
        window.location.href = "/";
      } else {
        // API pode retornar 200 porém sem cliente
        setStep("register");
        toast.info("Por favor, complete seu cadastro para agendar a avaliação.");
      }
    } catch (err: any) {
      // Se a API retornar que o CPF é inválido, exibimos o erro em vez de ir para cadastro
      if (err.message && err.message.toLowerCase().includes("cpf inválido")) {
        toast.error("CPF Inválido");
        return;
      }
      
      // Para outros erros (ex: 404 cliente não encontrado), vamos para registro
      setStep("register");
      toast.info("Por favor, complete seu cadastro para agendar a avaliação.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !celular || !email) {
      toast.error("Preencha todos os campos corretamente");
      return;
    }

    setLoading(true);
    try {
      const resultGravar = await gravarCliente(unit, {
        nome,
        celular,
        email,
        cpf
      }) as any;

      // Verifica se a API retornou erro mesmo com status 200
      if (resultGravar && (resultGravar.error || resultGravar.erro || resultGravar.msg)) {
        throw new Error(resultGravar.error || resultGravar.erro || resultGravar.msg);
      }

      // Busca o cliente recém criado para pegar o 'codigo' dele
      const data = await buscarCliente(unit, cpf.replace(/\D/g, ""));
      if (data && data.codigo) {
        setCliente(data as Cliente);
        setStep("schedule");
        toast.success("Cadastro realizado! Escolha o horário da avaliação.");
      } else {
        toast.error("Erro ao recuperar cadastro recém criado.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao realizar cadastro.");
    } finally {
      setLoading(false);
    }
  };

  const mockSelection = [{
    plano: { codPlano: -1, nome: "Avaliação", label: "Avaliação", servicos: [] },
    servicos: [{
      codSaldo: 0,
      codPlano: -1,
      codServico: 0,
      nome: "Avaliação",
      label: "Avaliação",
      valor: "0",
      saldoAtual: "1",
      saldoRestante: "1",
      saldoTotal: "1",
      tempo: 20, // 20 minutos
      usaDia: "N",
      diaRetorno: 0,
      categoria: "Avaliação",
      tipo: "Avaliação"
    }]
  }];

  const handleBooked = (
    result: Record<string, unknown>, 
    data: string, 
    hr: string, 
    successfulSelection?: { plano: Plano; servicos: Servico[] }[],
    failed?: { plano: Plano; servicos: Servico[]; motivo: string }[],
    prof?: { cod: string; nome: string } | null
  ) => {
    setBookingResult(result);
    setDataAgendamento(data);
    setHorario(hr);
    setProfAgendado(prof || null);
    setStep("confirmation");
  };

  const handleRestart = () => {
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 py-8 md:py-12">
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center mb-8">
          <img 
            src="/logo.png" 
            alt="Agendamento Online" 
            className="h-20 w-auto mb-2"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
          <p className="text-muted-foreground mt-2 text-center">
            Agende sua avaliação de forma rápida
          </p>
        </div>

        {step === "login" && (
          <Card className="border-0 shadow-lg shadow-primary/5">
            <CardHeader className="text-center pb-2">
              <CardTitle className="font-display text-xl">Bem-vindo(a)</CardTitle>
              <p className="text-sm text-muted-foreground">Informe seu CPF para agendar a avaliação</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearchCpf} className="space-y-5">
                {!hasUrlUnit && (
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
                )}

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
                    required
                  />
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={loading || !unit}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Aguarde...
                    </>
                  ) : (
                    "Continuar"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {step === "register" && (
          <Card className="border-0 shadow-lg shadow-primary/5">
            <CardHeader className="text-center pb-2">
              <CardTitle className="font-display text-xl">Novo Cadastro</CardTitle>
              <p className="text-sm text-muted-foreground">Complete seus dados para prosseguir</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegister} className="space-y-5">
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
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Nome Completo
                  </label>
                  <Input
                    placeholder="Seu nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Phone className="h-4 w-4 text-primary" />
                    Celular (com DDD)
                  </label>
                  <Input
                    placeholder="(00) 00000-0000"
                    value={celular}
                    onChange={(e) => setCelular(formatPhone(e.target.value))}
                    maxLength={15}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    E-mail
                  </label>
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Continuar"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {step === "schedule" && cliente && (
          <ScheduleStep
            unit={unit}
            cliente={cliente}
            selection={mockSelection}
            onBooked={handleBooked}
            onBack={() => setStep("login")}
          />
        )}

        {step === "confirmation" && cliente && (
          <ConfirmationStep
            cliente={cliente}
            selection={mockSelection}
            bookingResult={bookingResult}
            dataAgendamento={dataAgendamento}
            horario={horario}
            tempoTotal={20}
            prof={profAgendado}
            failedItems={[]}
            onRestart={handleRestart}
          />
        )}
      </div>
    </div>
  );
};

export default Avaliacao;
