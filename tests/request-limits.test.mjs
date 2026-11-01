import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSmallJson } from '../supabase/functions/_shared/request.ts';

test('Edge request limits inspect streamed bytes without trusting content length', async()=>{
  const request=body=>new Request('https://unit.invalid',{method:'POST',body});
  assert.deepEqual(await readSmallJson(request('{"reportId":"local"}')),{reportId:'local'});
  await assert.rejects(readSmallJson(request('not JSON')));
  const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(5000));controller.enqueue(new Uint8Array(5000));controller.close();}});
  await assert.rejects(readSmallJson(new Request('https://unit.invalid',{method:'POST',body:stream,duplex:'half',headers:{'content-length':'1'}})),/request_too_large/);
});
