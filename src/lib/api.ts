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
  const freeSlots = profHorarios
    .filter(h => h.cod === 'l' && h.bloq === 'l')
    .map(h => h.horario)
    .sort();

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
