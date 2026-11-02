import { useEffect,useState } from 'react';
import { useTranslation } from 'react-i18next';
import { t } from '../i18n/config.js';
import { supabase } from '../lib/supabase.js';
export default function VisitorContact({reportId}) {
  useTranslation();
  const [state,setState]=useState({loading:true});
  useEffect(()=>{
    let active=true;
    async function load(){
      try{const {data,error}=await supabase.rpc('visitor_report_contact',{target_report_id:reportId});if(error)throw error;if(active)setState({contact:data});}
      catch{if(active)setState({error:true});}
    }
    void load();return()=>{active=false;};
  },[reportId]);
  if(state.loading)return <p>{t('Loading confidential contact…')}</p>;
  if(state.error)return <p>{t('Confidential contact could not be loaded. Check moderator access and the database migration.')}</p>;
  if(!state.contact)return null;
  return <section><h3>{t('Confidential follow-up contact')}</h3><p>{t('For authorized follow-up only. Never copy contact details into public report fields or resident-facing notes.')}</p>
    {Object.keys(state.contact).length ? <dl>{[['name','Name (optional)'],['email','Email (optional)'],['phone','Phone (optional)']].filter(([key])=>state.contact[key]).map(([key,label])=><div key={key}><dt>{t(label)}</dt><dd>{state.contact[key]}</dd></div>)}</dl> : <p>{t('No contact details supplied.')}</p>}
  </section>;
}
