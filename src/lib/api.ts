export interface Unit {
  id: string;
  label: string;
}

export const UNITS: Unit[] = [
  { id: 'mantena', label: 'Mantena' },
  { id: 'sao-mateus', label: 'São Mateus' },
  { id: 'linhares', label: 'Linhares' },
  { id: 'aracruz', label: 'Aracruz' },
  { id: 'serra', label: 'Serra' },
];

async function apiGet(url: string) {
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    let msg = `API error: ${res.status}`;
    try {
      const errBody = await res.json();
      msg = errBody.error || errBody.msg || msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}

async function apiPost(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `API error: ${res.status}`;
    try {
      const errBody = await res.json();
      msg = errBody.error || errBody.msg || msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}

async function apiPut(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `API error: ${res.status}`;
    try {
      const errBody = await res.json();
      msg = errBody.error || errBody.msg || msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  try {
    return await res.json();
  } catch {
    return {}; // sometimes PUT endpoints return empty body
  }
}

export async function buscarCliente(unit: string, cpf: string) {
  const cleanCpf = cpf.replace(/\D/g, '');
  if (cleanCpf.length < 11) throw new Error('CPF inválido');
  return apiGet(`/api/belle/${unit}/cliente/listar?codEstab=1&cpf=${cleanCpf}`);
}

export async function gravarCliente(unit: string, dados: {
  nome: string;
  celular: string;
  email: string;
  cpf: string;
}) {
  const body = {
    nome: dados.nome,
    celular: dados.celular.replace(/\D/g, ''),
    email: dados.email,
    cpf: dados.cpf.replace(/\D/g, ''),
    observacao: "Cadastro via AgendaBelle (Avaliação)",
    tpOrigem: "Campanha",
    codOrigem: "1",
    codEstab: 1
  };

  return apiPost(`/api/belle/${unit}/cliente/gravar`, body);
}

export async function buscarPlanos(unit: string, codEstab: number, codCliente: number) {
  return apiGet(`/api/belle/${unit}/cliente/planos?codEstab=${codEstab}&codCliente=${codCliente}`);
}

export async function buscarHistoricoAgenda(unit: string, codEstab: number, codCliente: number, dtInicio: string, dtFim: string) {
  return apiGet(`/api/belle/${unit}/cliente/agenda?codEstab=${codEstab}&codCliente=${codCliente}&dtInicio=${dtInicio}&dtFim=${dtFim}`);
}

export async function buscarAgendamentosAbertos(unit: string, codEstab: number, dtInicio: string, dtFim: string) {
  return apiGet(`/api/belle/${unit}/agendamentos?codEstab=${codEstab}&dtInicio=${dtInicio}&dtFim=${dtFim}`);
}

export async function buscarAgendamentosFinalizados(unit: string, codEstab: number, dtInicio: string, dtFim: string) {
  return apiGet(`/api/belle/${unit}/agendamentos/finalizados?codEstab=${codEstab}&dtInicio=${dtInicio}&dtFim=${dtFim}`);
}

export async function buscarServicos(unit: string, codPlano: number) {
  return apiGet(`/api/belle/${unit}/servico/listar?codPlano=${codPlano}`);
}

export async function buscarDisponibilidade(unit: string, codEstab: number, dtAgenda: string, periodo: string = 'todos') {
  return apiGet(`/api/belle/${unit}/agenda/disponibilidade?codEstab=${codEstab}&dtAgenda=${dtAgenda}&periodo=${periodo}&tpAgd=s`);
}

export async function gravarAgendamento(unit: string, bookingData: Record<string, unknown>) {
  return apiPost(`/api/belle/${unit}/agenda/gravar`, bookingData);
}

export async function gravarAgendamentoSemServico(unit: string, bookingData: Record<string, unknown>) {
  return apiPost(`/api/belle/${unit}/agenda/gravar_sem_servico`, bookingData);
}

export async function alterarStatusAgendamento(unit: string, codConsulta: number, status: string) {
  return apiPut(`/api/belle/${unit}/agenda/status`, {
    codConsulta,
    novoStatus: status
  });
}

export interface Servico {
  codSaldo: number;
  codPlano: number;
  codServico: number;
  nome: string;
  label: string;
  valor: string;
  saldoAtual: string;
  saldoRestante: string;
  saldoTotal: string;
  tempo: number;
  usaDia: string;
  diaRetorno: number;
  categoria: string;
  tipo: string;
}

export interface Plano {
  codPlano: number;
  nome: string;
  label: string;
  servicos: { codServico: number; nome: string; saldoRestante: number }[];
}

export interface HorarioSlot {
  horario: string;
  cod: string;
  bloq: string;
}

export interface ProfissionalAgenda {
  codProf: number;
  tempo_intervalo: string;
  nome: string;
  horarios: HorarioSlot[];
}

export interface DiaAgenda {
  nome: string;
  data: string;
  disp: string;
  horarios: ProfissionalAgenda[];
}

export interface Cliente {
  codigo: number;
  nome: string;
  cpf: string;
  dtNascimento: string;
  celular: string;
  email: string;
}

export interface AgendamentoHistorico {
  codConsulta: number;
  dtAgenda: string;
  hrConsulta: string;
  status: string;
  tipo: string;
  codEstab: number;
  tipo_obs: string;
  observacao: string;
  prof: { cod: string; nome: string };
  sala: { cod: string; nome: string };
  servicos: { cod: string; nome: string }[];
}

// Calculate available start times based on required duration
export function calcularHorariosDisponiveis(
  profHorarios: HorarioSlot[],
  tempoTotalMinutos: number
): string[] {
  const slotsNeeded = tempoTotalMinutos / 5;
  if (slotsNeeded <= 0 || profHorarios.length === 0) return [];

  // Only free slots (l represents 'livre' - free)
  const freeSlots = Array.from(new Set(
    profHorarios
      .filter(h => h.cod === 'l' && h.bloq === 'l')
      .map(h => h.horario)
  )).sort();

  const validStartTimes: string[] = [];

  for (let i = 0; i <= freeSlots.length - slotsNeeded; i++) {
    let consecutive = true;
    for (let j = 0; j < slotsNeeded - 1; j++) {
      const current = timeToMinutes(freeSlots[i + j]);
      const next = timeToMinutes(freeSlots[i + j + 1]);
      if (next - current !== 5) {
        consecutive = false;
        break;
      }
    }
    if (consecutive) {
      validStartTimes.push(freeSlots[i]);
    }
  }

  return validStartTimes;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function addMinutesToTime(time: string, minutes: number): string {
  const total = timeToMinutes(time) + minutes;
  return minutesToTime(total);
}

export interface ParcelaElosgate {
  ID: string;
  Numero: number;
  Valor: number;
  Vencimento: string;
  Pagamento?: string | null;
  MeioPagamento?: string;
  StatusString?: string;
  [key: string]: any;
}

export interface MeioPagamentoElosgate {
  ID: string;
  Descricao: string;
  NumeroParcelas: number;
  Valor: number;
  StatusString?: string;
  Parcelas?: ParcelaElosgate[];
  [key: string]: any;
}

export interface VendaElosgate {
  ID: string;
  Numero: string;
  ReferenciaVenda: string;
  DataCriacao: string;
  DataAlteracao: string;
  StatusString: string;
  MeiosPagamento?: MeioPagamentoElosgate[];
  [key: string]: any;
}

export async function buscarVendasElosgate(unit: string, cpf: string): Promise<VendaElosgate[]> {
  const cleanCpf = cpf.replace(/\D/g, "");
  
  const res = await fetch(`/api/elosgate/${unit}/ListarDadosVendas`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      Documento: cleanCpf,
    }),
  });

  if (!res.ok) {
    throw new Error(`Erro ao buscar dados financeiros: ${res.status}`);
  }

  const data = await res.json();
  
  if (data && Array.isArray(data.Vendas)) {
    return data.Vendas;
  }
  
  if (data && Array.isArray(data)) {
    return data;
  }
  
  return [];
}

export async function obterURLVenda(unit: string, numeroVenda: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/elosgate/${unit}/ObterURLVenda`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        NumeroVenda: numeroVenda,
      }),
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    const resultObj = Array.isArray(data) ? data[0] : data;
    
    if (resultObj && resultObj.Errors && resultObj.Errors.length > 0) {
      console.error("[OBTER URL VENDA] API Errors:", resultObj.Errors);
      return null;
    }

    return resultObj?.URL || null;
  } catch (error) {
    console.error("[OBTER URL VENDA] Error fetching payment link:", error);
    return null;
  }
}

