import { createHash, createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import sharp from 'sharp';
import { validateReport } from '../src/lib/report-validation.js';

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const MAX_BODY_BYTES = 2900000;
const digest = value => createHash('sha256').update(value).digest('hex');
const fail = (status, code) => Object.assign(new Error(code), { status, code });
const protectedRefs = ['xoitncotbgobcsdmvyjb', 'egqoczyvhwtujwaflmgz', 'ztsmtwnmirlqzgnnmuuh'];

export function ingressEnabled(env) {
  if (env.ANON_REPORTING_ENABLED !== 'true' || !env.ANON_SOURCE_HMAC_KEY || env.ANON_SOURCE_HMAC_KEY.length < 32 || !env.ANON_ALLOWED_ORIGIN) return false;
  const url = env.SUPABASE_URL;
  if (env.ANON_ENVIRONMENT === 'isolated') {
    return url === 'http://127.0.0.1:54321' || /^[a-z]{20}$/.test(env.ANON_STAGING_PROJECT_REF || '') && url === `https://${env.ANON_STAGING_PROJECT_REF}.supabase.co` && !protectedRefs.includes(env.ANON_STAGING_PROJECT_REF);
  }
  return env.ANON_ENVIRONMENT === 'public' && env.PUBLIC_REPORTING_RELEASE_APPROVED === 'true' && url === 'https://xoitncotbgobcsdmvyjb.supabase.co';
}

export function sourceIdentity(req, env) {
  // Vercel overwrites x-forwarded-for. Never trust it on another host.
  // Reject chains rather than selecting a caller-controlled segment.
  const ip = env.VERCEL === '1' ? req.headers['x-forwarded-for'] : req.socket?.remoteAddress;
  if (typeof ip !== 'string' || !isIP(ip)) throw fail(503, 'unavailable');
  if (env.VERCEL !== '1' && env.ANON_ENVIRONMENT !== 'isolated') throw fail(503, 'unavailable');
  return createHmac('sha256', env.ANON_SOURCE_HMAC_KEY).update(ip).digest('hex');
}

export function validateVisitorPayload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw fail(400, 'invalid_report');
  const allowed = ['title','description','category','municipality','barangay','priority','incidentAt','neededBy','location','contact'];
  if (Object.keys(input).some(key => !allowed.includes(key))) throw fail(400, 'invalid_report');
  for (const key of ['title','description','category','municipality','barangay','priority','incidentAt','neededBy']) {
    if (input[key] != null && typeof input[key] !== 'string') throw fail(400, 'invalid_report');
  }
  let valid;
  try { valid = validateReport(input); } catch { throw fail(400, 'invalid_report'); }
  for(const value of [input.neededBy,input.incidentAt]){
    if(!value)continue;
    const match=/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(value);
    if(!match)throw fail(400,'invalid_report');
    const date=new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
    if(!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==`${match[1]}-${match[2]}-${match[3]}`)throw fail(400,'invalid_report');
  }
  const contact = {};
  if (input.contact !== undefined) {
    if (!input.contact || typeof input.contact !== 'object' || Array.isArray(input.contact) || Object.keys(input.contact).some(key => !['name','email','phone'].includes(key))) throw fail(400,'invalid_contact');
    for (const [key,max] of [['name',100],['email',254],['phone',32]]) {
      const value = input.contact[key];
      if (value === undefined || value === '') continue;
      if (typeof value !== 'string' || value.length > max || [...value].some(character=>character.charCodeAt(0)<32 || character.charCodeAt(0)===127)) throw fail(400,'invalid_contact');
      if (value.trim()) contact[key] = value.trim();
    }
    if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) throw fail(400,'invalid_contact');
    if (contact.phone && !/^[+0-9 ()-]{3,32}$/.test(contact.phone)) throw fail(400,'invalid_contact');
  }
  // Canonical order permits retries with the same private credential.
  return { title:valid.title,description:valid.description,category:valid.category,municipality:valid.municipality,barangay:valid.barangay,priority:valid.priority,incidentAt:valid.incidentAt || null,neededBy:valid.neededBy || null,location:valid.location ? {lat:valid.location.lat,lng:valid.location.lng} : null,contact };
}

export async function sanitizePhoto(photo) {
  if (photo == null) return null;
  if (typeof photo !== 'string' || photo.length > Math.ceil(MAX_PHOTO_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(photo)) throw fail(400, 'invalid_photo');
  const bytes = Buffer.from(photo,'base64');
  if(bytes.toString('base64')!==photo)throw fail(400,'invalid_photo');
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) throw fail(413,'photo_too_large');
  const jpeg=bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
  const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const webp=bytes.subarray(0,4).toString('ascii')==='RIFF' && bytes.subarray(8,12).toString('ascii')==='WEBP';
  if(!jpeg && !png && !webp)throw fail(400,'invalid_photo');
  try {
    const image = sharp(bytes,{limitInputPixels:16000000,failOn:'warning',animated:false});
    const metadata = await image.metadata();
    if (!['jpeg','png','webp'].includes(metadata.format) || (metadata.pages || 1) !== 1) throw new Error('unsupported');
    // Re-encode, auto-orient and strip all EXIF/GPS/XMP/default metadata.
    const output = await image.rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).jpeg({quality:85}).toBuffer();
    if (output.length > MAX_PHOTO_BYTES) throw fail(413,'photo_too_large');
    return output;
  } catch (error) { if (error.status) throw error; throw fail(400,'invalid_photo'); }
}

async function readJson(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw fail(415,'json_required');
  if (Number(req.headers['content-length']) > MAX_BODY_BYTES) throw fail(413,'request_too_large');
  const chunks=[];let size=0;
  for await (const chunk of req) { size+=chunk.length;if(size>MAX_BODY_BYTES)throw fail(413,'request_too_large');chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw fail(400,'invalid_json'); }
}

export function createVisitorHandler({ env, database, storage }) {
  return async function handler(req,res) {
    res.setHeader('Cache-Control','no-store, private');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Content-Type-Options','nosniff');
    const send = (status,body) => { res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body)); };
    try {
      if (req.method !== 'POST') {res.setHeader('Allow','POST');throw fail(405,'post_required');}
      if (!ingressEnabled(env)) throw fail(503,'unavailable');
      if (req.headers.origin !== env.ANON_ALLOWED_ORIGIN) throw fail(403,'origin_denied');
      const source = sourceIdentity(req,env);
      // Operation uses a fixed header; credentials never enter a URL/query.
      const operation = new URL(req.url,'http://local.invalid').search ? null : req.headers['x-report-operation'];
      if (!['submit','track'].includes(operation)) throw fail(400,'invalid_operation');
      const allowed = await database.rpc('claim_visitor_attempt',{source,operation});
      if (!allowed) {res.setHeader('Retry-After','600');throw fail(429,'rate_limited');}
      const body = await readJson(req);
      if (!body || typeof body.trackingCredential !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.trackingCredential)) throw fail(400,'invalid_credential');
      const tracking_hash=digest(body.trackingCredential);
      if (operation==='track') {
        if (Object.keys(body).some(key=>key!=='trackingCredential')) throw fail(400,'invalid_request');
        const result=await database.rpc('track_visitor_report',{tracking_hash});
        if (!result) throw fail(404,'not_found');
        return send(200,{report:result});
      }
      if (Object.keys(body).some(key=>!['trackingCredential','report','photo'].includes(key))) throw fail(400,'invalid_request');
      const payload=validateVisitorPayload(body.report);
      const photo=await sanitizePhoto(body.photo);
      const payload_hash=digest(JSON.stringify(payload)+'\n'+(photo ? digest(photo) : ''));
      const result=await database.rpc('submit_visitor_report',{payload,tracking_hash,source_hash:source,payload_hash,has_photo:Boolean(photo)});
      let photoSaved=!photo;
      if (photo && result.objectPath) {
        try {
          await storage.upload(result.objectPath,photo);
          await database.rpc('finalize_visitor_photo',{target_report_id:result.id,tracking_hash});
          photoSaved=true;
        } catch { /* report already committed; keep its receipt and permit a safe retry */ }
      }
      return send(200,{id:result.id,photoSaved,replayed:result.replayed});
    } catch(error) {
      // Never serialize DB messages, SQL, credentials, report/contact data or IPs.
      const quota=error.code==='54000';
      const invalid=String(error.code || '').startsWith('22') || error.code==='23514';
      return send(error.status || (quota?429:invalid?400:503),{error:error.status ? error.code : quota?'rate_limited':invalid?'invalid_report':'unavailable'});
    }
  };
}
