import{useEffect,useState}from'react';
import{api}from'../api';
import{WorkspaceCard}from'../components/WorkspaceCard';
import{Empty,Loading}from'../components/Layout';
import{RefreshCw,Search}from'lucide-react';
import{useApp}from'../context';

const filters=[['all','All spaces'],['hot_desk','Hot / flexi desks'],['dedicated_desk','Dedicated desks'],['private_cabin','Private cabins'],['meeting_room','Meeting room'],['conference_room','Conference']];

export default function Workspaces(){
 const{operationsVersion}=useApp();
 const[items,setItems]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[type,setType]=useState('all'),[search,setSearch]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setError('');api(`/workspaces${type==='all'?'':`?type=${type}`}`).then(result=>{if(active)setItems(result.items||[])}).catch(reason=>{if(active){setItems([]);setError(reason.message)}}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[type,retry,operationsVersion]);
 const shown=items.filter(item=>item.name.toLowerCase().includes(search.toLowerCase()));
 return <><section className="page-hero"><p className="eyebrow">Find your fit</p><h1>Space for every<br/><em>kind of work.</em></h1><p>Choose a flexi desk, dedicated desk, private cabin, meeting room or conference room on our single TWS floor. Phone booths are included as an amenity.</p></section><section className="catalog section"><div className="filter-row"><div className="filter-pills">{filters.map(([key,label])=><button className={type===key?'active':''} onClick={()=>setType(key)} key={key}>{label}</button>)}</div><label className="search"><Search/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search spaces"/></label></div>{loading?<Loading cards={6}/>:error?<div className="load-error"><RefreshCw/><h2>Spaces could not load</h2><p>{error}</p><button className="btn btn-dark" onClick={()=>setRetry(value=>value+1)}>Try again</button></div>:shown.length?<div className="workspace-grid">{shown.map((item,index)=><WorkspaceCard item={item} index={index} key={item._id}/>)}</div>:<Empty title="No matching spaces" copy="Try another space type or search term."/>}</section></>;
}
