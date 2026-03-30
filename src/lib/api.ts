import { supabase } from "@/integrations/supabase/client";

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

async function callProxy(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('belle-proxy', {
    body,
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function buscarCliente(unit: string, cpf: string) {
  return callProxy({ action: 'buscar-cliente', unit, cpf, codEstab: 1 });
}

export async function buscarPlanos(unit: string, codEstab: number, codCliente: number) {
  return callProxy({ action: 'buscar-planos', unit, codEstab, codCliente });
}

export async function buscarServicos(unit: string, codPlano: number) {
  return callProxy({ action: 'buscar-servicos', unit, codPlano });
}

export async function buscarDisponibilidade(unit: string, codEstab: number, dtAgenda: string, periodo: string) {
  return callProxy({ action: 'buscar-disponibilidade', unit, codEstab, dtAgenda, periodo });
}

export async function gravarAgendamento(unit: string, bookingData: Record<string, unknown>) {
  return callProxy({ action: 'gravar-agendamento', unit, bookingData });
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

// Calculate available start times based on required duration
export function calcularHorariosDisponiveis(
  profHorarios: HorarioSlot[],
  tempoTotalMinutos: number
): string[] {
  const slotsNeeded = tempoTotalMinutos / 5;
  if (slotsNeeded <= 0 || profHorarios.length === 0) return [];

  // Only free slots
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
