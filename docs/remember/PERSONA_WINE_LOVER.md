# Persona: The Casual Wine Lover

**Name**: Alex
**Age**: 32
**Wine knowledge**: Knows they prefer "big reds" and crisp whites, can name maybe 10 grape varieties, couldn't tell you the difference between Left Bank and Right Bank Bordeaux
**Phone usage**: Constantly. Instagram, TikTok, group chats. Takes photos of everything at dinner.
**Current wine tracking**: None. Has a Notes app entry from 2 years ago that says "the italian one - red label" with no further context.

---

## My Honest Relationship with Wine

I drink wine 2-3 times a week. I genuinely enjoy it. But here's the thing: I am not going to sit down and catalog my wine experiences like a sommelier. I have tried journaling apps before (for food, workouts, gratitude) and they all die after week two because the novelty wears off and the friction stays.

What I *actually* want is dead simple: **when I find a wine I love, I want to be able to find it again.** That's 80% of my motivation. The other 20% is wanting to seem like I know what I'm talking about when someone asks "what wine should I bring?"

---

## Real-World Scenarios (Things That Actually Happen To Me)

### 1. "Quick, snap the label before the waiter clears it"
I'm at dinner, had an incredible glass of something. I grab my phone and take a blurry photo of the bottle before it disappears. Right now that photo goes into my camera roll and is never seen again. I need that photo to go somewhere useful in under 5 seconds.

### 2. "What was that wine from Sarah's dinner party?"
Three weeks later, I'm at the wine shop. I know I had something amazing at Sarah's place. Was it a Malbec? An Argentinian something? I vaguely remember a yellow label. I want to search my memories by context, not by wine name, because *I don't know the wine name*. "Sarah's dinner" should find it.

### 3. "This TikTok sommelier just recommended something"
I'm scrolling at 11pm and a wine creator says "if you like Malbec, try Carmenere." I want to save that recommendation somewhere I'll actually see it again, not in my bookmarks graveyard. A quick "remember: try Carmenere" would be perfect.

### 4. "The wine at that restaurant was perfect"
I'm on holiday, had an amazing bottle with a view. The wine, the moment, the place -- it all goes together. I'd love to save a memory that captures the whole vibe, not just the wine data. The terrace, the sunset, my partner laughing. The wine was part of an experience.

### 5. "My friend asked what wine to buy for a dinner party"
I want to pull up my "loved it" wines and send a quick recommendation. Bonus points if I can share it in a way that doesn't look like a spreadsheet.

### 6. "I'm at the wine shop and I'm lost"
I'm staring at 200 bottles. I know I like certain things. I want to pull up my saved memories and either re-buy something or get a suggestion based on what I've liked before. "Show me wines similar to the ones I've saved" would be magical.

---

## User Stories

### Must Have (I literally won't use it without these)

**US-1: One-tap photo capture**
*As a casual wine lover, I want to snap a photo of a wine label and have it saved as a memory in under 5 seconds, so I don't have to fumble with forms while my friends wait.*

- No mandatory fields. Just the photo. Everything else is optional.
- The AI should figure out the wine name from the label automatically.
- If it can't identify the wine, that's fine -- just save the photo with a timestamp and location.

**US-2: Quick context note**
*As a casual wine lover, I want to add a short voice note or text blurb like "Sarah's birthday dinner, the lamb pairing was incredible" so I remember WHY I liked this wine.*

- One line of text. Not a form. Not structured data. Just my words.
- Voice-to-text would be even better (my hands are holding a wine glass).

**US-3: Search by context, not catalog data**
*As a casual wine lover, I want to search "restaurant in Barcelona" or "Christmas dinner" and find the wine I'm thinking of, because I never remember producer names.*

- Natural language search, not filter dropdowns.
- Search across my notes, locations, dates, companions, occasion tags -- whatever I attached.
- The AI agent should handle this: "Hey, what was that wine I had in Barcelona last summer?"

**US-4: Quick rating -- vibes, not scores**
*As a casual wine lover, I want to rate a wine with a simple "loved it / liked it / meh / not for me" scale so I can quickly sort my memories later.*

- I am not going to rate tannins on a 1-10 scale. Ever.
- 4 levels max. Ideally with emoji or icons, not numbers.
- This should be optional and tappable in a single gesture.

**US-5: Browse my memories as a visual feed**
*As a casual wine lover, I want to scroll through my wine memories like a photo feed, so it feels fun to revisit and not like a database.*

- Photos front and center, big and beautiful.
- My notes visible. Wine name visible. Where and when.
- It should feel like looking through a scrapbook, not a spreadsheet.

**US-6: Occasion/context chips at capture** *(promoted from Should Have after scrapbooker discussion)*
*As a casual wine lover, I want to tap a quick occasion chip (dinner, party, restaurant, travel, gift) right after capture, so my memories are searchable by context later.*

- 4-5 pre-built chips shown after capture, all skippable in one tap ("done"/"skip").
- NOT a blocking modal. Must be dismissible instantly.
- These chips power the recall scenarios: "What wine did I have at that dinner party?"
- Without occasion context, natural language search has nothing to match against.

**US-7: Cellar-to-memory bridge** *(identified through scrapbooker discussion)*
*As a casual wine lover, when I drink a bottle from my cellar and rate it, I want the option to save it as a memory with minimal extra effort.*

- After the existing drink/rate flow, offer "Save as memory?" -- wine data, date, and rating pre-filled.
- Optionally ask "What was the occasion?" (same chips) and "Add a photo?"
- This is the LOWEST friction path to a rich memory -- all the hard data already exists.
- May be how most memories get created for cellar users.

### Should Have (Would significantly improve the experience)

**US-8: "Want to try" list**
*As a casual wine lover, I want a separate wishlist for wines I haven't tried yet, so recommendations don't get mixed in with my actual experiences.*

- Quick add from a text input: "Carmenere from Chile"
- Quick add from the agent: "Remember this for later"
- Visible prompt when I'm at a wine shop: "You have 3 wines on your try list"

**US-9: "Add more details later" affordance** *(added after scrapbooker discussion)*
*As a casual wine lover, I want to optionally enrich a memory later when I'm browsing, without feeling pressured to do so.*

- In-app "Add a story?" prompt inside the memory card -- gentle, pretty, not a notification.
- Memory must look COMPLETE without any extra details. No empty fields, no progress bars.
- Browsing on a lazy Sunday is when I'd add context, not at capture time.

**US-10: Location capture**
*As a casual wine lover, I want the app to automatically capture where I am when I save a memory, so I can find "that wine from the Italian place" later.*

- Automatic GPS. Don't ask me to type an address.
- Reverse geocode to a human-readable place name.
- Optional -- if I deny location permission, just skip it silently. Don't nag.

**US-11: Share a recommendation**
*As a casual wine lover, I want to share a wine memory with a friend as a nice-looking card, not a raw link or screenshot.*

- "Share" button that generates a pretty image/card with the wine photo, name, my note, and my rating.
- Works in iMessage, WhatsApp, Instagram DMs.
- Should make me look like I know about wine (even if I don't).

### Nice to Have (Cool but I'm being honest about whether I'd use it)

**US-12: Map view**
*As a casual wine lover, I would occasionally enjoy seeing my wine memories on a map, connecting wines to travel memories.*

- Honestly? I'd use this once to show a friend, then forget about it.
- But it would be a great "wow" feature for onboarding.
- Low priority for V1.
- *(Note: chronological feed IS the timeline -- see scrapbooker discussion. The visual feed in US-5 already serves this need.)*

**US-13: Price tracking / re-purchase links**
*As a casual wine lover, I'd like the app to help me find where to buy a wine I liked, or track its price.*

- Useful in theory, but I'd probably just Google it myself.
- Only worth building if it can be genuinely accurate and local.

**US-14: Social feed / following friends**
*As a casual wine lover, I'd enjoy seeing what wines my friends are saving.*

- I'd use it for about a month. Then it becomes another social media feed I ignore.
- Unless my actual friend group was on this app, which is unlikely.
- Skip for V1. Focus on personal utility first.

---

## What Makes or Breaks Adoption

### MAKE (I'll keep using it)

1. **Under 5 seconds to capture** -- Photo, optional one-line note, done. If it takes longer, I'll just take a regular photo and forget about it.
2. **AI does the heavy lifting** -- I snap a photo, the app tells ME what wine it is, fills in the details. I'm not a data entry clerk.
3. **Useful recall** -- When I actually need to find a wine again, it works. Natural language search through the agent is the killer feature here.
4. **It looks good** -- My wine memories should feel premium, not like a to-do list. Nice photos, clean layout, satisfying to browse.
5. **It integrates with what I already do** -- I already use the cellar feature. My memories should connect to my cellar. "Add to cellar" from a memory, or auto-create a memory when I drink a bottle.

### BREAK (I'll abandon it within a week)

1. **Mandatory fields** -- If I have to fill in producer, region, vintage, or grape before saving, I'm out. I don't know half of that and I shouldn't have to.
2. **Slow or complicated capture flow** -- More than 2 taps to start saving? Gone. A loading screen while the AI processes before I can move on? Gone.
3. **No photos or ugly photo display** -- Wine is visual. If my memories are just text lists, it feels clinical and boring.
4. **Separate app or buried feature** -- If Remember is hidden 3 levels deep in navigation, I'll forget it exists. It needs to be a primary tab or one tap from home.
5. **Over-structured data entry** -- Asking me to tag, categorize, rate, and describe in a multi-step wizard for every memory. That's homework, not fun.

---

## The Agent Conversation Angle

This is where I get genuinely excited. The existing agent in Qve already identifies wines from photos and text. Extending that to memories feels natural:

**Saving via agent:**
> Me: "Save this -- had an amazing Barolo at Antonio's last night"
> Agent: "Got it! I've saved a memory for Barolo at Antonio's, last night. Want to add a photo or a quick rating?"
> Me: "Loved it"
> Agent: "Saved with a heart. I found that Antonio's serves several Barolos -- do you remember which one, or should I note it as 'Barolo at Antonio's'?"
> Me: "No idea, just the Barolo"
> Agent: "Perfect, saved as-is. You can always snap the label next time!"

**Recalling via agent:**
> Me: "What was that wine I had in Italy?"
> Agent: "I found 3 memories from Italy: a Barolo at Antonio's in Milan (loved it), a Vermentino in Cinque Terre (liked it), and a Chianti at the hotel in Florence (meh). Want details on any of these?"
> Me: "The Barolo -- can I find it near me?"
> Agent: "That was an unidentified Barolo from Antonio's. Want me to try to identify it from Italian Barolo producers, or should I suggest similar Barolos you might enjoy?"

This conversational recall is massively more useful than filter dropdowns. It's how I actually think about wine -- in stories and contexts, not in SKUs.

---

## Friction Points I'd Hit

1. **Camera permission prompt fatigue** -- If the app asks for camera access every time because I'm in a browser, that's annoying. Needs to feel native.
2. **AI identification failure** -- If I snap a label and the AI says "I couldn't identify this wine," I need to still save the memory easily. Don't make me re-do the flow.
3. **Syncing between devices** -- I capture on my phone at dinner, browse at home on my iPad. If memories don't sync, I lose trust immediately.
4. **Notification spam** -- "You haven't saved a memory in 7 days!" No. Don't. Stop.
5. **Cluttered home screen** -- If Remember adds 5 new navigation items and makes the existing cellar harder to use, I'd be annoyed. It should enhance, not clutter.

---

## My Honest Take on Minimum Viable Remember

For V1, I need exactly this (refined after scrapbooker discussion):

1. **A "Remember" button** accessible from the main screen -- opens camera or text input
2. **Photo capture with auto-identification** -- leveraging existing AI, async (save immediately, identify in background)
3. **Optional one-line note and vibe rating** (loved/liked/meh/nope)
4. **Skippable occasion chips** (dinner, party, restaurant, travel, gift) -- shown post-capture, one-tap each
5. **Auto-captured date and location**
6. **A chronological visual feed of memories** -- photos, names, notes, ratings, occasion context
7. **Agent-powered search** -- "what was that wine from..."
8. **Cellar-to-memory bridge** -- after drinking/rating a cellar bottle, offer "Save as memory?" with pre-filled data
9. **"Add more later" affordance** -- gentle in-card prompt, no guilt for sparse memories

That's it. No social features. No maps. No price tracking. Just capture quickly, browse beautifully, find again easily.

Everything else is V2.

---

## One More Thing: Motivation to Come Back

The hardest problem isn't capture -- it's retention. Why would I open my wine memories on a random Tuesday?

**Things that would bring me back:**
- Seeing a "This time last year" memory pop up (like phone photo memories)
- The agent suggesting a re-buy when I'm clearly browsing wines: "You loved the Malbec from Sarah's dinner -- want to add it to your cellar?"
- A friend asking for a recommendation and me thinking "I'll check my Qve memories"
- Planning a dinner party and browsing my "loved it" wines for what to serve
- Being at a wine shop and pulling up my try-list or re-buy list

**Things that would NOT bring me back:**
- Gamification (streaks, badges, levels) -- I'm 32, not 12
- Wine education tied to memories -- I'm here to remember, not study
- Social pressure (leaderboards, follower counts)
- Heavily curated content from the app -- I want MY memories, not a wine magazine

---

## Addendum: Cross-Persona Consensus

*After extensive discussion with the scrapbooker (power user) persona, we converged on 7 shared design principles. These represent agreement across the full user spectrum.*

### 7 Agreed Design Principles

1. **One capture flow, two depths.** Quick capture is 2-3 taps (photo, optional vibe, optional occasion chip, optional note). Rich context expands on demand, never by default.
2. **No empty-state guilt.** A photo-only memory is complete. A 15-field memory is complete. Cards render gracefully at any fill level. No greyed-out "missing" fields.
3. **AI does the cataloguing, humans do the remembering.** (North star.) AI fills facts (producer, vintage, region). Users add feelings (who, where, why, what it meant). This test resolves most "should we add field X?" decisions.
4. **Connections are AI-surfaced, not user-built.** No manual link buttons. The agent says "this is similar to the Malbec from Sarah's" based on matching. The agent IS the connection engine.
5. **Auto-suggested organization, not manual taxonomy.** "Group these 3 wines as an event?" is offered, not demanded. Smart collections are query-based retention hooks.
6. **Share = pretty card via messaging.** No social feed, no profiles, no followers. Just a "share this one" button that generates a beautiful card for iMessage/WhatsApp.
7. **Wish list is first-class.** "Want to try" is weekly-use for both personas. As easy to capture as a memory.

### What the Scrapbooker Changed My Mind On

- **Occasion chips promoted to essential** -- I had these as "should have" but they power my own recall scenarios. 5 skippable chips post-capture adds ~1 second, saves weeks of future searching.
- **Cellar-to-memory bridge** -- The lowest-friction path to a rich memory. When you drink/rate a cellar bottle, all wine data is pre-filled. Just add occasion + optional photo. May be the highest-volume memory creation path.
- **"Add more later" as a design principle** -- Not nagging notifications, but gentle in-card affordances. "Add a story?" when browsing, not at capture time.
- **Timeline IS the chronological feed** -- I was against "timeline" as a feature, but the visual chronological feed I wanted IS a timeline. We agreed; I was just reacting to the word.

### What I Convinced the Scrapbooker On

- **AI-surfaced connections over manual links** -- "This reminded me of..." buttons are power-user overhead. Agent-driven similarity surfacing is more powerful and zero-effort.
- **Auto-suggested collections over manual taxonomy** -- User-created tags and collections are V2. V1 leans on AI to suggest groupings.
- **Sharing matters (casually)** -- Not a public journal, but the ability to text a friend a pretty wine card is a real use case the private-journal mindset was undervaluing.

---

*Written as the kind of user who makes or breaks a consumer app: enthusiastic enough to try it, impatient enough to drop it if it's not immediately useful.*
