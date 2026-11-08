import {describe,it,expect} from 'vitest';
import {clampView,zoomView,pinchView,dragView} from '@/lib/image-gestures';
const box={width:400,height:300},photo={width:1600,height:900};
describe('image content geometry',()=>{
 it('bounds pan using the actual letterboxed image rather than the outer frame',()=>{expect(clampView({x:999,y:-999,scale:2},box,photo)).toEqual({x:200,y:-75,scale:2});});
 it('keeps an off-center image point under the pointer when zooming',()=>{expect(zoomView({x:0,y:0,scale:1},2,{x:60,y:0},box,photo)).toEqual({x:-60,y:0,scale:2});});
 it('retains an existing pan while changing zoom at the same anchor',()=>{expect(zoomView({x:20,y:-10,scale:2},3,{x:60,y:20},box,photo)).toEqual({x:0,y:-25,scale:3});});
 it('follows the pinch midpoint as the two fingers translate and scale',()=>{expect(pinchView({x:0,y:0,scale:2},1.5,{x:0,y:0},{x:40,y:0},box,photo)).toEqual({x:40,y:0,scale:3});});
 it('fits without exposing empty edges after a resize or reset',()=>{expect(clampView({x:200,y:75,scale:1},box,photo)).toEqual({x:0,y:0,scale:1});expect(clampView({x:400,y:50,scale:2},{width:200,height:300},photo)).toEqual({x:100,y:0,scale:2});});
 it('bounds unsupported zoom and invalid geometry without NaN transforms',()=>{expect(clampView({x:Infinity,y:NaN,scale:NaN},{width:0,height:0},{width:0,height:0})).toEqual({x:0,y:0,scale:1});expect(zoomView({x:0,y:0,scale:1},20,{x:0,y:0},box,photo).scale).toBe(4);});
});
it('keeps the displayed image continuous when a resisted gesture is caught',()=>{
 const v={x:220,y:0,scale:2};expect(dragView(v,{x:0,y:0},box,photo).x).toBeCloseTo(220,6);
 expect(dragView(v,{x:1,y:0},box,photo).x).toBeGreaterThan(220);expect(dragView(v,{x:1,y:0},box,photo).x).toBeLessThan(221);
});
it('keeps an overscrolled pinch continuous at its starting midpoint',()=>{
 const v=clampView({x:500,y:0,scale:2},box,photo,true);
 expect(pinchView(v,1,{x:0,y:0},{x:0,y:0},box,photo).x).toBeCloseTo(v.x,6);
});
it('responds immediately when reversing a long outward drag',()=>{
 const far=clampView({x:500,y:0,scale:2},box,photo,true),reversed=clampView({x:400,y:0,scale:2},box,photo,true);
 expect(reversed.x).toBeLessThan(far.x);expect(far.x).toBeLessThan(500);
});
