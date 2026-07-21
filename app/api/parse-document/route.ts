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

    const key = process.env.OPENROUTER_API_KEY
    if (!key) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY não configurada.' }, { status: 500 })
    }

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.2-11b-vision-instruct:free',
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
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error?.message ?? `Erro ${res.status} na API.`)
    }

    const data = await res.json()
    const text: string = data.choices?.[0]?.message?.content ?? ''
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
