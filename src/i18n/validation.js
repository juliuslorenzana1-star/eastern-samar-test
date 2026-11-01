import i18n,{t} from './config.js';

export function validationMessage(validity) {
  if(validity.valueMissing)return t('Complete this field.');
  if(validity.typeMismatch)return t('Enter a valid value for this field.');
  if(validity.tooShort)return t('This entry is too short.');
  if(validity.tooLong)return t('This entry is too long.');
  if(validity.rangeUnderflow||validity.rangeOverflow||validity.stepMismatch)return t('Enter a value within the allowed range.');
  if(validity.patternMismatch||validity.badInput)return t('Check the format of this entry.');
  return '';
}
export function installValidationLocalization(document) {
  const invalid=new Set();
  const translate=field=>{
    if(typeof field?.setCustomValidity!=='function')return;
    field.setCustomValidity('');
    const message=validationMessage(field.validity);
    if(message){field.setCustomValidity(message);invalid.add(field);}else invalid.delete(field);
  };
  const onInvalid=event=>translate(event.target);
  const onInput=event=>{if(invalid.has(event.target)){event.target.setCustomValidity('');invalid.delete(event.target);}};
  const refresh=()=>{for(const field of invalid)if(field.isConnected)translate(field);else invalid.delete(field);};
  document.addEventListener('invalid',onInvalid,true);
  document.addEventListener('input',onInput,true);
  document.addEventListener('change',onInput,true);
  i18n.on('languageChanged',refresh);
  return ()=>{document.removeEventListener('invalid',onInvalid,true);document.removeEventListener('input',onInput,true);document.removeEventListener('change',onInput,true);i18n.off('languageChanged',refresh);};
}
