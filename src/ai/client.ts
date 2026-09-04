import type { z } from 'zod';

/**
 * LlmClient — the only surface through which this application talks to a
 * language model.
 *
 * No implementation exists yet; Gemini arrives in Phase 6. The interface is
 * declared now because it constrains what a model is permitted to do, and
 * that constraint is an architectural decision rather than an implementation
 * detail.
 *
 * THE CONTRACT
 *
 *   1. Structured output only. `complete` takes a Zod schema and returns a
 *      parsed value of that type. There is no method that returns free text
 *      into the planning pipeline, so a model cannot emit prose that some
 *      later code has to interpret.
 *
 *   2. The model never produces numbers that matter. Times, prices,
 *      durations, distances and totals are computed by src/engine. Response
 *      schemas for planning tasks deliberately omit those fields.
 *
 *   3. The model never produces URLs. Links come from src/providers/links.ts.
 *      Any URL-shaped string in a response is discarded at the merge boundary.
 *
 *   4. Every call is logged to the LlmCall table — latency, tokens, whether
 *      the response validated, how many repair attempts were needed. This is
 *      where the project's "AI output validity" metric comes from.
 */

export interface LlmCallOptions {
  /** Task name, e.g. 'extractBrief'. Recorded for observability. */
  task: string;
  /** Prompt template version, e.g. 'v1'. Recorded so a regression can be
   *  traced to a specific prompt edit. */
  promptVersion: string;
  /** Fast model for extraction, reasoning model for rationale. */
  tier?: 'fast' | 'reasoning';
  /** Trip this call belongs to, when there is one. */
  tripId?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface LlmResult<T> {
  data: T;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  /** How many times the response had to be re-requested to satisfy the
   *  schema. A non-zero value is a signal the prompt needs work. */
  repairAttempts: number;
  model: string;
}

export interface LlmClient {
  readonly name: string;
  isConfigured(): boolean;

  /**
   * Ask the model for a value matching `schema`.
   *
   * Implementations must: constrain generation with the schema where the
   * provider supports it, parse the response with Zod, retry once with the
   * validation error appended on failure, and throw `LlmSchemaError` if the
   * second attempt also fails. They must never return partially-valid data.
   */
  complete<T>(args: {
    schema: z.ZodType<T>;
    system: string;
    user: string;
    options: LlmCallOptions;
  }): Promise<LlmResult<T>>;
}

/** The model returned something that does not satisfy the schema, twice. */
export class LlmSchemaError extends Error {
  constructor(
    readonly task: string,
    readonly issues: string,
    readonly raw: string,
  ) {
    super(`[${task}] model response failed schema validation: ${issues}`);
    this.name = 'LlmSchemaError';
  }
}

/** No model is configured. Phase 1 and 2 run entirely without one. */
export class LlmNotConfiguredError extends Error {
  constructor(task: string) {
    super(
      `[${task}] no LLM is configured. Set GEMINI_API_KEY, or use the ` +
        `deterministic path — the engine does not require a model.`,
    );
    this.name = 'LlmNotConfiguredError';
  }
}
