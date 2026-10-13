/**
 * 白噪音播放引擎（expo-audio）
 * ---------------------------------------------------------------------------
 * 这里只负责「把一段音频播出来」这一件事：加载、循环、音量、暂停、释放。
 * **什么时候该播**由 components/AmbienceProvider.tsx 统一决定 ——
 * 播放规则只能有一处，否则设置页试听和计时器自动播放会互相打架。
 *
 * 两个容易踩的坑，已在这里处理：
 *
 *   1. iOS 静音键。默认音频会话在静音档下不出声 —— 用户以为「App 没声音」，
 *      其实是被系统静音了。白噪音属于内容本身（不是提示音），所以会话固定为
 *      playsInSilentMode: true，静音档下也照常播放。
 *   2. 与别人的音乐共存。interruptionMode 用 mixWithOthers：用户一边听歌一边
 *      专注是常见用法，不该把对方的播放器掐掉。
 *
 * 音频资源在 assets/sounds/，由 scripts/audio/gen_ambience.py 用 DSP 合成，
 * 版权干净、严格无缝循环（详见该脚本头部注释）。
 */

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioSource } from 'expo-audio';
import type { SoundId } from '../types';

/** SoundId → 打包进来的音频资源（Metro 会把 m4a 作为静态资源处理） */
const SOURCES: Record<SoundId, AudioSource> = {
  rain: require('../../assets/sounds/rain.m4a'),
  library: require('../../assets/sounds/library.m4a'),
  forest: require('../../assets/sounds/forest.m4a'),
  cafe: require('../../assets/sounds/cafe.m4a'),
  ocean: require('../../assets/sounds/ocean.m4a'),
  fireplace: require('../../assets/sounds/fireplace.m4a'),
  night: require('../../assets/sounds/night.m4a'),
  cafe_street: require('../../assets/sounds/cafe_street.m4a'),
};

/** 专注计时中播放的音量：垫在背景里，不抢注意力 */
export const SESSION_VOLUME = 0.5;
/** 设置页试听音量：略高一点，让用户听清这段声音是什么 */
export const PREVIEW_VOLUME = 0.72;

let player: AudioPlayer | null = null;
let loadedId: SoundId | null = null;
let modeReady = false;

/** 音频会话只需设一次；失败也不影响后续（最多是静音档下不出声） */
function ensureAudioMode() {
  if (modeReady) return;
  modeReady = true;
  setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'mixWithOthers',
    shouldPlayInBackground: false,
  }).catch(e => console.warn('[GrowTime] setAudioModeAsync failed', e));
}

/** 启动时预热一次会话，避免首次点击时的延迟 */
export function initAmbience() {
  ensureAudioMode();
}

/** 正在播放（或已加载）的声音 */
export function loadedSound(): SoundId | null {
  return player && player.playing ? loadedId : null;
}

/**
 * 播放指定白噪音（已在放同一段则只调音量，不重新加载 —— 否则每次状态变化
 * 都会从头开始，听感上像被切断）。
 */
export function playSound(id: SoundId, volume: number) {
  try {
    ensureAudioMode();
    if (player && loadedId === id) {
      player.volume = volume;
      if (!player.playing) player.play();
      return;
    }
    releaseSound();
    const p = createAudioPlayer(SOURCES[id]);
    p.loop = true;
    p.volume = volume;
    p.play();
    player = p;
    loadedId = id;
  } catch (e) {
    // 播放失败不能拖垮界面：设置页照常可用，只是听不到声音
    console.warn('[GrowTime] play ambience failed', e);
  }
}

/** 暂停但保留已加载的音频（计时器暂停 → 继续时能立刻接着响） */
export function pauseSound() {
  try {
    if (player?.playing) player.pause();
  } catch (e) {
    console.warn('[GrowTime] pause ambience failed', e);
  }
}

/** 彻底释放（切换声音前调用） */
export function releaseSound() {
  try {
    player?.pause();
    player?.remove();
  } catch {
    // remove 失败无需处理：下次 createAudioPlayer 会新建实例
  }
  player = null;
  loadedId = null;
}

export { SOURCES as SOUND_SOURCES };
