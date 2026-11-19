---
status: approved
---

# Design brief: Ghost Hands (Bowline)

## The one spatial moment
I'm at step 2 of the bowline, "the rabbit comes up through the hole," with my rope on the table and the small loop already made. Ghost hands appear right above my rope, at my hands' position and from my own point of view, holding a faint ghost copy of the rope tip that overlaps mine. In a 2–3 second loop they push the ghost tip up through the loop from underneath, then freeze at the end pose. My own tip glows, and a dotted line traces the path from my tip, under the loop, and up through it. My rope doesn't move until I pinch my tip and drag it along that line.

## Why it belongs on glasses
- Uses: shares your view, draws in the world, leaves your body free.
- Why it's better than the phone or laptop version: in a video the teacher's hands face the wrong way, the key move hides behind their fingers, and my hands are too busy holding the rope to pause. Here the teacher's hands are where my hands are, seen from my own point of view, showing one small step and waiting for me.

## Product or overlay
- Type: overlay. The ghost hands teach on top of a real rope.
- What the real version would sense: my real rope and hands, to know when I've finished each step.
- Stand-in for the preview: a virtual rope on a virtual table. "My rope" is the virtual rope, and dragging its glowing tip along the dotted path stands in for doing the move with a real rope.

## Where things live
- Where the user is looking during the main task: down at the rope on the table, about 45 cm in front and well below eye level.
- Table: virtual counter-height table, top about 95 cm high, front edge about 30 cm from the user.
- Rope: about 60 cm long and 1 cm thick, lying left to right across the middle of the table. The bowline loop is about 8 cm wide. The whole working area fits in about 20 x 15 cm so it stays in view.
- Ghost hands and ghost rope tip: directly above the rope at the user's hand position, the ghost tip overlapping the real tip. The ghost rope is faint.
- Dotted path: from the user's tip, under the loop, and up through it, on the rope.
- Step marker: a row of four small dots plus a one-line label for the current step, lying flat on the table about 8 cm beyond the rope (same glance as the loop).
- Buttons (Replay step, Slower, Tighten, Again): each about 12 x 6 cm, lying on the table about 15 cm to the right of the loop, nearest the right hand, so arms stay low.
- Start card: center of the table at start. Shows "Bowline" and "The rabbit comes out of the hole, around the tree, and back down the hole."

## Look
- Ghost hands: light blue, semi-transparent, glowing edges, real hand size.
- Ghost rope tip: the same light blue.
- Dragged (user's) tip: glows white.
- Off-path warning: orange. Success: green.
- Nothing dark anywhere, since black renders as transparent on the display.

## Hands and input
- Start: pinch the Bowline start card to begin the lesson.
- Main move: pinch the glowing rope tip and drag it along the dotted path.
  - Reaching the end: the tip snaps into place, the step dot turns green with a short chime, and the Lens moves on automatically after about 0.5 s. No button press needed with rope in hand.
  - Letting go halfway: the tip stays where it was left, still glowing, and can be pinched again to continue.
  - More than about 3 cm off the line: the tip turns orange with a soft low sound and the dotted line pulses. Letting go while orange slides the tip back to the last checkpoint.
- Replay step (button): replays the current ghost loop at any time.
- Slower (button, toggle): replays the current ghost loop at half speed and stays slow until pressed again.
- Tighten (button): plays the ghost hands pulling the knot tight; the rope settles into the finished bowline, and a check and chime appear.
- Again (button): restarts from step 1 with less help. Round 2: ghost hands half transparent. Round 3: no ghost, only the dotted path and checkpoints.
- Targets are big and highlight when aimed at. All buttons stay 12 x 6 cm the whole time.
- Voice: none.

## When things show
- Start card: shows at start, disappears when pinched.
- Rope and the four step dots: always visible during the lesson.
- Step label: only for the current step. Labels (default, from the rhyme): 1 "Make the hole", 2 "Up through the hole", 3 "Around the tree", 4 "Back down the hole".
- Ghost hands: show only while demonstrating and holding their end pose; fade out as soon as the user completes the step. The loop takes 2–3 s.
- Glowing tip and dotted path: only on the user's turn.
- Replay step and Slower: visible during the steps, dimmed but full size.
- Tighten: appears only after step 4 is done, replacing Replay step and Slower.
- Again: appears only after the check, replacing Tighten.
- If something needs attention out of view: none. Everything sits in the 20 x 15 cm working area.

## Done criteria
Each one can be checked in Lens Studio's preview.
1. Pinching the Bowline start card makes the rope and ghost hands appear on the table about 45 cm in front, below eye level, and the card disappears.
2. The ghost hands loop step 1 and then hold their end pose; my rope tip glows and a dotted path appears.
3. Dragging the tip along the path to the end snaps it into place, turns the step dot green with a chime, and the ghost starts the next step by itself.
4. Dragging the tip off the line turns it orange, and letting go slides it back to the last checkpoint.
5. After step 4, Tighten appears; pressing it shows the finished knot with a check, then Again restarts with a half-transparent ghost, and round 3 shows only the path.

## Out of scope
- Any knot other than the bowline.
- Recognizing or tracking a real rope or real hands.
- Two-hand rope handling. Only the tip is moved, with one pinch-and-drag.
- Voice control.
- Saving progress between sessions.

## Risks and open questions
- The rope bending as the tip is dragged is the hardest part to build. Handled by authored per-step splines instead of physics (see Build notes).
- On real glasses the user would move a real rope, so the Lens would need to recognize real rope and hand positions to know a step is done. Only the preview stand-in is proven here.
- Feel unproven: whether ghost hands at your own hand position read clearly from a first-person view on the real display, and comfort over time.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Rope: don't simulate physics. Author the rope's shape for the start and end of each step as a spline. While the user drags, move the tip along that step's predefined path and blend the rope shape by how far along the path the tip is.
- Ghost hands: reuse the hand model from the Interaction Kit's HandVisuals, duplicate it as a ghost with a semi-transparent material, and animate it with a few keyframed poses per step. No real hand tracking needed.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
