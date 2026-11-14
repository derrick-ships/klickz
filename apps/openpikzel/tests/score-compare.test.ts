import {describe,it,expect} from "vitest";
import {compareScore} from "../src/lib/score-compare";

describe("before and after score labels",()=>{
 it("shows a signed rise in words and visible text",()=>{
  expect(compareScore(62,78,{name:"Clarity",empty:"Not assessed"})).toEqual({
   visible:"62 → 78 (+16)",
   spoken:"Clarity up 16, from 62 to 78",
  });
 });
 it("shows a signed fall in words and visible text",()=>{
  expect(compareScore(78,62,{name:"Idea",empty:"Not assessed"})).toEqual({
   visible:"78 → 62 (-16)",
   spoken:"Idea down 16, from 78 to 62",
  });
 });
 it("has no signed delta when the score is unchanged",()=>{
  expect(compareScore(60,60,{name:"Emotion",empty:"Not assessed"})).toEqual({
   visible:"60 → 60",
   spoken:"Emotion unchanged, at 60",
  });
 });
 it("has no delta when the new side is not assessed",()=>{
  expect(compareScore(62,null,{name:"Curiosity",empty:"Not assessed"})).toEqual({
   visible:"62 → Not assessed",
   spoken:"Curiosity not assessed, previously 62",
  });
 });
 it("has no delta when the previous side is not assessed",()=>{
  expect(compareScore(null,78,{name:"Curiosity",empty:"Not assessed"})).toEqual({
   visible:"Not assessed → 78",
   spoken:"Curiosity 78, previously not assessed",
  });
 });
 it("has no delta when both sides are null",()=>{
  expect(compareScore(null,null,{name:"Score",empty:"Partial"})).toEqual({
   visible:"Partial",
   spoken:"Partial",
  });
  expect(compareScore(null,null,{name:"Clarity",empty:"Not assessed"})).toEqual({
   visible:"Not assessed",
   spoken:"Clarity not assessed",
  });
 });
});
