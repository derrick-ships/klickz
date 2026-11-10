// Prompt-only checks that the studio shows under the prompt field instead of the top error banner.
// The same wording and thresholds as the checks inside submit(), which remain as a backstop.
export type PromptValidationInput={tool:"recreate"|"generate"|"analyze"|"edit"|"title";titleAction:"image"|"ideas";prompt:string;title:string};
export function promptValidationError({tool,titleAction,prompt,title}:PromptValidationInput):string|null{
 if(tool==="analyze"||(tool==="title"&&titleAction==="ideas"))return null;
 if(tool==="title")return !title.trim()&&!prompt.trim()?"Add a video title or direction before generating.":null;
 return prompt.trim().length<8?"Describe your thumbnail in at least eight characters.":null;
}
