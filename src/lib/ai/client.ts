import Anthropic from "@anthropic-ai/sdk";

// Single Anthropic client. Reads ANTHROPIC_API_KEY from the environment.
let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.",
      );
    }
    _client = new Anthropic();
  }
  return _client;
}

export function analysisModel(): string {
  return process.env.PROVENIRE_ANALYSIS_MODEL || "claude-opus-4-8";
}

function thinkingParam(): Record<string, unknown> | undefined {
  const t = (process.env.PROVENIRE_THINKING || "adaptive").toLowerCase();
  if (t === "off" || t === "disabled" || t === "none") return undefined;
  return { type: "adaptive" };
}

function effort(): string {
  const e = (process.env.PROVENIRE_EFFORT || "high").toLowerCase();
  return ["low", "medium", "high", "max", "xhigh"].includes(e) ? e : "high";
}

function extractText(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

// Build the request body. output_config carries both effort and (optionally) a
// structured-output format. We cast to `any` because the installed SDK types may
// lag the API surface; the SDK still transmits these body fields.
function buildParams(opts: {
  system: string;
  user: string;
  maxTokens: number;
  schema?: unknown;
}): any {
  const params: any = {
    model: analysisModel(),
    max_tokens: opts.maxTokens,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  };
  const thinking = thinkingParam();
  if (thinking) params.thinking = thinking;

  const output_config: any = { effort: effort() };
  if (opts.schema) {
    output_config.format = { type: "json_schema", schema: opts.schema };
  }
  params.output_config = output_config;
  return params;
}

async function runStreaming(params: any): Promise<string> {
  const client = getAnthropic();
  const stream = client.messages.stream(params);
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") {
    throw new Error(
      "The model declined this request (stop_reason: refusal). Try different documents.",
    );
  }
  return extractText(message);
}

// Call the model and return raw text. Streams to avoid HTTP timeouts on long
// outputs / high effort.
export async function callText(
  system: string,
  user: string,
  maxTokens = 16000,
): Promise<string> {
  return runStreaming(buildParams({ system, user, maxTokens }));
}

// Call the model expecting a JSON array (Part A). Uses structured outputs when
// possible; if the API rejects the format param it retries once without it and
// relies on the prompt's "JSON only" contract + defensive parsing.
export async function callForJson(
  system: string,
  user: string,
  schema: unknown,
  maxTokens = 16000,
): Promise<string> {
  try {
    return await runStreaming(buildParams({ system, user, maxTokens, schema }));
  } catch (err: any) {
    const status = err?.status ?? err?.response?.status;
    if (status === 400) {
      console.warn(
        "[provenire] structured-output request rejected; retrying without format constraint.",
        err?.message,
      );
      return runStreaming(buildParams({ system, user, maxTokens }));
    }
    throw err;
  }
}
