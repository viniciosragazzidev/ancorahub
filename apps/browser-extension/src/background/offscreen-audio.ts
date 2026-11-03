type AudioPedido = { target?: string; type?: string };

let tocando = false;

chrome.runtime.onMessage.addListener((message: AudioPedido) => {
  if (message.target !== "offscreen" || message.type !== "PLAY_ALERT_SOUND" || tocando) return false;
  tocando = true;
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(740, context.currentTime);
    oscillator.frequency.setValueAtTime(880, context.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.38);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.4);
    oscillator.addEventListener("ended", () => { void context.close(); tocando = false; }, { once: true });
  } catch {
    tocando = false;
  }
  return false;
});
