import { publicAsset } from "./runtimeConfig";

const SAMPLE_URLS = {
  "key-01": "assets/audio/key-01.wav",
  "key-02": "assets/audio/key-02.wav",
  "key-03": "assets/audio/key-03.wav",
  "key-04": "assets/audio/key-04.wav",
  "key-05": "assets/audio/key-05.wav",
  "key-06": "assets/audio/key-06.wav",
  "key-07": "assets/audio/key-07.wav",
  "key-08": "assets/audio/key-08.wav",
  space: "assets/audio/space.wav",
  carriage: "assets/audio/carriage.wav",
  eject: "assets/audio/eject.wav",
};

const KEY_NAMES = Object.keys(SAMPLE_URLS).filter((name) => name.startsWith("key-"));

export function createAudioEngine() {
  let context;
  let master;
  let previousKey = -1;
  const buffers = new Map();
  const loading = new Map();

  function ensure() {
    if (!context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext({ latencyHint: "interactive" });
      master = context.createGain();
      master.gain.value = 0.92;
      master.connect(context.destination);
    }
    return context;
  }

  function load(name) {
    if (buffers.has(name)) return Promise.resolve(buffers.get(name));
    if (loading.has(name)) return loading.get(name);
    const ctx = ensure();
    if (!ctx) return Promise.resolve(null);

    const request = fetch(publicAsset(SAMPLE_URLS[name]))
      .then((response) => {
        if (!response.ok) throw new Error(`Audio sample failed: ${name}`);
        return response.arrayBuffer();
      })
      .then((arrayBuffer) => ctx.decodeAudioData(arrayBuffer.slice(0)))
      .then((buffer) => {
        buffers.set(name, buffer);
        return buffer;
      })
      .catch(() => null);
    loading.set(name, request);
    return request;
  }

  function startBuffer(buffer, { gain = 1, rate = 1, delay = 0 } = {}) {
    const ctx = ensure();
    if (!ctx || !buffer) return;
    const source = ctx.createBufferSource();
    const level = ctx.createGain();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    level.gain.value = gain;
    source.connect(level).connect(master);
    source.start(ctx.currentTime + delay);
  }

  function trigger(name, options) {
    const ctx = ensure();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    const ready = buffers.get(name);
    if (ready) startBuffer(ready, options);
    else load(name).then((buffer) => startBuffer(buffer, options));
  }

  return {
    preload() {
      Object.keys(SAMPLE_URLS).forEach(load);
    },
    wake() {
      const ctx = ensure();
      if (ctx?.state === "suspended") ctx.resume();
    },
    key(light = false) {
      let next = Math.floor(Math.random() * KEY_NAMES.length);
      if (next === previousKey) next = (next + 1) % KEY_NAMES.length;
      previousKey = next;
      trigger(KEY_NAMES[next], {
        gain: light ? 0.34 : 0.88 + Math.random() * 0.12,
        rate: 0.97 + Math.random() * 0.065,
      });
    },
    space() {
      trigger("space", { gain: 0.9, rate: 0.98 + Math.random() * 0.035 });
    },
    backspace() {
      let next = Math.floor(Math.random() * KEY_NAMES.length);
      if (next === previousKey) next = (next + 2) % KEY_NAMES.length;
      previousKey = next;
      trigger(KEY_NAMES[next], { gain: 0.72, rate: 0.78 });
    },
    carriage() {
      trigger("carriage", { gain: 0.96 });
    },
    eject() {
      trigger("eject", { gain: 1 });
    },
  };
}
