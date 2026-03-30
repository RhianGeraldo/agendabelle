import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UNIT_TOKENS: Record<string, string> = {
  mantena: '452166ad16be9184c85db73a97832d55',
  'sao-mateus': '47ad4592f0438b5f4ba37c05e2ffc7e9',
  linhares: '76683f1105194b9f9544cb9f1b356a5b',
  aracruz: 'd4fd49c6235cbe09ea4cb0827f51f575',
  serra: '8471d37f86e5c2d2cb213d8e092f2c64',
};

const BASE_URL = 'https://app.bellesoftware.com.br/api/release/controller/IntegracaoExterna/v1.0';

function getToken(unit: string): string | null {
  return UNIT_TOKENS[unit] || null;
}

async function proxyGet(url: string, token: string) {
  const res = await fetch(url, {
    headers: { Authorization: token },
  });
  return res.json();
}

async function proxyPost(url: string, token: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, unit, cpf, codEstab, codCliente, codPlano, dtAgenda, periodo, bookingData } = body;

    const token = getToken(unit);
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unidade inválida' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let data;

    switch (action) {
      case 'buscar-cliente': {
        const schema = z.object({ cpf: z.string().min(11).max(14), codEstab: z.number() });
        const parsed = schema.safeParse({ cpf, codEstab });
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: 'CPF inválido' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const cleanCpf = cpf.replace(/\D/g, '');
        data = await proxyGet(
          `${BASE_URL}/cliente/listar?codEstab=${codEstab}&cpf=${cleanCpf}`,
          token
        );
        break;
      }

      case 'buscar-planos': {
        data = await proxyGet(
          `${BASE_URL}/cliente/planos?codEstab=${codEstab}&codCliente=${codCliente}`,
          token
        );
        break;
      }

      case 'buscar-servicos': {
        data = await proxyGet(
          `${BASE_URL}/servico/listar?codPlano=${codPlano}`,
          token
        );
        break;
      }

      case 'buscar-disponibilidade': {
        data = await proxyGet(
          `${BASE_URL}/agenda/disponibilidade?codEstab=${codEstab}&dtAgenda=${dtAgenda}&periodo=${periodo}&tpAgd=s`,
          token
        );
        break;
      }

      case 'gravar-agendamento': {
        console.log('[belle-proxy] gravar-agendamento body:', JSON.stringify(bookingData));
        data = await proxyPost(
          `${BASE_URL}/agenda/gravar`,
          token,
          bookingData
        );
        console.log('[belle-proxy] gravar-agendamento response:', JSON.stringify(data));
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'Ação inválida' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
