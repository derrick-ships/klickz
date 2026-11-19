// Pre-made style library, from Derrick's "Style OS" Notion database (Thumbnail type).
// Images live in public/styles; styles without an example image are omitted.
// Examples are mediator-only; metadata describes the reusable device or look.
export type LibraryStyle = { id: string; name: string; category: "documentary" | "review" | "entertainment" | "education" | "illustration"; description: string; images: string[]; source: string | null; mode: "composition" | "look"; composition: string; text: "required" | "none"; attribution: string | null };
export const styleCategories = ["documentary", "review", "entertainment", "education", "illustration"] as const;
export const styleLibrary: LibraryStyle[] = [
 {
   "id": "house-political-news",
   "name": "House: Political news",
   "category": "documentary",
   "description": "Documentary look with a teal-to-orange gradient and strong vignette, the real photo of the subject cut out and rim-lit on one side, two lines of ALL CAPS condensed text (yellow on top, white below) on the opposite side, red only on ¿ ?, a red play badge top-left, one faint context object, no date, no logo, no extra text.",
   "images": [
     "/styles/house-political-news-1.webp"
   ],
   "source": null,
   "mode": "look",
   "composition": "Place a cut-out subject on one side and a large two-line headline on the other, with a small badge in the upper corner.",
   "text": "required",
   "attribution": null
 },
 {
   "id": "captured",
   "name": "Captured",
   "category": "documentary",
   "description": "Stark red and blue split color palette with grayscale figures, harsh digital lighting, central gender-neutral wireframe human subject with an expressionless face in a mugshot pose, flanked by similar figures with FBI patches; grungy background with binary code and height lines; intense, mysterious, and investigative mood.",
   "images": [
     "/styles/captured-1.webp"
   ],
   "source": null,
   "mode": "look",
   "composition": "Center a front-facing subject against a height chart, flanked by figures, with a caption along the bottom.",
   "text": "none",
   "attribution": null
 },
 {
   "id": "dramatic",
   "name": "Dramatic",
   "category": "documentary",
   "description": "High contrast color palette with intense oranges and dark charcoal grays. Dramatic backlighting from a massive mushroom cloud explosion. The faceless, wireframe subject is focused and typing intensely on a laptop. The background is a desolate, post-apocalyptic wasteland. Overall mood is ominous, urgent, and high-stakes.",
   "images": [
     "/styles/dramatic-1.webp"
   ],
   "source": "https://www.youtube.com/watch?v=laMFoT-NFvg",
   "mode": "look",
   "composition": "Place a seated subject and a foreground object prominently in front of a distant dramatic event.",
   "text": "none",
   "attribution": null
 },
 {
   "id": "shocking-truth",
   "name": "Shocking truth",
   "category": "documentary",
   "description": "High-contrast color palette with intense orange fire glow and deep shadows. Dramatic backlighting highlighting the silhouette of a 3D wireframe character. The character is gesturing for silence with a finger over their lips while holding a crumpled, blood-stained paper. Background is a blurred, intense inferno. Overall mood is secretive, ominous, and high-stakes.",
   "images": [
     "/styles/shocking-truth-1.webp"
   ],
   "source": null,
   "mode": "look",
   "composition": "Frame a close subject on one side gesturing toward a held document, leaving space for a short caption.",
   "text": "none",
   "attribution": null
 },
 {
   "id": "comparison",
   "name": "Comparison",
   "category": "review",
   "description": "Vibrant red and yellow color palette contrasted with black and white; bright, even studio lighting; faceless grid-patterned human figure looking down, flanked by two contrasting french fry portions; clean white studio background; critical, revelatory, comparative mood.",
   "images": [
     "/styles/comparison-1.webp"
   ],
   "source": null,
   "mode": "look",
   "composition": "Center a subject between two contrasting examples for an immediate side-by-side comparison.",
   "text": "none",
   "attribution": null
 },
 {
   "id": "review",
   "name": "Review",
   "category": "review",
   "description": "Monochromatic palette of black, dark grey, and stark white with subtle blue grid patterns on the figure. Soft, even studio lighting with a slight glow around the text and logo. A faceless, grid-patterned humanoid figure in a dark hoodie, pointing emphatically with both hands towards the \"CURSOR 2.0\" text and abstract logo, presenting a reveal. Minimalist dark background. Mood is futuristic, informative, and slightly mysterious.",
   "images": [
     "/styles/review-1.webp"
   ],
   "source": null,
   "mode": "look",
   "composition": "Place the presenter at one side, gesturing toward an enlarged focal object or title on the other.",
   "text": "none",
   "attribution": null
 },
 {
   "id": "split-background",
   "name": "Split background",
   "category": "review",
   "description": "High-contrast split background featuring a dark stone texture with a crumbling AI logo on the left and a soft light-peach dotted pattern on the right. Central figure is a 3D wireframe humanoid in a thoughtful pose. Lighting is dual-toned with dramatic shadows and sharp highlights. Overall mood is mysterious, analytical, and suspenseful.",
   "images": [
     "/styles/split-background-1.webp"
   ],
   "source": "https://www.youtube.com/watch?v=xhVeCqF4I-Q&pp=0gcJCQQLAYcqIYzv",
   "mode": "look",
   "composition": "Center a thoughtful subject across a vertically split background, with a contrasting object on each side.",
   "text": "none",
   "attribution": null
 },
 {
   "id": "chiaroscuro",
   "name": "Chiaroscuro",
   "category": "entertainment",
   "description": "Dark, high-contrast color palette with natural skin tones, vibrant white and yellow text; direct and dramatic front lighting with strong highlights on the face; close-up headshot of a man with direct eye contact, neutral and serious expression, slightly furrowed brow; solid black minimalist background; direct, serious, and intriguing mood.",
   "images": [
     "/styles/chiaroscuro-1.webp"
   ],
   "source": "https://www.youtube.com/watch?v=UwMS0J2eTXE",
   "mode": "look",
   "composition": "Frame a face tightly at the center, with short text on either side.",
   "text": "none",
   "attribution": null
 },
 {
   "id": "confused",
   "name": "Confused",
   "category": "entertainment",
   "description": "Bright green, red, and blue accents with natural skin tones; bright, even frontal lighting; woman with wide-eyed, confused, and surprised expression, holding a curling broom and stone; blurred curling arena background; mysterious, intriguing, and dramatic mood.",
   "images": [
     "/styles/confused-1.webp"
   ],
   "source": "https://www.youtube.com/watch?v=p60I9LNHNxg",
   "mode": "look",
   "composition": "Place a questioning face between two foreground objects, with an arrow calling attention to a detail.",
   "text": "none",
   "attribution": null
 },
 {
   "id": "crime-scene",
   "name": "Crime scene",
   "category": "entertainment",
   "description": "Dark and cinematic color palette with high-contrast golden-yellow highlights, mysterious moody lighting, foreground wireframe hooded figure looking blankly, background featuring a crime scene with caution tape and a parked car at night, atmospheric and suspenseful mood.",
   "images": [
     "/styles/crime-scene-1.webp"
   ],
   "source": null,
   "mode": "look",
   "composition": "Frame a close foreground figure beside a wider contextual scene behind them.",
   "text": "none",
   "attribution": null
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
   "source": null,
   "mode": "look",
   "composition": "Place two speakers facing inward across the frame, with microphones and a central quote.",
   "text": "none",
   "attribution": null
 },
 {
   "id": "podcast-02",
   "name": "Podcast 02",
   "category": "entertainment",
   "description": "Minimalist dark gray and teal color palette, clean studio lighting, faceless 3D wireframe character poses, solid deep gray background, professional and mysterious mood.",
   "images": [
     "/styles/podcast-02-1.webp"
   ],
   "source": "https://www.youtube.com/watch?v=4rHHpI5XSow&rco=1",
   "mode": "look",
   "composition": "Place two speakers at opposite sides, framing a central title between them.",
   "text": "none",
   "attribution": null
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
   "source": null,
   "mode": "look",
   "composition": "Pair a large foreground portrait on one side with a diagram and title on the other.",
   "text": "none",
   "attribution": null
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
   "source": "https://www.youtube.com/watch?v=mdt2_CMJHfw",
   "mode": "look",
   "composition": "Place a portrait on one side and a vertical numbered list on the other.",
   "text": "none",
   "attribution": null
 },
 {
   "id": "estatement",
   "name": "Statement",
   "category": "education",
   "description": "Dark gray and black color palette with vibrant neon yellow-green and stark white text, complemented by a muted blue t-shirt. Direct, frontal lighting creates high contrast, highlighting the text and subject. The subject is a faceless, wireframe humanoid figure with hands clasped in a pensive, almost prayer-like pose. The background is a dark, blurred code editor interface, hinting at a programming context. The overall mood is serious, dramatic, thought-provoking, and slightly ominous, focusing on the future of technology.",
   "images": [
     "/styles/estatement-1.webp"
   ],
   "source": null,
   "mode": "look",
   "composition": "Center a contemplative figure beneath a large headline against a contextual backdrop.",
   "text": "none",
   "attribution": null
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
   "source": null,
   "mode": "look",
   "composition": "Show a pointing subject at a table with a prominent caption and a small directional callout.",
   "text": "none",
   "attribution": null
 },
 {
   "id": "whiteboard",
   "name": "Whiteboard",
   "category": "education",
   "description": "Monochromatic grey and white color palette with subtle blue and red text accents; bright, even front lighting; wireframe 3D model of a person smiling enthusiastically with mouth open, pointing forward; grid-lined whiteboard background displaying a blurred GTM Launch Plan chart; educational, professional, and optimistic mood.",
   "images": [
     "/styles/whiteboard-1.webp"
   ],
   "source": null,
   "mode": "look",
   "composition": "Place a presenter in front of a board of rows and columns, with a caption across the lower edge.",
   "text": "none",
   "attribution": null
 },
 {
   "id": "tri-color-hardcut-portrait-poster-style",
   "name": "Tri Color Hardcut Portrait Poster Style",
   "category": "illustration",
   "description": "Flat, high-contrast portrait poster made from exactly three solid colors: teal (#0E819E), coral red (#FF5447), and near-black (#000805). Use oversized, tightly cropped portrait or upper-body forms, with heavy near-black silhouette masses, coral subject planes, and sharp teal negative-space cuts. Build facial features and shadows from blunt geometric shapes, with no outlines. Keep the background abstract and flat. Clean stencil-like, vector-cut finish with hard edges, no gradients, texture, soft shading, or realistic detail.",
   "images": [
     "/styles/tri-color-hardcut-portrait-poster-style-1.webp"
   ],
   "source": null,
   "mode": "look",
   "composition": "Fill the frame with an oversized cropped portrait and angular negative-space shapes.",
   "text": "none",
   "attribution": null
 },
 {
   "id": "naive-marker-psa-poster-style",
   "name": "Naive Marker PSA Poster Style",
   "category": "illustration",
   "description": "Naive hand-drawn raster illustration with thick, uneven black marker outlines, rounded stroke ends, flat hand-colored fills, and subtle paper grain and marker scuffs. Use intentionally simple shapes, playful proportions, and flattened perspective. Keep the finish rough and approachable, like a scanned handmade poster. Avoid clean vector polish, realistic anatomy, gradients, airbrushed shading, 3D rendering, and photographic lighting.",
   "images": [
     "/styles/naive-marker-psa-poster-style-1.webp"
   ],
   "source": null,
   "mode": "look",
   "composition": "Arrange simple figures and objects across a poster under a prominent heading.",
   "text": "none",
   "attribution": null
 },
 {
   "id": "bold-block-mascot-poster-style",
   "name": "Bold Block Mascot Poster Style",
   "category": "illustration",
   "description": "Flat editorial poster illustration with ultra-heavy geometric black display type, oversized and tightly spaced. Layer simple, rounded forms with thick uniform black outlines over off-white paper and one dominant tilted cyan, mint, teal, or lemon panel. Use a restrained palette of black, off-white, bright panel colors, and a small red accent. Hard-edged fills, minimal facial detail, subtle paper grain, and a clean screenprint finish. Dense but readable, playful and bold. No realistic depth, gradients, glossy 3D, painterly shading, or photographic lighting.",
   "images": [
     "/styles/bold-block-mascot-poster-style-1.webp"
   ],
   "source": null,
   "mode": "look",
   "composition": "Combine a large text block and mascot-like figure with tilted panels and small supporting objects.",
   "text": "none",
   "attribution": null
 },
 {
   "id": "neon-plush-gadget-pop-3d-style",
   "name": "Neon Plush Gadget Pop 3D Style",
   "category": "illustration",
   "description": "Polished 3D rendering with oversized, rounded plush forms, visible knit or fleece fibers, and soft, collectible proportions. Pair fuzzy textiles with glossy molded plastic, translucent jelly materials, rubber details, and chrome highlights. Bright high-key studio lighting, gentle shadows, soft bloom, and close product-view depth. Energetic, tactile, playful Y2K pop; avoid flat illustration, muted colors, gritty realism, and dark cinematic lighting.",
   "images": [
     "/styles/neon-plush-gadget-pop-3d-style-1.webp"
   ],
   "source": null,
   "mode": "look",
   "composition": "Center an oversized object in a close product view, surrounded by a few smaller supporting shapes.",
   "text": "none",
   "attribution": null
 },
 {
   "id": "doodle",
   "name": "Doodle",
   "category": "illustration",
   "description": "Naive, handmade doodle illustration with thick, uneven black marker outlines, rounded shapes, flat punchy colors, minimal shading, and playful imperfections. Childlike proportions, loose wobbly strokes, simple graphic forms, and a light, humorous feel. Avoid polished vector art, gradients, photorealism, 3D, and anime rendering. Certeza",
   "images": [
     "/styles/doodle-1.webp"
   ],
   "source": null,
   "mode": "look",
   "composition": "Isolate a simple object with an arrow pointing directly at it.",
   "text": "none",
   "attribution": null
 },
 {
   "id": "rough-animation-pet-sketch-storyboard-style",
   "name": "Rough Animation Pet Sketch Storyboard Style",
   "category": "illustration",
   "description": "Loose, unfinished animation-development drawing on warm beige paper. Use visible red-brown construction lines, scratchy dark burgundy contours, layered correction strokes, and semi-transparent watercolor-like color washes. Keep shapes simple and expressive, with exaggerated features and lively poses. Add lightly sketched background details and rough motion marks. Warm, muted colors, soft shadows, and a tactile storyboard feel. Avoid polished linework, clean vector art, glossy 3D, photorealism, and overfinished shading.",
   "images": [
     "/styles/rough-animation-pet-sketch-storyboard-style-1.webp"
   ],
   "source": null,
   "mode": "look",
   "composition": "Stage expressive characters around a central object, with light background details and motion marks.",
   "text": "none",
   "attribution": null
 },
 {
   "id": "title-head",
   "name": "Title Head",
   "category": "education",
   "description": "A recognisable face beside a large title that explains what the video is about.",
   "images": [
     "/styles/title-head-1.webp",
     "/styles/title-head-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=edd24ce7",
   "mode": "composition",
   "composition": "Place a large stacked title beside a recognisable close or medium portrait.",
   "text": "required",
   "attribution": "11 Habits Of Highly Effective Managers! (How to improve your MANAGEMENT SKILLS!) · CareerVidz"
 },
 {
   "id": "motion-arrow",
   "name": "Motion Arrow",
   "category": "entertainment",
   "description": "An arrow shows where something is about to move, while the outcome stays hidden.",
   "images": [
     "/styles/motion-arrow-1.webp",
     "/styles/motion-arrow-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=d7ad08e5",
   "mode": "composition",
   "composition": "Show a subject in motion and use a curved arrow to indicate its possible path.",
   "text": "none",
   "attribution": "Reversing Motor Direction | Quick Tip | Motion RC · Motion RC"
 },
 {
   "id": "ranking",
   "name": "Ranking",
   "category": "education",
   "description": "Subjects placed on a scale, tier list or score to show where each one stands.",
   "images": [
     "/styles/ranking-1.webp",
     "/styles/ranking-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=4315d344",
   "mode": "composition",
   "composition": "Arrange subjects along a scale or in an ordered row to show their relative positions.",
   "text": "none",
   "attribution": "Ranking Men By Attractiveness | 5 Guys vs 5 Girls · Jubilee"
 },
 {
   "id": "impossible",
   "name": "Impossible",
   "category": "entertainment",
   "description": "A situation or result that looks unrealistic or physically impossible.",
   "images": [
     "/styles/impossible-1.webp",
     "/styles/impossible-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=fc9a240a",
   "mode": "composition",
   "composition": "Show a subject in an apparently impossible pose or situation, with the contradiction easy to read.",
   "text": "none",
   "attribution": "Impossible 0.0000001% Odds! · Beast Reacts"
 },
 {
   "id": "recreation",
   "name": "Recreation",
   "category": "entertainment",
   "description": "Something familiar, like a game or a show, recreated where it doesn't normally belong.",
   "images": [
     "/styles/recreation-1.webp",
     "/styles/recreation-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=0808fd47",
   "mode": "composition",
   "composition": "Place a familiar activity or setup in an unexpected setting and frame it as a single scene.",
   "text": "none",
   "attribution": "Mario Kart In Real Life · Shiloh & Bros"
 },
 {
   "id": "2-panel-layout-vertical-divider",
   "name": "2-Panel Layout (Vertical Divider)",
   "category": "education",
   "description": "The same subject at an early and a later stage, split by a clear line.",
   "images": [
     "/styles/2-panel-layout-vertical-divider-1.webp",
     "/styles/2-panel-layout-vertical-divider-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=5ddca79f",
   "mode": "composition",
   "composition": "Divide the frame vertically and place an earlier state on one side and a later state on the other.",
   "text": "none",
   "attribution": "NEW Walking Method 2x Better Than Running?! (Tested) · Jeremy Ethier"
 },
 {
   "id": "start-state",
   "name": "Start State",
   "category": "education",
   "description": "The very beginning of a journey, like zero subscribers or a blank page.",
   "images": [
     "/styles/start-state-1.webp",
     "/styles/start-state-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=a168f311",
   "mode": "composition",
   "composition": "Focus on the initial state of a journey, isolating the subject or starting marker.",
   "text": "none",
   "attribution": "Giving A Stranger Fake Steroids For 100 Days · Jeremy Ethier"
 },
 {
   "id": "do-this",
   "name": "Do This",
   "category": "education",
   "description": "A method that clearly works, shown with 'do this' and a sign of the result.",
   "images": [
     "/styles/do-this-1.webp",
     "/styles/do-this-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=29b4325a",
   "mode": "composition",
   "composition": "Show a method or action alongside a visible signal of its positive result.",
   "text": "none",
   "attribution": "How To Get 6 Pack Abs With No Equipment (DO THIS ANYWHERE!) · Jeremy Ethier"
 },
 {
   "id": "showcase",
   "name": "Showcase",
   "category": "education",
   "description": "A person holding the subject of the video up to the camera.",
   "images": [
     "/styles/showcase-1.webp",
     "/styles/showcase-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=fddc3675",
   "mode": "composition",
   "composition": "Frame a person holding the featured object toward the viewer so it dominates the foreground.",
   "text": "none",
   "attribution": "I Built 100 LEGO Sets! · Half-Asleep Chris"
 },
 {
   "id": "context-arrow",
   "name": "Context Arrow",
   "category": "education",
   "description": "An arrow with a short label that explains something not obvious in the image.",
   "images": [
     "/styles/context-arrow-1.webp",
     "/styles/context-arrow-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=f5ec6972",
   "mode": "composition",
   "composition": "Use an arrow to connect a small explanatory label to a detail in the scene.",
   "text": "none",
   "attribution": "Minecraft's Most Mind-Blowing Builds! · Meep"
 },
 {
   "id": "outcome",
   "name": "Outcome",
   "category": "entertainment",
   "description": "Someone in the moment of finding out a result, like reaching number one on trending.",
   "images": [
     "/styles/outcome-1.webp",
     "/styles/outcome-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=4e85ca8d",
   "mode": "composition",
   "composition": "Show the subject reacting at the moment a result is revealed, with the outcome nearby.",
   "text": "none",
   "attribution": "How to Make Your First $10,000 As a Teen (Stupid Simple) · Mark Tilbury"
 },
 {
   "id": "guess-the-answer",
   "name": "Guess The Answer",
   "category": "entertainment",
   "description": "A question with the answer hidden, like a box with a question mark.",
   "images": [
     "/styles/guess-the-answer-1.webp",
     "/styles/guess-the-answer-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=575a0e97",
   "mode": "composition",
   "composition": "Place a question beside a concealed object or answer, using a question mark to sustain curiosity.",
   "text": "required",
   "attribution": "What's In The Box Challenge · Kevin Langue 2"
 },
 {
   "id": "quote",
   "name": "Quote",
   "category": "education",
   "description": "A short quote at the centre, usually next to the person who said it.",
   "images": [
     "/styles/quote-1.webp",
     "/styles/quote-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=a9917a64",
   "mode": "composition",
   "composition": "Place a prominent short quotation beside the person or subject associated with it.",
   "text": "required",
   "attribution": "How To Change Your Life In 2025 (with Reverse Goal Setting) · Justin Sung"
 },
 {
   "id": "incorrect-statement",
   "name": "Incorrect Statement",
   "category": "education",
   "description": "A statement that is clearly wrong, like 1 + 1 = 4.",
   "images": [
     "/styles/incorrect-statement-1.webp",
     "/styles/incorrect-statement-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=8010f325",
   "mode": "composition",
   "composition": "Make an incorrect assertion the central focal point, using a compact statement or equation.",
   "text": "required",
   "attribution": "I FAILED THE EASIEST TEST · SSSniperWolf"
 },
 {
   "id": "title",
   "name": "Title",
   "category": "entertainment",
   "description": "Big, styled title text built around one subject, like the logo of a show.",
   "images": [
     "/styles/title-1.webp",
     "/styles/title-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=faca6cd6",
   "mode": "composition",
   "composition": "Arrange a large title around or above a central subject so the title dominates the composition.",
   "text": "required",
   "attribution": "The Bronze Scrub Who Made Esports Bleed · theScore esports"
 },
 {
   "id": "contrast-environment",
   "name": "Contrast Environment",
   "category": "entertainment",
   "description": "A subject placed in surroundings where it clearly doesn't belong.",
   "images": [
     "/styles/contrast-environment-1.webp",
     "/styles/contrast-environment-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=86e2cf52",
   "mode": "composition",
   "composition": "Isolate a subject in a setting where it visibly does not belong, using the setting as context.",
   "text": "none",
   "attribution": "How Much Information? · Veritasium"
 },
 {
   "id": "uptrend-arrow",
   "name": "Uptrend Arrow",
   "category": "education",
   "description": "A rising arrow or graph that signals growth, success or a breakthrough.",
   "images": [
     "/styles/uptrend-arrow-1.webp",
     "/styles/uptrend-arrow-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=f33f7b0e",
   "mode": "composition",
   "composition": "Pair the subject with a rising arrow or graph that directs the eye upward.",
   "text": "none",
   "attribution": "How to get SO good at YouTube you can't stop going viral · Learn By Leo"
 },
 {
   "id": "reaction",
   "name": "Reaction",
   "category": "entertainment",
   "description": "A person reacting to something on a screen, with the reaction spelled out in text.",
   "images": [
     "/styles/reaction-1.webp",
     "/styles/reaction-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=fbfbc0a1",
   "mode": "composition",
   "composition": "Show a person reacting beside the thing they are reacting to, optionally with a speech bubble.",
   "text": "none",
   "attribution": "I Went UNDERCOVER In Minibloxia's Hide & Seek.. (Roblox Bedwars) · Foltyn"
 },
 {
   "id": "extreme-close-up",
   "name": "Extreme Close-up",
   "category": "entertainment",
   "description": "A subject framed so tightly it fills the frame, often cropping part of the head.",
   "images": [
     "/styles/extreme-close-up-1.webp",
     "/styles/extreme-close-up-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=128b3f70",
   "mode": "composition",
   "composition": "Crop extremely close to a face or object so it fills the frame and extends beyond its edges.",
   "text": "none",
   "attribution": "why do I hear boss music? (original) · Daniyal Shahrokhian"
 },
 {
   "id": "interaction",
   "name": "Interaction",
   "category": "entertainment",
   "description": "Two people in a heated moment, pointing, arguing or reacting to each other.",
   "images": [
     "/styles/interaction-1.webp",
     "/styles/interaction-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=e0bebc76",
   "mode": "composition",
   "composition": "Place two subjects facing each other in a gesture or exchange that makes their interaction clear.",
   "text": "none",
   "attribution": "Tyler Oliveira · Tyler Oliveira"
 },
 {
   "id": "staircase",
   "name": "Staircase",
   "category": "education",
   "description": "Subjects lined up from small to large, the last often too big for the frame.",
   "images": [
     "/styles/staircase-1.webp",
     "/styles/staircase-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=f9e913a4",
   "mode": "composition",
   "composition": "Arrange subjects in a sequence of increasing size, with the largest extending beyond the frame.",
   "text": "none",
   "attribution": "Universe Size Comparison | 3d Animation Comparison | Stars Real Scale Comparison · Global Data"
 },
 {
   "id": "strange-object",
   "name": "Strange Object",
   "category": "education",
   "description": "An unfamiliar or odd object shown clearly, often with question marks.",
   "images": [
     "/styles/strange-object-1.webp",
     "/styles/strange-object-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=1a5f8c69",
   "mode": "composition",
   "composition": "Isolate an unfamiliar object as the focal point, optionally accompanied by question marks.",
   "text": "none",
   "attribution": "Paradox of the Möbius Strip and Klein Bottle - A 4D Visualization · Drew's Campfire"
 },
 {
   "id": "statistics",
   "name": "Statistics",
   "category": "education",
   "description": "A person paired with a chart, graph or piece of data.",
   "images": [
     "/styles/statistics-1.webp",
     "/styles/statistics-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=b636db90",
   "mode": "composition",
   "composition": "Place a person beside a prominent chart or graph with a concise data label.",
   "text": "required",
   "attribution": "How Mark Cuban Turned His First $1 Million Into $1 Billion | GQ Sports · GQ"
 },
 {
   "id": "time-progression",
   "name": "Time Progression",
   "category": "education",
   "description": "The same subject at two labelled moments, like day 1 and day 200.",
   "images": [
     "/styles/time-progression-1.webp",
     "/styles/time-progression-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=31a5cfa9",
   "mode": "composition",
   "composition": "Show the same subject at two moments side by side, connected by an arrow and time markers.",
   "text": "none",
   "attribution": null
 },
 {
   "id": "choice",
   "name": "Choice",
   "category": "education",
   "description": "Two options next to each other with an 'or' between them.",
   "images": [
     "/styles/choice-1.webp",
     "/styles/choice-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=0141a7f7",
   "mode": "composition",
   "composition": "Place two alternatives on opposite sides of the frame with a clear gap between them.",
   "text": "none",
   "attribution": "What Is A Paradox? · Vsauce2"
 },
 {
   "id": "medium-shot-title",
   "name": "Medium Shot + Title",
   "category": "education",
   "description": "A person from the chest up with a short title, often a name or label.",
   "images": [
     "/styles/medium-shot-title-1.webp",
     "/styles/medium-shot-title-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=9ae84c28",
   "mode": "composition",
   "composition": "Frame a subject from the chest up and place a short title above or beside them.",
   "text": "required",
   "attribution": "Andrew Tate ~ Tourner Dans Le Vide · Fasi & Emadh 2"
 },
 {
   "id": "large-number",
   "name": "Large Number",
   "category": "education",
   "description": "A very large number combined with an image to support it.",
   "images": [
     "/styles/large-number-1.webp",
     "/styles/large-number-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=3c2bd738",
   "mode": "composition",
   "composition": "Make a large number the dominant focal point with a smaller supporting subject below or beside it.",
   "text": "required",
   "attribution": "Have we solved every scramble? · Cubeorithms"
 },
 {
   "id": "mid-action",
   "name": "Mid Action",
   "category": "entertainment",
   "description": "A snapshot from the middle of a moment, like a jump, fall or celebration.",
   "images": [
     "/styles/mid-action-1.webp",
     "/styles/mid-action-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=d1d71a5f",
   "mode": "composition",
   "composition": "Capture a subject in the middle of a physical action, with the gesture readable at a glance.",
   "text": "none",
   "attribution": "If Educational Videos Were Filmed Like Music Videos · Tom Scott"
 },
 {
   "id": "options",
   "name": "Options",
   "category": "education",
   "description": "One subject surrounded by a set of options, choices or paths.",
   "images": [
     "/styles/options-1.webp",
     "/styles/options-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=727ef74f",
   "mode": "composition",
   "composition": "Center a subject surrounded by several distinct options arranged in an arc.",
   "text": "none",
   "attribution": "How to Build Your Ultimate Productivity System · Ali Abdaal"
 },
 {
   "id": "attention-circle",
   "name": "Attention Circle",
   "category": "entertainment",
   "description": "A circle drawn around a detail in the image, showing where to look.",
   "images": [
     "/styles/attention-circle-1.webp",
     "/styles/attention-circle-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=c78c3f82",
   "mode": "composition",
   "composition": "Draw a circle around a small detail in the scene to direct attention toward it.",
   "text": "none",
   "attribution": "Luckiest People Alive! · Beast Reacts"
 },
 {
   "id": "state-comparison",
   "name": "State Comparison",
   "category": "education",
   "description": "Two states of the same kind of person, each labelled with one word.",
   "images": [
     "/styles/state-comparison-1.webp",
     "/styles/state-comparison-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=20e7bf2e",
   "mode": "composition",
   "composition": "Place two contrasting states of a subject side by side, each with a short label.",
   "text": "none",
   "attribution": "Mario Kart 8 Deluxe Just Changed Forever · JPGiviner"
 },
 {
   "id": "mid-action-with-reference",
   "name": "Mid Action With Reference",
   "category": "entertainment",
   "description": "A mid-action snapshot with a logo or name that shows where it comes from.",
   "images": [
     "/styles/mid-action-with-reference-1.webp",
     "/styles/mid-action-with-reference-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=7126a184",
   "mode": "composition",
   "composition": "Show a subject mid-action with a compact reference marker beside them for context.",
   "text": "none",
   "attribution": "\"Godfather of AI\" Geoffrey Hinton: The 60 Minutes Interview · 60 Minutes"
 },
 {
   "id": "enhanced-area",
   "name": "Enhanced Area",
   "category": "entertainment",
   "description": "A zoomed-in circle that reveals a detail too small to see in the main image.",
   "images": [
     "/styles/enhanced-area-1.webp",
     "/styles/enhanced-area-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=f9eb500c",
   "mode": "composition",
   "composition": "Add a circular magnified inset connected to a small detail in the wider scene.",
   "text": "none",
   "attribution": "We Tested 17 Shoulder Exercises, These Are Best For Growth · Jeremy Ethier"
 },
 {
   "id": "outlier",
   "name": "Outlier",
   "category": "education",
   "description": "One subject singled out from a group, so it stands out at once.",
   "images": [
     "/styles/outlier-1.webp",
     "/styles/outlier-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=6665fda9",
   "mode": "composition",
   "composition": "Arrange a group together and isolate one contrasting subject outside it.",
   "text": "none",
   "attribution": "Slither.io A.I. 200,000+ Score Epic Slitherio Gameplay · Smash"
 },
 {
   "id": "title-about-head",
   "name": "Title About Head",
   "category": "education",
   "description": "An image with a short title that says what makes it special.",
   "images": [
     "/styles/title-about-head-1.webp",
     "/styles/title-about-head-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=c3ef19ab",
   "mode": "composition",
   "composition": "Place a short title above the subject or scene, leaving the visual to fill the rest of the frame.",
   "text": "required",
   "attribution": "What's the Longest River on Earth? · Atlas Pro"
 },
 {
   "id": "head-with-two-sides",
   "name": "Head With Two Sides",
   "category": "education",
   "description": "The creator in the middle with a contrasting visual on each side.",
   "images": [
     "/styles/head-with-two-sides-1.webp",
     "/styles/head-with-two-sides-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=56cf0d5d",
   "mode": "composition",
   "composition": "Center a subject between two contrasting objects or ideas, one on each side.",
   "text": "none",
   "attribution": "The ONLY 2 Exercises You Need to Fix Your Flat Butt · Jeremy Ethier"
 },
 {
   "id": "name",
   "name": "Name",
   "category": "entertainment",
   "description": "A famous person's name in large text, usually next to their face.",
   "images": [
     "/styles/name-1.webp",
     "/styles/name-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=ee354300",
   "mode": "composition",
   "composition": "Place a large name beside the associated portrait.",
   "text": "required",
   "attribution": "The Full Story of Michelle Khare (Challenge Accepted) · Colin and Samir"
 },
 {
   "id": "context-question",
   "name": "Context Question",
   "category": "education",
   "description": "A puzzle or challenge put to the viewer before they even click.",
   "images": [
     "/styles/context-question-1.webp",
     "/styles/context-question-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=12903a6b",
   "mode": "composition",
   "composition": "Pair a short question with a visual puzzle or challenge, leaving the answer unresolved.",
   "text": "required",
   "attribution": "Does Pain Actually Hurt? · Vsauce2"
 },
 {
   "id": "conversation-topic",
   "name": "Conversation Topic",
   "category": "education",
   "description": "Two people on either side with the subject of their talk in the middle.",
   "images": [
     "/styles/conversation-topic-1.webp",
     "/styles/conversation-topic-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=4ab41e41",
   "mode": "composition",
   "composition": "Place two people on opposite sides facing inward, with the topic of their conversation between them.",
   "text": "none",
   "attribution": "The MrBeast MEGA-STUDIO Tour! · Mrwhosetheboss"
 },
 {
   "id": "poster",
   "name": "Poster",
   "category": "entertainment",
   "description": "A stylised, cinematic snapshot where how it looks matters more than anything else.",
   "images": [
     "/styles/poster-1.webp",
     "/styles/poster-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=e07da6f2",
   "mode": "composition",
   "composition": "Build a cinematic scene with a foreground subject and a large contextual backdrop.",
   "text": "none",
   "attribution": "The Unhealthiest Restaurant In America - Why It's Controversial · SunnyV2"
 },
 {
   "id": "transformation-process",
   "name": "Transformation Process",
   "category": "education",
   "description": "Someone caught in the middle of changing something, often with text to explain.",
   "images": [
     "/styles/transformation-process-1.webp",
     "/styles/transformation-process-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=f511fa22",
   "mode": "composition",
   "composition": "Focus on hands or a subject actively changing an object, capturing the transformation in progress.",
   "text": "none",
   "attribution": "대한민국에 미래가 없는 이유 · 한눈에 보는 세상 – Kurzgesagt"
 },
 {
   "id": "blur",
   "name": "Blur",
   "category": "entertainment",
   "description": "A blurred subject that gives away just enough for the viewer to start guessing.",
   "images": [
     "/styles/blur-1.webp",
     "/styles/blur-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=88ba1f59",
   "mode": "composition",
   "composition": "Partially obscure the focal subject with blur while keeping surrounding clues visible.",
   "text": "none",
   "attribution": "Top 10 WORST US State Flags in History · Johannes Factotum"
 },
 {
   "id": "lead-text-emphasis",
   "name": "Lead Text + Emphasis",
   "category": "education",
   "description": "A text title where imagery replaces or fills some of the letters.",
   "images": [
     "/styles/lead-text-emphasis-1.webp",
     "/styles/lead-text-emphasis-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=2fb20ec8",
   "mode": "composition",
   "composition": "Use a large title as the focal point and replace or fill part of its lettering with a relevant visual.",
   "text": "required",
   "attribution": "How to enter ‘flow state’ on command | Steven Kotler for Big Think · Big Think"
 },
 {
   "id": "proximity",
   "name": "Proximity",
   "category": "entertainment",
   "description": "Two subjects about to meet, where one could hurt or damage the other.",
   "images": [
     "/styles/proximity-1.webp",
     "/styles/proximity-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=c6ef8367",
   "mode": "composition",
   "composition": "Position two subjects close together just before an interaction or possible impact.",
   "text": "none",
   "attribution": "The Most DANGEROUS Rubik’s Cubes · Kewbix"
 },
 {
   "id": "variation",
   "name": "Variation",
   "category": "education",
   "description": "Near-identical elements with small, subtle differences between them.",
   "images": [
     "/styles/variation-1.webp",
     "/styles/variation-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=b1550e3d",
   "mode": "composition",
   "composition": "Place near-identical examples side by side to highlight a subtle difference.",
   "text": "none",
   "attribution": "600 Page FLIPBOOK // Dot Challenge · Andrew Wells"
 },
 {
   "id": "transformed-result",
   "name": "Transformed result",
   "category": "education",
   "description": "The upgraded version of something at its most impressive, without the before.",
   "images": [
     "/styles/transformed-result-1.webp",
     "/styles/transformed-result-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=27844ddc",
   "mode": "composition",
   "composition": "Give the transformed subject a prominent isolated view, without showing its earlier state.",
   "text": "none",
   "attribution": "I Upgraded Minecraft. | The ULTIMATE Survival World Full Movie [6000+ HOURS] · TrixyBlox"
 },
 {
   "id": "end-result",
   "name": "End Result",
   "category": "education",
   "description": "Only the final outcome, with no hint of how it was achieved.",
   "images": [
     "/styles/end-result-1.webp",
     "/styles/end-result-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=bf8e5939",
   "mode": "composition",
   "composition": "Show the completed outcome as the focal point, without depicting the process.",
   "text": "none",
   "attribution": "Dog rescue and build Loving Dog House - Build House for Puppies · House Technology"
 },
 {
   "id": "title-subtitle",
   "name": "Title & Subtitle",
   "category": "education",
   "description": "A main line of text supported by a smaller second line, next to an image.",
   "images": [
     "/styles/title-subtitle-1.webp",
     "/styles/title-subtitle-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=a2d624a5",
   "mode": "composition",
   "composition": "Place a prominent title with a smaller supporting subtitle next to the main subject.",
   "text": "required",
   "attribution": "Heinrich Himmler: Architect of The Final Solution | WW2 Documentary · WarsofTheWorld"
 },
 {
   "id": "good-bad",
   "name": "Good & Bad",
   "category": "education",
   "description": "A right and a wrong version side by side, marked with a tick and cross.",
   "images": [
     "/styles/good-bad-1.webp",
     "/styles/good-bad-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=04de1a24",
   "mode": "composition",
   "composition": "Split two contrasting examples side by side and mark them with a check and a cross.",
   "text": "none",
   "attribution": "Clothing that is out of style! Wear This Instead! · Teachingmensfashion"
 },
 {
   "id": "comments",
   "name": "Comments",
   "category": "entertainment",
   "description": "Comments or reactions from other people used as the main visual.",
   "images": [
     "/styles/comments-1.webp",
     "/styles/comments-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=2526e210",
   "mode": "composition",
   "composition": "Surround a central subject with comment-shaped text bubbles as the main storytelling device.",
   "text": "required",
   "attribution": "The Comment Section · TheOdd1sOut"
 },
 {
   "id": "quadrant",
   "name": "Quadrant",
   "category": "education",
   "description": "The frame split into four sections, each a different variation or category.",
   "images": [
     "/styles/quadrant-1.webp",
     "/styles/quadrant-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=aae02225",
   "mode": "composition",
   "composition": "Divide the frame into four quadrants, placing one example in each section.",
   "text": "none",
   "attribution": "Candy From Around The World | Around The World · Insider Food"
 },
 {
   "id": "connection",
   "name": "Connection",
   "category": "education",
   "description": "People, objects or ideas shown as linked to each other rather than opposed.",
   "images": [
     "/styles/connection-1.webp",
     "/styles/connection-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=61f76447",
   "mode": "composition",
   "composition": "Arrange subjects close together in a shared action to emphasize their connection.",
   "text": "none",
   "attribution": "1,000 Deaf People Hear For The First Time · MrBeast"
 },
 {
   "id": "conversation",
   "name": "Conversation",
   "category": "entertainment",
   "description": "Two people exchanging a short line or reaction, shown in speech bubbles.",
   "images": [
     "/styles/conversation-1.webp",
     "/styles/conversation-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=35eb2066",
   "mode": "composition",
   "composition": "Place two people facing each other with short speech bubbles between them.",
   "text": "required",
   "attribution": "Meet MrBeast's Secret YouTube Consultant (Paddy Galloway Interview) · Jon Youshaei"
 },
 {
   "id": "competition",
   "name": "Competition",
   "category": "entertainment",
   "description": "Two subjects set against each other, often with a 'vs' between them.",
   "images": [
     "/styles/competition-1.webp",
     "/styles/competition-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=a24c1f2a",
   "mode": "composition",
   "composition": "Place two opposing subjects on opposite sides of the frame, emphasizing their confrontation.",
   "text": "none",
   "attribution": "Andrew Tate vs Therapist (Round 2) · David Sutcliffe"
 },
 {
   "id": "conflict-motion-arrow",
   "name": "Conflict motion arrow",
   "category": "entertainment",
   "description": "An arrow points one way while the scene suggests another, so the outcome feels uncertain.",
   "images": [
     "/styles/conflict-motion-arrow-1.webp",
     "/styles/conflict-motion-arrow-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=e13cac5e",
   "mode": "composition",
   "composition": "Pair a subject in motion with an arrow suggesting a conflicting direction of travel.",
   "text": "none",
   "attribution": "Running Off A Vehicle Backwards At The Same Speed That It Is Driving Forward! · The Action Lab"
 },
 {
   "id": "transformation",
   "name": "Transformation",
   "category": "education",
   "description": "A before and after: the starting point on one side, the result on the other.",
   "images": [
     "/styles/transformation-1.webp",
     "/styles/transformation-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=b894583f",
   "mode": "composition",
   "composition": "Show the same subject before and after on opposite sides of a clear divider.",
   "text": "none",
   "attribution": "I Bet Him $10,000 To Get Shredded In 90 Days · Stan Browney"
 },
 {
   "id": "downtrend-arrow",
   "name": "Downtrend Arrow",
   "category": "education",
   "description": "A falling arrow or graph that signals loss, decline or failure.",
   "images": [
     "/styles/downtrend-arrow-1.webp",
     "/styles/downtrend-arrow-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=f5d480ec",
   "mode": "composition",
   "composition": "Pair the subject with a downward-trending arrow or graph to signal decline.",
   "text": "none",
   "attribution": "The Pitiful Downfall of PIXAR · Doktor Skipper"
 },
 {
   "id": "2-panel-layout-horizonal-divider",
   "name": "2-Panel Layout (Horizonal Divider)",
   "category": "education",
   "description": "Two states in separate panels, so the eye compares them at once.",
   "images": [
     "/styles/2-panel-layout-horizonal-divider-1.webp",
     "/styles/2-panel-layout-horizonal-divider-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=7a7d2211",
   "mode": "composition",
   "composition": "Divide the frame horizontally into two panels, each showing a different state.",
   "text": "none",
   "attribution": "Targeting Belly Fat Is POSSIBLE?! (New Study) · Jeremy Ethier"
 },
 {
   "id": "mid-progression",
   "name": "Mid Progression",
   "category": "entertainment",
   "description": "A snapshot from partway through a journey, often with a day or time marker.",
   "images": [
     "/styles/mid-progression-1.webp",
     "/styles/mid-progression-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=0ca4eb75",
   "mode": "composition",
   "composition": "Show a subject partway through a journey, with a marker indicating progress.",
   "text": "none",
   "attribution": "This Trick Shot Took OVER 30 Days · That's Amazing 2"
 },
 {
   "id": "conflict",
   "name": "Conflict",
   "category": "education",
   "description": "Two things that don't belong together, about to collide, with no result shown.",
   "images": [
     "/styles/conflict-1.webp",
     "/styles/conflict-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=4e5bd816",
   "mode": "composition",
   "composition": "Place two incompatible subjects on a collision course, leaving the outcome unseen.",
   "text": "none",
   "attribution": "Trains vs Giant Pit – BeamNG.Drive · BeamNG Nation"
 },
 {
   "id": "accusation",
   "name": "Accusation",
   "category": "education",
   "description": "Text and imagery that point straight at the viewer and challenge them.",
   "images": [
     "/styles/accusation-1.webp",
     "/styles/accusation-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=b9fea770",
   "mode": "composition",
   "composition": "Use a direct-facing or pointing subject next to a large challenge addressed to the viewer.",
   "text": "none",
   "attribution": "Why you SUCK at Battlefield 6. · Zerk"
 },
 {
   "id": "review-02",
   "name": "Review 02",
   "category": "education",
   "description": "A subject paired with a clear quality signal, like stars, a price or a tier.",
   "images": [
     "/styles/review-02-1.webp",
     "/styles/review-02-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=52ac4b3c",
   "mode": "composition",
   "composition": "Pair the reviewed subject with a prominent rating or other visual quality indicator.",
   "text": "none",
   "attribution": "I Tested Gyms With No Reviews · Jesse James West"
 },
 {
   "id": "eliminators",
   "name": "Eliminators",
   "category": "entertainment",
   "description": "The video's main rule or limitation stated in the thumbnail, like 'backpack only'.",
   "images": [
     "/styles/eliminators-1.webp",
     "/styles/eliminators-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=12b54f76",
   "mode": "composition",
   "composition": "Place the subject beside a prominent short statement of the constraint governing the scene.",
   "text": "required",
   "attribution": "I Survived 100 Days of REAL LAWS in Minecraft · Branzy"
 },
 {
   "id": "problem-state",
   "name": "Problem State",
   "category": "education",
   "description": "A situation that is clearly going wrong, with no solution shown yet.",
   "images": [
     "/styles/problem-state-1.webp",
     "/styles/problem-state-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=cbd25219",
   "mode": "composition",
   "composition": "Show a subject in a visibly difficult situation without revealing the solution.",
   "text": "none",
   "attribution": "How To Grow Your Dead YT Channel · Marcus Jones"
 },
 {
   "id": "don-t",
   "name": "Don't",
   "category": "education",
   "description": "A common mistake shown in action and marked as wrong.",
   "images": [
     "/styles/don-t-1.webp",
     "/styles/don-t-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=b4f3883a",
   "mode": "composition",
   "composition": "Show an action or mistake and mark it clearly as wrong with a graphic cue.",
   "text": "none",
   "attribution": "How To Edit YouTube Videos 10x Faster! - Productivity Hacks · Film Booth"
 },
 {
   "id": "contrast",
   "name": "Contrast",
   "category": "education",
   "description": "Two things side by side that differ sharply in size, colour or value.",
   "images": [
     "/styles/contrast-1.webp",
     "/styles/contrast-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=d6391508",
   "mode": "composition",
   "composition": "Place two sharply different subjects in the same frame so their contrast is immediately apparent.",
   "text": "none",
   "attribution": "I Built the SpongeBob Patty Wagon! · Matthew Beem"
 },
 {
   "id": "3-panel-layout",
   "name": "3-Panel Layout",
   "category": "education",
   "description": "Three distinct panels show different examples, categories or stages of the video's subject.",
   "images": [
     "/styles/3-panel-layout-1.webp",
     "/styles/3-panel-layout-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=6f37942d",
   "mode": "composition",
   "composition": "Divide the frame into three panels, each containing a distinct state or example.",
   "text": "none",
   "attribution": "If I Wanted to Get Shredded In 2027, I'd Do This · Jeremy Ethier"
 },
 {
   "id": "conversation-question",
   "name": "Conversation Question",
   "category": "entertainment",
   "description": "Two people facing each other with a question between them.",
   "images": [
     "/styles/conversation-question-1.webp",
     "/styles/conversation-question-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=5c7953f8",
   "mode": "composition",
   "composition": "Place two people facing each other with a short question centered between them.",
   "text": "required",
   "attribution": "WHAT IS YOUR FAVORITE COUNTRY? | Street Interview · Adrian Gee"
 },
 {
   "id": "a-affects-b",
   "name": "A Affects B",
   "category": "education",
   "description": "One person or object clearly about to act on another.",
   "images": [
     "/styles/a-affects-b-1.webp",
     "/styles/a-affects-b-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=748a32bb",
   "mode": "composition",
   "composition": "Stage one subject acting on another, making the direction of influence visually clear.",
   "text": "none",
   "attribution": "Minecraft Manhunt, But A Wheel Decides · Bubbo"
 },
 {
   "id": "dramatic-face",
   "name": "Dramatic Face",
   "category": "entertainment",
   "description": "A single face with a strong expression and almost nothing else in the frame.",
   "images": [
     "/styles/dramatic-face-1.webp",
     "/styles/dramatic-face-2.webp"
   ],
   "source": "https://theretentionlab.com/hub/resources/thumbnail-formats?format=368429ad",
   "mode": "composition",
   "composition": "Fill the frame with a single expressive face, using radiating lines to draw attention to it.",
   "text": "none",
   "attribution": "The Future of Vsauce2 · Vsauce2"
 }
];
export const libraryStyle = (id: string | null | undefined) => styleLibrary.find((s) => s.id === id) ?? null;
