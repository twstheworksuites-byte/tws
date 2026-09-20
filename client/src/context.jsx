import {createContext,useContext,useEffect,useMemo,useState} from 'react';
import {api} from './api';
import {io} from 'socket.io-client';
const AppContext=createContext(null);
export function AppProvider({children}){
  const [user,setUser]=useState(null),[authReady,setAuthReady]=useState(!localStorage.getItem('tws_token')),[toasts,setToasts]=useState([]),[booking,setBooking]=useState(()=>JSON.parse(sessionStorage.getItem('tws_booking')||'{}')),[availabilityVersion,setAvailabilityVersion]=useState(0),[operationsVersion,setOperationsVersion]=useState(0);
  useEffect(()=>{const token=localStorage.getItem('tws_token');if(!token){setAuthReady(true);return}api('/auth/me').then(r=>setUser(r.user)).catch(()=>localStorage.removeItem('tws_token')).finally(()=>setAuthReady(true));},[]);
  useEffect(()=>sessionStorage.setItem('tws_booking',JSON.stringify(booking)),[booking]);
  useEffect(()=>{const socket=io(import.meta.env.VITE_SOCKET_URL||'http://localhost:5000');socket.on('availability:update',detail=>{setAvailabilityVersion(v=>v+1);window.dispatchEvent(new CustomEvent('tws:availability',{detail}))});socket.on('operations:update',()=>setOperationsVersion(v=>v+1));return()=>socket.close()},[]);
  const toast=(message,type='success')=>{const id=crypto.randomUUID();setToasts(t=>[...t,{id,message,type}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3800);};
  const login=(token,nextUser)=>{localStorage.setItem('tws_token',token);setUser(nextUser);setAuthReady(true);};
  const logout=()=>{localStorage.removeItem('tws_token');setUser(null);setAuthReady(true);};
  const value=useMemo(()=>({user,setUser,authReady,login,logout,toasts,toast,booking,setBooking,availabilityVersion,operationsVersion}),[user,authReady,toasts,booking,availabilityVersion,operationsVersion]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export const useApp=()=>useContext(AppContext);
