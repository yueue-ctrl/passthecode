import { paintWaveLED } from './ribbon-wave.js';
import { paintRibbonColors } from './ribbon-colors.js';
// CPU projection fallback keeps the animated 3D ribbon available after a GPU context loss.
export async function startRibbonFallback(){
 document.querySelector('#render-error')?.remove();document.querySelectorAll('canvas').forEach(c=>c.remove());
 const canvas=document.createElement('canvas');canvas.dataset.renderMode='cpu-projection';document.body.prepend(canvas);const ctx=canvas.getContext('2d');
 const surface=document.createElement('canvas'),screen=surface.getContext('2d');
 await document.fonts.load('400 100px Inter');
 const words=Array(12).fill('code'),palette=['#efff35','#8dff00','#00e2fa','#1299ff','#ff00c8'];
 const front=document.createElement('canvas'),back=document.createElement('canvas');front.width=back.width=8192;front.height=back.height=256;
 const classicFront=document.createElement('canvas');classicFront.width=8192;classicFront.height=256;
 const f=front.getContext('2d'),b=back.getContext('2d');
 const phrases=words.map(word=>{const chars=[...`pass the ${word}`],weights=chars.map((_,i)=>900-800*i/(chars.length-1));const widths=chars.map((c,i)=>{f.font=`${weights[i]} 132px Inter`;return f.measureText(c).width-5;});return{chars,weights,widths,width:widths.reduce((a,b)=>a+b,0)};});
 const factor=8192/phrases.reduce((a,p)=>a+p.width+70,0);f.fillStyle='#030407';f.fillRect(0,0,8192,256);f.scale(factor,1);b.scale(factor,1);
 paintRibbonColors(b,8192,256,0);
 let x=0;phrases.forEach(p=>{f.fillStyle='#ffffff';f.textBaseline='middle';let tx=x;p.chars.forEach((c,j)=>{f.font=`${p.weights[j]} 132px Inter`;f.fillText(c,tx,136);tx+=p.widths[j];});x+=p.width+70;});
 for(const t of [front,back]){const c=t.getContext('2d');c.setTransform(1,0,0,1,0,0);c.strokeStyle='#0000000c';c.lineWidth=.5;c.beginPath();for(let x=0;x<8192;x+=8192/1664){c.moveTo(x,0);c.lineTo(x,256);}for(let y=0;y<256;y+=256/40){c.moveTo(0,y);c.lineTo(8192,y);}c.stroke();}
 classicFront.getContext('2d').drawImage(front,0,0);
 let screenMode='wave',waveClock=0,lastWave=-1;
 document.querySelector('#screen-mode').onchange=e=>{screenMode=e.target.value;lastWave=-1;if(screenMode==='classic')f.drawImage(classicFront,0,0);};
 let w=innerWidth,h=innerHeight,flow=.35,tilt=18,size=1,glow=.32,playing=true,clock=0,previous,drag,roll=0,lastColor=-1;
 function resize(){w=innerWidth;h=innerHeight;const d=Math.min(1.5,Math.sqrt(2000000/(w*h)));canvas.width=surface.width=Math.round(w*d);canvas.height=surface.height=Math.round(h*d);canvas.style.width=w+'px';canvas.style.height=h+'px';}
 addEventListener('resize',resize);resize();
 document.querySelector('#play').onclick=e=>{playing=!playing;e.currentTarget.textContent=playing?'Pause':'Play';};
 document.querySelector('#flow').oninput=e=>flow=e.target.value/100;
 document.querySelector('#glow').oninput=e=>glow=e.target.value/100;
 document.querySelector('#size').oninput=e=>size=e.target.value/100;
 document.querySelector('#tilt').oninput=e=>tilt=Number(e.target.value);
 canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(!drag)return;roll+=(e.clientX-drag.x)*.002;tilt=Math.max(5,Math.min(60,tilt+(e.clientY-drag.y)*.15));drag={x:e.clientX,y:e.clientY};};canvas.onpointerup=canvas.onpointercancel=()=>drag=null;
 function triangle(image,src,dst){const [s0,s1,s2]=src,[d0,d1,d2]=dst;const sx1=s1[0]-s0[0],sy1=s1[1]-s0[1],sx2=s2[0]-s0[0],sy2=s2[1]-s0[1],det=sx1*sy2-sx2*sy1;if(!det)return;const dx1=d1.x-d0.x,dy1=d1.y-d0.y,dx2=d2.x-d0.x,dy2=d2.y-d0.y;const a=(dx1*sy2-dx2*sy1)/det,b=(dy1*sy2-dy2*sy1)/det,c=(dx2*sx1-dx1*sx2)/det,d=(dy2*sx1-dy1*sx2)/det;screen.save();screen.beginPath();screen.moveTo(d0.x,d0.y);screen.lineTo(d1.x,d1.y);screen.lineTo(d2.x,d2.y);screen.closePath();screen.clip();screen.setTransform(a,b,c,d,d0.x-a*s0[0]-c*s0[1],d0.y-b*s0[0]-d*s0[1]);screen.drawImage(image,0,0);screen.restore();}
 function frame(now){const dt=previous===undefined?0:Math.min(.06,(now-previous)/1000);previous=now;if(playing&&!document.hidden&&!drag){clock+=dt*flow*.018;waveClock+=dt;}if(document.hidden){requestAnimationFrame(frame);return;}
 if(screenMode==='wave'&&(lastWave<0||waveClock-lastWave>1/18)){paintWaveLED(front,back,8192,256,waveClock);lastWave=waveClock;}
 if(screenMode==='classic'&&clock-lastColor>.002){paintRibbonColors(b,8192,256,clock*80);lastColor=clock;}
 const W=surface.width,H=surface.height,angle=tilt*Math.PI/180,distance=(w/h<1?14/(w/h):14)/size,focal=H/(2*Math.tan(Math.PI/12));
 function project(r,a,y){let x=Math.sin(a)*r,z=Math.cos(a)*r;const yy=y*Math.cos(roll)+x*Math.sin(roll);x=x*Math.cos(roll)-y*Math.sin(roll);const depth=distance-yy*Math.sin(angle)-z*Math.cos(angle),k=focal/depth;return{x:W/2+x*k,y:H/2-(yy*Math.cos(angle)-z*Math.sin(angle))*k,z:depth};}
 screen.setTransform(1,0,0,1,0,0);screen.clearRect(0,0,W,H);
 const N=256,patches=[];for(let i=0;i<N;i++){const a=i/N*Math.PI*2,mid=a+Math.PI/N,isFront=Math.cos(mid)>0,r=isFront?3.35:3.22;patches.push({i,a,r,isFront,depth:Math.cos(mid)});}patches.sort((a,b)=>a.depth-b.depth);
 for(const patch of patches){const {i,a,r,isFront}=patch,a1=a+Math.PI*2/N,pts=[project(r,a,.25),project(r,a1,.25),project(r,a1,-.25),project(r,a,-.25)];let u=isFront?i/N+clock:1-i/N-clock;u=((u%1)+1)%1;const dx=(isFront?1:-1)*8192/N;let sx=u*8192;if(sx+dx<0)sx=8192;if(sx+dx>8192)sx=0;const image=isFront?front:back;triangle(image,[[sx,0],[sx+dx,0],[sx+dx,256]],[pts[0],pts[1],pts[2]]);triangle(image,[[sx,0],[sx+dx,256],[sx,256]],[pts[0],pts[2],pts[3]]);}
 for(const y of [-.25,.25]){for(let i=0;i<N;i++){const a=i/N*Math.PI*2,a1=(i+1)/N*Math.PI*2,p=[project(3.35,a,y),project(3.35,a1,y),project(3.22,a1,y),project(3.22,a,y)];const brightness=65+Math.round(65*Math.pow(Math.max(0,Math.cos(a-.7)),8));screen.fillStyle=`rgb(${brightness},${brightness+5},${brightness+12})`;screen.beginPath();p.forEach((v,j)=>j?screen.lineTo(v.x,v.y):screen.moveTo(v.x,v.y));screen.closePath();screen.fill();}}
 ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);ctx.save();ctx.filter='blur(7px)';ctx.globalAlpha=glow*.6;ctx.drawImage(surface,0,0);ctx.restore();ctx.drawImage(surface,0,0);requestAnimationFrame(frame);}
 requestAnimationFrame(frame);
}
