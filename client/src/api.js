const API_URL=import.meta.env.VITE_API_URL||'http://localhost:5000/api';
export async function api(path,options={}){
  const token=localStorage.getItem('tws_token');
  let response;
  try{response=await fetch(`${API_URL}${path}`,{...options,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{ }),...options.headers}})}catch(error){throw new Error('TWS server is not connected. Start the API and try again.')}
  if(response.status===204)return null;
  const data=await response.json().catch(()=>({message:'The server returned an unexpected response.'}));
  if(!response.ok)throw Object.assign(new Error(data.message||'Request failed'),{status:response.status,data});
  return data;
}
export const money=value=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(value||0);
export const dt=value=>new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(value));
export async function downloadFile(path,filename){const token=localStorage.getItem('tws_token');const response=await fetch(`${API_URL}${path}`,{headers:token?{Authorization:`Bearer ${token}`}:{}});if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.message||'Download failed');}const url=URL.createObjectURL(await response.blob()),anchor=document.createElement('a');anchor.href=url;anchor.download=filename;document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);}
