# Ghost Hands：示範手就在你手的位置，一步一步教你打稱人結

[English](README.md) | 繁體中文

Ghost Hands 是一個 SPECS Lens，把稱人結（bowline）拆成幾個小步驟來教。淡藍色的示範手會出現在你的繩子正上方，
就在你自己的手會在的位置，而且是從你自己的視角看過去，用 2–3 秒的循環示範下一個動作，然後停下來等你。
你的繩頭會發光，一條虛線告訴你要往哪裡走，你捏住繩頭沿著虛線拖過去，自己完成這個動作。

適合所有看影片學繩結卻學不會的人：玩帆船、攀岩、露營的人，以及一般初學者。影片裡老師的手方向是反的，
關鍵動作被手指擋住，而且你雙手拿著繩子，沒辦法按暫停。在這裡，老師的手就在你的手的位置，動作不會被擋住，
課程也會等你跟上。

本專案為 **Learn AR with SPECS**（Devpost）參賽作品。設計簡報在
[`devpost/design-brief.md`](devpost/design-brief.md)。

> **哪些已驗證、哪些還沒有。** 桌上的繩子是用來代替真實繩子的虛擬繩（見設計簡報）。課程流程已由下方的
> LEAF 測試在 Lens Studio 預覽中驗證。實際戴在透視顯示的眼鏡上感覺如何（示範手看不看得清楚、長時間是否舒適），
> 因為手邊沒有 SPECS 眼鏡，無法在預覽中判斷。

## 如何執行

1. 安裝 **Lens Studio 5.25** 並 clone 這個 repo。如果二進位檔下載下來是很小的文字指標檔，請執行 `git lfs pull`
   （套件、圖示、音效和 HDR 都用 Git LFS 存放）。
2. 在 Lens Studio 開啟 `GhostHands.esproj`。
3. 在 **Preview** 面板選 **Interactive Preview**，裝置選 SPECS。
4. 把預覽相機放在課程設計時假設的眼睛位置：位置 **(0, 0, 0)**，看向 **(0, −64.5, −46)**，也就是桌上那個小圈。
   版面測試也是從這個位置量測，所以你看到的畫面會和測試一致。
5. 點桌上的 **Bowline** 卡片開始（在 Interactive Preview 中，點一下就等於 pinch）。

在 Interactive Preview 中移動：WASD 前後左右移動，Q 和 E 下降與上升，按住右鍵拖曳（或按住 Shift）轉動視角。

## 操作

| 操作 | 作用 |
| --- | --- |
| **Bowline 卡片** | 開始課程。 |
| **拖曳繩頭** | 捏住你發光的（白色）繩頭，沿虛線拖。拖到終點會吸附到位，步驟圓點變綠並發出叮聲，下一步自動開始。偏離虛線超過約 3 cm，繩頭會變橘色；放手後會滑回上一個檢查點。在其他地方放手則停在原處，可以再捏起來。 |
| **Replay step** | 再播一次示範手的這一步。 |
| **Slower** | 切換鍵。以半速重播示範，再按一次才恢復正常速度。 |
| **Tighten** | 第 4 步完成後出現。示範手把繩結拉緊，繩子變成完成的稱人結，出現打勾和叮聲。 |
| **Again** | 打勾後出現。以較少的提示重新開始：第 2 輪示範手半透明，第 3 輪沒有示範手，只剩虛線和檢查點。 |

四個步驟跟著口訣走：1「Make the hole」（做出小洞）、2「Up through the hole」（兔子從洞裡鑽出來）、
3「Around the tree」（繞樹一圈）、4「Back down the hole」（鑽回洞裡）。

## 執行 10 個 LEAF 測試

測試使用 LEAF（Lens Studio 的情境測試框架），放在 `Assets/Tests`，並在 `Assets/Tests/LeafIndex.ts` 註冊。

1. 如果還沒裝，從 Lens Studio Asset Library（Plugin Manager）安裝 **LeafPlugin**，然後重新啟動 Lens Studio。
2. 開啟 LEAF 面板，選一個情境在預覽中執行。請一次跑一個，因為每次執行都會重設 Lens。
3. 執行 `gh10` 時，Interactive Preview 的相機必須在「如何執行」第 4 步的眼睛位置。測試會檢查這點，相機被移動過就會失敗。

| 情境 | 檢查內容 |
| --- | --- |
| `gh1-start-card` | 完成標準 1：捏開始卡後，繩子和示範手出現在桌上、約前方 45 cm、低於視線的位置，卡片消失。 |
| `gh2-demo-hold` | 完成標準 2：示範手循環播放第 1 步後停在結束姿勢；你的繩頭發光，虛線出現。 |
| `gh3-drag-snap` | 完成標準 3：真的拖到路徑終點時，繩頭吸附、圓點變綠並發出叮聲，下一步開始。 |
| `gh4-off-path` | 完成標準 4：拖離虛線時繩頭變橘色，放手後滑回上一個檢查點。 |
| `gh5-tighten-rounds` | 完成標準 5：Tighten 顯示完成的繩結和打勾；Again 進入第 2 輪（示範手半透明）和第 3 輪（只剩路徑）。 |
| `gh6-real-drag-steps` | 用真實的 pinch 拖曳完成全部四步；每一格畫面都檢查（從不變橘、進度只往前、繩尾跟著繩頭走）。 |
| `gh7-replay-slower` | 用真實的 pinch 按 Replay step 和 Slower：Slower 大約花兩倍時間、Replay 時保持慢速、可恢復正常；示範手每次都真的做出動作。 |
| `gh8-finished-knot` | Tighten 之後繩子是看得出來的稱人結：固定的圈、繩尾在圈內、主繩往外延伸；左手示範手拉著繩子；打勾標記不會擋住繩結。 |
| `gh9-ghost-hands-pose` | 示範手看起來像你自己的手：右手用拇指和食指捏繩頭，第 2–4 步左手扶著小圈，手掌朝下、手指朝前、手腕朝向你，手指在桌面上方。 |
| `gh10-visual-hierarchy` | 手只是淡淡的輪廓，拇指和食指指尖發光；淡藍色示範繩頭是示範元素中最亮的，且和你的白色繩頭有明顯區別；看著小圈時每個按鈕都完整在視野內；步驟文字大一級。 |

10 個測試都在 Lens Studio 預覽（Lens Studio 5.25）中通過。

## 製作過程

1. **規劃。** Devpost Learn skill pack 的 `plan-lens` 技能（`agent/skills/plan-lens`，來源
   `challengepost/learn-specs`）訪談我的想法，對照 AR 設計原則和預覽能做到的事，寫出
   [`devpost/design-brief.md`](devpost/design-brief.md)。
2. **建置。** Claude Code 依照那份簡報，透過 **CLAD**（Lens Studio agent 工具組）和 **Lens Studio MCP** 伺服器
   建出這個 Lens：`Assets/Scripts` 裡的 TypeScript 元件、場景、示範手的材質和 shader，以及生成的音效。
3. **測試與檢視。** Claude Code 撰寫 `Assets/Tests` 的 LEAF 情境並在預覽中執行。我從使用者的角度檢視預覽並提出
   設計意見（例如「手的填色幾乎要看不見」、「把按鈕移進視野」），每一輪都重新測試並 commit。

主要設計決定：

- **不用繩子物理模擬。** 每一步的繩子形狀是事先設計好的，繩頭沿路徑移動時，在這些形狀之間混合來讓繩子彎曲。
- **示範手是 Interaction Kit 的骨架手部模型**，逐個關節擺姿勢：拇指和食指捏住示範繩頭，其他手指彎曲並保持在桌面上方。
- **示範手不擋住動作。** 手只有淡淡的發光輪廓，加上發光的拇指和食指指尖，下方的小圈和繩子都看得到。

檢視過程中相對於簡報的修改：按鈕改為 9 × 4.5 cm，放在小圈右側約 7.5 cm（簡報寫 12 × 6 cm、15 cm），
讓你看著繩子時整顆按鈕都在視野內。示範繩頭用比手更淺、更亮的藍色，讓視線跟著繩子走。

## 既有作品

本專案建立在以下既有作品之上，這些都不是為這次參賽而寫：

- **SPECS Base Template**（Lens Studio 專案範本：相機、render target、預覽環境，包含 `Assets/Render/Echopark.hdr`）
- **Spectacles Interaction Kit**（`Packages/InteractionKit.lspkg`），包含示範手所用的手部模型
- **UI Kit**（`Packages/UIKit.lspkg`）
- **Motion**（`Packages/Motion.lspkg`）
- **LEAF** 測試框架（`Packages/Leaf.lspkg`）和 LeafPlugin
- **Bitmoji 3D** 套件（`Packages/Bitmoji 3D.lsc`），由 LEAF 為其 avatar interactor 安裝（`gh1` 測試使用）；Lens 本身沒有使用
- Lens Studio 的預設 shader（`Assets/Materials/pbr.graphShader`、`simple_pbr.graphShader`、`unlit.graphShader`），
  繩子、桌子和示範手的材質以此為基礎
- **Icons** 套件（`Packages/Icons.lspkg`，Google Material Icons）和 **AI Preview Agent** 套件
  （`Packages/AiPreviewAgentInspect.lspkg`、`Packages/AiPreviewAgentInteract.lspkg`），由 Lens Studio 工具安裝，
  用來挑選圖示以及檢查和操作預覽
- **Devpost Learn skill pack**（`plan-lens`，位於 `agent/skills/plan-lens`）

本 repo 中所有 Lens 程式碼（`Assets/Scripts`、`Assets/Tests`，以及示範手 shader
`Assets/Materials/GhostHandsGhostRim.graphShader`）都是在參賽期間由 Claude Code 透過 CLAD 撰寫。

英文版 [README.md](README.md) 為主要版本，兩者內容不一致時以英文版為準。
