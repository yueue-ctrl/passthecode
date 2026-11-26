import * as THREE from './assets/vendor/three.module.js';
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x000000);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
document.body.prepend(renderer.domElement);
const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(32,1,.1,100);
camera.position.set(0,2.8,10.5);camera.lookAt(0,0,0);
// White photographic strips and restrained cool reflections in a dark jewelry studio.
const studio=new THREE.Scene();studio.background=new THREE.Color(.025,.025,.03);
function panel(w,h,p,color,intensity){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(intensity),side:THREE.DoubleSide}));mesh.position.set(...p);mesh.lookAt(0,0,0);studio.add(mesh);}
panel(2,9,[-4,3,4],'#ffffff',7);panel(.5,8,[4,2,3],'#d8e9ff',10);panel(7,1,[0,5,-2],'#ffffff',5);panel(1.5,6,[3,1,-4],'#fff0e5',6);panel(3,5,[-5,0,-1],'#759bdb',1.5);panel(1,4,[0,-4,2],'#ffffff',3);
const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(studio,.035).texture;pmrem.dispose();
scene.add(new THREE.HemisphereLight('#ffffff','#161b25',.3));
const key=new THREE.DirectionalLight('#ffffff',2.5);key.position.set(-4,6,5);scene.add(key);
const rim=new THREE.DirectionalLight('#c9deff',2);rim.position.set(5,1,-3);scene.add(rim);
const silver=new THREE.MeshPhysicalMaterial({color:'#d8dce4',metalness:1,roughness:.14,clearcoat:1,clearcoatRoughness:.1,envMapIntensity:1.3,iridescence:.12,iridescenceIOR:1.35,iridescenceThicknessRange:[100,330]});
await document.fonts.load('500 60px Inter');
const colorCanvas=document.createElement('canvas');colorCanvas.width=4096;colorCanvas.height=256;
const ctx=colorCanvas.getContext('2d');ctx.fillStyle='#d8dce4';ctx.fillRect(0,0,4096,256);
const letters=[['p',900],['a',800],['s',700],['s',700],[' ',400],['t',600],['h',500],['e',400],[' ',400],['c',400],['o',300],['d',200],['e',100]];
const size=135;const widths=letters.map(([c,w])=>{ctx.font=`${w} ${size}px Inter`;return ctx.measureText(c).width;});
let x=(4096-widths.reduce((a,b)=>a+b,0))/2;ctx.fillStyle='#08090b';ctx.textBaseline='middle';letters.forEach(([c,w],i)=>{ctx.font=`${w} ${size}px Inter`;ctx.fillText(c,x,137);x+=widths[i];});
const colorMap=new THREE.CanvasTexture(colorCanvas);colorMap.colorSpace=THREE.SRGBColorSpace;colorMap.anisotropy=8;
// A beveled normal relief makes the dark lettering read as incised into the metal.
const normalCanvas=document.createElement('canvas');normalCanvas.width=4096;normalCanvas.height=256;
const nc=normalCanvas.getContext('2d'),source=ctx.getImageData(0,0,4096,256),out=nc.createImageData(4096,256);
function height(x,y){const k=(Math.max(0,Math.min(255,y))*4096+((x+4096)%4096))*4;return source.data[k]/255;}
for(let y=0;y<256;y++)for(let x=0;x<4096;x++){const dx=(height(x+1,y)-height(x-1,y))*2.4,dy=(height(x,y+1)-height(x,y-1))*2.4,n=new THREE.Vector3(-dx,dy,1).normalize(),k=(y*4096+x)*4;out.data[k]=(n.x*.5+.5)*255;out.data[k+1]=(n.y*.5+.5)*255;out.data[k+2]=(n.z*.5+.5)*255;out.data[k+3]=255;}
nc.putImageData(out,0,0);const normalMap=new THREE.CanvasTexture(normalCanvas);normalMap.anisotropy=8;
const engraved=silver.clone();engraved.map=colorMap;engraved.normalMap=normalMap;engraved.normalScale.set(.7,.7);
engraved.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
float ink=1.0-smoothstep(.015,.35,max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b)));`).replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>
material.specularColor*=1.0-ink*.96;material.clearcoat*=1.0-ink;material.roughness=mix(material.roughness,.72,ink);`);};
// Closed band with rounded edges and a real inner surface, not a flat image.
const profile=[],rInner=1.97,rOuter=2.16,half=.36,bevel=.055;
for(const [cx,cy,start] of [[rOuter-bevel,half-bevel,0],[rInner+bevel,half-bevel,Math.PI/2],[rInner+bevel,-half+bevel,Math.PI],[rOuter-bevel,-half+bevel,Math.PI*1.5]])for(let j=0;j<=12;j++){const a=start+j/12*Math.PI/2;profile.push(new THREE.Vector2(cx+Math.cos(a)*bevel,cy+Math.sin(a)*bevel));}
profile.push(profile[0].clone());
const geometry=new THREE.LatheGeometry(profile,256),pos=geometry.attributes.position,normals=geometry.attributes.normal,uv=geometry.attributes.uv;
for(let i=0;i<pos.count;i++)uv.setY(i,(pos.getY(i)+half)/(2*half));
const indices=geometry.index.array;geometry.clearGroups();
let groupStart=0,last=-1;
for(let i=0;i<indices.length;i+=3){let outward=0;for(let j=0;j<3;j++){const v=indices[i+j],r=Math.hypot(pos.getX(v),pos.getZ(v));outward+=(normals.getX(v)*pos.getX(v)+normals.getZ(v)*pos.getZ(v))/r;}const m=outward>1.8?1:0;if(m!==last){if(last!==-1)geometry.addGroup(groupStart,i-groupStart,last);groupStart=i;last=m;}}
geometry.addGroup(groupStart,indices.length-groupStart,last);
const ring=new THREE.Group(),band=new THREE.Mesh(geometry,[silver,engraved]);ring.add(band);band.rotation.y=Math.PI;scene.add(ring);ring.rotation.z=-.32;
// Small, angular glints appear on the moving rim when it catches a light.
const glintCanvas=document.createElement('canvas');glintCanvas.width=glintCanvas.height=128;const gc=glintCanvas.getContext('2d');
const halo=gc.createRadialGradient(64,64,0,64,64,62);halo.addColorStop(0,'#fff');halo.addColorStop(.08,'#ffffffef');halo.addColorStop(.25,'#d7e6ff55');halo.addColorStop(1,'#ffffff00');gc.fillStyle=halo;gc.fillRect(0,0,128,128);
for(let i=0;i<4;i++){gc.save();gc.translate(64,64);gc.rotate(i*Math.PI/4);const g=gc.createLinearGradient(-62,0,62,0);g.addColorStop(0,'#ffffff00');g.addColorStop(.5,'#ffffff');g.addColorStop(1,'#ffffff00');gc.fillStyle=g;gc.beginPath();gc.moveTo(-62,0);gc.lineTo(0,-1.3);gc.lineTo(62,0);gc.lineTo(0,1.3);gc.fill();gc.restore();}
const sparkMap=new THREE.CanvasTexture(glintCanvas);const glints=Array.from({length:12},(_,i)=>{const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:sparkMap,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0}));const a=i/12*Math.PI*2;sprite.position.set(Math.sin(a)*2.16,i%2?half:-half,Math.cos(a)*2.16);sprite.scale.setScalar(.6);ring.add(sprite);return sprite;});
let playing=true,speed=.65,glintStrength=.85,time=0,previous,drag;
document.querySelector('#play').onclick=e=>{playing=!playing;e.currentTarget.textContent=playing?'Pause':'Play';};document.querySelector('#speed').oninput=e=>speed=e.target.value/100;document.querySelector('#glints').oninput=e=>glintStrength=e.target.value/100;
renderer.domElement.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId);};renderer.domElement.onpointermove=e=>{if(!drag)return;ring.rotation.y+=(e.clientX-drag.x)*.008;ring.rotation.x+=(e.clientY-drag.y)*.008;drag={x:e.clientX,y:e.clientY};};renderer.domElement.onpointerup=renderer.domElement.onpointercancel=()=>drag=null;
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.position.set(0,2.8,camera.aspect<1?14:10.5);camera.lookAt(0,0,0);camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();
const world=new THREE.Vector3(),direction=new THREE.Vector3();
function frame(now){const dt=previous===undefined?0:Math.min(.06,(now-previous)/1000);previous=now;if(playing&&!document.hidden&&!drag){time+=dt*speed;ring.rotation.y+=dt*speed*.38;ring.rotation.x=.16*Math.sin(time*.48);ring.rotation.z=-.32+.09*Math.sin(time*.32);}ring.updateMatrixWorld();glints.forEach((sprite,i)=>{sprite.getWorldPosition(world);direction.copy(world).normalize();const facing=Math.max(0,direction.dot(new THREE.Vector3(-.4,.7,.6).normalize()));const pulse=Math.pow(Math.max(0,Math.sin(time*2.3+i*2.1)),20);sprite.material.opacity=Math.min(1,pulse*(.35+facing)*glintStrength*2.2);sprite.scale.setScalar(.45+pulse*.55);sprite.material.rotation=.18*Math.sin(time+i);});renderer.render(scene,camera);requestAnimationFrame(frame);}requestAnimationFrame(frame);
