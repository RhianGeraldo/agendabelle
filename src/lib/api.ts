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

const UNIT_TOKENS: Record<string, string> = {
  mantena: '452166ad16be9184c85db73a97832d55',
  'sao-mateus': '47ad4592f0438b5f4ba37c05e2ffc7e9',
  linhares: '76683f1105194b9f9544cb9f1b356a5b',
  aracruz: 'd4fd49c6235cbe09ea4cb0827f51f575',
  serra: '8471d37f86e5c2d2cb213d8e092f2c64',
};

const BASE_URL = 'https://app.bellesoftware.com.br/api/release/controller/IntegracaoExterna/v1.0';

function getToken(unit: string): string {
  const token = UNIT_TOKENS[unit];
  if (!token) throw new Error('Unidade inválida');
  return token;
}

async function apiGet(url: string, token: string) {
  console.log(`[API GET]: ${url}`);
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: token },
  });
  console.log(`[API GET RESPONSE STATUS]: ${res.status}`);
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

async function apiPost(url: string, token: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: token,
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

async function apiPut(url: string, token: string, body: unknown) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: token,
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
  return apiGet(`${BASE_URL}/cliente/listar?codEstab=1&cpf=${cleanCpf}`, getToken(unit));
}

export async function buscarPlanos(unit: string, codEstab: number, codCliente: number) {
  return apiGet(`${BASE_URL}/cliente/planos?codEstab=${codEstab}&codCliente=${codCliente}`, getToken(unit));
}

export async function buscarHistoricoAgenda(unit: string, codEstab: number, codCliente: number, dtInicio: string, dtFim: string) {
  return apiGet(`${BASE_URL}/cliente/agenda?codEstab=${codEstab}&codCliente=${codCliente}&dtInicio=${dtInicio}&dtFim=${dtFim}`, getToken(unit));
}

export async function buscarAgendamentosAbertos(unit: string, codEstab: number, dtInicio: string, dtFim: string) {
  return apiGet(`${BASE_URL}/agendamentos?codEstab=${codEstab}&dtInicio=${dtInicio}&dtFim=${dtFim}`, getToken(unit));
}

export async function buscarAgendamentosFinalizados(unit: string, codEstab: number, dtInicio: string, dtFim: string) {
  return apiGet(`${BASE_URL}/agendamentos/finalizados?codEstab=${codEstab}&dtInicio=${dtInicio}&dtFim=${dtFim}`, getToken(unit));
}

export async function buscarServicos(unit: string, codPlano: number) {
  return apiGet(`${BASE_URL}/servico/listar?codPlano=${codPlano}`, getToken(unit));
}

export async function buscarDisponibilidade(unit: string, codEstab: number, dtAgenda: string, periodo: string) {
  return apiGet(`${BASE_URL}/agenda/disponibilidade?codEstab=${codEstab}&dtAgenda=${dtAgenda}&periodo=${periodo}&tpAgd=s`, getToken(unit));
}

export async function gravarAgendamento(unit: string, bookingData: Record<string, unknown>) {
  return apiPost(`${BASE_URL}/agenda/gravar`, getToken(unit), bookingData);
}

export async function alterarStatusAgendamento(unit: string, codConsulta: number, status: string) {
  return apiPut(`${BASE_URL}/agenda/status`, getToken(unit), {
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

const FINANCIAL_UNIT_KEYS: Record<string, string> = {
  mantena: "A3F7FF3375B1EBE13DB1CF09749D1A4949D53BD9EECD4DDCD4877D38CF1BF7F8",
  "sao-mateus": "DBE42F861DE477D9BE335EB5E16897E15D412E1DA1E7C65550E9C441D8AD9A6C",
  linhares: "1B5D672062BD4D7B23657A141812A3018A24D8755E08570BEF9556FA9FA71CCF",
  aracruz: "E94FF7C18A2C2F752385B8DD5530B2BE164C409591B4981E26BDB4D62E2537A7",
  serra: "3083D7AE32D10D9940CD2DD42DB82B0859FC08FAE586F903391F8378F8F564B3",
};

export async function buscarVendasElosgate(unit: string, cpf: string): Promise<VendaElosgate[]> {
  const apiKey = FINANCIAL_UNIT_KEYS[unit];
  if (!apiKey) throw new Error("Unidade inválida para financeiro");
  
  const cleanCpf = cpf.replace(/\D/g, "");
  console.log(`[FINANCIAL GET]: Fetching sales for unit=${unit}, cleanCpf=${cleanCpf}`);
  
  const res = await fetch("https://svc3.elosgate.com.br/generated/gatewaysvc.svc/json/ListarDadosVendas", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      APIKey: apiKey,
      Documento: cleanCpf,
    }),
  });

  if (!res.ok) {
    throw new Error(`Erro ao buscar dados financeiros: ${res.status}`);
  }

  const data = await res.json();
  console.log(`[FINANCIAL RESPONSE]: Received sales data for unit=${unit}`);
  
  if (data && Array.isArray(data.Vendas)) {
    return data.Vendas;
  }
  
  if (data && Array.isArray(data)) {
    return data;
  }
  
  return [];
}

export async function obterURLVenda(unit: string, numeroVenda: string): Promise<string | null> {
  const apiKey = FINANCIAL_UNIT_KEYS[unit];
  if (!apiKey) {
    console.error(`[OBTER URL VENDA]: API Key not found for unit: ${unit}`);
    return null;
  }

  try {
    const res = await fetch("https://svc3.elosgate.com.br/generated/gatewaysvc.svc/json/ObterURLVenda", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        APIKey: apiKey,
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

