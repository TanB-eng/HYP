import { createClient } from "npm:@supabase/supabase-js@2";

const DAILY_LIMIT = 3;
const CHAT_LIMIT = 3000;
const USAGE_RETENTION_DAYS = 30;
const MODEL = "gemini-2.5-flash";
const RELATIONSHIP_TYPES = ["romance", "flirt", "friendship", "work", "family"];
const SIGNS = [
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CompatibilityRequest = {
  signA?: string;
  signB?: string;
  relationshipType?: string;
  chatText?: string;
  baseResult?: Record<string, unknown>;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: corsHeaders,
  });
}

function isValidSign(value: unknown): value is string {
  return typeof value === "string" && SIGNS.includes(value);
}

function isValidRelationship(value: unknown): value is string {
  return typeof value === "string" && RELATIONSHIP_TYPES.includes(value);
}

function getShanghaiDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getUsageRetentionCutoff(referenceDate: string): string {
  const [year, month, day] = referenceDate.split("-").map(Number);
  const cutoff = new Date(Date.UTC(year, month - 1, day));
  cutoff.setUTCDate(cutoff.getUTCDate() - (USAGE_RETENTION_DAYS - 1));
  return cutoff.toISOString().slice(0, 10);
}

async function cleanupOldUsageRows(
  serviceClient: ReturnType<typeof createClient>,
  retentionCutoff: string,
) {
  return await serviceClient
    .from("compatibility_ai_usage")
    .delete()
    .lt("usage_date", retentionCutoff);
}

function buildPrompt(payload: Required<Pick<CompatibilityRequest, "signA" | "signB" | "relationshipType">> & {
  chatText: string;
  baseResult?: Record<string, unknown>;
}) {
  return [
    "你是一个中文星座关系分析助手，请基于用户提供的信息生成娱乐向关系分析。",
    "必须遵守：不要做绝对化判断；不要评判谁对谁错；不要输出操控、冷暴力、PUA 建议；不要替代心理咨询。",
    "请输出严格 JSON，不要 Markdown，不要代码块。",
    "JSON 字段必须包含：summary, zodiacDynamic, chatPattern, strengths, risks, advice, nextMessageSuggestion, disclaimer。",
    "strengths、risks、advice 必须是字符串数组，每个数组 2 到 4 条。",
    "disclaimer 固定表达内容仅供娱乐和自我反思参考。",
    "",
    `我的星座：${payload.signA}`,
    `对方星座：${payload.signB}`,
    `关系类型：${payload.relationshipType}`,
    `基础规则分析：${JSON.stringify(payload.baseResult || {})}`,
    `聊天片段：${payload.chatText || "用户未提供聊天片段，请主要基于星座关系给出温和建议。"}`,
  ].join("\n");
}

function extractText(data: Record<string, unknown>): string {
  const candidates = data.candidates;
  if (!Array.isArray(candidates) || !candidates[0]) return "";
  const candidate = candidates[0] as Record<string, unknown>;
  const content = candidate.content as Record<string, unknown> | undefined;
  const parts = content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => typeof (part as Record<string, unknown>).text === "string"
      ? (part as Record<string, string>).text
      : "")
    .join("")
    .trim();
}

function parseAnalysis(text: string) {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (_error) {
    return {
      summary: cleaned,
      zodiacDynamic: "",
      chatPattern: "",
      strengths: [],
      risks: [],
      advice: [],
      nextMessageSuggestion: "",
      disclaimer: "内容仅供娱乐和自我反思参考。",
    };
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !geminiKey) {
    return jsonResponse({ error: "Missing required environment variables" }, 500);
  }

  const authorization = request.headers.get("Authorization") || "";
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser();

  if (authError || !authData.user) {
    return jsonResponse({ error: "请先登录后使用 AI 深度关系分析" }, 401);
  }

  let payload: CompatibilityRequest;
  try {
    payload = await request.json();
  } catch (_error) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!isValidSign(payload.signA) || !isValidSign(payload.signB)) {
    return jsonResponse({ error: "Unsupported zodiac sign" }, 400);
  }
  if (!isValidRelationship(payload.relationshipType)) {
    return jsonResponse({ error: "Unsupported relationship type" }, 400);
  }

  const chatText = typeof payload.chatText === "string" ? payload.chatText.trim() : "";
  if (chatText.length > CHAT_LIMIT) {
    return jsonResponse({ error: "聊天片段超过 3000 字，请删减后再分析" }, 400);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const usageDate = getShanghaiDate();
  const { data: usageRow, error: usageError } = await serviceClient
    .from("compatibility_ai_usage")
    .select("used_count")
    .eq("user_id", authData.user.id)
    .eq("usage_date", usageDate)
    .maybeSingle();

  if (usageError) {
    return jsonResponse({ error: usageError.message }, 500);
  }

  const usedCount = usageRow?.used_count ?? 0;
  if (usedCount >= DAILY_LIMIT) {
    return jsonResponse({ error: "今天的 3 次 AI 分析已用完，明天再来看看你们的关系节奏" }, 429);
  }

  const prompt = buildPrompt({
    signA: payload.signA,
    signB: payload.signB,
    relationshipType: payload.relationshipType,
    chatText,
    baseResult: payload.baseResult,
  });

  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(geminiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.7,
        },
      }),
    },
  );

  if (!geminiResponse.ok) {
    const body = await geminiResponse.text();
    return jsonResponse({
      error: "Gemini request failed",
      status: geminiResponse.status,
      body,
    }, 502);
  }

  const geminiData = await geminiResponse.json() as Record<string, unknown>;
  const text = extractText(geminiData);
  if (!text) {
    return jsonResponse({ error: "Gemini returned an empty response" }, 502);
  }

  const analysis = parseAnalysis(text);

  // Only successful Gemini responses consume usage.
  const newCount = usedCount + 1;
  const { error: upsertError } = await serviceClient
    .from("compatibility_ai_usage")
    .upsert({
      user_id: authData.user.id,
      usage_date: usageDate,
      used_count: newCount,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,usage_date" });

  if (upsertError) {
    return jsonResponse({ error: upsertError.message }, 500);
  }

  const retentionCutoff = getUsageRetentionCutoff(usageDate);
  const { error: cleanupError } = await cleanupOldUsageRows(serviceClient, retentionCutoff);
  if (cleanupError) {
    return jsonResponse({ error: cleanupError.message }, 500);
  }

  return jsonResponse({
    ok: true,
    usage: {
      used: newCount,
      limit: DAILY_LIMIT,
      date: usageDate,
    },
    analysis,
  });
});
