import { useEffect,useRef } from 'react';
import { Marker } from 'react-leaflet';

// Leaflet's title option is not a mutable React-Leaflet prop. Update the existing
// marker element so changing language preserves open popups and map position.
export default function LocalizedMarker({title,...props}) {
  const marker=useRef(null);
  useEffect(()=>{
    if(!marker.current)return;
    marker.current.options.title=title||'';
    const element=marker.current.getElement();
    if(title){element?.setAttribute('title',title);element?.setAttribute('aria-label',title);}else{element?.removeAttribute('title');element?.removeAttribute('aria-label');}
  },[title]);
  return <Marker {...props} keyboard={props.interactive === false ? false : props.keyboard ?? true} ref={marker} title={title} />;
}
