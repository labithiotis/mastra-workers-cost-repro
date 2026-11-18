import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { Observability, TestExporter } from '@mastra/observability';
import { simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';

// A real OpenRouter credit (non-BYOK) response: `cost` differs from `upstream_inference_cost`,
// and @openrouter/ai-sdk-provider (3.0.0, 3.1.0) does not pass `is_byok` through.
const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};
const providerMetadata = {
  openrouter: {
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, cost: 0.000003465, costDetails: { upstreamInferenceCost: 0.0000035 } },
  },
};

const model = new MockLanguageModelV4({
  provider: 'openrouter.chat',
  modelId: 'anthropic/claude-haiku-5.5',
  doGenerate: async () => ({
    content: [{ type: 'text', text: 'Hello' }],
    finishReason: { unified: 'stop', raw: 'stop' },
    usage,
    providerMetadata,
    response: { id: 'gen-1', modelId: 'anthropic/claude-haiku-5.5', timestamp: new Date(0) },
    warnings: [],
  }),
  doStream: async () => ({
    stream: simulateReadableStream({
      chunks: [
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'gen-1', modelId: 'anthropic/claude-haiku-5.5', timestamp: new Date(0) },
        { type: 'text-start', id: 't1' },
        { type: 'text-delta', id: 't1', delta: 'Hello' },
        { type: 'text-end', id: 't1' },
        { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage, providerMetadata },
      ],
    }),
  }),
});

export async function runRepro() {
  const exporter = new TestExporter();
  const mastra = new Mastra({
    agents: { agent: new Agent({ id: 'agent', name: 'agent', instructions: 'Say hello.', model }) },
    observability: new Observability({ configs: { repro: { serviceName: 'repro', exporters: [exporter] } } }),
  });

  await mastra.getAgent('agent').generate('hi');
  await mastra.observability.getDefaultInstance()?.flush();

  const costs = exporter
    .getAllMetrics()
    .filter((metric) => metric.costContext)
    .map((metric) => ({ name: metric.name, ...metric.costContext }));
  const totals = costs.filter((cost) => cost.name.startsWith('mastra_model_total_') && typeof cost.estimatedCost === 'number');
  const estimatedCost = totals.length ? totals.reduce((sum, cost) => sum + (cost.estimatedCost ?? 0), 0) : null;
  return { estimatedCost, costs };
}
