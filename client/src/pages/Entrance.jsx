import{useEffect,useState}from'react';
import{AnimatePresence,motion}from'framer-motion';
import{ArrowRight}from'lucide-react';
import{useNavigate}from'react-router-dom';
import{BrandLogo}from'../components/Layout';

const images=['/images/tws-passage-03.webp','/images/tws-conference-02.webp'];

export default function Entrance(){
 const[index,setIndex]=useState(0),navigate=useNavigate();
 useEffect(()=>{
  document.body.classList.add('entrance-tour-active');
  images.forEach(source=>{const image=new Image();image.src=source});
  const slides=setInterval(()=>setIndex(value=>(value+1)%images.length),1350),finish=setTimeout(()=>navigate('/home',{replace:true}),5600);
  return()=>{document.body.classList.remove('entrance-tour-active');clearInterval(slides);clearTimeout(finish)};
 },[navigate]);
 return <main className="premium-loader">
  <div className="loader-scenes" aria-hidden="true"><AnimatePresence mode="sync">{images.map((image,imageIndex)=>imageIndex===index&&<motion.img key={image} src={image} initial={{opacity:0,scale:1.08}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:1.03}} transition={{duration:1.2,ease:[.16,1,.3,1]}}/>)}</AnimatePresence></div>
  <div className="loader-shade"/><div className="loader-grid"/><div className="loader-depth" aria-hidden="true"><i/><i/><i/></div><div className="loader-grain"/>
  <header className="loader-header"><span>BANNERGHATTA MAIN ROAD · BENGALURU</span><small>THE WORK SUITES</small></header>
  <motion.section className="loader-center" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:1,ease:[.16,1,.3,1]}}>
   <div className="loader-orbit" aria-hidden="true"><i/><i/><span/></div>
   <p className="loader-welcome">WELCOME TO</p>
   <BrandLogo className="loader-brand-logo"/>
   <div className="loader-status"><i><b/></i><p>Preparing your workspace</p></div>
   <button onClick={()=>navigate('/home',{replace:true})}><span>Enter workspace</span><i><ArrowRight/></i></button>
  </motion.section>
  <footer className="loader-footer"><span>CABINS · MEETING · CONFERENCE</span><div>{images.map((_,dot)=><i className={dot===index?'active':''} key={dot}/>)}</div><span>AUTOMATIC ENTRY</span></footer>
 </main>
}
