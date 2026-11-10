import {describe,expect,it} from "vitest";
import {forgetPendingRequest,rememberPendingRequest} from "../src/lib/pending-requests";

describe("pending analysis request ids",()=>{
 it("keeps a failed image id after a later image in the same batch succeeds",()=>{
  const pending=new Map<string,string>();
  let n=0;
  const next=()=>"req-"+(++n);
  const first=rememberPendingRequest(pending,"image-a","fp-a",next);
  const second=rememberPendingRequest(pending,"image-b","fp-b",next);
  expect(first).toBe("req-1");
  expect(second).toBe("req-2");
  expect(rememberPendingRequest(pending,"image-a","fp-a",next)).toBe("req-1");
  forgetPendingRequest(pending,"image-b","fp-b");
  expect(rememberPendingRequest(pending,"image-a","fp-a",next)).toBe("req-1");
  forgetPendingRequest(pending,"image-a","fp-a");
  expect(rememberPendingRequest(pending,"image-a","fp-a",next)).toBe("req-3");
 });
});
