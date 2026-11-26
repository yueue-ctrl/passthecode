import { paintWaveLED } from './ribbon-wave.js';
import { paintRibbonColors } from './ribbon-colors.js';
import { createRibbonBloom } from './ribbon-bloom.js?v=sharp-premium-led';
import * as THREE from './assets/vendor/three.module.js';
let renderer, gpuLost=false;
try { renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'default'}); }
catch(error) { const fallback=await import('./ribbon-fallback.js?v=wave-led-motion');await fallback.startRibbonFallback(); }
function showRenderError(message){
 let notice=document.querySelector('#render-error');
 if(!notice){notice=document.createElement('div');notice.id='render-error';notice.style.cssText='position:fixed;inset:0;display:grid;place-content:center;gap:20px;padding:32px;text-align:center;color:#ddd;background:#000;font:14px Inter,Arial,sans-serif;z-index:10';document.body.append(notice);}
 notice.replaceChildren(document.createTextNode(message));const retry=document.createElement('button');retry.textContent='Reload display';retry.style.cssText='padding:12px 20px;color:#eee;background:#222;border:1px solid #555;border-radius:6px;cursor:pointer';retry.onclick=()=>location.reload();notice.append(retry);
}
if(renderer){
renderer.setPixelRatio(Math.min(1.5,Math.sqrt(2000000/(innerWidth*innerHeight))));renderer.setClearColor('#000000');renderer.outputColorSpace=THREE.SRGBColorSpace;document.body.prepend(renderer.domElement);
renderer.domElement.dataset.renderMode='webgl';
renderer.domElement.addEventListener('webglcontextlost',async event=>{event.preventDefault();gpuLost=true;const fallback=await import('./ribbon-fallback.js?v=wave-led-motion');await fallback.startRibbonFallback();});
const bloom=createRibbonBloom(renderer);bloom.strength.value=.32;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(30,1,.1,100);
scene.add(new THREE.HemisphereLight('#ffffff','#e4e1df',2.5));const key=new THREE.DirectionalLight('#ffffff',1.5);key.position.set(-3,6,5);scene.add(key);
const words=Array(12).fill('code');
const colors=['#efff35','#8dff00','#00e2fa','#1299ff','#ff00c8'];
await document.fonts.load('400 100px Inter');
const strip=document.createElement('canvas');strip.width=8192;strip.height=256;const ctx=strip.getContext('2d');ctx.fillStyle='#030407';ctx.fillRect(0,0,strip.width,strip.height);
// One unified gradient and one descending weight ramp for every complete phrase.
const fontSize=132,gap=70;
const phrases=words.map(word=>{const chars=[...`pass the ${word}`],weights=chars.map((_,i)=>900-800*i/(chars.length-1));const widths=chars.map((c,i)=>{ctx.font=`${weights[i]} ${fontSize}px Inter`;return ctx.measureText(c).width-5;});return{chars,weights,widths,width:widths.reduce((a,b)=>a+b,0)};});
const total=phrases.reduce((n,p)=>n+p.width+gap,0),factor=8192/total;ctx.scale(factor,1);
let left=0;phrases.forEach((phrase,index)=>{ctx.fillStyle='#ffffff';ctx.textBaseline='middle';let x=left;phrase.chars.forEach((c,i)=>{ctx.font=`${phrase.weights[i]} ${fontSize}px Inter`;ctx.fillText(c,x,136);x+=phrase.widths[i];});left+=phrase.width+gap;});
const outerMap=new THREE.CanvasTexture(strip);outerMap.colorSpace=THREE.SRGBColorSpace;outerMap.wrapS=THREE.RepeatWrapping;outerMap.anisotropy=16;
const innerStrip=document.createElement('canvas');innerStrip.width=8192;innerStrip.height=256;
const innerContext=innerStrip.getContext('2d');
innerContext.fillStyle='#f4f3f3';innerContext.fillRect(0,0,8192,256);innerContext.scale(factor,1);
paintRibbonColors(innerContext,8192,256,0);
// A slight diffusion softens each colored leading edge, matching the original ribbon.
const softInner=document.createElement('canvas');softInner.width=8192;softInner.height=256;
const softContext=softInner.getContext('2d');softContext.fillStyle='#f4f3f3';softContext.fillRect(0,0,8192,256);
softContext.filter='blur(8px)';softContext.drawImage(innerStrip,0,0);
const innerMap=new THREE.CanvasTexture(softInner);innerMap.colorSpace=THREE.SRGBColorSpace;innerMap.wrapS=THREE.RepeatWrapping;innerMap.anisotropy=16;innerMap.repeat.x=-1;
const radius=3.35,height=.5,thickness=.13;
const loop=new THREE.Group();scene.add(loop);
const reflectionUniforms={ribbonReflection:{value:innerMap},ribbonFlow:{value:0},ledTime:{value:0},waveScreen:{value:1}};
const frontMaterial=new THREE.MeshBasicMaterial({map:outerMap,color:new THREE.Color(1.65,1.65,1.65),side:THREE.FrontSide});
frontMaterial.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,reflectionUniforms);
  shader.fragmentShader='uniform sampler2D ribbonReflection; uniform float ribbonFlow; uniform float ledTime; uniform float waveScreen;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>', `
    #include <map_fragment>
    // Sample all screen content once at each fixed LED cell, including the letter edges.
    vec2 ledDensity=vec2(2356.0,56.0);
    vec2 panelUV=vec2(vMapUv.x-ribbonFlow,vMapUv.y);
    vec2 ledSample=(floor(panelUV*ledDensity)+0.5)/ledDensity+vec2(ribbonFlow,0.0);
    vec2 footprintContent=fwidth(panelUV*ledDensity);
    float resolved=1.0-smoothstep(.65,1.3,max(footprintContent.x,footprintContent.y));
    // Keep fine strokes intact when LEDs project below a screen pixel.
    vec3 continuous=textureGrad(map,vMapUv,dFdx(vMapUv),dFdy(vMapUv)).rgb;
    vec3 sampled=textureGrad(map,ledSample,dFdx(vMapUv),dFdy(vMapUv)).rgb;
    vec3 ledContent=mix(continuous,sampled,resolved*.75);
    diffuseColor.rgb=diffuse*smoothstep(vec3(0.035),vec3(0.9),ledContent);
    // Broad colored bounce from the inner ribbon, without per-phrase background blocks.
    vec3 reflectedColor=vec3(0.0);
    for(int tap=-4;tap<=4;tap++){
      float u=fract(1.0-vMapUv.x-ribbonFlow+float(tap)*0.024);
      reflectedColor+=texture2D(ribbonReflection,vec2(u,0.5)).rgb/9.0;
    }
    float paper= 1.0-smoothstep(0.05,0.4,max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b)));
    float spill=(0.22+0.33*smoothstep(0.05,0.95,vMapUv.y))*paper*(1.0-waveScreen);
    diffuseColor.rgb*=mix(vec3(1.0),reflectedColor,spill);
  `).replace('#include <opaque_fragment>', `
    vec2 cell=vec2((vMapUv.x-ribbonFlow)*2356.0,vMapUv.y*56.0);
    vec2 footprint=fwidth(cell);
    float visibility=1.0-smoothstep(.7,1.5,max(footprint.x,footprint.y));
    vec2 square=abs(fract(cell)-0.5);
    float diode=1.0-smoothstep(.43,.5,max(square.x,square.y));
    outgoingLight*=mix(1.0,0.84+0.16*diode,visibility);
    float subpixel=fract(cell.x*3.0);
    vec3 rgb=mix(vec3(1.1,.96,.96),mix(vec3(.96,1.1,.96),vec3(.96,.96,1.1),step(.666,subpixel)),step(.333,subpixel));
    outgoingLight*=mix(vec3(1.0),rgb,visibility*.06);
    outgoingLight*=mix(vec3(1.0),mix(vec3(1.0),reflectedColor,0.2),visibility*diode*paper);
    outgoingLight*=0.995+0.005*sin(vMapUv.y*180.0+ledTime*1.4);
    #include <opaque_fragment>
  `);
};
const outside=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,384,1,true),frontMaterial);loop.add(outside);
const inside=new THREE.Mesh(new THREE.CylinderGeometry(radius-thickness,radius-thickness,height,384,1,true),new THREE.MeshBasicMaterial({map:innerMap,color:new THREE.Color(2.15,2.15,2.15),side:THREE.BackSide}));loop.add(inside);
inside.material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,reflectionUniforms);
  shader.fragmentShader='uniform float ribbonFlow;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>', `
    #include <map_fragment>
    vec2 density=vec2(2356.0,56.0);
    vec2 fixedUV=vec2(vMapUv.x+ribbonFlow,vMapUv.y);
    vec2 sampleUV=(floor(fixedUV*density)+0.5)/density-vec2(ribbonFlow,0.0);
    diffuseColor.rgb=diffuse*texture2D(map,sampleUV).rgb;
  `).replace('#include <opaque_fragment>', `
    vec2 cell=vec2(vMapUv.x*2356.0,vMapUv.y*56.0);
    float visibility=1.0-smoothstep(.7,1.5,max(fwidth(cell.x),fwidth(cell.y)));
    vec2 square=abs(fract(cell)-0.5);
    float diode=1.0-smoothstep(.43,.5,max(square.x,square.y));
    outgoingLight*=mix(1.0,.84+.16*diode,visibility);
    #include <opaque_fragment>
  `);
};
// A real metal chassis gives the emitting panels depth and a connection to the ring.
const studio=new THREE.Scene();studio.background=new THREE.Color(.05,.055,.065);
for(const [position,color,power,width] of [ [[-4,4,4],'#ffffff',3,2],[[4,3,2],'#dce9ff',3,1],[[0,4,-3],'#ffffff',2.5,5],[[-3,0,-3],'#ff00c8',1.2,2],[[3,0,-3],'#00e2fa',1.2,2] ]){
 const panel=new THREE.Mesh(new THREE.PlaneGeometry(width,5),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(power),side:THREE.DoubleSide}));panel.position.set(...position);panel.lookAt(0,0,0);studio.add(panel);
}
const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(studio,.12).texture;pmrem.dispose();studio.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});
const edgeMaterial=new THREE.MeshStandardMaterial({color:'#747e8d',metalness:1,roughness:.24,envMapIntensity:.9});
for(const y of [-height/2,height/2]){const edge=new THREE.Mesh(new THREE.RingGeometry(radius-thickness,radius,384),edgeMaterial);edge.rotation.x=y>0?-Math.PI/2:Math.PI/2;edge.position.y=y;loop.add(edge);
 for(const r of [radius,radius-thickness]){const lip=new THREE.Mesh(new THREE.TorusGeometry(r,.012,8,384),edgeMaterial);lip.rotation.x=Math.PI/2;lip.position.y=y;loop.add(lip);}
}
document.querySelector('#glow').oninput=e=>{bloom.strength.value=e.target.value/100;};
const waveFront=document.createElement('canvas'),waveBack=document.createElement('canvas');
waveFront.width=waveBack.width=4096;waveFront.height=waveBack.height=128;
let screenMode='wave',waveClock=0,lastWave=-1;
document.querySelector('#screen-mode').onchange=event=>{screenMode=event.target.value;lastWave=-1;outerMap.image=screenMode==='wave'?waveFront:strip;innerMap.image=screenMode==='wave'?waveBack:softInner;outerMap.needsUpdate=innerMap.needsUpdate=true;reflectionUniforms.waveScreen.value=screenMode==='wave'?1:0;};
paintWaveLED(waveFront,waveBack,4096,128,0);outerMap.image=waveFront;innerMap.image=waveBack;outerMap.needsUpdate=innerMap.needsUpdate=true;
let playing=true,flow=.35,tilt=18,size=1,previous,clock=0,drag,lastColor=-1;
document.querySelector('#play').onclick=e=>{playing=!playing;e.currentTarget.textContent=playing?'Pause':'Play';};document.querySelector('#flow').oninput=e=>flow=e.target.value/100;document.querySelector('#tilt').oninput=e=>{tilt=Number(e.target.value);resize();};document.querySelector('#size').oninput=e=>{size=e.target.value/100;resize();};
function resize(){renderer.setPixelRatio(Math.min(1.5,Math.sqrt(2000000/(innerWidth*innerHeight))));renderer.setSize(innerWidth,innerHeight);bloom.resize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;const distance=(camera.aspect<1?14/camera.aspect:14)/size,angle=THREE.MathUtils.degToRad(tilt);camera.position.set(0,Math.sin(angle)*distance,Math.cos(angle)*distance);camera.lookAt(0,0,0);camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();
renderer.domElement.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId);};renderer.domElement.onpointermove=e=>{if(!drag)return;loop.rotation.z+=(e.clientX-drag.x)*.002;tilt=THREE.MathUtils.clamp(tilt+(e.clientY-drag.y)*.15,5,60);resize();drag={x:e.clientX,y:e.clientY};};renderer.domElement.onpointerup=renderer.domElement.onpointercancel=()=>drag=null;
function frame(now){if(gpuLost)return;if(document.hidden){previous=now;requestAnimationFrame(frame);return;}const delta=previous===undefined?0:Math.min(.06,(now-previous)/1000);previous=now;if(playing&&!document.hidden&&!drag){clock+=delta*flow*.018;waveClock+=delta;}if(screenMode==='wave'&&(lastWave<0||waveClock-lastWave>1/18)){paintWaveLED(waveFront,waveBack,4096,128,waveClock);outerMap.needsUpdate=innerMap.needsUpdate=true;lastWave=waveClock;}if(screenMode==='classic'&&clock-lastColor>.002){paintRibbonColors(innerContext,8192,256,clock*80);softContext.save();softContext.filter='blur(8px)';softContext.drawImage(innerStrip,0,0);softContext.restore();innerMap.needsUpdate=true;lastColor=clock;}outerMap.offset.x=clock;innerMap.offset.x=-clock;reflectionUniforms.ribbonFlow.value=clock;reflectionUniforms.ledTime.value=clock*40;bloom.render(scene,camera);requestAnimationFrame(frame);}requestAnimationFrame(frame);

}
