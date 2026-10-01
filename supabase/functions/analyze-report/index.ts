const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function respond(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function serviceHeaders(serviceKey, json = false) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

async function writeRun(projectUrl, serviceKey, reportId, status, modelName = null) {
  const response = await fetch(`${projectUrl}/rest/v1/ai_review_runs?on_conflict=report_id`, {
    method: 'POST',
    headers: {
      ...serviceHeaders(serviceKey, true),
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      report_id: reportId,
      status,
      model_name: modelName,
      checked_at: status === 'pending' ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) throw new Error('screening_status_write_failed');
}

async function readRun(projectUrl, serviceKey, reportId) {
  const url = new URL(`${projectUrl}/rest/v1/ai_review_runs`);
  url.searchParams.set('report_id', `eq.${reportId}`);
  url.searchParams.set('select', 'status,model_name');
  const response = await fetch(url, { headers: serviceHeaders(serviceKey) });
  if (!response.ok) throw new Error('screening_status_read_failed');
  const runs = await response.json();
  return runs[0] ?? null;
}

async function claimRun(projectUrl, serviceKey, reportId, modelName, existingRun) {
  const body = {
    report_id: reportId,
    status: 'pending',
    model_name: modelName,
    checked_at: null,
    updated_at: new Date().toISOString(),
  };
  const headers = { ...serviceHeaders(serviceKey, true), Prefer: 'return=representation' };
  if (existingRun?.status === 'unavailable') {
    const url = new URL(`${projectUrl}/rest/v1/ai_review_runs`);
    url.searchParams.set('report_id', `eq.${reportId}`);
    url.searchParams.set('status', 'eq.unavailable');
    const response = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify(body) });
    if (!response.ok) throw new Error('screening_claim_failed');
    return (await response.json()).length > 0;
  }

  const response = await fetch(`${projectUrl}/rest/v1/ai_review_runs`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (response.status === 409) return false;
  if (!response.ok) throw new Error('screening_claim_failed');
  return (await response.json()).length > 0;
}

function parseFlags(content) {
  const parsed = JSON.parse(content);
  const allowedTypes = new Set(['spam', 'abuse', 'irrelevant', 'other']);
  if (!Array.isArray(parsed?.flags)) throw new Error('invalid_screening_response');
  return parsed.flags.slice(0, 3).map((flag) => {
    const confidence = Number(flag?.confidence);
    const explanation = typeof flag?.explanation === 'string' ? flag.explanation.trim() : '';
    if (!allowedTypes.has(flag?.type) || !Number.isFinite(confidence) || confidence < 0 || confidence > 1 || !explanation) {
      throw new Error('invalid_screening_flag');
    }
    return {
      flag_type: flag.type,
      confidence,
      explanation: explanation.slice(0, 600),
    };
  });
}

async function writeFlags(projectUrl, serviceKey, reportId, modelName, flags) {
  if (!flags.length) return;
  const response = await fetch(`${projectUrl}/rest/v1/ai_review_flags`, {
    method: 'POST',
    headers: { ...serviceHeaders(serviceKey, true), Prefer: 'return=minimal' },
    body: JSON.stringify(flags.map((flag) => ({ ...flag, report_id: reportId, model_name: modelName }))),
  });
  if (!response.ok) throw new Error('screening_flags_write_failed');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return respond({ error: 'method_not_allowed' }, 405);

  const projectUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!projectUrl || !anonKey || !serviceKey) return respond({ error: 'service_unavailable' }, 503);
  if (!authorization?.startsWith('Bearer ')) return respond({ error: 'unauthorized' }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return respond({ error: 'invalid_request' }, 400);
  }
  const reportId = body?.reportId;
  if (typeof reportId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reportId)) {
    return respond({ error: 'invalid_request' }, 400);
  }

  try {
    const userResponse = await fetch(`${projectUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: authorization },
    });
    if (!userResponse.ok) return respond({ error: 'unauthorized' }, 401);
    const user = await userResponse.json();

    const reportUrl = new URL(`${projectUrl}/rest/v1/reports`);
    reportUrl.searchParams.set('id', `eq.${reportId}`);
    reportUrl.searchParams.set('select', 'id,reporter_id,title,description,category_slug,status,is_public');
    const reportResponse = await fetch(reportUrl, { headers: serviceHeaders(serviceKey) });
    if (!reportResponse.ok) return respond({ error: 'report_unavailable' }, 500);
    const reports = await reportResponse.json();
    const report = reports[0];
    if (!report || report.reporter_id !== user.id) return respond({ error: 'report_not_found' }, 404);
    if (report.status !== 'pending_review' || report.is_public) return respond({ error: 'report_not_pending' }, 409);

    const apiUrl = Deno.env.get('AI_API_URL')?.trim();
    const apiKey = Deno.env.get('AI_API_KEY')?.trim();
    const modelName = Deno.env.get('AI_MODEL')?.trim();
    const existingRun = await readRun(projectUrl, serviceKey, reportId);
    if (existingRun && existingRun.status !== 'unavailable') {
      return respond({ status: existingRun.status });
    }
    if (!apiUrl || !apiKey || !modelName) {
      if (!existingRun) await writeRun(projectUrl, serviceKey, reportId, 'unavailable');
      return respond({ status: 'unavailable' });
    }

    let providerUrl;
    try {
      providerUrl = new URL(apiUrl);
      if (providerUrl.protocol !== 'https:') throw new Error('https_required');
    } catch {
      await writeRun(projectUrl, serviceKey, reportId, 'failed', modelName);
      return respond({ status: 'failed' });
    }

    const claimed = await claimRun(projectUrl, serviceKey, reportId, modelName, existingRun);
    if (!claimed) {
      const currentRun = await readRun(projectUrl, serviceKey, reportId);
      return respond({ status: currentRun?.status ?? 'pending' });
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      let providerResponse;
      try {
        providerResponse = await fetch(providerUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            model: modelName,
            temperature: 0,
            max_tokens: 600,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content: 'Screen a community report for explicit signs of spam, abuse, irrelevance, or another moderation concern. Be conservative: do not infer truth, urgency, identity, or credibility. Do not treat a flag as a decision. Return JSON only in the form {"flags":[{"type":"spam|abuse|irrelevant|other","confidence":0.0,"explanation":"short reason"}]}. Return an empty flags array when there is no clear concern. Do not repeat personal details from the report.',
              },
              {
                role: 'user',
                content: JSON.stringify({
                  title: String(report.title ?? '').slice(0, 120),
                  description: String(report.description ?? '').slice(0, 4000),
                  category: String(report.category_slug ?? '').slice(0, 80),
                }),
              },
            ],
          }),
        });
      } finally {
        clearTimeout(timeoutId);
      }
      if (!providerResponse.ok) throw new Error('provider_request_failed');
      const providerData = await providerResponse.json();
      const content = providerData?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') throw new Error('provider_response_invalid');
      const flags = parseFlags(content);
      await writeFlags(projectUrl, serviceKey, reportId, modelName, flags);
      await writeRun(projectUrl, serviceKey, reportId, 'completed', modelName);
      return respond({ status: 'completed', flagCount: flags.length });
    } catch {
      try {
        await writeRun(projectUrl, serviceKey, reportId, 'failed', modelName);
      } catch {
        // The report remains pending even if screening status storage is unavailable.
      }
      return respond({ status: 'failed' });
    }
  } catch {
    return respond({ error: 'screening_unavailable' }, 503);
  }
});