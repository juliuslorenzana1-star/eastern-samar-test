// Tracking secrets live in memory/user-held receipts, never URLs or localStorage.
import { validateReport } from './report-validation.js';
export function newTrackingCredential() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}
const messages={rate_limited:'Please wait before trying again. The reporting allowance has been reached.',not_found:'No report matches that tracking credential.',invalid_photo:'Use a valid JPEG, PNG or WebP photo.',photo_too_large:'For anonymous reports, use a photo up to 2 MB.',invalid_contact:'Check the optional contact details.',invalid_report:'Check the report details and try again.',invalid_credential:'Enter your complete private tracking credential.'};
async function request(operation,body) {
  const response=await fetch(`${import.meta.env.BASE_URL}api/anonymous`,{method:'POST',headers:{'Content-Type':'application/json','X-Report-Operation':operation},body:JSON.stringify(body),credentials:'same-origin',cache:'no-store',referrerPolicy:'no-referrer'});
  let data;
  try{data=await response.json();}catch{throw new Error('Reporting is currently unavailable. Your details have not been confirmed saved.');}
  if(!response.ok)throw new Error(messages[data.error] || 'Reporting is currently unavailable. Your details have not been confirmed saved.');
  return data;
}
export async function submitVisitorReport(values,trackingCredential) {
  const report=validateReport(values);
  const photo=values.evidence ? await new Promise((resolve,reject)=>{
    if(values.evidence.size>2097152){reject(new Error('For anonymous reports, use a photo up to 2 MB.'));return;}
    const reader=new FileReader();reader.onerror=()=>reject(new Error('The photo could not be read.'));reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(values.evidence);
  }):null;
  const result=await request('submit',{trackingCredential,photo,report:{title:report.title,description:report.description,category:report.category,municipality:report.municipality,barangay:report.barangay,priority:report.priority,location:report.location,incidentAt:report.incidentAt,neededBy:report.neededBy,contact:values.contact || {}}});
  return {...result,trackingCredential};
}
export async function trackVisitorReport(trackingCredential) {
  if(!/^[A-Za-z0-9_-]{43}$/.test(trackingCredential))throw new Error(messages.invalid_credential);
  return (await request('track',{trackingCredential})).report;
}
