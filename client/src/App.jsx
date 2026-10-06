import{useLayoutEffect}from'react';
import{Navigate,Route,Routes,useLocation}from'react-router-dom';
import{PublicLayout,Toasts}from'./components/Layout';
import AdminLayout from'./components/AdminLayout';
import CustomerLayout from'./components/CustomerLayout';
import{useApp}from'./context';
import Home from'./pages/Home';
import Workspaces from'./pages/Workspaces';
import Booking from'./pages/Booking';
import Checkout from'./pages/Checkout';
import{AdminLogin,ForgotPassword,Login,Register,ResetPassword}from'./pages/Auth';
import{CustomerDashboard,Invoices,MyBookings,Notifications,Profile}from'./pages/Customer';
import{AdminBookings,AdminMap,CancellationRequests,Dashboard,Reports,ResourceList}from'./pages/Admin';
import SupportWidget from'./components/SupportWidget';
import InfoPage from'./pages/Info';
import{Contact}from'./pages/Marketing';
import{About,Amenities,Gallery,SeatingPlans}from'./pages/Discover';
import BookingConfirmation from'./pages/BookingConfirmation';
import AdminBusiness from'./pages/AdminBusiness';
import AdminLeases from'./pages/AdminLeases';

function RequireAuth({admin=false,children}){
 const{user,authReady}=useApp(),location=useLocation();
 if(!authReady)return <div className="auth-loading">Connecting to TWS…</div>;
 if(!user)return <Navigate to={admin?'/admin/login':'/login'} state={{from:location.pathname}} replace/>;
 if(admin&&user.role!=='super_admin')return <Navigate to="/customer/bookings" replace/>;
 if(!admin&&user.role!=='customer')return <Navigate to="/admin" replace/>;
 return children;
}
function NotFound(){return <section className="not-found"><span>404</span><h1>This space<br/><em>doesn't exist.</em></h1><a className="btn btn-dark" href="/">Return home</a></section>}
function ScrollToTop(){const{pathname,search,hash}=useLocation();useLayoutEffect(()=>{if('scrollRestoration'in window.history)window.history.scrollRestoration='manual';if(hash){requestAnimationFrame(()=>document.querySelector(hash)?.scrollIntoView({block:'start'}));return}window.scrollTo(0,0);document.documentElement.scrollTop=0;document.body.scrollTop=0},[pathname,search,hash]);return null}

export default function App(){
 const location=useLocation(),isPortal=location.pathname.startsWith('/customer')||location.pathname.startsWith('/admin');
 return <><ScrollToTop/><Routes>
  <Route element={<PublicLayout/>}>
   <Route index element={<Home/>}/><Route path="home" element={<Home/>}/><Route path="about" element={<About/>}/><Route path="workspaces" element={<Workspaces/>}/><Route path="seating-plans" element={<SeatingPlans/>}/><Route path="get-space" element={<Navigate to="/book" replace/>}/><Route path="lease" element={<Navigate to="/book?mode=lease" replace/>}/><Route path="amenities" element={<Amenities/>}/><Route path="gallery" element={<Gallery/>}/><Route path="contact" element={<Contact/>}/><Route path="book" element={<Booking/>}/>
   <Route path="checkout" element={<RequireAuth><Checkout/></RequireAuth>}/><Route path="booking-confirmation/:id" element={<RequireAuth><BookingConfirmation/></RequireAuth>}/>
   <Route path="login" element={<Login/>}/><Route path="register" element={<Register/>}/><Route path="forgot-password" element={<ForgotPassword/>}/><Route path="reset-password" element={<ResetPassword/>}/>
   <Route path="faq" element={<InfoPage type="faq"/>}/><Route path="privacy" element={<InfoPage type="privacy"/>}/><Route path="terms" element={<InfoPage type="terms"/>}/><Route path="*" element={<NotFound/>}/>
  </Route>
  <Route path="customer" element={<RequireAuth><CustomerLayout/></RequireAuth>}><Route index element={<CustomerDashboard/>}/><Route path="bookings" element={<MyBookings/>}/><Route path="profile" element={<Profile/>}/><Route path="invoices" element={<Invoices/>}/><Route path="notifications" element={<Notifications/>}/><Route path="*" element={<Navigate to="/customer" replace/>}/></Route>
  <Route path="admin/login" element={<AdminLogin/>}/>
  <Route path="admin" element={<RequireAuth admin><AdminLayout/></RequireAuth>}><Route index element={<Dashboard/>}/><Route path="map" element={<AdminMap/>}/><Route path="bookings" element={<AdminBookings/>}/><Route path="leases" element={<AdminLeases/>}/><Route path="cancellations" element={<CancellationRequests/>}/><Route path="maintenance" element={<Navigate to="/admin/workspaces" replace/>}/><Route path="workspaces" element={<ResourceList kind="workspaces"/>}/><Route path="reports" element={<Reports/>}/><Route path="business" element={<AdminBusiness/>}/><Route path="*" element={<Navigate to="/admin" replace/>}/></Route>
 </Routes><Toasts/>{!isPortal&&<SupportWidget/>}</>;
}
