import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, BadgeCheck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api, dt, money } from '../api';
import { Loading } from '../components/Layout';

export default function BookingConfirmation(){const{id}=useParams(),[booking,setBooking]=useState(null);useEffect(()=>{api(`/bookings/mine/${id}`).then(result=>setBooking(result.item))},[id]);if(!booking)return <section className="confirmation"><Loading cards={1}/></section>;return <section className="confirmation"><motion.div initial={{opacity:0,scale:.94}} animate={{opacity:1,scale:1}} className="confirmation-card"><div className="success-orbit"><BadgeCheck/></div><p className="eyebrow">Booking confirmation</p><h1>Your space is<br/><em>ready for you.</em></h1><p className="confirmation-id">{booking.bookingId}</p><div className="confirmation-detail"><div><span>Workspace</span><strong>{booking.workspace?.name||'TWS · The Work Suites'}</strong></div><div><span>When</span><strong>{dt(booking.startAt)}</strong></div><div><span>Total</span><strong>{money(booking.total)}</strong></div></div><Link className="btn btn-dark" to="/customer/bookings">View my bookings <ArrowRight/></Link></motion.div></section>}
