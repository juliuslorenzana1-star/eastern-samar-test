import { useState } from 'react';
import { Check, Copy, MapPin, PhoneCall, Radio, X } from 'lucide-react';
import { SOURCED_EMERGENCIES } from '../data/sourcedHotlines.js';
import { MUNICIPALITIES } from '../lib/place.js';
import useDialogFocus from '../lib/useDialogFocus.js';

export default function EmergencyHotlineDrawer({ isOpen,onClose,defaultMunicipality='all' }) {
  const [area,setArea]=useState(defaultMunicipality);
  const [copied,setCopied]=useState('');
  const [copyError,setCopyError]=useState('');
  const dialogRef=useDialogFocus({active:isOpen,busy:false,onClose});
  if(!isOpen)return null;
  async function copy(number) {
    try {await navigator.clipboard.writeText(number);setCopied(number);setCopyError('');}
    catch {setCopyError('Clipboard is unavailable. Select the displayed number to copy it.');}
  }
  return <div className="emergency-drawer-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section ref={dialogRef} tabIndex={-1} className="emergency-drawer" role="dialog" aria-modal="true" aria-labelledby="emergency-drawer-title">
      <header className="emergency-drawer-header"><div><span className="emergency-beacon"><Radio size={16} />EMERGENCY CONTACTS</span><h2 id="emergency-drawer-title">Eastern Samar Hotlines</h2><p className="emergency-subtitle">Published government contact information. This platform does not dispatch emergency assistance.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close emergency hotlines"><X size={20} /></button></header>
      <div className="emergency-directory-body">
        <label className="field-label"><MapPin size={15} /> Municipality / city<select value={area} onChange={event=>setArea(event.target.value)}><option value="all">Province-wide</option>{MUNICIPALITIES.map(name=><option key={name}>{name}</option>)}</select></label>
        {SOURCED_EMERGENCIES.map(item=><article className="hotline-card" key={item.id}><h3>{item.name}</h3><div className="dial-action-row"><a href={`tel:${item.raw}`} className="direct-dial-link"><PhoneCall size={17} /><strong>{item.number}</strong></a><button type="button" className="copy-btn" onClick={()=>copy(item.number)} aria-label={`Copy ${item.number}`}>{copied===item.number?<Check size={16}/>:<Copy size={16}/>}</button></div><p><a href={item.source} target="_blank" rel="noreferrer">{item.sourceTitle}</a> · source checked {item.checkedAt}</p></article>)}
        <p className="emergency-protocol-banner">State your municipality, barangay, nearest landmark and the nature of the emergency when speaking to an operator.</p>
        <p>{area==='all'?'Local municipal contacts':`${area} local contacts`} are awaiting source verification. Unverified numbers are withheld.</p>
        <p><a href="https://easternsamar.gov.ph/emergency-and-safety/" target="_blank" rel="noreferrer">Provincial emergency and safety directory</a></p>
        {copyError&&<p role="alert">{copyError}</p>}{copied&&<p role="status">Number copied.</p>}
      </div>
    </section>
  </div>;
}
