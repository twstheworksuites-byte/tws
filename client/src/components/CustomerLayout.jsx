import{useState}from'react';
import{Bell,CalendarDays,FileText,Home,LayoutDashboard,LogOut,Menu,UserRound,X}from'lucide-react';
import{NavLink,Outlet,useNavigate}from'react-router-dom';
import{Logo}from'./Layout';
import{useApp}from'../context';

const links=[['Dashboard','/customer',LayoutDashboard],['Bookings','/customer/bookings',CalendarDays],['Invoices','/customer/invoices',FileText],['Notifications','/customer/notifications',Bell],['Profile','/customer/profile',UserRound]];

export default function CustomerLayout(){
 const[open,setOpen]=useState(false),{user,logout}=useApp(),navigate=useNavigate();
 const signOut=()=>{logout();navigate('/login')};
 return <div className={`customer-layout ${open?'nav-open':''}`}>
  <button className="portal-menu" onClick={()=>setOpen(!open)} aria-label={open?'Close customer navigation':'Open customer navigation'}>{open?<X/>:<Menu/>}</button>
  <button className="portal-backdrop" onClick={()=>setOpen(false)} aria-label="Close navigation"/>
  <aside className="customer-sidebar">
   <Logo light/><button className="portal-close" onClick={()=>setOpen(false)} aria-label="Close navigation"><X/></button>
   <div className="portal-person"><span>{user?.name?.[0]||'C'}</span><div><strong>{user?.name||'Customer'}</strong><small>{user?.email}</small></div></div>
   <nav>{links.map(([label,to,Icon])=><NavLink end={to==='/customer'} to={to} onClick={()=>setOpen(false)} key={label}><Icon/>{label}</NavLink>)}</nav>
   <div className="portal-sidebar-bottom"><NavLink to="/" onClick={()=>setOpen(false)}><Home/>Public website</NavLink><button onClick={signOut}><LogOut/>Sign out</button></div><small className="portal-powered">Powered by MERNPixel</small>
  </aside>
  <main className="customer-main"><Outlet/></main>
 </div>
}
