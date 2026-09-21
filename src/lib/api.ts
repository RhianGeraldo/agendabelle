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
    headers: { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    },
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
  observacao?: string;
}) {
  const body = {
    nome: dados.nome,
    celular: dados.celular.replace(/\D/g, ''),
    email: dados.email,
    cpf: dados.cpf.replace(/\D/g, ''),
    observacao: dados.observacao || "Cadastro via AgendaBelle (Avaliação)",
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

export async function buscarAgendamentosAbertos(unit: string, codEstab: number, dtInicio: string, dtFim: string, codCliente?: number | string) {
  const query = codCliente ? `&codCliente=${codCliente}` : '';
  return apiGet(`/api/belle/${unit}/agendamentos?codEstab=${codEstab}&dtInicio=${dtInicio}&dtFim=${dtFim}${query}`);
}

export async function buscarAgendamentosFinalizados(unit: string, codEstab: number, dtInicio: string, dtFim: string, codCliente?: number | string) {
  const query = codCliente ? `&codCliente=${codCliente}` : '';
  return apiGet(`/api/belle/${unit}/agendamentos/finalizados?codEstab=${codEstab}&dtInicio=${dtInicio}&dtFim=${dtFim}${query}`);
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
  cliente?: { cod?: string | number; nome?: string; cpf?: string; celular?: string };
}

// Calculate available start times based on required duration
export function calcularHorariosDisponiveis(
  profHorarios: HorarioSlot[],
  tempoTotalMinutos: number
): string[] {
  if (tempoTotalMinutos <= 0 || profHorarios.length === 0) return [];

  // Only free slots (l represents 'livre' - free)
  const freeSlots = Array.from(new Set(
    profHorarios
      .filter(h => h.cod === 'l' && h.bloq === 'l')
      .map(h => h.horario)
  )).sort();

  // No Belle Software, cada slot livre S_k retornado pela API já garante pelo menos
  // 20 minutos livres a partir dele até o próximo agendamento (ou fim do expediente).
  // Agrupamos em blocos contínuos de slots separados por 5 minutos.
  // Para cada bloco [S_inicio ... S_fim], a janela total livre é de S_inicio até (S_fim + 20 minutos).
  const validStartTimes: string[] = [];

  let blockStartIdx = 0;
  while (blockStartIdx < freeSlots.length) {
    let blockEndIdx = blockStartIdx;
    while (
      blockEndIdx + 1 < freeSlots.length &&
      timeToMinutes(freeSlots[blockEndIdx + 1]) - timeToMinutes(freeSlots[blockEndIdx]) === 5
    ) {
      blockEndIdx++;
    }

    const windowEndMinutes = timeToMinutes(freeSlots[blockEndIdx]) + 20;

    for (let i = blockStartIdx; i <= blockEndIdx; i++) {
      const slotMinutes = timeToMinutes(freeSlots[i]);
      if (windowEndMinutes - slotMinutes >= tempoTotalMinutos) {
        validStartTimes.push(freeSlots[i]);
      }
    }

    blockStartIdx = blockEndIdx + 1;
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
  [key: string]: unknown;
}

export interface MeioPagamentoElosgate {
  ID: string;
  Descricao: string;
  NumeroParcelas: number;
  Valor: number;
  StatusString?: string;
  Parcelas?: ParcelaElosgate[];
  [key: string]: unknown;
}

export interface VendaElosgate {
  ID: string;
  Numero: string;
  ReferenciaVenda: string;
  DataCriacao: string;
  DataAlteracao: string;
  StatusString: string;
  MeiosPagamento?: MeioPagamentoElosgate[];
  [key: string]: unknown;
}

export function isSaleExcluded(sale: VendaElosgate): boolean {
  if (!sale) return true;

  const saleStatusStr = String(sale.StatusString || "").trim().toLowerCase();
  
  if (
    saleStatusStr.includes("cancel") ||
    saleStatusStr.includes("exclu") ||
    saleStatusStr.includes("estorn") ||
    saleStatusStr.includes("recus") ||
    saleStatusStr.includes("rejeit") ||
    String(sale.Status) === "5" ||
    String(sale.Status) === "8"
  ) {
    return true;
  }

  if (sale.MeiosPagamento && Array.isArray(sale.MeiosPagamento) && sale.MeiosPagamento.length > 0) {
    const allMeiosCancelled = sale.MeiosPagamento.every((m) => {
      const mStr = String(m.StatusString || "").trim().toLowerCase();
      return (
        mStr.includes("cancel") ||
        mStr.includes("exclu") ||
        String(m.Status) === "4" ||
        String(m.Status) === "8"
      );
    });
    if (allMeiosCancelled) return true;
  }

  return false;
}

export function isSaleDelinquent(sale: VendaElosgate): boolean {
  if (!sale || isSaleExcluded(sale)) return false;

  const saleStatusStr = String(sale.StatusString || "").trim().toLowerCase();
  
  if (
    saleStatusStr.includes("inadimpl") || 
    saleStatusStr.includes("atrasa") || 
    String(sale.Status) === "3"
  ) {
    return true;
  }

  if (sale.MeiosPagamento && Array.isArray(sale.MeiosPagamento)) {
    for (const meio of sale.MeiosPagamento) {
      const meioStatusStr = String(meio.StatusString || "").trim().toLowerCase();
      if (
        meioStatusStr.includes("cancel") ||
        meioStatusStr.includes("exclu") ||
        String(meio.Status) === "4" ||
        String(meio.Status) === "8"
      ) {
        continue;
      }
      if (meioStatusStr.includes("inadimpl") || meioStatusStr.includes("atrasa") || String(meio.Status) === "3") {
        return true;
      }
      if (meio.Parcelas && Array.isArray(meio.Parcelas)) {
        for (const parcela of meio.Parcelas) {
          const parcStatusStr = String(parcela.StatusString || "").trim().toLowerCase();
          if (parcStatusStr.includes("inadimpl") || parcStatusStr.includes("atrasa") || String(parcela.Status) === "3") {
            return true;
          }
        }
      }
    }
  }

  return false;
}

export function isSaleFullyPaid(sale: VendaElosgate): boolean {
  if (!sale || isSaleExcluded(sale) || isSaleDelinquent(sale)) return false;

  const saleStatusStr = String(sale.StatusString || "").trim().toLowerCase();

  let activeMeio = null;
  if (sale.MeiosPagamento && Array.isArray(sale.MeiosPagamento)) {
    activeMeio =
      sale.MeiosPagamento.find((m) => {
        const s = String(m.StatusString || "").toLowerCase();
        return (
          !s.includes("exclu") &&
          !s.includes("cancel") &&
          String(m.Status) !== "8" &&
          String(m.Status) !== "4"
        );
      }) || sale.MeiosPagamento[0];
  }

  const meioStatusStr = String(activeMeio?.StatusString || "").trim().toLowerCase();
  const parcelas = activeMeio?.Parcelas || [];
  const paidCount = parcelas.filter(
    (p) => p.Pagamento !== null && p.Pagamento !== undefined && String(p.Pagamento).trim() !== ""
  ).length;
  const totalParc =
    activeMeio && typeof activeMeio.NumeroParcelas === "number" && activeMeio.NumeroParcelas > 0
      ? activeMeio.NumeroParcelas
      : parcelas.length || 1;

  // Check if any parcel is late
  const hasLate = parcelas.some((p) => {
    const ps = String(p.StatusString || "").toLowerCase();
    return ps.includes("atrasa") || ps.includes("inadimpl") || String(p.Status) === "3";
  });
  if (hasLate) return false;

  if (
    saleStatusStr === "finalizada" ||
    saleStatusStr === "pago" ||
    saleStatusStr === "aprovado" ||
    String(sale.Status) === "4" ||
    meioStatusStr === "pago" ||
    String(activeMeio?.Status) === "2"
  ) {
    if (parcelas.length === 0 || paidCount >= totalParc) {
      return true;
    }
  }

  if (paidCount >= totalParc && totalParc > 0) {
    return true;
  }

  return false;
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

