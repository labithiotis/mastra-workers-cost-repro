# Mastra cost estimates are empty on Cloudflare Workers

One agent call against a mock OpenRouter model (`openrouter.chat` / `anthropic/claude-haiku-5.5`), traced with
`TestExporter`. No API keys needed. The same code runs under Node and in a Worker (`wrangler dev`, workerd).

```bash
bun install            # or npm install
bun run node           # Node
bun run worker         # Worker, then: curl localhost:8799
```

## Result

| Runtime | `estimatedCost` | `costMetadata` |
| --- | --- | --- |
| Node (`tsx`) | `0.0000035` | `pricing_id: openrouter/anthropic/claude-haiku-5.5` |
| Worker (`wrangler dev`) | `null` | `error: no_matching_model` |

The model is in the bundled models.dev snapshot, and Node finds it. In a Worker, `loadPricingModels()` reads
`dist/metrics/pricing-data.json` with `fs.readFileSync`. The file is not in the Worker bundle, the error goes to
`cachedLoadError` without being logged, and every lookup reports `no_matching_model`.

The mock returns OpenRouter's real cost shape for a credit (non-BYOK) request: `usage.cost` 0.000003465 and
`costDetails.upstreamInferenceCost` 0.0000035, without `isByok`, because `@openrouter/ai-sdk-provider` (3.0.0, 3.1.0)
drops it. `inferByok()` returns `undefined` for that shape, so the provider-reported cost is not used in either
runtime. On Workers no cost source is left.

## Versions

- `@mastra/core` 1.84.0
- `@mastra/observability` 1.24.1
- `ai` 7.0.176
- `wrangler` 4.164.0, `compatibility_flags: ["nodejs_compat"]`
