/**
 * Quick smoke test - verifies auth and a single code preview work.
 */
import { test, expect } from '@playwright/test';
import { signIn } from './auth';

test('smoke: sign in and preview a simple RSI strategy', async ({ page }) => {
  await signIn(page);

  // Wait for the app to actually render after OIDC callback
  // The app needs time to process the auth redirect and render
  await page.waitForTimeout(3000);
  await page.goto('/strategies');
  await page.waitForLoadState('networkidle');

  // Intercept a real GraphQL request to capture the auth token
  let capturedToken = '';
  page.on('request', (req) => {
    if (req.url().includes('/gateway/') && req.headers()['authorization']) {
      capturedToken = req.headers()['authorization'];
    }
  });

  // Trigger a real request by reloading (the app will make GraphQL calls)
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // If we still don't have a token, try extracting from the OIDC user manager
  if (!capturedToken) {
    capturedToken = await page.evaluate(() => {
      // oidc-client-ts stores in sessionStorage with key pattern: oidc.user:<authority>:<client_id>
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('oidc.user:')) {
          try {
            const val = JSON.parse(sessionStorage.getItem(key) || '{}');
            if (val.access_token) return `Bearer ${val.access_token}`;
          } catch { /* ignore */ }
        }
      }
      return '';
    });
  }

  console.log('Token captured:', capturedToken ? `${capturedToken.substring(0, 30)}...` : 'NONE');

  // Now call previewStrategyCode with the captured token
  // The config must be wrapped: { timeframe, ui_builder: { ...UIBuilderConfig } }
  const config = {
    timeframe: '5m',
    ui_builder: {
      version: 2,
      schema_version: '2.0.0',
      indicators: [{ id: 'rsi_1', type: 'RSI', params: { period: 14 } }],
      trading_mode: 'SPOT',
      position_mode: 'LONG_ONLY',
      long: {
        entry_conditions: {
          type: 'AND',
          children: [{
            type: 'COMPARE',
            left: { type: 'INDICATOR', indicatorId: 'rsi_1' },
            operator: 'lt',
            right: { type: 'CONSTANT', value: 30 },
          }],
        },
        exit_conditions: {
          type: 'AND',
          children: [{
            type: 'COMPARE',
            left: { type: 'INDICATOR', indicatorId: 'rsi_1' },
            operator: 'gt',
            right: { type: 'CONSTANT', value: 70 },
          }],
        },
      },
      parameters: {
        stoploss: -0.10,
        minimal_roi: { '0': 0.10 },
        trailing_stop: false,
        use_exit_signal: true,
      },
      callbacks: {},
    },
  };

  const result = await page.evaluate(
    async ({ token, config }) => {
      const resp = await fetch('/gateway/v1/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: token } : {}),
        },
        body: JSON.stringify({
          query: `mutation PreviewStrategyCode($config: Map!, $className: String!) {
            previewStrategyCode(config: $config, className: $className) {
              success
              code
              error
            }
          }`,
          variables: { config, className: 'SmokeTestRSI' },
        }),
      });
      return resp.json();
    },
    { token: capturedToken, config }
  );

  console.log('Preview result:', JSON.stringify(result, null, 2).substring(0, 500));

  expect(result.errors).toBeUndefined();
  expect(result.data.previewStrategyCode.success).toBe(true);
  expect(result.data.previewStrategyCode.code).toContain('class SmokeTestRSI');

  console.log('Smoke test passed! Code length:', result.data.previewStrategyCode.code.length);
});
