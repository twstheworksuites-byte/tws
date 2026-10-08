import{useCallback,useEffect,useRef,useState}from'react';

export default function Entrance({onComplete}){
 const[phase,setPhase]=useState('playing'),completed=useRef(false);
 const finish=useCallback(()=>{
  if(completed.current)return;
  completed.current=true;
  setPhase('fading');
  window.setTimeout(()=>onComplete?.(),620);
 },[onComplete]);

 useEffect(()=>{
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const safetyTimer=window.setTimeout(finish,10000);
  const handleKeyDown=event=>{if(event.key==='Escape')finish()};
  window.addEventListener('keydown',handleKeyDown);
  return()=>{
   document.body.style.overflow=previousOverflow;
   window.clearTimeout(safetyTimer);
   window.removeEventListener('keydown',handleKeyDown);
  };
 },[finish]);

 return <div className={`site-intro site-intro-${phase}`} role="dialog" aria-label="TWS introduction">
  <video
   className="site-intro-video"
   src="/videos/tws-intro.mp4"
   autoPlay
   muted
   playsInline
   preload="auto"
   aria-hidden="true"
   onCanPlay={event=>event.currentTarget.play().catch(()=>{})}
   onEnded={finish}
   onError={finish}
  />
  <div className="site-intro-shade" aria-hidden="true"/>
  <button className="site-intro-skip" type="button" onClick={finish} aria-label="Skip introduction video">
   <span>Skip intro</span><b aria-hidden="true">&#8599;</b>
  </button>
 </div>;
}
