export type Point={x:number;y:number};
export type Size={width:number;height:number};
export type ImageView=Point&{scale:number};
const finite=(v:number,fallback=0)=>Number.isFinite(v)?v:fallback;
const zoom=(v:number)=>Math.max(1,Math.min(4,finite(v,1)));
export function panBounds(scale:number,box:Size,photo:Size):Point{
 if(box.width<=0||box.height<=0||photo.width<=0||photo.height<=0)return{x:0,y:0};
 const fit=Math.min(box.width/photo.width,box.height/photo.height);
 return{x:Math.max(0,(photo.width*fit*zoom(scale)-box.width)/2),y:Math.max(0,(photo.height*fit*zoom(scale)-box.height)/2)};
}
function bounded(view:ImageView,box:Size,photo:Size,resist:boolean,carry:Point):ImageView{
 const scale=zoom(view.scale),bounds=panBounds(scale,box,photo);
 function axis(value:number,limit:number,carried:number){
  value=finite(value);const edge=Math.max(-limit,Math.min(limit,value)),overflow=value-edge;
  if(!resist||!overflow)return edge;
  const direction=Math.sign(overflow),existing=Math.max(0,carried*direction),extra=Math.max(0,Math.abs(overflow)-existing);
  // Asymptotic resistance responds to every reversal; no flat hard-cap dead zone.
  const rubber=extra*.18/(1+extra*.18/60);
  return edge+direction*(Math.min(Math.abs(overflow),existing)+rubber);
 }
 return{x:axis(view.x,bounds.x,carry.x),y:axis(view.y,bounds.y,carry.y),scale};
}
export function clampView(view:ImageView,box:Size,photo:Size,resist=false):ImageView{return bounded(view,box,photo,resist,{x:0,y:0});}
export function dragView(start:ImageView,delta:Point,box:Size,photo:Size):ImageView{
 const fit=clampView(start,box,photo);
 return bounded({...start,x:start.x+delta.x,y:start.y+delta.y},box,photo,true,{x:start.x-fit.x,y:start.y-fit.y});
}
export function zoomView(view:ImageView,next:number,anchor:Point,box:Size,photo:Size):ImageView{
 const scale=zoom(next),ratio=scale/zoom(view.scale);
 return clampView({scale,x:anchor.x-(anchor.x-view.x)*ratio,y:anchor.y-(anchor.y-view.y)*ratio},box,photo);
}
export function pinchView(view:ImageView,ratio:number,from:Point,to:Point,box:Size,photo:Size):ImageView{
 const scale=zoom(view.scale*finite(ratio,1)),actual=scale/zoom(view.scale),fit=clampView(view,box,photo);
 return bounded({scale,x:to.x-(from.x-view.x)*actual,y:to.y-(from.y-view.y)*actual},box,photo,true,{x:(view.x-fit.x)*actual,y:(view.y-fit.y)*actual});
}
