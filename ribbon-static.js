const ns='http://www.w3.org/2000/svg';
const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 1200 720');svg.setAttribute('role','img');svg.setAttribute('aria-label','Static ring with pass the code lettering and color gradients');svg.style.cssText='position:fixed;inset:0;width:100%;height:100%;display:block';document.body.prepend(svg);
const defs=document.createElementNS(ns,'defs');svg.append(defs);
const element=(tag,attrs,parent=svg)=>{const node=document.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);parent.append(node);return node;};
const palette=['#efff35','#8dff00','#00e2fa','#1299ff','#ff00c8'];
const cx=600,cy=360,rx=490,ry=112,half=23;
const point=(angle,y=0)=>[cx+rx*Math.sin(angle),cy+ry*Math.cos(angle)+y];
const bandPath=(start,end)=>{const a=point(start,-half),b=point(end,-half),c=point(end,half),d=point(start,half);return `M${a}A${rx},${ry} 0 0 0 ${b}L${c}A${rx},${ry} 0 0 1 ${d}Z`;};
// Rear and front are flat illustrated bands, with no lighting, surface texture or motion.
function band(start,end,colorIndex){const a=point(start),b=point(end);const id='color-'+colorIndex+'-'+Math.round(start*100);const gradient=element('linearGradient',{id,gradientUnits:'userSpaceOnUse',x1:Math.min(a[0],b[0]),x2:Math.max(a[0],b[0]),y1:0,y2:0},defs);element('stop',{offset:'0%','stop-color':palette[colorIndex%5]},gradient);element('stop',{offset:'100%','stop-color':'#f4f3f3'},gradient);element('path',{d:bandPath(start,end),fill:`url(#${id})`});}
for(let i=0;i<6;i++)band(Math.PI/2+i*Math.PI/6,Math.PI/2+(i+1)*Math.PI/6,i+2);
const frontGroup=element('g',{});
element('path',{d:bandPath(-Math.PI/2,Math.PI/2),fill:'#f4f3f3'},frontGroup);
const textClip=element('clipPath',{id:'front-text-clip'},defs);element('path',{d:bandPath(-Math.PI/2,Math.PI/2)},textClip);
const textLayer=element('g',{'clip-path':'url(#front-text-clip)'});
for(let i=0;i<6;i++){
 const start=-Math.PI/2+i*Math.PI/6,end=start+Math.PI/6;band(start,end,i);
 const center=(start+end)/2,p=point(center,8),tangent=Math.atan2(-ry*Math.sin(center),rx*Math.cos(center))*180/Math.PI;
 const group=element('g',{transform:`translate(${p[0]} ${p[1]}) rotate(${tangent}) scale(${.48+.52*Math.cos(center)} 1)`},textLayer);
 const text=element('text',{'text-anchor':'middle',fill:'#111','font-family':'Inter,Arial,sans-serif','font-size':'29','letter-spacing':'-1.4'},group);
 const glyphs=[['p',900],['a',800],['s',700],['s',700],[' ',600],['t',600],['h',500],['e',400],[' ',400],['c',400],['o',300],['d',200],['e',100]];
 glyphs.forEach(([letter,weight])=>{const span=element('tspan',{'font-weight':weight},text);span.textContent=letter;});
}

svg.append(textLayer);
