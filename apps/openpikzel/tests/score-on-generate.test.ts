import {describe,expect,it} from "vitest";
import {
 deliveryCopy,
 missingVisionKeyMessage,
 reviewerName,
 scorePlan,
 scoreStatusCopy,
 scoreStatusFromEvaluation,
} from "../src/lib/score-on-generate";
import {pillars,type Evaluation} from "../src/lib/types";

describe("scorePlan",()=>{
 it("reviews when Jev is connected and prefers Claude for vision",()=>{
  expect(scorePlan({jev:true,anthropic:true,openai:true,google:true})).toEqual({review:true,includeVision:true,critiqueProvider:"anthropic"});
 });
 it("falls through OpenAI then Google, and skips vision when no vision key is connected",()=>{
  expect(scorePlan({jev:true,openai:true})).toEqual({review:true,includeVision:true,critiqueProvider:"openai"});
  expect(scorePlan({jev:true,google:true})).toEqual({review:true,includeVision:true,critiqueProvider:"google"});
  expect(scorePlan({jev:true})).toEqual({review:true,includeVision:false,critiqueProvider:null});
 });
 it("does not review when Jev is missing, even if a vision key is present",()=>{
  expect(scorePlan({jev:false,anthropic:true})).toEqual({review:false,includeVision:false,critiqueProvider:null});
  expect(scorePlan(null)).toEqual({review:false,includeVision:false,critiqueProvider:null});
 });
});

describe("vision key and reviewer names",()=>{
 it("names Claude first, then OpenAI and Google, in the missing-key error",()=>{
  expect(missingVisionKeyMessage("anthropic")).toBe("Connect your selected Claude API key for the extra image review.");
  expect(missingVisionKeyMessage("openai")).toBe("Connect your selected OpenAI API key for the extra image review.");
  expect(missingVisionKeyMessage("google")).toBe("Connect your selected Google API key for the extra image review.");
  expect(missingVisionKeyMessage()).toBe("Connect a Claude, OpenAI, or Google API key for the extra image review.");
 });
 it("shows Reviewed by Claude, not Anthropic, for the anthropic provider",()=>{
  expect(reviewerName("anthropic")).toBe("Claude");
  expect(reviewerName("openai")).toBe("OpenAI");
  expect(reviewerName("google")).toBe("Google");
 });
});

const scored=(extra:Partial<Evaluation>={})=>{
 const dimensions=Object.fromEntries(pillars.map(p=>[p,{score:60,confidence:.5,observation:"",strength:"",weakness:"",fix:""}]));
 return {source:"jev",version:3,title:"A title",overall:60,priority:"clarity",created_at:"2026-11-10T00:00:00Z",note:"",dimensions,vision:false,warnings:[],contributors:[{provider:"Jev",model:"jev-latest",role:"scoring"}],...extra} as Evaluation;
};

describe("score status copy for spec §4.3",()=>{
 it("shows Connect Jev when the key is missing",()=>{
  expect(scoreStatusCopy({kind:"no-jev"})).toMatchObject({title:"Connect scoring to see this image’s score",action:"connect"});
 });
 it("shows Score on the way while a review is pending after the hold",()=>{
  expect(scoreStatusCopy({kind:"pending"}).title).toBe("Score on the way");
 });
 it("shows Score did not finish with Retry score when Jev fails",()=>{
  expect(scoreStatusCopy({kind:"failed"})).toMatchObject({title:"Score did not finish",action:"retry"});
 });
 it("shows Score without image review when Jev scored with no vision key",()=>{
  expect(scoreStatusFromEvaluation(scored({vision:false}))).toEqual({kind:"scored",reviewer:null});
  expect(scoreStatusCopy({kind:"scored",reviewer:null}).title).toBe("Score without image review");
 });
 it("shows Image review did not finish when vision failed and Jev still scored",()=>{
  const score=scored({vision:false,warnings:["Image review did not finish"]});
  expect(scoreStatusFromEvaluation(score)).toEqual({kind:"scored",reviewer:null,visionFailed:true});
  expect(scoreStatusCopy({kind:"scored",reviewer:null,visionFailed:true}).title).toBe("Image review did not finish");
 });
 it("names the reviewer that actually ran, including Claude",()=>{
  const claude=scored({vision:true,contributors:[{provider:"Jev",model:"jev-latest",role:"scoring"},{provider:"Anthropic API",model:"claude-opus-5-5",role:"image-review"}]});
  expect(scoreStatusFromEvaluation(claude)).toEqual({kind:"scored",reviewer:"Claude"});
  expect(scoreStatusCopy({kind:"scored",reviewer:"Claude"}).title).toBe("Reviewed by Claude");
  expect(scoreStatusCopy({kind:"scored",reviewer:"OpenAI"}).title).toBe("Reviewed by OpenAI");
  expect(scoreStatusCopy({kind:"scored",reviewer:"Google"}).title).toBe("Reviewed by Google");
 });
});

describe("delivery labels for spec §4.3",()=>{
 it("uses Score on the way while reviews are still pending after the hold",()=>{
  expect(deliveryCopy({stage:"review-pending",reviewed:1,total:4}).label).toBe("Score on the way");
 });
 it("uses Score did not finish when every review has settled and at least one failed",()=>{
  expect(deliveryCopy({stage:"review-pending",reviewed:4,total:4}).label).toBe("Score did not finish");
 });
 it("points to Connect Jev when the image is ready without a review",()=>{
  expect(deliveryCopy({stage:"image-ready",reviewed:0,total:1}).detail).toBe("Connect scoring to see this image’s score");
 });
 it("keeps the existing failed generation copy",()=>{
  expect(deliveryCopy({stage:"failed",reviewed:0,total:0}).label).toBe("Generation did not finish.");
 });
});

import { needsImageReview } from "../src/lib/score-on-generate";
describe("needsImageReview", () => {
  it("only lets the fix review the image first when the score is complete and has a title", () => {
    const base = { fixBlocked: true, vision: false, partial: false, context: { title: "Real title" } };
    expect(needsImageReview(base)).toBe(true);
    expect(needsImageReview({ ...base, vision: true })).toBe(false);
    expect(needsImageReview({ ...base, partial: true })).toBe(false);
    expect(needsImageReview({ ...base, context: { title: "" } })).toBe(false);
    expect(needsImageReview({ ...base, fixBlocked: false })).toBe(false);
    expect(needsImageReview(null)).toBe(false);
  });
});
