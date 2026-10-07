import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Bot, Headphones, LoaderCircle, MessageCircle, Send, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api';

const quickPrompts = ['Available spaces', 'Yearly leases', 'TWS location', 'Included amenities'];

export default function SupportWidget(){
  const[open,setOpen]=useState(false),[input,setInput]=useState(''),[busy,setBusy]=useState(false),[messages,setMessages]=useState([{from:'bot',text:'Hi! How can I help with your workspace today?'}]);
  const location=useLocation(),number=import.meta.env.VITE_WHATSAPP_NUMBER||'917778886839';
  if(location.pathname.startsWith('/admin'))return null;
  const whatsappText=encodeURIComponent(`Hi, I need help with TWS · The Work Suites${location.pathname==='/book'?' booking':''}.`);
  const whatsappUrl=number?`https://wa.me/${number.replace(/\D/g,'')}?text=${whatsappText}`:'#contact';
  async function send(text=input){
    const message=text.trim();if(!message||busy)return;
    const history=messages.slice(-8);setMessages(current=>[...current,{from:'user',text:message}]);setInput('');setBusy(true);
    try{const result=await api('/chat',{method:'POST',body:JSON.stringify({message,history})});setMessages(current=>[...current,{from:'bot',text:result.message,action:/book|availability|seat|space/i.test(result.message)}]);}
    catch{setMessages(current=>[...current,{from:'bot',text:'Please use the enquiry form or WhatsApp and the TWS team will confirm this for you.',error:true}]);}
    finally{setBusy(false)}
  }
  return <div className="support-widget"><AnimatePresence>{open&&<motion.section className="chat-panel" initial={{opacity:0,y:18,scale:.96}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:12,scale:.97}} transition={{duration:.2}} aria-label="AI workspace booking assistant"><header><span><Bot/></span><div><strong>TWS Live Chat</strong><small><i/> Online now</small></div><button onClick={()=>setOpen(false)} aria-label="Close assistant"><X/></button></header><div className="chat-messages" aria-live="polite">{messages.map((message,index)=><motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} className={`chat-message ${message.from} ${message.error?'chat-error':''}`} key={`${index}-${message.text}`}>{message.text}{message.action&&<Link to="/book" onClick={()=>setOpen(false)}>Check live spaces <ArrowRight/></Link>}</motion.div>)}{busy&&<div className="chat-typing"><i/><i/><i/></div>}</div><div className="chat-prompts">{quickPrompts.map(label=><button key={label} onClick={()=>send(label)} disabled={busy}>{label}</button>)}</div><form className="chat-input" onSubmit={event=>{event.preventDefault();send()}}><input value={input} onChange={event=>setInput(event.target.value)} maxLength={500} placeholder="Type a message…" aria-label="Message the workspace assistant"/><button disabled={busy||!input.trim()} aria-label="Send message">{busy?<LoaderCircle className="spin"/>:<Send/>}</button></form><footer><Headphones/><span>Prefer a person?</span><a href={whatsappUrl} target={number?'_blank':undefined} rel="noreferrer">WhatsApp</a></footer></motion.section>}</AnimatePresence><div className="support-actions"><a className="whatsapp-fab" href={whatsappUrl} target={number?'_blank':undefined} rel="noreferrer" aria-label="Chat with us on WhatsApp" title="WhatsApp"><MessageCircle/></a><button className="chat-fab" onClick={()=>setOpen(!open)} aria-label={open?'Close booking assistant':'Open AI booking assistant'}>{open?<X/>:<><Bot/><i/></>}</button></div></div>
}
