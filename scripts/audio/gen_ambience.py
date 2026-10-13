#!/usr/bin/env python
"""GrowTime 白噪音生成器
================================================================================
为什么不用现成素材：App Store 上架的音频必须有可商用授权证明。与其去下载
来源不明的「免费白噪音」，不如用 DSP 合成 —— 版权 100% 干净、体积可控、
也方便按场景微调。

关键技巧：用 FFT 频域合成噪声
  - 在频域按目标频谱（1/f^α、带通、低通）给随机相位，再逆变换回时域
  - 得到的信号在整个循环长度上**天然严格周期**，因此首尾无缝，
    不需要交叉淡化（交叉淡化会在噪声里留下可听见的音量凹陷）
  - 所有调制（海浪起伏、咖啡馆人声起伏）也用整数周期的正弦叠加，
    保证调制本身也是周期的

产出：GrowTime/assets/sounds/<id>.m4a（mono 44.1kHz AAC 96kbps）

为什么是 m4a 而不是 mp3：
  MP3 编码器会插入约 26ms 的 priming 静音，解码端若不读 LAME 头就无法剔除 ——
  循环播放在连续雨声里会变成每 24 秒一次的轻微"咔哒"。AAC/MP4 用 edit list
  记录 priming，iOS(AVFoundation) 原生按 edit list 裁剪，循环点干净。
  （实测对照：ffprobe/解码 MP3 得到 24.033s 且开头 26ms 近乎静音；m4a 得到 24.000s）

用法：
  python scripts/audio/gen_ambience.py            # 生成全部
  python scripts/audio/gen_ambience.py rain       # 只生成指定的一两个
"""

from __future__ import annotations

import sys
from pathlib import Path

import av
import numpy as np
import soundfile as sf

SR = 44100
LOOP_SECONDS = 24
N = SR * LOOP_SECONDS
OUT_DIR = Path(__file__).resolve().parents[2] / "assets" / "sounds"

Target = float  # numpy 数组别名，仅用于可读性


# ---------------------------------------------------------------------------
# 基础工具
# ---------------------------------------------------------------------------

def spectral_noise(n: int, shape, seed: int) -> np.ndarray:
    """按频谱形状生成一段时域噪声（严格周期，首尾无缝）。"""
    rng = np.random.default_rng(seed)
    freqs = np.fft.rfftfreq(n, 1 / SR)
    spec = rng.normal(size=freqs.size) + 1j * rng.normal(size=freqs.size)
    spec *= shape(np.maximum(freqs, 1e-6))
    spec[0] = 0.0
    x = np.fft.irfft(spec, n)
    peak = np.max(np.abs(x))
    return x / peak if peak > 0 else x


def pink(cut_lo: float = 20.0, cut_hi: float = 16000.0, alpha: float = 0.9):
    """1/f^α 噪声，带高低切。雨声、风底噪都用它。"""
    def shape(f):
        s = (f / 1000.0) ** (-alpha)
        s *= 1.0 / (1.0 + (cut_lo / f) ** 4)
        s *= 1.0 / (1.0 + (f / cut_hi) ** 4)
        return s
    return shape


def brown(cut: float = 400.0, order: float = 2.0):
    """更厚重的低频噪声：海浪深处、夜间底噪。"""
    def shape(f):
        return (f / 1000.0) ** (-order) / (1.0 + (f / cut) ** 2)
    return shape


def band(center: float, q: float = 1.2, gain: float = 1.0):
    """对数域高斯带通：人声絮语、树叶沙沙、咖啡馆背景。"""
    def shape(f):
        x = np.log(f / center) / np.log(q)
        return gain * np.exp(-0.5 * x * x)
    return shape


def periodic_lfo(cycles: float, phase: float = 0.0, shape: float = 1.0) -> np.ndarray:
    """整数周期的调制波（cycles 必须是整数的一半以上的小数也行，只要保证周期闭合）。"""
    t = np.arange(N) / N
    return np.sin(2 * np.pi * cycles * t + phase)


def envelope_bursts(n: int, times: np.ndarray, decay: float, attack: float = 0.004) -> np.ndarray:
    """在给定时间点铺一串指数衰减包络（用于雨滴、鸟鸣、杯碟碰撞）。"""
    env = np.zeros(n, dtype=np.float64)
    for t0 in times:
        i0 = int(t0 * SR)
        length = int(decay * 4 * SR)
        if i0 < 0 or i0 >= n or length <= 0:
            continue
        idx = np.arange(length)
        e = np.exp(-idx / (decay * SR))
        rise = np.minimum(1.0, idx / max(1, attack * SR))
        e = e * rise
        end = min(n, i0 + length)
        env[i0:end] += e[: end - i0]
    return env


def place(n: int, times, render) -> np.ndarray:
    """把短事件渲染进长度 n 的缓冲；事件若越过边界则丢弃（保持循环无缝）。"""
    buf = np.zeros(n, dtype=np.float64)
    for t0 in times:
        seg = render()
        i0 = int(t0 * SR)
        if i0 < 0 or i0 + seg.size > n:
            continue
        buf[i0 : i0 + seg.size] += seg
    return buf


def spread(times_like, jitter: float, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    base = np.asarray(times_like, dtype=np.float64)
    return base + rng.uniform(-jitter, jitter, size=base.size)


def normalize(x: np.ndarray, rms_target: float) -> np.ndarray:
    rms = float(np.sqrt(np.mean(x**2)))
    if rms <= 0:
        return x
    x = x * (rms_target / rms)
    peak = float(np.max(np.abs(x)))
    if peak > 0.92:  # 软限制，避免爆音
        x = np.tanh(x / 0.92) * 0.92
    return x


# ---------------------------------------------------------------------------
# 事件音色
# ---------------------------------------------------------------------------

def droplet(seed: int, f0: float = 2600.0) -> np.ndarray:
    """雨滴：短促带通噪声 + 轻微下坠音高。"""
    rng = np.random.default_rng(seed)
    dur = 0.05
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f0 * (1 - 0.35 * t / dur)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR)
    noise = rng.normal(size=n) * 0.6
    env = np.exp(-t / 0.010)
    return (tone * 0.5 + noise) * env * 0.5


def page_turn(seed: int) -> np.ndarray:
    """翻书页：短促的高频摩擦噪声。"""
    rng = np.random.default_rng(seed)
    dur = 0.28
    n = int(dur * SR)
    x = rng.normal(size=n)
    # 一阶高通 + 慢速包络，模拟纸页摩擦
    hp = np.diff(np.concatenate([[0.0], x]))
    t = np.arange(n) / SR
    env = np.exp(-((t - 0.06) ** 2) / (2 * 0.045**2))
    return hp * env * 0.55


def cup_clink(seed: int) -> np.ndarray:
    """咖啡杯碟：两个高频衰减正弦的叠加。"""
    dur = 0.35
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = (
        np.sin(2 * np.pi * 1850 * t) * np.exp(-t / 0.035)
        + 0.7 * np.sin(2 * np.pi * 2640 * t) * np.exp(-t / 0.024)
        + 0.3 * np.sin(2 * np.pi * 4210 * t) * np.exp(-t / 0.015)
    )
    return x * 0.35


def chair_scrape(seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    dur = 0.4
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = rng.normal(size=n)
    # 简单的滑动平均做低通，再乘一个粗糙的包络
    kernel = np.ones(24) / 24
    x = np.convolve(x, kernel, mode="same")
    env = np.exp(-((t - 0.15) ** 2) / (2 * 0.09**2)) * (0.7 + 0.3 * np.sin(2 * np.pi * 34 * t) ** 2)
    return x * env * 0.5


def chirp(seed: int, base: float = 3200.0, notes: int = 3) -> np.ndarray:
    """鸟鸣：一小段颤音（中心频率上下摆动 + 快速起落）。"""
    rng = np.random.default_rng(seed)
    total = 0.16 * notes + 0.05
    n = int(total * SR)
    t = np.arange(n) / SR
    seq = np.zeros(n)
    for k in range(notes):
        s = int((k * 0.16) * SR)
        e = min(n, s + int(0.13 * SR))
        if e <= s:
            break
        tt = np.arange(e - s) / SR
        f = base * (1.0 + 0.16 * np.sin(2 * np.pi * 9 * tt) + 0.04 * tt / 0.13)
        seg = np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.045) * (1 - np.exp(-tt / 0.006))
        seq[s:e] += seg
    return seq * 0.32


def crackle(seed: int, loud: float = 1.0) -> np.ndarray:
    """柴火噼啪：极短的高频爆点。"""
    rng = np.random.default_rng(seed)
    dur = 0.05 * loud
    n = max(8, int(dur * SR))
    t = np.arange(n) / SR
    x = rng.normal(size=n) * np.exp(-t / 0.0035)
    return x * 0.5 * loud


def cricket(seed: int) -> np.ndarray:
    """蟋蟀：一串 25Hz 调制的 4.6kHz 音。"""
    dur = 1.15
    n = int(dur * SR)
    t = np.arange(n) / SR
    trill = np.sin(2 * np.pi * 4600 * t) * (0.5 + 0.5 * np.sin(2 * np.pi * 26 * t))
    env = np.exp(-((t - 0.5) ** 2) / (2 * 0.32**2))
    return trill * env * 0.14


def car_pass(seed: int) -> np.ndarray:
    """车辆驶过：带低通扫频的噪声，先近后远。"""
    rng = np.random.default_rng(seed)
    dur = 2.6
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = rng.normal(size=n)
    # 用两段不同宽度的滑动平均模拟"低频先到、高频随后远离"
    k = (np.hanning(60) / 30).astype(np.float64)
    low = np.convolve(x, k, mode="same")
    k2 = (np.hanning(10) / 5).astype(np.float64)
    mid = np.convolve(x, k2, mode="same")
    mix = low * 0.9 + mid * 0.35
    env = np.exp(-((t - 1.2) ** 2) / (2 * 0.55**2))
    return mix * env


# ---------------------------------------------------------------------------
# 八个场景
# ---------------------------------------------------------------------------

def build_rain() -> np.ndarray:
    base = spectral_noise(N, pink(cut_lo=180.0, cut_hi=13000.0, alpha=0.75), seed=11)
    hiss = spectral_noise(N, band(5200.0, q=2.2, gain=0.35), seed=12)
    # 雨势并不是恒定的：两个不同速率的起伏叠出"阵雨"感
    swell = (
        1.0
        + 0.10 * periodic_lfo(3.0)
        + 0.06 * periodic_lfo(7.0, phase=1.1)
    )
    x = base * swell * 0.9 + hiss * swell

    times = spread(np.arange(0.9, LOOP_SECONDS - 0.9, 0.22), 0.12, seed=13)
    drops = place(N, times, lambda: droplet(int(np.random.default_rng(len(times)).integers(1 << 30))))
    # 让雨滴音高有变化，逐个生成
    drops = np.zeros(N)
    rng = np.random.default_rng(14)
    for t0 in times:
        seg = droplet(int(rng.integers(1 << 30)), f0=float(rng.uniform(2000, 3600)))
        i0 = int(t0 * SR)
        if 0 <= i0 and i0 + seg.size <= N:
            drops[i0 : i0 + seg.size] += seg
    return x * 1.0 + drops * 0.5


def build_library() -> np.ndarray:
    room = spectral_noise(N, brown(cut=520.0, order=1.4), seed=21)
    air = spectral_noise(N, band(900.0, q=2.6, gain=0.16), seed=22)
    x = room * 0.9 + air

    turns = spread(np.arange(2.5, LOOP_SECONDS - 1.0, 5.2), 1.4, seed=23)
    x += place(N, turns, lambda: page_turn(int(len(turns))))

    pages = np.zeros(N)
    rng = np.random.default_rng(24)
    for t0 in turns:
        seg = page_turn(int(rng.integers(1 << 30)))
        i0 = int(t0 * SR)
        if i0 >= 0 and i0 + seg.size <= N:
            pages[i0 : i0 + seg.size] += seg
    return x + pages * 0.75


def build_forest() -> np.ndarray:
    wind = spectral_noise(N, brown(cut=600.0, order=1.3), seed=31)
    leaves = spectral_noise(N, band(3400.0, q=2.0, gain=0.30), seed=32)
    breeze = 1.0 + 0.32 * periodic_lfo(2.0) + 0.16 * periodic_lfo(5.0, phase=0.7)
    leaf_mod = 1.0 + 0.55 * periodic_lfo(4.0, phase=2.1)
    x = wind * breeze * 0.95 + leaves * leaf_mod * 0.55

    birds = np.zeros(N)
    rng = np.random.default_rng(33)
    starts = spread(np.arange(1.8, LOOP_SECONDS - 1.5, 3.4), 1.1, seed=34)
    for t0 in starts:
        seg = chirp(int(rng.integers(1 << 30)), base=float(rng.uniform(2700, 3900)), notes=int(rng.integers(2, 5)))
        i0 = int(t0 * SR)
        if i0 >= 0 and i0 + seg.size <= N:
            birds[i0 : i0 + seg.size] += seg
    return x + birds * 0.85


def build_cafe() -> np.ndarray:
    rumble = spectral_noise(N, brown(cut=300.0, order=1.2), seed=41)
    # 人声絮语：多个不同速率的调制叠在一起，避免"机器嗡嗡"感
    babble = spectral_noise(N, band(780.0, q=1.9, gain=1.0), seed=42)
    mod = (
        1.0
        + 0.42 * periodic_lfo(7.0)
        + 0.30 * periodic_lfo(11.0, phase=1.7)
        + 0.22 * periodic_lfo(17.0, phase=0.4)
        + 0.16 * periodic_lfo(23.0, phase=2.6)
    )
    voices = spectral_noise(N, band(1600.0, q=2.4, gain=0.35), seed=43)
    x = rumble * 0.7 + babble * mod * 0.85 + voices * mod * 0.4

    clinks = spread(np.arange(3.0, LOOP_SECONDS - 1.0, 6.5), 2.0, seed=44)
    scrapes = spread(np.arange(5.5, LOOP_SECONDS - 1.0, 9.0), 2.5, seed=45)
    events = np.zeros(N)
    rng = np.random.default_rng(46)
    for t0 in clinks:
        seg = cup_clink(int(rng.integers(1 << 30)))
        i0 = int(t0 * SR)
        if i0 >= 0 and i0 + seg.size <= N:
            events[i0 : i0 + seg.size] += seg * float(rng.uniform(0.6, 1.0))
    for t0 in scrapes:
        seg = chair_scrape(int(rng.integers(1 << 30)))
        i0 = int(t0 * SR)
        if i0 >= 0 and i0 + seg.size <= N:
            events[i0 : i0 + seg.size] += seg * 0.5
    return x + events * 0.8


def build_ocean() -> np.ndarray:
    deep = spectral_noise(N, brown(cut=220.0, order=2.0), seed=51)
    surf = spectral_noise(N, brown(cut=900.0, order=1.1), seed=52)
    foam = spectral_noise(N, band(4200.0, q=2.0, gain=0.30), seed=53)

    t = np.arange(N) / N
    # 每 12 秒一道浪（24 秒循环 = 2 道），用非对称包络模拟"涌上来、退下去"
    wave = np.zeros(N)
    for k in range(2):
        c = (k + 0.5) / 2.0
        d = np.minimum(np.abs(t - c), 1 - np.abs(t - c))
        rise = np.exp(-((d - 0.055) ** 2) / (2 * 0.030**2))
        fall = np.exp(-((d + 0.030) ** 2) / (2 * 0.045**2)) * 0.6
        wave += rise + fall
    wave = 0.42 + 0.75 * np.clip(wave, 0, None)

    hiss = 0.35 + 0.85 * np.clip(wave - 0.6, 0, None)
    return deep * 0.85 + surf * wave + foam * hiss * 0.7


def build_fireplace() -> np.ndarray:
    roar = spectral_noise(N, brown(cut=420.0, order=1.4), seed=61)
    flicker = spectral_noise(N, band(1100.0, q=2.2, gain=0.30), seed=62)
    mod = (
        1.0
        + 0.22 * periodic_lfo(9.0)
        + 0.14 * periodic_lfo(19.0, phase=1.3)
        + 0.10 * periodic_lfo(31.0, phase=2.2)
    )
    x = roar * 0.95 + flicker * mod * 0.5

    pops = np.zeros(N)
    rng = np.random.default_rng(63)
    times = np.sort(rng.uniform(0.6, LOOP_SECONDS - 0.6, size=150))
    for t0 in times:
        loud = float(rng.uniform(0.35, 1.35))
        seg = crackle(int(rng.integers(1 << 30)), loud=loud)
        i0 = int(t0 * SR)
        if i0 >= 0 and i0 + seg.size <= N:
            pops[i0 : i0 + seg.size] += seg
    return x + pops * 0.55


def build_night() -> np.ndarray:
    rumble = spectral_noise(N, brown(cut=200.0, order=2.2), seed=71)
    shimmer = spectral_noise(N, band(6200.0, q=2.6, gain=0.14), seed=72)
    x = rumble * 0.85 + shimmer

    crickets = np.zeros(N)
    rng = np.random.default_rng(73)
    # 蟋蟀不是均匀分布的：一小群一小群地叫，中间留白
    clusters = [1.6, 5.4, 9.9, 14.2, 18.6, 21.4]
    for c0 in clusters:
        k = int(rng.integers(2, 5))
        for j in range(k):
            t0 = c0 + j * 1.25 + float(rng.uniform(-0.15, 0.15))
            seg = cricket(int(rng.integers(1 << 30)))
            i0 = int(t0 * SR)
            if i0 >= 0 and i0 + seg.size <= N:
                crickets[i0 : i0 + seg.size] += seg * float(rng.uniform(0.55, 1.0))
    return x + crickets * 0.9


def build_street() -> np.ndarray:
    city = spectral_noise(N, brown(cut=500.0, order=1.5), seed=81)
    wind = spectral_noise(N, band(2400.0, q=1.8, gain=0.22), seed=82)
    voices = spectral_noise(N, band(900.0, q=2.0, gain=0.28), seed=83)
    vmod = (
        1.0
        + 0.35 * periodic_lfo(5.0)
        + 0.22 * periodic_lfo(13.0, phase=0.9)
    )
    x = city * 0.9 + wind * 0.5 + voices * vmod * 0.55

    passes = np.zeros(N)
    rng = np.random.default_rng(84)
    starts = spread(np.arange(1.2, LOOP_SECONDS - 3.2, 5.4), 1.6, seed=85)
    for t0 in starts:
        seg = car_pass(int(rng.integers(1 << 30)))
        gain = float(rng.uniform(0.5, 1.0))
        i0 = int(t0 * SR)
        if i0 >= 0 and i0 + seg.size <= N:
            passes[i0 : i0 + seg.size] += seg * gain
    return x + passes * 0.85


SCENES = {
    "rain": (build_rain, 0.085),
    "library": (build_library, 0.075),
    "forest": (build_forest, 0.080),
    "cafe": (build_cafe, 0.078),
    "ocean": (build_ocean, 0.088),
    "fireplace": (build_fireplace, 0.080),
    "night": (build_night, 0.076),
    "cafe_street": (build_street, 0.080),
}


# ---------------------------------------------------------------------------
# 编码
# ---------------------------------------------------------------------------

def encode_m4a(x: np.ndarray, path: Path, bitrate: int = 96000) -> int:
    """编码为 AAC / MP4（.m4a）。MP4 容器会写入 edit list，让解码端裁掉 priming。"""
    pcm = np.clip(x, -1.0, 1.0)
    pcm = (pcm * 32767.0).astype("<i2")

    with av.open(str(path), mode="w", format="mp4") as container:
        stream = container.add_stream("aac", rate=SR)
        stream.bit_rate = bitrate
        stream.layout = "mono"
        frame = av.AudioFrame.from_ndarray(pcm.reshape(1, -1), format="s16", layout="mono")
        frame.sample_rate = SR
        frame.pts = 0
        for packet in stream.encode(frame):
            container.mux(packet)
        for packet in stream.encode(None):
            container.mux(packet)

    return path.stat().st_size


def decode_check(path: Path) -> tuple[float, float]:
    """解码回来确认时长与循环接缝（时长应严格等于 LOOP_SECONDS）。"""
    with av.open(str(path)) as container:
        stream = next(s for s in container.streams if s.type == "audio")
        parts = [f.to_ndarray().reshape(-1) for f in container.decode(stream)]
        sr = stream.sample_rate
    x = np.concatenate(parts).astype(np.float64)
    if x.size and np.max(np.abs(x)) > 1.5:  # 某些路径返回整型
        x = x / 32768.0
    return x.size / sr, float(abs(x[0] - x[-1])) if x.size else 0.0


def main() -> None:
    want = sys.argv[1:] or list(SCENES)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    total = 0
    for name in want:
        if name not in SCENES:
            print(f"!! 未知场景: {name}")
            continue
        build, rms = SCENES[name]
        x = build()
        x = normalize(x, rms)
        path = OUT_DIR / f"{name}.m4a"
        size = encode_m4a(x, path)
        total += size

        dur, seam = decode_check(path)
        d = np.abs(np.diff(x))
        print(
            f"  ✓ {name:12s} {size/1024:6.1f}KB  rms={np.sqrt(np.mean(x**2)):.3f} "
            f"peak={np.max(np.abs(x)):.2f}  decode={dur:.3f}s  seam={seam:.4f} "
            f"(mean step {np.mean(d):.4f})"
        )
    print(f"\n合计 {total/1024/1024:.2f} MB → {OUT_DIR}")


if __name__ == "__main__":
    main()
