// Bound the actual streamed body; Content-Length alone is attacker-controlled.
export async function readSmallJson(request: Request): Promise<unknown> {
  if (Number(request.headers.get('content-length')) > 8192) throw new Error('request_too_large');
  if (!request.body) throw new Error('invalid_request');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let expired = false;
  const deadline = setTimeout(() => { expired = true; void reader.cancel().catch(() => {}); }, 5000);
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (expired) throw new Error('request_timeout');
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { void reader.cancel().catch(() => {}); throw new Error('request_too_large'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } finally { clearTimeout(deadline); reader.releaseLock(); }
}
