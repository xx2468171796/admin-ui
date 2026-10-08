// 演示用的媒体：浏览器里生成一段「像说话」的音频（WAV）和两张「现场照片」。真实项目里这些是宿主给的文件地址。

/** Small deterministic random generator so the demo looks the same on every load. */
function rng(seed: number) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/** A speech-like tone: syllable bursts of a low hum. Returns an object URL and one peak per 100 ms. */
export function demoTone(seconds: number, seed: number): { url: string; peaks: number[] } {
  const rate = 8000;
  const total = Math.round(seconds * rate);
  const rand = rng(seed);
  const samples = new Int16Array(total);
  const peaks: number[] = [];
  let envelope = 0;
  let target = 0;
  let windowMax = 0;
  for (let i = 0; i < total; i++) {
    if (i % 1200 === 0) target = rand() < 0.22 ? 0.03 : 0.25 + rand() * 0.7; // a pause now and then
    envelope += (target - envelope) * 0.002;
    const t = i / rate;
    const v = envelope * (0.7 * Math.sin(2 * Math.PI * 190 * t) + 0.3 * Math.sin(2 * Math.PI * 380 * t));
    samples[i] = Math.round(v * 0.6 * 32767);
    windowMax = Math.max(windowMax, Math.abs(v));
    if ((i + 1) % 800 === 0) {
      peaks.push(Math.round(windowMax * 1000) / 1000);
      windowMax = 0;
    }
  }
  const header = new DataView(new ArrayBuffer(44));
  const text = (at: number, s: string) => [...s].forEach((c, k) => header.setUint8(at + k, c.charCodeAt(0)));
  text(0, "RIFF");
  header.setUint32(4, 36 + samples.byteLength, true);
  text(8, "WAVE");
  text(12, "fmt ");
  header.setUint32(16, 16, true);
  header.setUint16(20, 1, true);
  header.setUint16(22, 1, true);
  header.setUint32(24, rate, true);
  header.setUint32(28, rate * 2, true);
  header.setUint16(32, 2, true);
  header.setUint16(34, 16, true);
  text(36, "data");
  header.setUint32(40, samples.byteLength, true);
  const url = URL.createObjectURL(new Blob([header.buffer, samples.buffer], { type: "audio/wav" }));
  return { url, peaks };
}

/** A stand-in photo drawn with the current palette (a real project shows the uploaded image). */
export function demoPhoto(variant: number): string {
  const root = document.querySelector(".adminui") ?? document.documentElement;
  const css = getComputedStyle(root);
  const token = (name: string) => css.getPropertyValue(name).trim() || "#8a9a94";
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 420;
  const g = canvas.getContext("2d");
  if (!g) return "";
  const sky = g.createLinearGradient(0, 0, 0, 420);
  sky.addColorStop(0, token("--aui-soft"));
  sky.addColorStop(1, token(variant ? "--aui-primary-mid" : "--aui-soft-strong"));
  g.fillStyle = sky;
  g.fillRect(0, 0, 640, 420);
  g.fillStyle = token("--aui-ink");
  g.globalAlpha = 0.85;
  if (variant) {
    g.fillRect(220, 70, 200, 290); // electrical box
    g.globalAlpha = 1;
    g.fillStyle = token("--aui-tile");
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) g.fillRect(238 + c * 30, 100 + r * 60, 18, 40);
  } else {
    g.fillRect(0, 300, 640, 120); // floor
    g.fillStyle = token("--aui-primary");
    g.fillRect(70, 200, 260, 100); // sofa
    g.fillRect(430, 90, 150, 110); // window
    g.globalAlpha = 1;
    g.fillStyle = token("--aui-surface");
    g.fillRect(445, 105, 120, 80);
  }
  return canvas.toDataURL("image/jpeg", 0.8);
}
