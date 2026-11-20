# Feature map — baseline

Recorded from the code on `op/native-polish` before lane A changes. Desktop means the persistent sidebar; phone means the same workspace with the sidebar opened as a drawer. Dialogs and result menus use the same labels at both sizes. Availability depends on sign-in, keys, selection, and whether an image has a score.

| Action | Desktop: container → exact label | Phone: container → exact label  Status after |
| --- | --- | ---  --- |
| New chat | Sidebar → New chat | Navigation drawer → New chat  Same |
| Search chats | Sidebar history → Search your chats | Navigation drawer history → Search your chats  Same |
| Open chat | Sidebar history → chat title | Navigation drawer history → chat title  Same |
| Rename chat | Chat heading → Rename chat (icon) → Chat name → Save chat name | Same, in workspace heading  Same |
| Delete chat | Chat heading or sidebar row → Delete chat → Delete chat | Chat heading or drawer row → Delete chat → Delete chat  Same |
| Open creations | Sidebar → My creations | Navigation drawer → My creations  Same |
| Search creations | Your creations → Find a thumbnail or idea | Same  Same |
| Filter favorites | Sidebar → Show favorites; Your creations → Favorites | Drawer → Show favorites; Your creations → Favorites  Same |
| Clear filters | Your creations empty state → Clear filters | Same  Same |
| New creation | Your creations → New creation | Same  Same |
| Open/resume creation | Creation card → image/title; sidebar → Recent creations | Creation card → image/title; drawer → Recent creations  Same |
| Favorite creation | Result heading → Favorite selected creation (star); creation card → Favorite [title] (star) | Same  Moved to result/card → Save (same location) |
| Delete creation | Creation card → Delete [title] (trash); selected creation delete confirmation → Delete creation | Same  Same |
| Rename creation | No control found in current studio code | No control found in current studio code  MISSING (baseline; out of scope per lead) |
| Create thumbnail | Composer → Create mode → Create | Same  Same |
| Score thumbnail | Composer → Score mode → Upload / Link / Library → Score; unscored result → Score | Same  Same |
| Fix | Scored result → Fix it | Scored result / sticky action bar → Fix it  Same |
| Review fix first | Score inspector → Review first → Preview → apply reviewed fix | Score inspector → Review first → Preview → apply reviewed fix  Same |
| Download YouTube JPG | Result actions → Download | Result / phone sticky bar → Download  Same |
| Download full size | Result → More → Download full size | Result → More → Download full size  Same |
| Edit | Scored result → More → Edit | Same  Same |
| Score again | Scored result → More → Score again | Same  Same |
| Retry score | Unscored failed score inspector → Retry score | Same  Same |
| Retry with Jev | Full score dialog → retry action | Same  Same |
| Resize | Result → More → Make wide version / Make vertical version | Same  Same |
| Inspect | Result → More → Inspect image | Same  Same |
| Score history | Result → More → Score history | Same  Same |
| Compare | Result → More → Compare before & after; fixed result → Compare | Same  Same |
| Feedback | Result → More → Leave feedback | Same  Same |
| Feed preview | Result → More → Feed preview | Same; phone feed preview initially enabled  Same |
| What was sent | Result → More → What we sent to the AI | Same  Same |
| Select score pillar | Score inspector → Virality / Clarity / Idea / Curiosity / Emotion | Same or Full score dialog → See scores  Same |
| Open result score | Score badge / score inspector → View score | Score badge / result → See scores  Same |
| View original | Fixed result → View original | Same  Same |
| Open revision | In this chat → thumbnail | Same, horizontal revision strip  Same |
| Save draft | Composer footer → Save draft | Same  Same |
| Add person | Sidebar → People; composer → Add a person → Create Person | Drawer → People; composer → Add a person → Create Person  Same |
| Add style | Sidebar → Styles; composer → Pick a style → Create Style | Drawer → Styles; composer → Pick a style → Create Style  Same |
| Add object | Composer → More options → Object → Create Object | Same  Same |
| Select profile | People / Styles / Objects dialog → profile name | Same dialog  Same |
| Rename profile | People / Styles / Objects dialog → Rename → Save name | Same  Same |
| Prepare profile | People / Styles / Objects dialog → Prepare | Same  Same |
| Delete profile | People / Styles / Objects dialog → Delete | Same  Same |
| Style library pick | Styles dialog → Library → style | Same  Same |
| Upload image reference | Composer → More options → Add image; Score → Upload | Same  Same |
| Reference from saved creation | Score → Library → Reference library → image | Same  Same |
| Remove composer reference | Composer reference strip → Remove reference [number] | Same  Same |
| Remove person / style / object | Composer reference strip → Remove person / Remove style / Remove element | Same  Same |
| Import YouTube / image URL | Score → Link → Reference URL → Get thumbnail | Same  Same |
| Import style from YouTube | Styles → Create Style → Study link / Pick channel | Same  Same |
| Improve prompt / undo | Create → More options → Improve / Undo | Same  Same |
| Clear prompt | Select and delete text in Describe your thumbnail; no clear button found | Same  Same |
| Format | Composer → Format → Long-form 16:9 / Short-form 9:16 | Same  Same |
| Model | Create → More options → Rendering model | Same  Same |
| Quality | Create → More options → Quality | Same  Same |
| Thinking time | Create → More options → Thinking time | Same  Same |
| Batch | Create → More options → Images per request | Same  Same |
| Image review and scoring AI | More options → Preparation / Review the image itself for specific advice | Same  Same |
| Change visual direction | Create → More options → Visual direction | Same  Same |
| Add key | Top bar → Keys → Set up your key → Save; /connect → Use a different AI → Save | Same  Same |
| Remove key | /connect → key row → Remove | Same  Same |
| Sign in | Top bar → Sign in; /connect → sign-in form | Same  Same |
| Sign out | /connect → Account → Sign out | Same  Same |
| Help | Top bar → Help; footer / help dialog → Email us | Same  Same |
| Developer model preferences | /connect → For developers → model settings | Same  Same |
| Higgsfield connection | /connect → For developers → Connect Higgsfield / Reconnect Higgsfield / Check Higgsfield connection / Disconnect Higgsfield | Same  Same |
| Agent connection | /connect → For developers → Copy MCP URL / Copy instructions | Same  Same |
| Agent access | /connect → For developers → Connected agents → Revoke access / Show revoked | Same  Same |
| Codex connection | /connect → For developers → Codex connection | Same  Same |
| Activity | Activity dialog → Refresh activity / Stop waiting / Copy / Open saved result | Same  Same |

The baseline records absent controls explicitly rather than implying they exist. The final status check must distinguish an unchanged absence from an implemented action.
