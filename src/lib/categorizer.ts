import Fuse from 'fuse.js';
import { GoogleGenerativeAI } from '@google/genai';
import { supabase } from './supabase';

export interface CategorizationResult {
  categoryId: string | null;
  confidence: number;
  source: 'rule' | 'dictionary' | 'ai' | 'manual_needed';
}

// Diccionario de comercios colombianos precargado
const COLOMBIAN_MERCHANTS: Record<string, { category: string; type: 'need' | 'want' | 'saving' }> = {
  // Alimentación — need
  'd1': { category: 'Alimentación', type: 'need' },
  'tiendas d1': { category: 'Alimentación', type: 'need' },
  'ara': { category: 'Alimentación', type: 'need' },
  'exito': { category: 'Alimentación', type: 'need' },
  'éxito': { category: 'Alimentación', type: 'need' },
  'carrefour': { category: 'Alimentación', type: 'need' },
  'alkosto': { category: 'Alimentación', type: 'need' },
  'carulla': { category: 'Alimentación', type: 'need' },
  'jumbo': { category: 'Alimentación', type: 'need' },
  'olimpica': { category: 'Alimentación', type: 'need' },
  'olímpica': { category: 'Alimentación', type: 'need' },
  'surtimax': { category: 'Alimentación', type: 'need' },
  'surtifruver': { category: 'Alimentación', type: 'need' },
  'colsubsidio': { category: 'Alimentación', type: 'need' },
  'mercado libre': { category: 'Compras', type: 'want' },
  // Transporte — need
  'uber': { category: 'Transporte', type: 'need' },
  'didi': { category: 'Transporte', type: 'need' },
  'cabify': { category: 'Transporte', type: 'need' },
  'indriver': { category: 'Transporte', type: 'need' },
  'transmilenio': { category: 'Transporte', type: 'need' },
  'metro': { category: 'Transporte', type: 'need' },
  'mio': { category: 'Transporte', type: 'need' },
  'metro plus': { category: 'Transporte', type: 'need' },
  'tpc': { category: 'Transporte', type: 'need' },
  'flota': { category: 'Transporte', type: 'need' },
  // Servicios — need
  'epm': { category: 'Servicios', type: 'need' },
  'codensa': { category: 'Servicios', type: 'need' },
  'emcali': { category: 'Servicios', type: 'need' },
  'gas natural': { category: 'Servicios', type: 'need' },
  'vanti': { category: 'Servicios', type: 'need' },
  'claro': { category: 'Servicios', type: 'need' },
  'movistar': { category: 'Servicios', type: 'need' },
  'tigo': { category: 'Servicios', type: 'need' },
  'wom': { category: 'Servicios', type: 'need' },
  'etb': { category: 'Servicios', type: 'need' },
  'une': { category: 'Servicios', type: 'need' },
  'directv': { category: 'Servicios', type: 'need' },
  // Entretenimiento — want
  'netflix': { category: 'Entretenimiento', type: 'want' },
  'spotify': { category: 'Entretenimiento', type: 'want' },
  'prime video': { category: 'Entretenimiento', type: 'want' },
  'disney': { category: 'Entretenimiento', type: 'want' },
  'hbo': { category: 'Entretenimiento', type: 'want' },
  'steam': { category: 'Entretenimiento', type: 'want' },
  'playstation': { category: 'Entretenimiento', type: 'want' },
  'xbox': { category: 'Entretenimiento', type: 'want' },
  'youtube premium': { category: 'Entretenimiento', type: 'want' },
  // Restaurantes — want
  'rappi': { category: 'Restaurantes', type: 'want' },
  'ifood': { category: 'Restaurantes', type: 'want' },
  'domicilios': { category: 'Restaurantes', type: 'want' },
  'mcdonald': { category: 'Restaurantes', type: 'want' },
  'subway': { category: 'Restaurantes', type: 'want' },
  'burger king': { category: 'Restaurantes', type: 'want' },
  'starbucks': { category: 'Restaurantes', type: 'want' },
  'juan valdez': { category: 'Restaurantes', type: 'want' },
  'crepes': { category: 'Restaurantes', type: 'want' },
  // Salud — need
  'drogas': { category: 'Salud', type: 'need' },
  'farmatodo': { category: 'Salud', type: 'need' },
  'cafam': { category: 'Salud', type: 'need' },
  'compensar': { category: 'Salud', type: 'need' },
  'sura': { category: 'Salud', type: 'need' },
  // Ropa — want
  'zara': { category: 'Ropa', type: 'want' },
  'h&m': { category: 'Ropa', type: 'want' },
  'adidas': { category: 'Ropa', type: 'want' },
  'nike': { category: 'Ropa', type: 'want' },
  'studio f': { category: 'Ropa', type: 'want' },
  'bershka': { category: 'Ropa', type: 'want' },
  'pull': { category: 'Ropa', type: 'want' },
  // Transferencias bancarias
  'pago pse': { category: 'Servicios', type: 'need' },
  'transferencia': { category: 'Transferencia', type: 'need' },
  'bancolombia': { category: 'Transferencia', type: 'need' },
  'nequi': { category: 'Transferencia', type: 'need' },
};

const fuseInstance = new Fuse(Object.keys(COLOMBIAN_MERCHANTS), {
  threshold: 0.35,
  distance: 80,
  minMatchCharLength: 3,
});

let geminiClient: GoogleGenerativeAI | null = null;

function getGemini() {
  if (!geminiClient) {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) return null;
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
  return geminiClient;
}

export async function categorizeTransaction(
  description: string,
  merchant: string | undefined,
  userId: string
): Promise<CategorizationResult> {
  const text = `${merchant ?? ''} ${description}`.toLowerCase().trim();

  // 1. Check user rules first
  const ruleResult = await checkUserRules(text, userId);
  if (ruleResult && ruleResult.confidence > 0.9) {
    return { categoryId: ruleResult.categoryId, confidence: ruleResult.confidence, source: 'rule' };
  }

  // 2. Dictionary + fuzzy matching
  const dictResult = checkDictionary(text);
  if (dictResult && dictResult.confidence > 0.85) {
    return { categoryId: dictResult.categoryId, confidence: dictResult.confidence, source: 'dictionary' };
  }

  // 3. Gemini Flash for ambiguous cases
  const aiResult = await askGemini(description, merchant);
  if (aiResult && aiResult.confidence > 0.75) {
    // Save as a new rule for future use
    await saveRule(userId, text, aiResult.categoryName, aiResult.confidence);
    const categoryId = await getCategoryIdByName(aiResult.categoryName, userId);
    return { categoryId, confidence: aiResult.confidence, source: 'ai' };
  }

  // 4. Needs manual classification
  return { categoryId: null, confidence: 0, source: 'manual_needed' };
}

async function checkUserRules(text: string, userId: string) {
  const { data: rules } = await supabase
    .from('categorization_rules')
    .select('*')
    .eq('user_id', userId)
    .order('confidence', { ascending: false });

  if (!rules?.length) return null;

  // Use fuse.js on user rules
  const ruleFuse = new Fuse(rules.map((r) => r.pattern), { threshold: 0.2 });
  const matches = ruleFuse.search(text);
  if (matches.length > 0) {
    const rule = rules[matches[0].refIndex];
    await supabase
      .from('categorization_rules')
      .update({ uses_count: rule.uses_count + 1 })
      .eq('id', rule.id);
    return { categoryId: rule.category_id, confidence: rule.confidence };
  }
  return null;
}

function checkDictionary(text: string): { categoryId: string | null; categoryName: string; confidence: number } | null {
  // Exact match first
  for (const [key, val] of Object.entries(COLOMBIAN_MERCHANTS)) {
    if (text.includes(key)) {
      return { categoryId: null, categoryName: val.category, confidence: 0.95 };
    }
  }

  // Fuzzy match
  const results = fuseInstance.search(text);
  if (results.length > 0 && results[0].score !== undefined && results[0].score < 0.35) {
    const key = results[0].item;
    const val = COLOMBIAN_MERCHANTS[key];
    const confidence = 1 - (results[0].score ?? 0.35);
    return { categoryId: null, categoryName: val.category, confidence };
  }
  return null;
}

async function askGemini(description: string, merchant?: string) {
  const client = getGemini();
  if (!client) return null;

  try {
    const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Clasifica esta transacción bancaria colombiana en UNA de estas categorías:
Alimentación, Transporte, Servicios, Entretenimiento, Restaurantes, Salud, Ropa, Educación, Compras, Vivienda, Transferencia, Otro

Transacción: "${description}"${merchant ? `\nComercio: "${merchant}"` : ''}

Responde SOLO con: CATEGORIA|CONFIANZA (ejemplo: "Alimentación|0.92")`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const [category, confStr] = text.split('|');
    const confidence = parseFloat(confStr);
    if (category && !isNaN(confidence)) {
      return { categoryName: category.trim(), confidence };
    }
  } catch (e) {
    console.warn('Gemini categorization failed:', e);
  }
  return null;
}

async function getCategoryIdByName(name: string, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('categories')
    .select('id')
    .or(`user_id.eq.${userId},is_default.eq.true`)
    .ilike('name', name)
    .maybeSingle();
  return data?.id ?? null;
}

async function saveRule(userId: string, pattern: string, categoryName: string, confidence: number) {
  const categoryId = await getCategoryIdByName(categoryName, userId);
  if (!categoryId) return;
  await supabase.from('categorization_rules').upsert({
    user_id: userId,
    pattern,
    category_id: categoryId,
    confidence,
    created_from: 'ai',
    uses_count: 1,
  }, { onConflict: 'user_id,pattern' });
}

// Called when user manually corrects a category — learns and propagates to similar transactions
export async function learnFromCorrection(
  userId: string,
  description: string,
  merchant: string | undefined,
  categoryId: string,
  propagateToSimilar = true
) {
  const pattern = `${merchant ?? ''} ${description}`.toLowerCase().trim();

  await supabase.from('categorization_rules').upsert({
    user_id: userId,
    pattern,
    category_id: categoryId,
    confidence: 1.0,
    created_from: 'user',
    uses_count: 1,
  }, { onConflict: 'user_id,pattern' });

  if (!propagateToSimilar) return;

  // Find similar uncategorized transactions
  const { data: pending } = await supabase
    .from('transactions')
    .select('id, description, merchant')
    .eq('user_id', userId)
    .is('category_id', null);

  if (!pending?.length) return;

  const similarFuse = new Fuse(pending, {
    keys: ['description', 'merchant'],
    threshold: 0.25,
  });

  const matches = similarFuse.search(pattern);
  const toUpdate = matches.filter((m) => m.score !== undefined && m.score < 0.25).map((m) => m.item.id);

  if (toUpdate.length > 0) {
    await supabase
      .from('transactions')
      .update({ category_id: categoryId })
      .in('id', toUpdate);
  }
}
