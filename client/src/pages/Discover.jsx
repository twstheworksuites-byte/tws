import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowUpDown, BadgeCheck, Building2, Car, Check, Coffee, CupSoda, DoorOpen, Phone, Printer, Users, Wifi } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Loading } from '../components/Layout';
import { useSiteContent } from '../siteContent';

const reveal={initial:{opacity:0,y:22},whileInView:{opacity:1,y:0},viewport:{once:true,amount:.18},transition:{duration:.55,ease:[.16,1,.3,1]}};

export function About(){const content=useSiteContent('about',{title:'Built for work that needs room to grow.',body:'A professional workspace on Bannerghatta Main Road in South Bengaluru.'});return <><section className="page-hero about-hero"><p className="eyebrow">About The Work Suites</p><h1>{content.title}</h1><p>{content.body}</p></section><section className="section story-grid"><motion.img {...reveal} src="/images/tws-foyer-02.webp" loading="lazy" decoding="async" alt="The Work Suites foyer and reception in Bengaluru"/><motion.div {...reveal}><p className="eyebrow">Your space · Your pace</p><h2>Work better. Meet better. Grow better.</h2><p>TWS is a single-floor professional workspace created for individuals, teams and businesses. It combines private cabins, professional meeting facilities and everyday conveniences in Kothnur, Kalena Agrahara.</p><div className="story-points"><span><BadgeCheck/>1 three-seat, 13 four-seat and 7 six-seat cabins</span><span><Building2/>10 meeting rooms and a 20–25-seat conference room</span><span><Users/>Two complimentary phone booths for every workspace type</span></div><Link className="btn btn-dark" to="/workspaces">Explore workspaces <ArrowRight/></Link></motion.div></section></>}

const amenityItems=[
 [Users,'Reception & seating','A welcoming reception and visitor seating area.'],[Coffee,'Pantry','A dedicated pantry with its own seating area.'],[CupSoda,'Coffee & vending','Coffee and vending machines inside the workspace.'],[Printer,'Print station','A dedicated area for everyday printing needs.'],[Phone,'Two phone booths','Private sound-controlled booths for important calls.'],[DoorOpen,'Washrooms','Separate male and female washrooms.'],[ArrowUpDown,'Lift access','An eight-person lift serves the workspace.'],[Car,'Ground-floor parking','Parking is available within the building for members and visitors.'],[Check,'Puja space','A dedicated puja space within TWS.'],[Wifi,'Workspace connectivity','Connectivity is available across the professional work areas.']
];
export function Amenities(){const content=useSiteContent('amenities',{title:'Workday essentials. Already handled.',body:'Facilities are included so you can focus on the work.'});return <><section className="page-hero amenities-hero"><p className="eyebrow">Everything you need</p><h1>{content.title}</h1><p>{content.body}</p></section><section className="section amenity-grid">{amenityItems.map(([Icon,title,copy],index)=><motion.article {...reveal} transition={{...reveal.transition,delay:index*.04}} key={title}><Icon/><span>{String(index+1).padStart(2,'0')}</span><h2>{title}</h2><p>{copy}</p></motion.article>)}</section></>}

const gallery=[
 ['/images/tws-foyer-01.webp','TWS reception'],
 ['/images/tws-foyer-02.webp','Reception lounge'],
 ['/images/tws-private-cabin.webp','Private cabin'],
 ['/images/tws-conference-01.webp','Conference room'],
 ['/images/tws-conference-02.webp','Meeting room'],
 ['/images/tws-conference-03.webp','Presentation room'],
 ['/images/tws-passage-01.webp','Private phone booths'],
 ['/images/tws-passage-02.webp','Workspace passage'],
 ['/images/tws-print-area.webp','Print station'],
 ['/images/tws-cafe-01.webp','Pantry seating'],
 ['/images/tws-cafe-02.webp','Café lounge'],
 ['/images/tws-cafe-03.webp','Community café']
];
export function Gallery(){return <><section className="page-hero gallery-hero"><p className="eyebrow">Inside TWS</p><h1>See where your<br/><em>next workday happens.</em></h1><p>A visual tour of the shared spaces and facilities around TWS.</p></section><section className="section gallery-grid">{gallery.map(([src,title],index)=><motion.figure {...reveal} transition={{...reveal.transition,delay:(index%3)*.06}} key={src}><img src={src} loading="lazy" decoding="async" alt={title}/><figcaption><span>{String(index+1).padStart(2,'0')}</span><strong>{title}</strong></figcaption></motion.figure>)}</section></>}

const typeName=value=>({hot_desk:'Hot desks',dedicated_desk:'Dedicated desks',private_cabin:'Private cabins',meeting_room:'Meeting rooms',conference_room:'Conference room',phone_booth:'Phone booths'}[value]||value);
export function SeatingPlans(){const[items,setItems]=useState([]),[loading,setLoading]=useState(true);useEffect(()=>{api('/workspaces').then(result=>setItems(result.items||[])).finally(()=>setLoading(false))},[]);return <><section className="page-hero seating-hero"><p className="eyebrow">Single-floor plan</p><h1>Choose the setup<br/><em>that fits your team.</em></h1><p>All TWS spaces are on one floor. Live inventory is selected during booking.</p></section><section className="section seating-plans">{loading?<Loading cards={3}/>:<motion.article {...reveal}><header><div><span>TWS · One floor</span><h2>{items.length} available workspace options</h2></div><Link to="/book">View live availability <ArrowRight/></Link></header><div className="plan-canvas">{items.map((space,index)=><div className={`plan-space type-${space.type}`} key={space._id}><span>{String(index+1).padStart(2,'0')}</span><strong>{space.name}</strong><small>{typeName(space.type)} · {space.capacity?`${space.capacity} seats`:'Count confirmed by TWS'}</small><i className={space.status}/></div>)}</div></motion.article>}</section><section className="section seating-cta"><div><p className="eyebrow">Ready to choose?</p><h2>Select an available desk, cabin or room for your date and time.</h2></div><Link className="btn btn-accent" to="/book">Open live booking <ArrowRight/></Link></section></>}
