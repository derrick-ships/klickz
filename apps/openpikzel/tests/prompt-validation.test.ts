import {describe,expect,it} from "vitest";
import {promptValidationError} from "../src/lib/prompt-validation";
// OP-3 fix: prompt-only validation is shown under the field, so it needs one pure source of truth.
describe("promptValidationError",()=>{
 it("asks for eight characters when the direction is empty or short",()=>{
  for(const tool of ["generate","recreate","edit"] as const){
   expect(promptValidationError({tool,titleAction:"image",prompt:"",title:""})).toBe("Describe your thumbnail in at least eight characters.");
   expect(promptValidationError({tool,titleAction:"image",prompt:"  short  ",title:""})).toBe("Describe your thumbnail in at least eight characters.");
  }
 });
 it("accepts eight trimmed characters",()=>{
  expect(promptValidationError({tool:"generate",titleAction:"image",prompt:"  12345678 ",title:""})).toBeNull();
 });
 it("title mode needs a title or a direction, and either one is enough",()=>{
  expect(promptValidationError({tool:"title",titleAction:"image",prompt:" ",title:" "})).toBe("Add a video title or direction before generating.");
  expect(promptValidationError({tool:"title",titleAction:"image",prompt:"",title:"My video"})).toBeNull();
  expect(promptValidationError({tool:"title",titleAction:"image",prompt:"cat",title:""})).toBeNull();
 });
 it("never blocks analysis or title ideas, which keep their own checks",()=>{
  expect(promptValidationError({tool:"analyze",titleAction:"image",prompt:"",title:""})).toBeNull();
  expect(promptValidationError({tool:"title",titleAction:"ideas",prompt:"",title:""})).toBeNull();
 });
});
