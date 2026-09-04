import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Limite alinhado com o teto de body das rotas serverless (4,5 MB).
const MAX_FILE_BYTES = 4 * 1024 * 1024
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

const EXTRACTION_PROMPT = `Você é um assistente especializado em leitura de documentos financeiros brasileiros.
Analise o documento e extraia as seguintes informações de lançamento financeiro.

Retorne SOMENTE um JSON válido com esta estrutura (sem markdown, sem explicações):
{
  "description": "descrição resumida do lançamento (máx 80 caracteres)",
  "value": 0.00,
  "date": "YYYY-MM-DD",
  "type": "expense" ou "income",
  "category_name": "nome da categoria sugerida ou null",
  "notes": "informações adicionais relevantes ou null"
}

Regras:
- Para boletos: use o valor nominal, beneficiário como descrição, data de vencimento
- Para NF/NFe/cupom fiscal: use valor total, nome do estabelecimento, data de emissão
- Para recibo: use valor, pagador/beneficiário, data
- type = "income" se for uma receita/entrada, "expense" se for despesa/saída
- date no formato YYYY-MM-DD; se não encontrar, use a data de hoje
- value deve ser número positivo (ex: 150.90)
- Se não conseguir extrair o valor, use null
- category_name: sugira uma categoria adequada em português (ex: "Alimentação", "Transporte", "Saúde", "Serviços", "Impostos", "Compras", etc.)`

const FREE_VISION_MODELS = [
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-nano-12b-v2-vl:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
]

async function callOpenRouter(key: string, mimeType: string, base64: string): Promise<string> {
  for (const model of FREE_VISION_MODELS) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: EXTRACTION_PROMPT },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            ],
          },
        ],
        max_tokens: 512,
      }),
    })

    if (!res.ok) {
      // Erro HTTP: tenta o próximo modelo
      continue
    }

    // Body pode ser vazio ou não-JSON em respostas de rate-limit/gateway free tier
    let data: unknown
    try {
      data = await res.json()
    } catch {
      continue
    }

    const content = (data as { choices?: Array<{ message?: { content?: string } }> })
      ?.choices?.[0]?.message?.content

    // Conteúdo vazio ou nulo: trata como falha deste modelo e tenta o próximo
    if (!content) continue

    return content
  }

  throw new Error('Nenhum modelo de visão disponível no momento. Tente novamente em alguns instantes.')
}

export async function POST(request: Request) {
  try {
    // Rota fora do matcher do proxy: valida a sessão aqui para não expor a
    // chave do OpenRouter a chamadas anônimas.
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: 'Imagem muito grande (máx. 4 MB). Tire a foto com resolução menor.' },
        { status: 413 },
      )
    }
    if (file.type && !ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json(
        { error: 'Formato não suportado. Envie uma imagem JPG, PNG ou WEBP.' },
        { status: 415 },
      )
    }

    const key = process.env.OPENROUTER_API_KEY
    if (!key) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY não configurada.' }, { status: 500 })
    }

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mimeType = file.type || 'image/jpeg'

    const text = await callOpenRouter(key, mimeType, base64)
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return NextResponse.json(
        { error: 'Não foi possível interpretar o documento. Tente com uma imagem mais nítida.' },
        { status: 422 },
      )
    }

    return NextResponse.json({
      description: parsed.description ?? null,
      value: typeof parsed.value === 'number' ? parsed.value : null,
      date: parsed.date ?? null,
      type: parsed.type === 'income' ? 'income' : 'expense',
      category_name: parsed.category_name ?? null,
      notes: parsed.notes ?? null,
    })
  } catch (err) {
    console.error('[parse-document]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao processar documento.' },
      { status: 500 },
    )
  }
}
