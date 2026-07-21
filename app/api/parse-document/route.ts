import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

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
    const mimeType = file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf'

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const result = await model.generateContent([
      EXTRACTION_PROMPT,
      { inlineData: { data: base64, mimeType } },
    ])

    const text = result.response.text()
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
