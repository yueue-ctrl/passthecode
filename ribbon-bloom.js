import * as THREE from './assets/vendor/three.module.js';
export function createRibbonBloom(renderer) {
  const target = () => new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
  const sceneTarget=target();sceneTarget.depthBuffer=true;
  const bright=target(),a=target(),b=target();
  const screen=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const vertexShader='varying vec2 texUV; void main(){texUV=uv;gl_Position=vec4(position.xy,0.,1.);}';
  const make=(uniforms,fragmentShader)=>new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader,depthWrite:false,depthTest:false,toneMapped:false});
  const extract=make({source:{value:null}},`uniform sampler2D source;varying vec2 texUV;void main(){vec3 c=texture2D(source,texUV).rgb;float l=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*smoothstep(.7,1.5,l),1.);}`);
  const blur=make({source:{value:null},stepUV:{value:new THREE.Vector2()}},`uniform sampler2D source;uniform vec2 stepUV;varying vec2 texUV;void main(){vec3 c=texture2D(source,texUV).rgb*.227027;c+=(texture2D(source,texUV+stepUV*1.384615).rgb+texture2D(source,texUV-stepUV*1.384615).rgb)*.316216;c+=(texture2D(source,texUV+stepUV*3.230769).rgb+texture2D(source,texUV-stepUV*3.230769).rgb)*.070270;gl_FragColor=vec4(c,1.);}`);
  const combine=make({source:{value:sceneTarget.texture},halo:{value:b.texture},strength:{value:.25},pixelSize:{value:new THREE.Vector2(1,1)}},`uniform sampler2D source,halo;uniform float strength;uniform vec2 pixelSize;varying vec2 texUV;
void main(){
 vec3 crisp=texture2D(source,texUV).rgb;
 float side=smoothstep(.32,.46,abs(texUV.x-.5));
 vec3 soft=vec3(0.0);
 for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)soft+=texture2D(source,texUV+vec2(float(x),float(y))*pixelSize*2.0).rgb/9.0;
 vec3 base=mix(crisp,soft,side*.65);
 float inkProtection=smoothstep(.025,.5,max(base.r,max(base.g,base.b)));
 vec3 c=base+texture2D(halo,texUV).rgb*strength*inkProtection;
 float luminance=dot(c,vec3(.2126,.7152,.0722));
 c=max(vec3(0.0),mix(vec3(luminance),c,1.16));
 gl_FragColor=vec4(c/(1.+c*.26),1.);
 #include <colorspace_fragment>
}`.replace(';#include',';\n#include'));
  const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),extract);screen.add(quad);
  function pass(material,destination){quad.material=material;renderer.setRenderTarget(destination);renderer.render(screen,camera);}
  return {
    strength:combine.uniforms.strength,
    resize(w,h){combine.uniforms.pixelSize.value.set(1/w,1/h);const dpr=renderer.getPixelRatio();sceneTarget.setSize(Math.round(w*dpr),Math.round(h*dpr));for(const t of [bright,a,b])t.setSize(Math.max(1,Math.round(w/3)),Math.max(1,Math.round(h/3)));},
    render(scene,camera3d){renderer.setRenderTarget(sceneTarget);renderer.render(scene,camera3d);extract.uniforms.source.value=sceneTarget.texture;pass(extract,bright);let source=bright.texture;for(let i=0;i<2;i++){blur.uniforms.source.value=source;blur.uniforms.stepUV.value.set((.6+i*.6)/a.width,0);pass(blur,a);blur.uniforms.source.value=a.texture;blur.uniforms.stepUV.value.set(0,(.6+i*.6)/b.height);pass(blur,b);source=b.texture;}pass(combine,null);}
  };
}
