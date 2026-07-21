import { NextResponse } from 'next/server'

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

const MODELS = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-pro-vision',
]

async function callGemini(base64: string, mimeType: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY não configurada.')

  const body = {
    contents: [{
      parts: [
        { text: EXTRACTION_PROMPT },
        { inline_data: { mime_type: mimeType, data: base64 } },
      ],
    }],
    generationConfig: { maxOutputTokens: 512 },
  }

  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${key}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      const data = await res.json()
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    }

    // Se for 404 ou 429, tenta o próximo modelo
    const status = res.status
    if (status !== 404 && status !== 429) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error?.message ?? `Erro ${status} na API Gemini.`)
    }
  }

  throw new Error('Nenhum modelo Gemini disponível no plano gratuito desta chave.')
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mimeType = file.type || 'image/jpeg'

    const text = await callGemini(base64, mimeType)
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    const parsed = JSON.parse(cleaned)

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
