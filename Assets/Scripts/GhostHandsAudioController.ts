// GhostHandsAudioController.ts
// Owns: four short SFX cues for the Ghost Hands bowline lesson (step success,
// off-path warning, knot finished, button tap) on child AudioComponents under
// its own SceneObject ("AudioRoot").
// Expects: @input volume (0..1). SFX assets are fixed internal requireAsset literals.
// Produces: playSuccess(), playWarning(), playFinished(), playTap(),
//           getLastSfx(): SfxName, getPlayCount(): number.
// Must not: call sibling components, play music, or create any UI or text components.

import { SfxName } from "./GhostHandsSceneContracts";

const SFX_SUCCESS = requireAsset("../GeneratedSFX/StepSuccessChime.wav") as AudioTrackAsset;
const SFX_WARNING = requireAsset("../GeneratedSFX/OffPathWarning.wav") as AudioTrackAsset;
const SFX_FINISHED = requireAsset("../GeneratedSFX/KnotFinishedChime.wav") as AudioTrackAsset;
const SFX_TAP = requireAsset("../GeneratedSFX/ButtonTap.wav") as AudioTrackAsset;

@component
export class GhostHandsAudioController extends BaseScriptComponent {
  @input
  @hint("SFX playback volume (0..1)")
  volume: number = 0.8;

  private players: { [name: string]: AudioComponent } = {};
  private lastSfx: SfxName = "";
  private playCount: number = 0;

  onAwake(): void {
    const vol = Math.max(0, Math.min(1, this.volume));
    this.createPlayer("StepSuccessChime", SFX_SUCCESS, vol);
    this.createPlayer("OffPathWarning", SFX_WARNING, vol);
    this.createPlayer("KnotFinishedChime", SFX_FINISHED, vol);
    this.createPlayer("ButtonTap", SFX_TAP, vol);
  }

  playSuccess(): void {
    this.playCue("StepSuccessChime");
  }

  playWarning(): void {
    this.playCue("OffPathWarning");
  }

  playFinished(): void {
    this.playCue("KnotFinishedChime");
  }

  playTap(): void {
    this.playCue("ButtonTap");
  }

  getLastSfx(): SfxName {
    return this.lastSfx;
  }

  getPlayCount(): number {
    return this.playCount;
  }

  private createPlayer(name: SfxName, track: AudioTrackAsset, vol: number): void {
    if (!track) {
      print("[GhostHandsAudioController] missing audio track for " + name);
      return;
    }
    const child = global.scene.createSceneObject("SFX_" + name);
    child.setParent(this.getSceneObject());
    const audio = child.createComponent("Component.AudioComponent") as AudioComponent;
    audio.audioTrack = track;
    audio.volume = vol;
    // Input-reactive cues: minimize latency on Specs (default is LowPower).
    audio.playbackMode = Audio.PlaybackMode.LowLatency;
    this.players[name] = audio;
  }

  private playCue(name: SfxName): void {
    this.lastSfx = name;
    this.playCount++;
    const audio = this.players[name];
    if (!audio) {
      print("[GhostHandsAudioController] no player for " + name);
      return;
    }
    try {
      if (audio.isPlaying()) {
        audio.stop(false);
      }
      audio.play(1);
    } catch (e) {
      print("[GhostHandsAudioController] play failed for " + name + ": " + e);
    }
  }
}
