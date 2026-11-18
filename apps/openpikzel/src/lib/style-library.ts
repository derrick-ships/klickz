// Pre-made style library, from Derrick's "Style OS" Notion database (Thumbnail type).
// Images live in public/styles; styles without an example image are omitted.
// A library style is sent as a style reference: its images guide treatment, its description the look.
export type LibraryStyle = { id: string; name: string; category: "documentary" | "review" | "entertainment" | "education" | "illustration"; description: string; images: string[]; source: string | null };
export const styleCategories = ["documentary", "review", "entertainment", "education", "illustration"] as const;
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
 },
 {
   "id": "tri-color-hardcut-portrait-poster-style",
   "name": "Tri Color Hardcut Portrait Poster Style",
   "category": "illustration",
   "description": "Flat, high-contrast portrait poster made from exactly three solid colors: teal (#0E819E), coral red (#FF5447), and near-black (#000805). Use oversized, tightly cropped portrait or upper-body forms, with heavy near-black silhouette masses, coral subject planes, and sharp teal negative-space cuts. Build facial features and shadows from blunt geometric shapes, with no outlines. Keep the background abstract and flat. Clean stencil-like, vector-cut finish with hard edges, no gradients, texture, soft shading, or realistic detail.",
   "images": [
     "/styles/tri-color-hardcut-portrait-poster-style-1.webp"
   ],
   "source": null
 },
 {
   "id": "naive-marker-psa-poster-style",
   "name": "Naive Marker PSA Poster Style",
   "category": "illustration",
   "description": "Naive hand-drawn raster illustration with thick, uneven black marker outlines, rounded stroke ends, flat hand-colored fills, and subtle paper grain and marker scuffs. Use intentionally simple shapes, playful proportions, and flattened perspective. Keep the finish rough and approachable, like a scanned handmade poster. Avoid clean vector polish, realistic anatomy, gradients, airbrushed shading, 3D rendering, and photographic lighting.",
   "images": [
     "/styles/naive-marker-psa-poster-style-1.webp"
   ],
   "source": null
 },
 {
   "id": "bold-block-mascot-poster-style",
   "name": "Bold Block Mascot Poster Style",
   "category": "illustration",
   "description": "Flat editorial poster illustration with ultra-heavy geometric black display type, oversized and tightly spaced. Layer simple, rounded forms with thick uniform black outlines over off-white paper and one dominant tilted cyan, mint, teal, or lemon panel. Use a restrained palette of black, off-white, bright panel colors, and a small red accent. Hard-edged fills, minimal facial detail, subtle paper grain, and a clean screenprint finish. Dense but readable, playful and bold. No realistic depth, gradients, glossy 3D, painterly shading, or photographic lighting.",
   "images": [
     "/styles/bold-block-mascot-poster-style-1.webp"
   ],
   "source": null
 },
 {
   "id": "neon-plush-gadget-pop-3d-style",
   "name": "Neon Plush Gadget Pop 3D Style",
   "category": "illustration",
   "description": "Polished 3D rendering with oversized, rounded plush forms, visible knit or fleece fibers, and soft, collectible proportions. Pair fuzzy textiles with glossy molded plastic, translucent jelly materials, rubber details, and chrome highlights. Bright high-key studio lighting, gentle shadows, soft bloom, and close product-view depth. Energetic, tactile, playful Y2K pop; avoid flat illustration, muted colors, gritty realism, and dark cinematic lighting.",
   "images": [
     "/styles/neon-plush-gadget-pop-3d-style-1.webp"
   ],
   "source": null
 },
 {
   "id": "doodle",
   "name": "Doodle",
   "category": "illustration",
   "description": "Naive, handmade doodle illustration with thick, uneven black marker outlines, rounded shapes, flat punchy colors, minimal shading, and playful imperfections. Childlike proportions, loose wobbly strokes, simple graphic forms, and a light, humorous feel. Avoid polished vector art, gradients, photorealism, 3D, and anime rendering. Certeza",
   "images": [
     "/styles/doodle-1.webp"
   ],
   "source": null
 },
 {
   "id": "rough-animation-pet-sketch-storyboard-style",
   "name": "Rough Animation Pet Sketch Storyboard Style",
   "category": "illustration",
   "description": "Loose, unfinished animation-development drawing on warm beige paper. Use visible red-brown construction lines, scratchy dark burgundy contours, layered correction strokes, and semi-transparent watercolor-like color washes. Keep shapes simple and expressive, with exaggerated features and lively poses. Add lightly sketched background details and rough motion marks. Warm, muted colors, soft shadows, and a tactile storyboard feel. Avoid polished linework, clean vector art, glossy 3D, photorealism, and overfinished shading.",
   "images": [
     "/styles/rough-animation-pet-sketch-storyboard-style-1.webp"
   ],
   "source": null
 },
 {
   "id": "title-head",
   "name": "Title Head",
   "category": "education",
   "description": "A recognisable face beside a large title that explains what the video is about. Nichos: Education, Entertainment Referencia visual: 11 Habits Of Highly Effective Managers! (How to improve your MANAGEMENT SKILLS!) · CareerVidz",
   "images": [
     "/styles/title-head-1.webp",
     "/styles/title-head-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=edd24ce7"
 },
 {
   "id": "motion-arrow",
   "name": "Motion Arrow",
   "category": "entertainment",
   "description": "An arrow shows where something is about to move, while the outcome stays hidden. Nichos: Entertainment Referencia visual: Reversing Motor Direction | Quick Tip | Motion RC · Motion RC",
   "images": [
     "/styles/motion-arrow-1.webp",
     "/styles/motion-arrow-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=d7ad08e5"
 },
 {
   "id": "ranking",
   "name": "Ranking",
   "category": "education",
   "description": "Subjects placed on a scale, tier list or score to show where each one stands. Nichos: Education, Entertainment Referencia visual: Ranking Men By Attractiveness | 5 Guys vs 5 Girls · Jubilee",
   "images": [
     "/styles/ranking-1.webp",
     "/styles/ranking-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=4315d344"
 },
 {
   "id": "impossible",
   "name": "Impossible",
   "category": "entertainment",
   "description": "A situation or result that looks unrealistic or physically impossible. Nichos: Entertainment Referencia visual: Impossible 0.0000001% Odds! · Beast Reacts",
   "images": [
     "/styles/impossible-1.webp",
     "/styles/impossible-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=fc9a240a"
 },
 {
   "id": "recreation",
   "name": "Recreation",
   "category": "entertainment",
   "description": "Something familiar, like a game or a show, recreated where it doesn't normally belong. Nichos: Entertainment Referencia visual: Mario Kart In Real Life · Shiloh & Bros",
   "images": [
     "/styles/recreation-1.webp",
     "/styles/recreation-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=0808fd47"
 },
 {
   "id": "2-panel-layout-vertical-divider",
   "name": "2-Panel Layout (Vertical Divider)",
   "category": "education",
   "description": "The same subject at an early and a later stage, split by a clear line. Nichos: Education, Entertainment Referencia visual: NEW Walking Method 2x Better Than Running?! (Tested) · Jeremy Ethier",
   "images": [
     "/styles/2-panel-layout-vertical-divider-1.webp",
     "/styles/2-panel-layout-vertical-divider-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=5ddca79f"
 },
 {
   "id": "start-state",
   "name": "Start State",
   "category": "education",
   "description": "The very beginning of a journey, like zero subscribers or a blank page. Nichos: Education, Entertainment Referencia visual: Giving A Stranger Fake Steroids For 100 Days · Jeremy Ethier",
   "images": [
     "/styles/start-state-1.webp",
     "/styles/start-state-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=a168f311"
 },
 {
   "id": "do-this",
   "name": "Do This",
   "category": "education",
   "description": "A method that clearly works, shown with 'do this' and a sign of the result. Nichos: Education Referencia visual: How To Get 6 Pack Abs With No Equipment (DO THIS ANYWHERE!) · Jeremy Ethier",
   "images": [
     "/styles/do-this-1.webp",
     "/styles/do-this-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=29b4325a"
 },
 {
   "id": "showcase",
   "name": "Showcase",
   "category": "education",
   "description": "A person holding the subject of the video up to the camera. Nichos: Education, Entertainment Referencia visual: I Built 100 LEGO Sets! · Half-Asleep Chris",
   "images": [
     "/styles/showcase-1.webp",
     "/styles/showcase-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=fddc3675"
 },
 {
   "id": "context-arrow",
   "name": "Context Arrow",
   "category": "education",
   "description": "An arrow with a short label that explains something not obvious in the image. Nichos: Education, Entertainment Referencia visual: Minecraft's Most Mind-Blowing Builds! · Meep",
   "images": [
     "/styles/context-arrow-1.webp",
     "/styles/context-arrow-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=f5ec6972"
 },
 {
   "id": "outcome",
   "name": "Outcome",
   "category": "entertainment",
   "description": "Someone in the moment of finding out a result, like reaching number one on trending. Nichos: Entertainment Referencia visual: How to Make Your First $10,000 As a Teen (Stupid Simple) · Mark Tilbury",
   "images": [
     "/styles/outcome-1.webp",
     "/styles/outcome-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=4e85ca8d"
 },
 {
   "id": "guess-the-answer",
   "name": "Guess The Answer",
   "category": "entertainment",
   "description": "A question with the answer hidden, like a box with a question mark. Nichos: Entertainment Referencia visual: What's In The Box Challenge · Kevin Langue 2",
   "images": [
     "/styles/guess-the-answer-1.webp",
     "/styles/guess-the-answer-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=575a0e97"
 },
 {
   "id": "quote",
   "name": "Quote",
   "category": "education",
   "description": "A short quote at the centre, usually next to the person who said it. Nichos: Education Referencia visual: How To Change Your Life In 2025 (with Reverse Goal Setting) · Justin Sung",
   "images": [
     "/styles/quote-1.webp",
     "/styles/quote-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=a9917a64"
 },
 {
   "id": "incorrect-statement",
   "name": "Incorrect Statement",
   "category": "education",
   "description": "A statement that is clearly wrong, like 1 + 1 = 4. Nichos: Education Referencia visual: I FAILED THE EASIEST TEST · SSSniperWolf",
   "images": [
     "/styles/incorrect-statement-1.webp",
     "/styles/incorrect-statement-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=8010f325"
 },
 {
   "id": "title",
   "name": "Title",
   "category": "entertainment",
   "description": "Big, styled title text built around one subject, like the logo of a show. Nichos: Entertainment Referencia visual: The Bronze Scrub Who Made Esports Bleed · theScore esports",
   "images": [
     "/styles/title-1.webp",
     "/styles/title-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=faca6cd6"
 },
 {
   "id": "contrast-environment",
   "name": "Contrast Environment",
   "category": "entertainment",
   "description": "A subject placed in surroundings where it clearly doesn't belong. Nichos: Entertainment Referencia visual: How Much Information? · Veritasium",
   "images": [
     "/styles/contrast-environment-1.webp",
     "/styles/contrast-environment-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=86e2cf52"
 },
 {
   "id": "uptrend-arrow",
   "name": "Uptrend Arrow",
   "category": "education",
   "description": "A rising arrow or graph that signals growth, success or a breakthrough. Nichos: Education Referencia visual: How to get SO good at YouTube you can't stop going viral · Learn By Leo",
   "images": [
     "/styles/uptrend-arrow-1.webp",
     "/styles/uptrend-arrow-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=f33f7b0e"
 },
 {
   "id": "reaction",
   "name": "Reaction",
   "category": "entertainment",
   "description": "A person reacting to something on a screen, with the reaction spelled out in text. Nichos: Entertainment Referencia visual: I Went UNDERCOVER In Minibloxia's Hide & Seek.. (Roblox Bedwars) · Foltyn",
   "images": [
     "/styles/reaction-1.webp",
     "/styles/reaction-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=fbfbc0a1"
 },
 {
   "id": "extreme-close-up",
   "name": "Extreme Close-up",
   "category": "entertainment",
   "description": "A subject framed so tightly it fills the frame, often cropping part of the head. Nichos: Entertainment Referencia visual: why do I hear boss music? (original) · Daniyal Shahrokhian",
   "images": [
     "/styles/extreme-close-up-1.webp",
     "/styles/extreme-close-up-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=128b3f70"
 },
 {
   "id": "interaction",
   "name": "Interaction",
   "category": "entertainment",
   "description": "Two people in a heated moment, pointing, arguing or reacting to each other. Nichos: Entertainment Referencia visual: Tyler Oliveira · Tyler Oliveira",
   "images": [
     "/styles/interaction-1.webp",
     "/styles/interaction-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=e0bebc76"
 },
 {
   "id": "staircase",
   "name": "Staircase",
   "category": "education",
   "description": "Subjects lined up from small to large, the last often too big for the frame. Nichos: Education Referencia visual: Universe Size Comparison | 3d Animation Comparison | Stars Real Scale Comparison · Global Data",
   "images": [
     "/styles/staircase-1.webp",
     "/styles/staircase-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=f9e913a4"
 },
 {
   "id": "strange-object",
   "name": "Strange Object",
   "category": "education",
   "description": "An unfamiliar or odd object shown clearly, often with question marks. Nichos: Education, Entertainment Referencia visual: Paradox of the Möbius Strip and Klein Bottle - A 4D Visualization · Drew's Campfire",
   "images": [
     "/styles/strange-object-1.webp",
     "/styles/strange-object-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=1a5f8c69"
 },
 {
   "id": "statistics",
   "name": "Statistics",
   "category": "education",
   "description": "A person paired with a chart, graph or piece of data. Nichos: Education Referencia visual: How Mark Cuban Turned His First $1 Million Into $1 Billion | GQ Sports · GQ",
   "images": [
     "/styles/statistics-1.webp",
     "/styles/statistics-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=b636db90"
 },
 {
   "id": "time-progression",
   "name": "Time Progression",
   "category": "education",
   "description": "The same subject at two labelled moments, like day 1 and day 200. Nichos: Education, Entertainment Referencia externa (YouTube): 100 Days to Transform My Life · Chuffsters. The Retention Lab no tiene un ejemplo publicado para este formato.",
   "images": [
     "/styles/time-progression-1.webp",
     "/styles/time-progression-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=31a5cfa9"
 },
 {
   "id": "choice",
   "name": "Choice",
   "category": "education",
   "description": "Two options next to each other with an 'or' between them. Nichos: Education, Entertainment Referencia visual: What Is A Paradox? · Vsauce2",
   "images": [
     "/styles/choice-1.webp",
     "/styles/choice-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=0141a7f7"
 },
 {
   "id": "medium-shot-title",
   "name": "Medium Shot + Title",
   "category": "education",
   "description": "A person from the chest up with a short title, often a name or label. Nichos: Education, Entertainment Referencia visual: Andrew Tate ~ Tourner Dans Le Vide · Fasi & Emadh 2",
   "images": [
     "/styles/medium-shot-title-1.webp",
     "/styles/medium-shot-title-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=9ae84c28"
 },
 {
   "id": "large-number",
   "name": "Large Number",
   "category": "education",
   "description": "A very large number combined with an image to support it. Nichos: Education, Entertainment Referencia visual: Have we solved every scramble? · Cubeorithms",
   "images": [
     "/styles/large-number-1.webp",
     "/styles/large-number-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=3c2bd738"
 },
 {
   "id": "mid-action",
   "name": "Mid Action",
   "category": "entertainment",
   "description": "A snapshot from the middle of a moment, like a jump, fall or celebration. Nichos: Entertainment Referencia visual: If Educational Videos Were Filmed Like Music Videos · Tom Scott",
   "images": [
     "/styles/mid-action-1.webp",
     "/styles/mid-action-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=d1d71a5f"
 },
 {
   "id": "options",
   "name": "Options",
   "category": "education",
   "description": "One subject surrounded by a set of options, choices or paths. Nichos: Education, Entertainment Referencia visual: How to Build Your Ultimate Productivity System · Ali Abdaal",
   "images": [
     "/styles/options-1.webp",
     "/styles/options-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=727ef74f"
 },
 {
   "id": "attention-circle",
   "name": "Attention Circle",
   "category": "entertainment",
   "description": "A circle drawn around a detail in the image, showing where to look. Nichos: Entertainment Referencia visual: Luckiest People Alive! · Beast Reacts",
   "images": [
     "/styles/attention-circle-1.webp",
     "/styles/attention-circle-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=c78c3f82"
 },
 {
   "id": "state-comparison",
   "name": "State Comparison",
   "category": "education",
   "description": "Two states of the same kind of person, each labelled with one word. Nichos: Education Referencia visual: Mario Kart 8 Deluxe Just Changed Forever · JPGiviner",
   "images": [
     "/styles/state-comparison-1.webp",
     "/styles/state-comparison-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=20e7bf2e"
 },
 {
   "id": "mid-action-with-reference",
   "name": "Mid Action With Reference",
   "category": "entertainment",
   "description": "A mid-action snapshot with a logo or name that shows where it comes from. Nichos: Entertainment Referencia visual: \"Godfather of AI\" Geoffrey Hinton: The 60 Minutes Interview · 60 Minutes",
   "images": [
     "/styles/mid-action-with-reference-1.webp",
     "/styles/mid-action-with-reference-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=7126a184"
 },
 {
   "id": "enhanced-area",
   "name": "Enhanced Area",
   "category": "entertainment",
   "description": "A zoomed-in circle that reveals a detail too small to see in the main image. Nichos: Entertainment Referencia visual: We Tested 17 Shoulder Exercises, These Are Best For Growth · Jeremy Ethier",
   "images": [
     "/styles/enhanced-area-1.webp",
     "/styles/enhanced-area-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=f9eb500c"
 },
 {
   "id": "outlier",
   "name": "Outlier",
   "category": "education",
   "description": "One subject singled out from a group, so it stands out at once. Nichos: Education, Entertainment Referencia visual: Slither.io A.I. 200,000+ Score Epic Slitherio Gameplay · Smash",
   "images": [
     "/styles/outlier-1.webp",
     "/styles/outlier-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=6665fda9"
 },
 {
   "id": "title-about-head",
   "name": "Title About Head",
   "category": "education",
   "description": "An image with a short title that says what makes it special. Nichos: Education Referencia visual: What's the Longest River on Earth? · Atlas Pro",
   "images": [
     "/styles/title-about-head-1.webp",
     "/styles/title-about-head-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=c3ef19ab"
 },
 {
   "id": "head-with-two-sides",
   "name": "Head With Two Sides",
   "category": "education",
   "description": "The creator in the middle with a contrasting visual on each side. Nichos: Education, Entertainment Referencia visual: The ONLY 2 Exercises You Need to Fix Your Flat Butt · Jeremy Ethier",
   "images": [
     "/styles/head-with-two-sides-1.webp",
     "/styles/head-with-two-sides-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=56cf0d5d"
 },
 {
   "id": "name",
   "name": "Name",
   "category": "entertainment",
   "description": "A famous person's name in large text, usually next to their face. Nichos: Entertainment Referencia visual: The Full Story of Michelle Khare (Challenge Accepted) · Colin and Samir",
   "images": [
     "/styles/name-1.webp",
     "/styles/name-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=ee354300"
 },
 {
   "id": "context-question",
   "name": "Context Question",
   "category": "education",
   "description": "A puzzle or challenge put to the viewer before they even click. Nichos: Education, Entertainment Referencia visual: Does Pain Actually Hurt? · Vsauce2",
   "images": [
     "/styles/context-question-1.webp",
     "/styles/context-question-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=12903a6b"
 },
 {
   "id": "conversation-topic",
   "name": "Conversation Topic",
   "category": "education",
   "description": "Two people on either side with the subject of their talk in the middle. Nichos: Education, Entertainment Referencia visual: The MrBeast MEGA-STUDIO Tour! · Mrwhosetheboss",
   "images": [
     "/styles/conversation-topic-1.webp",
     "/styles/conversation-topic-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=4ab41e41"
 },
 {
   "id": "poster",
   "name": "Poster",
   "category": "entertainment",
   "description": "A stylised, cinematic snapshot where how it looks matters more than anything else. Nichos: Entertainment Referencia visual: The Unhealthiest Restaurant In America - Why It's Controversial · SunnyV2",
   "images": [
     "/styles/poster-1.webp",
     "/styles/poster-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=e07da6f2"
 },
 {
   "id": "transformation-process",
   "name": "Transformation Process",
   "category": "education",
   "description": "Someone caught in the middle of changing something, often with text to explain. Nichos: Education, Entertainment Referencia visual: 대한민국에 미래가 없는 이유 · 한눈에 보는 세상 – Kurzgesagt",
   "images": [
     "/styles/transformation-process-1.webp",
     "/styles/transformation-process-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=f511fa22"
 },
 {
   "id": "blur",
   "name": "Blur",
   "category": "entertainment",
   "description": "A blurred subject that gives away just enough for the viewer to start guessing. Nichos: Entertainment Referencia visual: Top 10 WORST US State Flags in History · Johannes Factotum",
   "images": [
     "/styles/blur-1.webp",
     "/styles/blur-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=88ba1f59"
 },
 {
   "id": "lead-text-emphasis",
   "name": "Lead Text + Emphasis",
   "category": "education",
   "description": "A text title where imagery replaces or fills some of the letters. Nichos: Education Referencia visual: How to enter ‘flow state’ on command | Steven Kotler for Big Think · Big Think",
   "images": [
     "/styles/lead-text-emphasis-1.webp",
     "/styles/lead-text-emphasis-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=2fb20ec8"
 },
 {
   "id": "proximity",
   "name": "Proximity",
   "category": "entertainment",
   "description": "Two subjects about to meet, where one could hurt or damage the other. Nichos: Entertainment Referencia visual: The Most DANGEROUS Rubik’s Cubes · Kewbix",
   "images": [
     "/styles/proximity-1.webp",
     "/styles/proximity-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=c6ef8367"
 },
 {
   "id": "variation",
   "name": "Variation",
   "category": "education",
   "description": "Near-identical elements with small, subtle differences between them. Nichos: Education Referencia visual: 600 Page FLIPBOOK // Dot Challenge · Andrew Wells",
   "images": [
     "/styles/variation-1.webp",
     "/styles/variation-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=b1550e3d"
 },
 {
   "id": "transformed-result",
   "name": "Transformed result",
   "category": "education",
   "description": "The upgraded version of something at its most impressive, without the before. Nichos: Education, Entertainment Referencia visual: I Upgraded Minecraft. | The ULTIMATE Survival World Full Movie [6000+ HOURS] · TrixyBlox",
   "images": [
     "/styles/transformed-result-1.webp",
     "/styles/transformed-result-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=27844ddc"
 },
 {
   "id": "end-result",
   "name": "End Result",
   "category": "education",
   "description": "Only the final outcome, with no hint of how it was achieved. Nichos: Education, Entertainment Referencia visual: Dog rescue and build Loving Dog House - Build House for Puppies · House Technology",
   "images": [
     "/styles/end-result-1.webp",
     "/styles/end-result-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=bf8e5939"
 },
 {
   "id": "title-subtitle",
   "name": "Title & Subtitle",
   "category": "education",
   "description": "A main line of text supported by a smaller second line, next to an image. Nichos: Education, Entertainment Referencia visual: Heinrich Himmler: Architect of The Final Solution | WW2 Documentary · WarsofTheWorld",
   "images": [
     "/styles/title-subtitle-1.webp",
     "/styles/title-subtitle-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=a2d624a5"
 },
 {
   "id": "good-bad",
   "name": "Good & Bad",
   "category": "education",
   "description": "A right and a wrong version side by side, marked with a tick and cross. Nichos: Education Referencia visual: Clothing that is out of style! Wear This Instead! · Teachingmensfashion",
   "images": [
     "/styles/good-bad-1.webp",
     "/styles/good-bad-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=04de1a24"
 },
 {
   "id": "comments",
   "name": "Comments",
   "category": "entertainment",
   "description": "Comments or reactions from other people used as the main visual. Nichos: Entertainment Referencia visual: The Comment Section · TheOdd1sOut",
   "images": [
     "/styles/comments-1.webp",
     "/styles/comments-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=2526e210"
 },
 {
   "id": "quadrant",
   "name": "Quadrant",
   "category": "education",
   "description": "The frame split into four sections, each a different variation or category. Nichos: Education Referencia visual: Candy From Around The World | Around The World · Insider Food",
   "images": [
     "/styles/quadrant-1.webp",
     "/styles/quadrant-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=aae02225"
 },
 {
   "id": "connection",
   "name": "Connection",
   "category": "education",
   "description": "People, objects or ideas shown as linked to each other rather than opposed. Nichos: Education, Entertainment Referencia visual: 1,000 Deaf People Hear For The First Time · MrBeast",
   "images": [
     "/styles/connection-1.webp",
     "/styles/connection-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=61f76447"
 },
 {
   "id": "conversation",
   "name": "Conversation",
   "category": "entertainment",
   "description": "Two people exchanging a short line or reaction, shown in speech bubbles. Nichos: Entertainment Referencia visual: Meet MrBeast's Secret YouTube Consultant (Paddy Galloway Interview) · Jon Youshaei",
   "images": [
     "/styles/conversation-1.webp",
     "/styles/conversation-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=35eb2066"
 },
 {
   "id": "competition",
   "name": "Competition",
   "category": "entertainment",
   "description": "Two subjects set against each other, often with a 'vs' between them. Nichos: Entertainment Referencia visual: Andrew Tate vs Therapist (Round 2) · David Sutcliffe",
   "images": [
     "/styles/competition-1.webp",
     "/styles/competition-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=a24c1f2a"
 },
 {
   "id": "conflict-motion-arrow",
   "name": "Conflict motion arrow",
   "category": "entertainment",
   "description": "An arrow points one way while the scene suggests another, so the outcome feels uncertain. Nichos: Entertainment Referencia visual: Running Off A Vehicle Backwards At The Same Speed That It Is Driving Forward! · The Action Lab",
   "images": [
     "/styles/conflict-motion-arrow-1.webp",
     "/styles/conflict-motion-arrow-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=e13cac5e"
 },
 {
   "id": "transformation",
   "name": "Transformation",
   "category": "education",
   "description": "A before and after: the starting point on one side, the result on the other. Nichos: Education, Entertainment Referencia visual: I Bet Him $10,000 To Get Shredded In 90 Days · Stan Browney",
   "images": [
     "/styles/transformation-1.webp",
     "/styles/transformation-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=b894583f"
 },
 {
   "id": "downtrend-arrow",
   "name": "Downtrend Arrow",
   "category": "education",
   "description": "A falling arrow or graph that signals loss, decline or failure. Nichos: Education Referencia visual: The Pitiful Downfall of PIXAR · Doktor Skipper",
   "images": [
     "/styles/downtrend-arrow-1.webp",
     "/styles/downtrend-arrow-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=f5d480ec"
 },
 {
   "id": "2-panel-layout-horizonal-divider",
   "name": "2-Panel Layout (Horizonal Divider)",
   "category": "education",
   "description": "Two states in separate panels, so the eye compares them at once. Nichos: Education, Entertainment Referencia visual: Targeting Belly Fat Is POSSIBLE?! (New Study) · Jeremy Ethier",
   "images": [
     "/styles/2-panel-layout-horizonal-divider-1.webp",
     "/styles/2-panel-layout-horizonal-divider-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=7a7d2211"
 },
 {
   "id": "mid-progression",
   "name": "Mid Progression",
   "category": "entertainment",
   "description": "A snapshot from partway through a journey, often with a day or time marker. Nichos: Entertainment Referencia visual: This Trick Shot Took OVER 30 Days · That's Amazing 2",
   "images": [
     "/styles/mid-progression-1.webp",
     "/styles/mid-progression-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=0ca4eb75"
 },
 {
   "id": "conflict",
   "name": "Conflict",
   "category": "education",
   "description": "Two things that don't belong together, about to collide, with no result shown. Nichos: Education, Entertainment Referencia visual: Trains vs Giant Pit – BeamNG.Drive · BeamNG Nation",
   "images": [
     "/styles/conflict-1.webp",
     "/styles/conflict-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=4e5bd816"
 },
 {
   "id": "accusation",
   "name": "Accusation",
   "category": "education",
   "description": "Text and imagery that point straight at the viewer and challenge them. Nichos: Education, Entertainment Referencia visual: Why you SUCK at Battlefield 6. · Zerk",
   "images": [
     "/styles/accusation-1.webp",
     "/styles/accusation-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=b9fea770"
 },
 {
   "id": "review-02",
   "name": "Review 02",
   "category": "education",
   "description": "A subject paired with a clear quality signal, like stars, a price or a tier. Nichos: Education, Entertainment Referencia visual: I Tested Gyms With No Reviews · Jesse James West",
   "images": [
     "/styles/review-02-1.webp",
     "/styles/review-02-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=52ac4b3c"
 },
 {
   "id": "eliminators",
   "name": "Eliminators",
   "category": "entertainment",
   "description": "The video's main rule or limitation stated in the thumbnail, like 'backpack only'. Nichos: Entertainment Referencia visual: I Survived 100 Days of REAL LAWS in Minecraft · Branzy",
   "images": [
     "/styles/eliminators-1.webp",
     "/styles/eliminators-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=12b54f76"
 },
 {
   "id": "problem-state",
   "name": "Problem State",
   "category": "education",
   "description": "A situation that is clearly going wrong, with no solution shown yet. Nichos: Education, Entertainment Referencia visual: How To Grow Your Dead YT Channel · Marcus Jones",
   "images": [
     "/styles/problem-state-1.webp",
     "/styles/problem-state-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=cbd25219"
 },
 {
   "id": "don-t",
   "name": "Don't",
   "category": "education",
   "description": "A common mistake shown in action and marked as wrong. Nichos: Education Referencia visual: How To Edit YouTube Videos 10x Faster! - Productivity Hacks · Film Booth",
   "images": [
     "/styles/don-t-1.webp",
     "/styles/don-t-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=b4f3883a"
 },
 {
   "id": "contrast",
   "name": "Contrast",
   "category": "education",
   "description": "Two things side by side that differ sharply in size, colour or value. Nichos: Education, Entertainment Referencia visual: I Built the SpongeBob Patty Wagon! · Matthew Beem",
   "images": [
     "/styles/contrast-1.webp",
     "/styles/contrast-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=d6391508"
 },
 {
   "id": "3-panel-layout",
   "name": "3-Panel Layout",
   "category": "education",
   "description": "Three distinct panels show different examples, categories or stages of the video's subject. Nichos: Education, Entertainment Referencia visual: If I Wanted to Get Shredded In 2027, I'd Do This · Jeremy Ethier",
   "images": [
     "/styles/3-panel-layout-1.webp",
     "/styles/3-panel-layout-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=6f37942d"
 },
 {
   "id": "conversation-question",
   "name": "Conversation Question",
   "category": "entertainment",
   "description": "Two people facing each other with a question between them. Nichos: Entertainment Referencia visual: WHAT IS YOUR FAVORITE COUNTRY? | Street Interview · Adrian Gee",
   "images": [
     "/styles/conversation-question-1.webp",
     "/styles/conversation-question-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=5c7953f8"
 },
 {
   "id": "a-affects-b",
   "name": "A Affects B",
   "category": "education",
   "description": "One person or object clearly about to act on another. Nichos: Education, Entertainment Referencia visual: Minecraft Manhunt, But A Wheel Decides · Bubbo",
   "images": [
     "/styles/a-affects-b-1.webp",
     "/styles/a-affects-b-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=748a32bb"
 },
 {
   "id": "dramatic-face",
   "name": "Dramatic Face",
   "category": "entertainment",
   "description": "A single face with a strong expression and almost nothing else in the frame. Nichos: Entertainment Referencia visual: The Future of Vsauce2 · Vsauce2",
   "images": [
     "/styles/dramatic-face-1.webp",
     "/styles/dramatic-face-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=368429ad"
 }
];
export const libraryStyle = (id: string | null | undefined) => styleLibrary.find((s) => s.id === id) ?? null;
