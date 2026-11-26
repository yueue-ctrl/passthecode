const palette=['#efff35','#8dff00','#00e2fa','#1299ff','#ff00c8'];
export function paintRibbonColors(context,width,height,time=0){
 context.save();context.setTransform(1,0,0,1,0,0);context.fillStyle='#17191f';context.fillRect(0,0,width,height);
 const lengths=Array.from({length:12},(_,i)=>.75+.35*Math.sin(time*.55+i*1.7)+.18*Math.cos(time*.31+i*.9));
 const total=lengths.reduce((a,b)=>a+b,0);let x=0;
 lengths.forEach((length,i)=>{const span=width*length/total,color=palette[i%palette.length];const g=context.createLinearGradient(x,0,x+span,0);g.addColorStop(0,color);g.addColorStop(.28+.15*Math.sin(time*.4+i),color);g.addColorStop(.76,color+'90');g.addColorStop(1,color+'30');context.fillStyle=g;context.fillRect(x,0,span+1,height);x+=span;});
 const shade=context.createLinearGradient(0,0,0,height);shade.addColorStop(0,'#ffffff18');shade.addColorStop(.4,'#ffffff00');shade.addColorStop(1,'#00000024');context.fillStyle=shade;context.fillRect(0,0,width,height);context.restore();
}
