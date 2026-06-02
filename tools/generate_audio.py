from pathlib import Path
import math
import random
import struct
import wave

RATE = 16000
OUT = Path(__file__).resolve().parents[1] / "assets" / "audio"
OUT.mkdir(parents=True, exist_ok=True)


def write_wave(name, samples):
    samples = [max(-1.0, min(1.0, sample)) for sample in samples]
    with wave.open(str(OUT / name), "wb") as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(RATE)
        target.writeframes(b"".join(struct.pack("<h", int(sample * 32767)) for sample in samples))


def note(freq, duration, volume=0.25, decay=0.0, shimmer=0.0):
    count = int(RATE * duration)
    result = []
    for index in range(count):
        time = index / RATE
        envelope = max(0.0, 1 - decay * time / max(duration, 0.001))
        tone = math.sin(2 * math.pi * freq * time)
        tone += 0.34 * math.sin(2 * math.pi * freq * 2 * time)
        tone += shimmer * math.sin(2 * math.pi * freq * 3.01 * time)
        result.append(tone * envelope * volume)
    return result


def silence(duration):
    return [0.0] * int(RATE * duration)


def mix(*tracks):
    length = max(len(track) for track in tracks)
    result = [0.0] * length
    for track in tracks:
        for index, sample in enumerate(track):
            result[index] += sample
    return result


def place(track, offset, clip):
    start = int(offset * RATE)
    for index, sample in enumerate(clip):
        if start + index < len(track):
            track[start + index] += sample


def make_bgm_home():
    duration = 12
    track = silence(duration)
    scale = [293.66, 349.23, 392.00, 440.00, 523.25, 587.33]
    for step in range(24):
        freq = scale[[0, 2, 4, 3, 2, 1, 3, 5][step % 8]]
        place(track, step * 0.5, note(freq, 0.48, 0.12, 0.68, 0.12))
    for beat in range(12):
        place(track, beat, note(146.83 if beat % 4 < 2 else 174.61, 0.9, 0.07, 0.88))
    return track


def make_bgm_battle():
    duration = 10
    track = silence(duration)
    scale = [220.00, 261.63, 293.66, 329.63, 392.00]
    for step in range(40):
        freq = scale[[0, 2, 1, 3, 2, 4, 3, 1][step % 8]]
        place(track, step * 0.25, note(freq, 0.22, 0.13, 0.76, 0.08))
    for beat in range(20):
        pulse = note(92.50, 0.14, 0.2, 1.0)
        place(track, beat * 0.5, pulse)
    return track


def make_bgm_battle_variant(root, scale, pulse_freq):
    duration = 10
    track = silence(duration)
    for step in range(40):
        freq = root * scale[[0, 2, 1, 3, 2, 4, 3, 1][step % 8]]
        place(track, step * 0.25, note(freq, 0.22, 0.13, 0.76, 0.08))
    for beat in range(20):
        place(track, beat * 0.5, note(pulse_freq, 0.14, 0.2, 1.0))
    return track


def make_bgm_boss():
    duration = 8
    track = silence(duration)
    scale = [164.81, 196.00, 220.00, 246.94, 293.66]
    for step in range(32):
        freq = scale[[0, 2, 1, 3, 4, 3, 2, 1][step % 8]]
        place(track, step * 0.25, note(freq, 0.23, 0.16, 0.72, 0.08))
    for beat in range(32):
        place(track, beat * 0.25, mix(note(73.42, 0.1, 0.24, 1), noise(0.1, 0.08)))
    return track


def noise(duration, volume=0.18):
    return [(random.random() * 2 - 1) * volume * (1 - index / (RATE * duration)) for index in range(int(RATE * duration))]


write_wave("bgm-home.wav", make_bgm_home())
write_wave("bgm-battle.wav", make_bgm_battle())
write_wave("bgm-battle-moon.wav", make_bgm_battle_variant(220.00, [1, 1.19, 1.33, 1.5, 1.78], 92.50))
write_wave("bgm-battle-bamboo.wav", make_bgm_battle_variant(246.94, [1, 1.12, 1.33, 1.5, 1.68], 110.00))
write_wave("bgm-battle-canyon.wav", make_bgm_battle_variant(196.00, [1, 1.26, 1.5, 1.68, 2.0], 82.41))
write_wave("bgm-battle-snow.wav", make_bgm_battle_variant(174.61, [1, 1.19, 1.41, 1.59, 1.78], 73.42))
write_wave("bgm-boss.wav", make_bgm_boss())
write_wave("sfx-chop.wav", mix(note(130, 0.16, 0.34, 1), noise(0.16, 0.24)))
write_wave("sfx-equip.wav", mix(note(523.25, 0.28, 0.2, 0.85), note(783.99, 0.28, 0.12, 0.9)))
write_wave("sfx-slash.wav", mix(note(180, 0.1, 0.24, 1), noise(0.1, 0.18)))
write_wave("sfx-heavy.wav", mix(note(82, 0.2, 0.38, 1), noise(0.2, 0.3)))
write_wave("sfx-crit.wav", mix(note(92, 0.23, 0.42, 1), note(740, 0.18, 0.2, 1), noise(0.23, 0.34)))
write_wave("sfx-magic.wav", mix(note(392, 0.24, 0.2, 0.82, 0.18), note(587.33, 0.24, 0.14, 0.9)))
write_wave("sfx-skill.wav", mix(note(261.63, 0.42, 0.2, 0.84, 0.16), note(523.25, 0.42, 0.18, 0.88), note(783.99, 0.42, 0.1, 0.92)))
write_wave("sfx-dodge.wav", mix(note(659.25, 0.18, 0.12, 1, 0.12), noise(0.18, 0.08)))
victory = silence(0.9)
for offset, freq in [(0, 392), (0.18, 523.25), (0.36, 659.25), (0.54, 783.99)]:
    place(victory, offset, note(freq, 0.34, 0.2, 0.9))
write_wave("sfx-victory.wav", victory)
write_wave("sfx-explore.wav", mix(note(440, 0.36, 0.18, 0.9, 0.15), note(659.25, 0.36, 0.11, 0.9)))
print(f"Generated audio assets in {OUT}")
