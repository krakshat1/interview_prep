// Thin wrapper around the browser's Web Speech API.
// Speech recognition (STT) works best in Chrome/Edge; falls back gracefully
// to text-only entry if unsupported.

const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;

function speechRecognitionSupported() {
  return !!SpeechRecognitionImpl;
}

function speechSynthesisSupported() {
  return 'speechSynthesis' in window;
}

/**
 * Speaks text aloud like the interviewer. Returns a promise that resolves
 * once speaking finishes.
 */
function speak(text) {
  return new Promise((resolve) => {
    if (!speechSynthesisSupported() || !text) return resolve();
    window.speechSynthesis.cancel(); // stop anything currently queued
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.0;
    utter.pitch = 1.0;
    utter.onend = resolve;
    utter.onerror = resolve;
    window.speechSynthesis.speak(utter);
  });
}

function stopSpeaking() {
  if (speechSynthesisSupported()) window.speechSynthesis.cancel();
}

/**
 * Creates a controller for live speech-to-text.
 * callbacks: { onInterim(text), onFinalChunk(text), onEnd(), onError(msg) }
 */
function createRecognizer(callbacks = {}) {
  if (!speechRecognitionSupported()) return null;

  const recognition = new SpeechRecognitionImpl();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  let finalTranscript = '';

  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        finalTranscript += result[0].transcript + ' ';
        callbacks.onFinalChunk?.(finalTranscript.trim());
      } else {
        interim += result[0].transcript;
      }
    }
    callbacks.onInterim?.(interim);
  };

  recognition.onerror = (event) => {
    callbacks.onError?.(event.error);
  };

  recognition.onend = () => {
    callbacks.onEnd?.(finalTranscript.trim());
  };

  return {
    start() {
      finalTranscript = '';
      recognition.start();
    },
    stop() {
      recognition.stop();
    },
    abort() {
      recognition.abort();
    },
    getTranscript: () => finalTranscript.trim(),
  };
}
