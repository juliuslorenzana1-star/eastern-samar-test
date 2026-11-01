import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

for (const name of ['reports', 'volunteers']) {
  test(`${name}: disabled email never invokes transport; opt-in retains delivery`, async () => {
    let calls = 0;
    const source = await readFile(new URL(`../src/lib/${name}.js`, import.meta.url), 'utf8');
    const fn = source.slice(source.indexOf('export async function sendEmailNotification('), source.indexOf('\nexport async function ', source.indexOf('export async function sendEmailNotification(') + 1));
    for (const enabled of [false, true]) {
      const env = enabled ? { VITE_ENABLE_EMAIL_NOTIFICATIONS: 'true' } : {};
      const module = `// ${name}\nconst supabase={functions:{invoke:globalThis.optionalApiInvoke}};\n${fn.replaceAll('import.meta.env', JSON.stringify(env))}`;
      globalThis.optionalApiInvoke = async () => { calls++; return { data: { accepted: true } }; };
      const { sendEmailNotification } = await import(`data:text/javascript;base64,${Buffer.from(module).toString('base64')}`);
      const result = await sendEmailNotification({ type: 'report_submission' });
      assert.equal(result.ok, enabled); assert.equal(calls, enabled ? 1 : 0);
    }
    delete globalThis.optionalApiInvoke;
  });
}
