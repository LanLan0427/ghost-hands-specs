# Ghost Hands: learn the bowline with hands that are where yours are

Ghost Hands is a Lens for SPECS that teaches the bowline knot one small step at a time.
Light-blue ghost hands appear right above your rope, at your own hand position and from your
own point of view, and show the next move in a 2–3 second loop. Then they wait. Your rope tip
glows, a dotted line shows where it goes, and you do the move yourself by pinching the tip and
dragging it along the line.

It's for anyone who has tried to learn a knot from a video and got lost: sailors, climbers,
campers and beginners in general. In a video the teacher's hands face the wrong way, the key
move hides behind their fingers, and your hands are too busy holding the rope to pause it. Here
the teacher's hands are where your hands are, the move is never hidden, and the lesson waits
for you.

Built for **Learn AR with SPECS** (Devpost). The design brief is in
[`devpost/design-brief.md`](devpost/design-brief.md).

> **What is proven and what isn't.** The rope on the table is a virtual stand-in for a real
> rope (see the brief). The lesson flow is proven in Lens Studio's preview by the LEAF tests
> below. How it feels on the real see-through display (whether the ghost hands read clearly
> and how comfortable it is over time) can't be judged in the preview, because no SPECS device
> was available.

## How to run it

1. Install **Lens Studio 5.25** and clone this repo. If the binary files come down as small
   text pointers, run `git lfs pull` (packages, icons, sounds and the HDR are stored with Git LFS).
2. Open `GhostHands.esproj` in Lens Studio.
3. In the **Preview** panel, choose **Interactive Preview** with SPECS as the device.
4. Put the preview camera at the eye position the lesson is laid out for: position
   **(0, 0, 0)**, looking at **(0, −64.5, −46)**, which is the loop on the table. This is the
   same eye position the layout tests measure from, so what you see matches the tests.
5. Click the **Bowline** card on the table to start (in Interactive Preview a click is a pinch).

Moving around Interactive Preview: WASD to move, Q and E to go down and up, right-drag (or hold
Shift) to look around.

## Controls

| Control | What it does |
| --- | --- |
| **Bowline card** | Starts the lesson. |
| **Drag the rope tip** | Pinch your glowing (white) rope tip and drag it along the dotted line. At the end it snaps into place, the step dot turns green with a chime, and the next step starts by itself. If you drift more than about 3 cm off the line, the tip turns orange; let go and it slides back to the last checkpoint. Let go anywhere else and it stays put, ready to pinch again. |
| **Replay step** | Plays the ghost hands' demo of the current step again. |
| **Slower** | Toggle. Replays the demo at half speed and stays slow until pressed again. |
| **Tighten** | Appears after step 4. The ghost hands pull the knot tight and the rope settles into the finished bowline, with a check and a chime. |
| **Again** | Appears after the check. Restarts with less help: round 2 has half-transparent ghost hands, round 3 has no ghost, only the dotted line and checkpoints. |

The four steps follow the rhyme: 1 "Make the hole", 2 "Up through the hole", 3 "Around the
tree", 4 "Back down the hole".

## Running the 10 LEAF tests

The tests use LEAF (Lens Studio's scenario test framework) and live in `Assets/Tests`. They
are registered in `Assets/Tests/LeafIndex.ts`.

1. Install the **LeafPlugin** from the Lens Studio Asset Library (Plugin Manager) if you don't
   have it, then restart Lens Studio.
2. Open the LEAF panel, pick a scenario and run it in preview. Run them one at a time, because
   each run resets the Lens.
3. For `gh10`, the Interactive Preview camera must be at the eye position from step 4 of "How
   to run it". The test checks this and fails if the camera has been moved.

| Scenario | What it checks |
| --- | --- |
| `gh1-start-card` | Done criterion 1: pinching the start card shows the rope and ghost hands on the table about 45 cm in front and below eye level, and the card goes away. |
| `gh2-demo-hold` | Done criterion 2: the ghost loops step 1 and then holds its end pose; your tip glows and the dotted line appears. |
| `gh3-drag-snap` | Done criterion 3: a real drag to the end of the path snaps the tip, turns the dot green with a chime, and starts the next step. |
| `gh4-off-path` | Done criterion 4: dragging off the line turns the tip orange, and letting go slides it back to the last checkpoint. |
| `gh5-tighten-rounds` | Done criterion 5: Tighten shows the finished knot and check, Again gives round 2 with a half-transparent ghost and round 3 with only the path. |
| `gh6-real-drag-steps` | All four steps done with real pinch-drags along their paths; every frame is checked (never orange, progress only forward, rope end follows the tip). |
| `gh7-replay-slower` | Replay step and Slower pressed with real pinches: Slower takes about twice as long, stays slow on Replay, and returns to normal; the ghost hand really performs the move each time. |
| `gh8-finished-knot` | After Tighten the rope is a recognisable bowline: fixed loop, tail inside the loop, standing part leading away; the left ghost hand pulls on the rope; the check badge doesn't cover the knot. |
| `gh9-ghost-hands-pose` | Ghost hands read as your own hands: right hand pinches the tip with thumb and index, left hand holds the loop in steps 2–4, palms down, fingers away from you, wrists toward you, fingers above the table. |
| `gh10-visual-hierarchy` | Hands are a faint outline with glowing thumb and index tips; the light-blue ghost rope tip is the brightest ghost element and distinct from your white tip; every button is fully in view while looking at the loop; the step label is one size bigger. |

All 10 pass in Lens Studio's preview (Lens Studio 5.25).

## How it was built

1. **Plan.** The `plan-lens` skill from the Devpost Learn skill pack (`agent/skills/plan-lens`,
   source `challengepost/learn-specs`) interviewed me about the idea, checked it against AR
   design rules and what the preview can do, and wrote
   [`devpost/design-brief.md`](devpost/design-brief.md).
2. **Build.** Claude Code built the Lens from that brief through **CLAD** (the Lens Studio
   agent toolkit) and the **Lens Studio MCP** server: TypeScript components in
   `Assets/Scripts`, the scene, the ghost-hand material and shader, and the generated sound
   effects.
3. **Test and review.** Claude Code wrote the LEAF scenarios in `Assets/Tests` and ran them in
   preview. I reviewed the preview from the user's point of view and gave design notes (for
   example "make the hand fill almost invisible", "move the buttons into view"), and each round
   was re-tested and committed.

Main design decisions:

- **No rope physics.** The rope's shape is authored for each step, and the rope bends by
  blending between those shapes as the tip moves along the step's path.
- **Ghost hands are rigged Interaction Kit hand models**, posed joint by joint: thumb and index
  pinch the ghost rope tip, the other fingers curl and stay above the table.
- **The ghost stays out of the way of the move.** The hands are only a faint glowing outline
  with glowing thumb and index tips, so the loop and rope under them stay visible.

Changes from the brief made during review: the buttons are 9 × 4.5 cm, about 7.5 cm right of
the loop (the brief said 12 × 6 cm and 15 cm), so the whole button stays in view while you look
at the rope. The ghost rope tip is a lighter, brighter blue than the hands so your eye follows
the rope.

## Pre-existing work

This project builds on the following, none of which was written for this submission:

- **SPECS Base Template** (Lens Studio project template: camera, render target, preview
  environment, including `Assets/Render/Echopark.hdr`)
- **Spectacles Interaction Kit** (`Packages/InteractionKit.lspkg`), including the hand models
  the ghost hands are made from
- **UI Kit** (`Packages/UIKit.lspkg`)
- **Motion** (`Packages/Motion.lspkg`)
- **LEAF** test framework (`Packages/Leaf.lspkg`) and the LeafPlugin
- **Bitmoji 3D** package (`Packages/Bitmoji 3D.lsc`), installed by LEAF for its avatar
  interactor (used by the `gh1` test); the Lens itself doesn't use it
- Lens Studio's preset shaders (`Assets/Materials/pbr.graphShader`, `simple_pbr.graphShader`,
  `unlit.graphShader`), which the rope, table and ghost materials are built on
- **Icons** package (`Packages/Icons.lspkg`, Google Material Icons) and the **AI Preview Agent**
  packages (`Packages/AiPreviewAgentInspect.lspkg`, `Packages/AiPreviewAgentInteract.lspkg`),
  installed by the Lens Studio tooling to pick icons and to inspect and drive the preview
- **Devpost Learn skill pack** (`plan-lens`, in `agent/skills/plan-lens`)

All Lens code in this repo (`Assets/Scripts`, `Assets/Tests`, and the ghost-hand shader
`Assets/Materials/GhostHandsGhostRim.graphShader`) was written during the submission period by
Claude Code through CLAD.
