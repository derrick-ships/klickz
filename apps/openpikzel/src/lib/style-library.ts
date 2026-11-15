// Pre-made style library, from Derrick's "Style OS" Notion database (Thumbnail type, entries
// with a category; uncategorised entries omitted). Images live in public/styles.
// A library style is sent as a style reference: its images guide treatment, its description the look.
export type LibraryStyle = { id: string; name: string; category: "documentary" | "review" | "entertainment" | "education"; description: string; images: string[]; source: string | null };
export const styleCategories = ["documentary", "review", "entertainment", "education"] as const;
export const styleLibrary: LibraryStyle[] = [
 {
  "id": "house-political-news",
  "name": "House: Political news",
  "category": "documentary",
  "description": "Documentary look with a teal-to-orange gradient and strong vignette, the real photo of the subject cut out and rim-lit on one side, two lines of ALL CAPS condensed text (yellow on top, white below) on the opposite side, red only on ¿ ?, a red play badge top-left, one faint context object, no date, no logo, no extra text.",
  "images": ["/styles/house-political-news-1.webp"],
  "source": null
 },
 {
  "id": "captured",
  "name": "Captured",
  "category": "documentary",
  "description": "Stark red and blue split color palette with grayscale figures, harsh digital lighting, central gender-neutral wireframe human subject with an expressionless face in a mugshot pose, flanked by similar figures with FBI patches; grungy background with binary code and height lines; intense, mysterious, and investigative mood.",
  "images": [
   "/styles/captured-1.webp"
  ],
  "source": null
 },
 {
  "id": "dramatic",
  "name": "Dramatic",
  "category": "documentary",
  "description": "High contrast color palette with intense oranges and dark charcoal grays. Dramatic backlighting from a massive mushroom cloud explosion. The faceless, wireframe subject is focused and typing intensely on a laptop. The background is a desolate, post-apocalyptic wasteland. Overall mood is ominous, urgent, and high-stakes.",
  "images": [
   "/styles/dramatic-1.webp"
  ],
  "source": "https://www.youtube.com/watch?v=laMFoT-NFvg"
 },
 {
  "id": "shocking-truth",
  "name": "Shocking truth",
  "category": "documentary",
  "description": "High-contrast color palette with intense orange fire glow and deep shadows. Dramatic backlighting highlighting the silhouette of a 3D wireframe character. The character is gesturing for silence with a finger over their lips while holding a crumpled, blood-stained paper. Background is a blurred, intense inferno. Overall mood is secretive, ominous, and high-stakes.",
  "images": [
   "/styles/shocking-truth-1.webp"
  ],
  "source": null
 },
 {
  "id": "comparison",
  "name": "Comparison",
  "category": "review",
  "description": "Vibrant red and yellow color palette contrasted with black and white; bright, even studio lighting; faceless grid-patterned human figure looking down, flanked by two contrasting french fry portions; clean white studio background; critical, revelatory, comparative mood.",
  "images": [
   "/styles/comparison-1.webp"
  ],
  "source": null
 },
 {
  "id": "review",
  "name": "Review",
  "category": "review",
  "description": "Monochromatic palette of black, dark grey, and stark white with subtle blue grid patterns on the figure. Soft, even studio lighting with a slight glow around the text and logo. A faceless, grid-patterned humanoid figure in a dark hoodie, pointing emphatically with both hands towards the \"CURSOR 2.0\" text and abstract logo, presenting a reveal. Minimalist dark background. Mood is futuristic, informative, and slightly mysterious.",
  "images": [
   "/styles/review-1.webp"
  ],
  "source": null
 },
 {
  "id": "split-background",
  "name": "Split background",
  "category": "review",
  "description": "High-contrast split background featuring a dark stone texture with a crumbling AI logo on the left and a soft light-peach dotted pattern on the right. Central figure is a 3D wireframe humanoid in a thoughtful pose. Lighting is dual-toned with dramatic shadows and sharp highlights. Overall mood is mysterious, analytical, and suspenseful.",
  "images": [
   "/styles/split-background-1.webp"
  ],
  "source": "https://www.youtube.com/watch?v=xhVeCqF4I-Q&pp=0gcJCQQLAYcqIYzv"
 },
 {
  "id": "chiaroscuro",
  "name": "Chiaroscuro",
  "category": "entertainment",
  "description": "Dark, high-contrast color palette with natural skin tones, vibrant white and yellow text; direct and dramatic front lighting with strong highlights on the face; close-up headshot of a man with direct eye contact, neutral and serious expression, slightly furrowed brow; solid black minimalist background; direct, serious, and intriguing mood.",
  "images": [
   "/styles/chiaroscuro-1.webp"
  ],
  "source": "https://www.youtube.com/watch?v=UwMS0J2eTXE"
 },
 {
  "id": "confused",
  "name": "Confused",
  "category": "entertainment",
  "description": "Bright green, red, and blue accents with natural skin tones; bright, even frontal lighting; woman with wide-eyed, confused, and surprised expression, holding a curling broom and stone; blurred curling arena background; mysterious, intriguing, and dramatic mood.",
  "images": [
   "/styles/confused-1.webp"
  ],
  "source": "https://www.youtube.com/watch?v=p60I9LNHNxg"
 },
 {
  "id": "crime-scene",
  "name": "Crime scene",
  "category": "entertainment",
  "description": "Dark and cinematic color palette with high-contrast golden-yellow highlights, mysterious moody lighting, foreground wireframe hooded figure looking blankly, background featuring a crime scene with caution tape and a parked car at night, atmospheric and suspenseful mood.",
  "images": [
   "/styles/crime-scene-1.webp"
  ],
  "source": null
 },
 {
  "id": "podcast",
  "name": "Podcast",
  "category": "entertainment",
  "description": "High-contrast black, white, and red color palette; dramatic studio lighting with clear focus on subjects; one man speaking assertively with mouth open, the other listening intently and looking engaged; stark black background; intense, confrontational, and serious discussion mood. Dark grey and red color palette, dramatic contrast lighting with subtle rim light, two identical faceless humanoid figures in a thinking pose, gradient red background, serious and informative mood.",
  "images": [
   "/styles/podcast-1.webp",
   "/styles/podcast-2.webp",
   "/styles/podcast-3.webp",
   "/styles/podcast-4.webp"
  ],
  "source": null
 },
 {
  "id": "podcast-02",
  "name": "Podcast 02",
  "category": "entertainment",
  "description": "Minimalist dark gray and teal color palette, clean studio lighting, faceless 3D wireframe character poses, solid deep gray background, professional and mysterious mood.",
  "images": [
   "/styles/podcast-02-1.webp"
  ],
  "source": "https://www.youtube.com/watch?v=4rHHpI5XSow&rco=1"
 },
 {
  "id": "blueprint",
  "name": "Blueprint",
  "category": "education",
  "description": "Bold blues and vibrant yellows, with dramatic contrasting glows (electric blue and fiery orange/red) on a futuristic 3D wireframe head. The subject is a neutral, faceless 3D grid human head, representing AI or strategic thought. The background is a detailed digital blueprint diagram with highlighted keywords. The overall mood is educational, strategic, and cutting-edge.",
  "images": [
   "/styles/blueprint-1.webp",
   "/styles/blueprint-2.webp"
  ],
  "source": null
 },
 {
  "id": "listicle",
  "name": "Listicle",
  "category": "education",
  "description": "Dark monochromatic color palette with high-contrast red rim lighting, 3D wireframe human bust subject, clean minimalist dark background with subtle digital grid texture, tech-focused, professional, and mysterious mood.",
  "images": [
   "/styles/listicle-1.webp",
   "/styles/listicle-2.webp"
  ],
  "source": "https://www.youtube.com/watch?v=mdt2_CMJHfw"
 },
 {
  "id": "estatement",
  "name": "Statement",
  "category": "education",
  "description": "Dark gray and black color palette with vibrant neon yellow-green and stark white text, complemented by a muted blue t-shirt. Direct, frontal lighting creates high contrast, highlighting the text and subject. The subject is a faceless, wireframe humanoid figure with hands clasped in a pensive, almost prayer-like pose. The background is a dark, blurred code editor interface, hinting at a programming context. The overall mood is serious, dramatic, thought-provoking, and slightly ominous, focusing on the future of technology.",
  "images": [
   "/styles/estatement-1.webp"
  ],
  "source": null
 },
 {
  "id": "estatement-02",
  "name": "Statement 02",
  "category": "education",
  "description": "Muted green, charcoal, black, and white color palette with a red accent. Even, soft frontal studio lighting. Subject in an assertive, pointing pose with a faceless, grid-patterned head and gloves, wearing a white baseball cap. Plain, dark studio background with a wooden table. Confident, direct, and instructional mood.",
  "images": [
   "/styles/estatement-02-1.webp",
   "/styles/estatement-02-2.webp"
  ],
  "source": null
 },
 {
  "id": "whiteboard",
  "name": "Whiteboard",
  "category": "education",
  "description": "Monochromatic grey and white color palette with subtle blue and red text accents; bright, even front lighting; wireframe 3D model of a person smiling enthusiastically with mouth open, pointing forward; grid-lined whiteboard background displaying a blurred GTM Launch Plan chart; educational, professional, and optimistic mood.",
  "images": [
   "/styles/whiteboard-1.webp"
  ],
  "source": null
 }
];
export const libraryStyle = (id: string | null | undefined) => styleLibrary.find((s) => s.id === id) ?? null;
