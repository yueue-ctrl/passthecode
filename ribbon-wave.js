const palette=['#efff35','#8dff00','#00e2fa','#1299ff','#ff00c8'];
const letters=[['p',900],['a',800],['s',700],['s',700],[' ',600],['t',600],['h',500],['e',400],[' ',400],['c',400],['o',300],['d',200],['e',100]];
export function paintWaveLED(front,back,width,height,time,strength=1){
 const f=front.getContext('2d'),b=back.getContext('2d');
 for(const c of [f,b]){c.setTransform(1,0,0,1,0,0);c.fillStyle='#f4f3f3';c.fillRect(0,0,width,height);}
 const count=12,slot=width/count,font=height*.56;
 for(let i=0;i<count;i++){
  const wave=(1+Math.sin(time*2.1-i*.68))/2;
  const energy=Math.min(1,.26+wave*.7*strength),x=i*slot,span=slot*.94;
  const colorPosition=time*.12+i*.62;
  const step=Math.floor(colorPosition)%5,color=palette[step];
  const fraction=colorPosition%1;
  const handoff=Math.min(1,fraction/.12,(1-fraction)/.12);
  const opacity=(.48+energy*.52)*handoff;
  for(const c of [f,b]){const g=c.createLinearGradient(x,0,x+span,0);g.addColorStop(0,color);g.addColorStop(.35,color+'ad');g.addColorStop(1,'#f4f3f3');c.save();c.globalAlpha=opacity;c.fillStyle=g;c.fillRect(x,0,span,height);c.restore();}
  const exponent=Math.exp(Math.sin(time*1.2-i*.45)*.75*strength);
  const glyphs=letters.map(([character,base])=>{const progress=(base-100)/800;const weight=100+800*Math.pow(progress,exponent)*(.55+energy*.45);f.font=`${weight} ${font}px Inter`;return{character,weight,width:f.measureText(character).width-font*.04};});
  const natural=glyphs.reduce((sum,g)=>sum+g.width,0),scale=span/natural;
  f.save();f.translate(x,0);f.scale(scale,1);f.fillStyle='#08090a';f.textBaseline='middle';let cursor=0;
  for(const glyph of glyphs){f.font=`${glyph.weight} ${font}px Inter`;f.fillText(glyph.character,cursor,height*.53);cursor+=glyph.width;}
  f.restore();
 }
}
