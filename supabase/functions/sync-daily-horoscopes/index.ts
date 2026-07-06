import { createClient } from "npm:@supabase/supabase-js@2";

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
const RETENTION_DAYS = 7;

type FreeAstroPayload = {
  data?: Record<string, unknown>;
  meta?: Record<string, unknown>;
};

type DailyHoroscopeRow = ReturnType<typeof buildRow>;
type TencentCredentials = {
  secretId: string;
  secretKey: string;
  region: string;
};
type TranslationStats = {
  enabled: boolean;
  attemptedFields: number;
  translatedRows: number;
  failedRows: number;
  errors: string[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const stringValue = asString(value);
    if (stringValue) return stringValue;
  }
  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAuthorized(request: Request, cronSecret: string): boolean {
  const cronHeader = request.headers.get("x-cron-secret");
  const authorization = request.headers.get("authorization");
  return cronHeader === cronSecret || authorization === `Bearer ${cronSecret}`;
}

function toDateValue(value: unknown): string {
  const explicitDate = asString(value);
  if (explicitDate) return explicitDate.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function getRetentionCutoff(referenceDate: string | undefined): string | null {
  if (!referenceDate) return null;
  const [year, month, day] = referenceDate.split("-").map(Number);
  if (!year || !month || !day) return null;

  const cutoff = new Date(Date.UTC(year, month - 1, day));
  cutoff.setUTCDate(cutoff.getUTCDate() - (RETENTION_DAYS - 1));
  return cutoff.toISOString().slice(0, 10);
}

function buildContentText(data: Record<string, unknown>): string {
  const content = asRecord(data.content);
  return firstString(
    content.text,
    content.summary,
    content.overview,
    data.text,
    data.horoscope,
    data.prediction,
    data.description,
  ) || "";
}

function buildRow(payload: FreeAstroPayload, sign: string, locale: string) {
  const data = asRecord(payload.data);
  const content = asRecord(data.content);
  const scores = asRecord(data.scores);
  const lucky = asRecord(data.lucky);
  const color = asRecord(lucky.color);
  const astro = asRecord(data.astro);
  const moonSign = asRecord(astro.moon_sign);
  const moonPhase = asRecord(astro.moon_phase);
  const contentText = buildContentText(data);

  return {
    horoscope_date: toDateValue(data.date),
    sign: firstString(data.sign, sign) || sign,
    locale,
    source: "freeastroapi",
    overall_score: asNumber(scores.overall),
    love_score: asNumber(scores.love),
    career_score: asNumber(scores.career),
    money_score: asNumber(scores.money),
    health_score: asNumber(scores.health),
    lucky_color: firstString(color.label, lucky.color),
    lucky_number: asNumber(lucky.number),
    lucky_time_window: asString(lucky.time_window),
    theme: asString(content.theme),
    keywords: asStringArray(content.keywords),
    content_text: contentText,
    do_items: asStringArray(content.do),
    dont_items: asStringArray(content.dont),
    supporting_insights: asStringArray(content.supporting_insights),
    moon_sign: firstString(moonSign.label, astro.moon_sign),
    moon_phase: firstString(moonPhase.label, astro.moon_phase),
    payload,
    is_published: Boolean(contentText),
    updated_at: new Date().toISOString(),
  };
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(key: string | Uint8Array, value: string): Promise<Uint8Array> {
  const keyBytes = typeof key === "string" ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(value),
  );
  return new Uint8Array(signature);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function buildTencentAuthorization(
  credentials: TencentCredentials,
  payload: string,
  timestamp: number,
): Promise<string> {
  const algorithm = "TC3-HMAC-SHA256";
  const service = "tmt";
  const host = "tmt.tencentcloudapi.com";
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const canonicalHeaders = [
    "content-type:application/json; charset=utf-8",
    `host:${host}`,
    "x-tc-action:texttranslate",
    "",
  ].join("\n");
  const signedHeaders = "content-type;host;x-tc-action";
  const hashedPayload = await sha256Hex(payload);
  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    hashedPayload,
  ].join("\n");
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = [
    algorithm,
    String(timestamp),
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");
  const secretDate = await hmac(`TC3${credentials.secretKey}`, date);
  const secretService = await hmac(secretDate, service);
  const secretSigning = await hmac(secretService, "tc3_request");
  const signature = toHex(await hmac(secretSigning, stringToSign));

  return `${algorithm} Credential=${credentials.secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

async function translateOneText(credentials: TencentCredentials, text: string): Promise<string> {
  const payload = JSON.stringify({
    SourceText: text,
    Source: "en",
    Target: "zh",
    ProjectId: 0,
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const authorization = await buildTencentAuthorization(credentials, payload, timestamp);
  const response = await fetch("https://tmt.tencentcloudapi.com", {
    method: "POST",
    headers: {
      "Authorization": authorization,
      "Content-Type": "application/json; charset=utf-8",
      "Host": "tmt.tencentcloudapi.com",
      "X-TC-Action": "TextTranslate",
      "X-TC-Timestamp": String(timestamp),
      "X-TC-Version": "2018-03-21",
      "X-TC-Region": credentials.region,
    },
    body: payload,
  });

  const data = await response.json() as {
    Response?: {
      TargetText?: string;
      Error?: {
        Code?: string;
        Message?: string;
      };
    };
  };

  if (!response.ok || data.Response?.Error) {
    const message = data.Response?.Error?.Message || `Tencent translate request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data.Response?.TargetText || "";
}

async function translateTexts(credentials: TencentCredentials, texts: string[]): Promise<string[]> {
  const translated: string[] = [];
  for (const text of texts) {
    translated.push(await translateOneText(credentials, text));
    await delay(250);
  }
  return translated;
}

async function translateRow(
  row: DailyHoroscopeRow,
  credentials: TencentCredentials | null,
  stats?: TranslationStats,
) {
  if (!credentials) return row;

  const fields: Array<{ key: string; text: string }> = [];
  const addText = (key: string, value: unknown) => {
    const text = asString(value);
    if (text) fields.push({ key, text });
  };
  const addArray = (key: string, values: string[]) => {
    values.forEach((text, index) => addText(`${key}.${index}`, text));
  };

  addText("theme_zh", row.theme);
  addText("content_text_zh", row.content_text);
  addArray("keywords_zh", row.keywords);
  addArray("do_items_zh", row.do_items);
  addArray("dont_items_zh", row.dont_items);
  addArray("supporting_insights_zh", row.supporting_insights);

  if (!fields.length) return row;

  if (stats) stats.attemptedFields += fields.length;

  try {
    const translated = await translateTexts(credentials, fields.map((field) => field.text));
    const output = {
      ...row,
      keywords_zh: [] as string[],
      do_items_zh: [] as string[],
      dont_items_zh: [] as string[],
      supporting_insights_zh: [] as string[],
      translation_provider: "tencent",
      translated_at: new Date().toISOString(),
    };

    fields.forEach((field, index) => {
      const text = translated[index] || "";
      if (field.key === "theme_zh") output.theme_zh = text;
      else if (field.key === "content_text_zh") output.content_text_zh = text;
      else if (field.key.startsWith("keywords_zh.")) output.keywords_zh.push(text);
      else if (field.key.startsWith("do_items_zh.")) output.do_items_zh.push(text);
      else if (field.key.startsWith("dont_items_zh.")) output.dont_items_zh.push(text);
      else if (field.key.startsWith("supporting_insights_zh.")) output.supporting_insights_zh.push(text);
    });

    if (stats) stats.translatedRows += 1;
    return output;
  } catch (error) {
    if (stats) {
      stats.failedRows += 1;
      if (stats.errors.length < 5) {
        stats.errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    console.error("Daily horoscope translation failed", error);
    return row;
  }
}

Deno.serve(async (request) => {
  const debug = new URL(request.url).searchParams.get("debug") === "1";
  const cronSecret = Deno.env.get("CRON_SECRET");
  const freeAstroKey = Deno.env.get("FREE_ASTRO_API_KEY");
  const tencentSecretId = Deno.env.get("TENCENT_SECRET_ID");
  const tencentSecretKey = Deno.env.get("TENCENT_SECRET_KEY");
  const tencentRegion = Deno.env.get("TENCENT_REGION") || "ap-guangzhou";
  const tencentCredentials = tencentSecretId && tencentSecretKey
    ? {
      secretId: tencentSecretId,
      secretKey: tencentSecretKey,
      region: tencentRegion,
    }
    : null;
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!cronSecret || !freeAstroKey || !supabaseUrl || !serviceRoleKey) {
    return Response.json(
      { error: "Missing required environment variables" },
      { status: 500 },
    );
  }

  if (!isAuthorized(request, cronSecret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const locale = "en";
  const tz = "Asia/Shanghai";
  const rows = [];
  const translationStats: TranslationStats = {
    enabled: Boolean(tencentCredentials),
    attemptedFields: 0,
    translatedRows: 0,
    failedRows: 0,
    errors: [],
  };

  for (const sign of SIGNS) {
    const url = new URL("https://api.freeastroapi.com/api/v2/horoscope/daily/sign");
    url.searchParams.set("sign", sign);
    url.searchParams.set("date", "today");
    url.searchParams.set("tz_str", tz);
    url.searchParams.set("locale", locale);

    const response = await fetch(url, {
      headers: {
        "x-api-key": freeAstroKey,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      return Response.json(
        {
          error: "FreeAstroAPI request failed",
          sign,
          status: response.status,
          body,
        },
        { status: 502 },
      );
    }

    const payload = await response.json() as FreeAstroPayload;
    rows.push(await translateRow(
      buildRow(payload, sign, locale),
      tencentCredentials,
      translationStats,
    ));
    await delay(1100);
  }

  const { error } = await supabase
    .from("daily_horoscopes")
    .upsert(rows, {
      onConflict: "horoscope_date,sign,locale",
    });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const retentionCutoff = getRetentionCutoff(rows[0]?.horoscope_date);
  if (retentionCutoff) {
    const { error: cleanupError } = await supabase
      .from("daily_horoscopes")
      .delete()
      .lt("horoscope_date", retentionCutoff);

    if (cleanupError) {
      return Response.json({ error: cleanupError.message }, { status: 500 });
    }
  }

  return Response.json({
    ok: true,
    inserted_or_updated: rows.length,
    date: rows[0]?.horoscope_date,
    ...(debug ? { debug: "debug=1", translation: translationStats } : {}),
  });
});

export { buildRow };
