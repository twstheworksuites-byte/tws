import{useEffect,useRef}from'react';

export default function WorkspaceBlueprint(){
 const canvasRef=useRef(null);
 useEffect(()=>{
  const canvas=canvasRef.current,ctx=canvas.getContext('2d',{alpha:true});
  let frame=0,width=0,height=0,dpr=1,yaw=.08,targetYaw=.08,pitch=0,targetPitch=0;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const resize=()=>{const box=canvas.getBoundingClientRect();width=box.width;height=box.height;dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)};
  const pointer=e=>{targetYaw=((e.clientX/window.innerWidth)-.5)*.28;targetPitch=((e.clientY/window.innerHeight)-.5)*.12};
  const leave=()=>{targetYaw=.08;targetPitch=0};
  const project=(x,y,z,time)=>{const c=Math.cos(yaw),s=Math.sin(yaw),rx=x*c-z*s,rz=x*s+z*c;const perspective=620/(620+rz*19);const scale=Math.min(width/18,height/11)*(1+(reduced?0:Math.sin(time*.00045)*.018));return[width*.58+rx*scale*perspective,height*.48+(rz*(.48+pitch)-y)*scale*perspective,perspective]};
  const line3=(a,b,time,color='rgba(169,229,215,.38)',lineWidth=1)=>{const p=project(...a,time),q=project(...b,time);ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.stroke()};
  const poly=(points,time,fill,stroke='rgba(169,229,215,.3)')=>{const mapped=points.map(p=>project(...p,time));ctx.beginPath();mapped.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke()}};
  const room=(x1,z1,x2,z2,h,time)=>{poly([[x1,0,z1],[x2,0,z1],[x2,0,z2],[x1,0,z2]],time,'rgba(31,98,89,.045)','rgba(130,207,190,.27)');[[x1,z1,x2,z1],[x2,z1,x2,z2],[x2,z2,x1,z2],[x1,z2,x1,z1]].forEach(([ax,az,bx,bz])=>{line3([ax,0,az],[ax,h,az],time,'rgba(173,229,216,.28)');line3([ax,h,az],[bx,h,bz],time,'rgba(173,229,216,.42)')})};
  const desk=(x,z,time,w=1.25,d=.48)=>{poly([[x-w/2,.42,z-d/2],[x+w/2,.42,z-d/2],[x+w/2,.42,z+d/2],[x-w/2,.42,z+d/2]],time,'rgba(231,133,69,.12)','rgba(243,163,109,.7)');line3([x-w/2,.42,z-d/2],[x-w/2,0,z-d/2],time,'rgba(220,151,103,.34)');line3([x+w/2,.42,z+d/2],[x+w/2,0,z+d/2],time,'rgba(220,151,103,.34)')};
  const pulse=(x,z,time,offset=0)=>{const p=project(x,.08,z,time),phase=((time*.00022+offset)%1),r=3+phase*17;ctx.beginPath();ctx.arc(p[0],p[1],r,0,Math.PI*2);ctx.strokeStyle=`rgba(242,145,79,${(1-phase)*.55})`;ctx.lineWidth=1;ctx.stroke();ctx.beginPath();ctx.arc(p[0],p[1],2.2,0,Math.PI*2);ctx.fillStyle='#f3914f';ctx.fill()};
  const draw=time=>{yaw+=(targetYaw-yaw)*.035;pitch+=(targetPitch-pitch)*.035;ctx.clearRect(0,0,width,height);const bg=ctx.createRadialGradient(width*.58,height*.44,20,width*.58,height*.44,Math.max(width,height)*.65);bg.addColorStop(0,'rgba(21,63,58,.28)');bg.addColorStop(.5,'rgba(5,20,18,.12)');bg.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);for(let x=-7;x<=7;x++)line3([x,0,-4.5],[x,0,4.5],time,'rgba(121,190,175,.07)');for(let z=-4.5;z<=4.5;z++)line3([-7,0,z],[7,0,z],time,'rgba(121,190,175,.07)');poly([[-7,0,-4.5],[7,0,-4.5],[7,0,4.5],[-7,0,4.5]],time,'rgba(8,30,27,.13)','rgba(166,226,212,.52)');room(-7,-4.5,-2.1,-1.2,1.75,time);room(2.5,-4.5,7,-1.2,1.75,time);room(4.7,1.2,7,4.5,1.75,time);room(-7,2.7,-4.9,4.5,1.75,time);[[-5.8,-3.35],[-4.5,-3.35],[-3.2,-3.35]].forEach(([x,z])=>desk(x,z,time,.95,.48));[[-.7,-1.8],[.8,-1.8],[-.7,-.45],[.8,-.45],[-.7,.9],[.8,.9]].forEach(([x,z])=>desk(x,z,time));desk(4.75,-2.85,time,3.1,1.05);desk(5.85,2.65,time,1.35,.65);for(let i=0;i<5;i++){const z=-3.5+i*1.75;line3([-2,0,z],[-2,.13,z],time,'rgba(241,145,79,.65)',1.5)}const scanZ=-4.5+(((time*.00018)%1)*9);line3([-7,.02,scanZ],[7,.02,scanZ],time,'rgba(83,214,185,.52)',1.4);pulse(-.7,-1.8,time,0);pulse(.8,.9,time,.38);pulse(4.75,-2.85,time,.68);const title=project(-6.7,.05,4.15,time);ctx.font='600 9px Inter, sans-serif';ctx.fillStyle='rgba(179,219,210,.55)';ctx.fillText('LIVE FLOOR · 01',title[0],title[1]);if(!reduced)frame=requestAnimationFrame(draw)};
  resize();window.addEventListener('resize',resize);window.addEventListener('pointermove',pointer);window.addEventListener('pointerleave',leave);draw(performance.now());
  return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize);window.removeEventListener('pointermove',pointer);window.removeEventListener('pointerleave',leave)};
 },[]);
 return <canvas ref={canvasRef} className="home-blueprint" aria-hidden="true"/>;
}
