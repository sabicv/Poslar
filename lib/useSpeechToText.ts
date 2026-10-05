'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { isNumberWords } from '@/lib/spokenNumbers';

// Minimal shape of the Web Speech API we actually use — not part of
// lib.dom.d.ts, and support varies (Chrome/Edge/Safari; no Firefox), so
// this is feature-detected and typed just enough to avoid `any` leaking
// through consumers.
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface UseSpeechToTextOptions {
  onFinalText?: (text: string) => void;
}

const ERROR_MESSAGES_HR: Record<string, string> = {
  'not-allowed': 'Mikrofon nije dozvoljen. Dodirnite ikonu lokota pored adrese stranice i dozvolite mikrofon.',
  'service-not-allowed': 'Mikrofon nije dozvoljen. Dodirnite ikonu lokota pored adrese stranice i dozvolite mikrofon.',
  'audio-capture': 'Mikrofon nije pronađen ili ga koristi druga aplikacija.',
  network: 'Prepoznavanje govora treba internetsku vezu.',
  'no-speech': 'Nisam čuo govor. Dodirnite mikrofon i pričajte odmah.',
};

// Words compared without capitals and punctuation ("Akumulator." = "akumulator").
function splitWords(text: string): string[] {
  return text.split(/\s+/).filter((w) => normalizeWord(w) !== '');
}
function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[.,!?;:"„”'()]/g, '');
}
function startsWithWords(words: string[], prefix: string[]): boolean {
  return prefix.length <= words.length && prefix.every((w, i) => words[i] === w);
}
function endsWithWords(words: string[], suffix: string[]): boolean {
  return suffix.length > 0 && suffix.length <= words.length && suffix.every((w, i) => words[words.length - suffix.length + i] === w);
}
function sameWords(a: string[], b: string[]): boolean {
  return a.length > 0 && a.length === b.length && a.every((w, i) => w === b[i]);
}

export function useSpeechToText({ onFinalText }: UseSpeechToTextOptions = {}) {
  const [isSupported, setIsSupported] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalTextRef = useRef(onFinalText);
  onFinalTextRef.current = onFinalText;
  // Whether the mic should keep listening after the current utterance ends —
  // a ref so onend (fired by the browser) always reads the latest value.
  const keepGoingRef = useRef(false);
  const isMobileRef = useRef(false);
  // Android Chrome re-delivers finals: the same result again (also at a new
  // index and with another capital or full stop), or the whole utterance so
  // far ("prazan" → "prazan akumulator"). What each result index already
  // gave is remembered per session, and only words not yet passed on go out,
  // so text never doubles up.
  const sessionFinalsRef = useRef<string[][]>([]);
  const sessionWordsRef = useRef<string[]>([]);
  const lastChunkRef = useRef<{ words: string[]; at: number }>({ words: [], at: 0 });
  // Result indexes the phone showed while they were being spoken. A re-send
  // arrives final at once; words said again ("56 56" in a phone number) are
  // first heard as they are spoken.
  const spokenAtRef = useRef<boolean[]>([]);
  // Did the current recognition session hear anything? Restarting after a
  // silent session is what made phones beep and buzz in a loop.
  const heardSpeechRef = useRef(false);
  const sessionHadSpeechRef = useRef(false);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;

    if (!Ctor) {
      setIsSupported(false);
      return;
    }

    // Phone browsers end recognition on every pause and beep/vibrate on every
    // start. So: keep listening across pauses while the worker is talking,
    // but once a session ends having heard nothing, stop instead of looping.
    isMobileRef.current = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    const recognition = new Ctor();
    recognition.lang = 'hr-HR';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = '';
      const finalChunks: string[] = [];
      // Every result, not only from resultIndex: Android reports it wrongly.
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim();
        if (!transcript) continue;
        heardSpeechRef.current = true;
        sessionHadSpeechRef.current = true;

        if (!result.isFinal) {
          if (!sessionFinalsRef.current[i]) spokenAtRef.current[i] = true;
          if (i >= event.resultIndex) interim += `${transcript} `;
          continue;
        }

        const words = splitWords(transcript);
        const norms = words.map(normalizeWord);
        const before = sessionFinalsRef.current[i];
        let addition: string[] = [];
        if (before) {
          // This result was handled: only words it has grown by.
          if (startsWithWords(norms, before) && norms.length > before.length) addition = words.slice(before.length);
        } else {
          const said = sessionWordsRef.current;
          const last = lastChunkRef.current;
          // Re-sends come right away; the same words said again later stay.
          const recent = Date.now() - last.at < 3000;
          // A number heard while it was said again is new, not a re-send.
          const saidAgain = spokenAtRef.current[i] && isNumberWords(norms);
          if (said.length && norms.length > said.length && startsWithWords(norms, said)) {
            // The whole utterance so far again, with something new at the end.
            addition = words.slice(said.length);
          } else if (recent && !saidAgain && (endsWithWords(said, norms) || sameWords(norms, last.words))) {
            // Already passed on: the same words re-sent.
            addition = [];
          } else {
            addition = words;
          }
        }
        sessionFinalsRef.current[i] = norms;
        if (addition.length) {
          finalChunks.push(addition.join(' '));
          sessionWordsRef.current = [...sessionWordsRef.current, ...addition.map(normalizeWord)];
          lastChunkRef.current = { words: addition.map(normalizeWord), at: Date.now() };
        }
      }
      if (finalChunks.length > 0) onFinalTextRef.current?.(finalChunks.join(' '));
      setInterimText(interim.trim());
    };

    recognition.onerror = (event) => {
      // Silence after the worker has already dictated is just "done".
      if (event.error === 'no-speech' && sessionHadSpeechRef.current) return;
      if (event.error === 'aborted') return;
      keepGoingRef.current = false;
      setIsRecording(false);
      const message = ERROR_MESSAGES_HR[event.error];
      if (message) toast.error(message);
    };

    recognition.onend = () => {
      setInterimText('');
      const shouldRestart = keepGoingRef.current && (!isMobileRef.current || heardSpeechRef.current);
      heardSpeechRef.current = false;
      // A new session numbers its results from 0 again.
      sessionFinalsRef.current = [];
      spokenAtRef.current = [];
      sessionWordsRef.current = [];
      if (shouldRestart) {
        try {
          recognition.start();
          return;
        } catch {
          // Fall through to stopping.
        }
      }
      keepGoingRef.current = false;
      setIsRecording(false);
    };

    recognitionRef.current = recognition;

    return () => {
      keepGoingRef.current = false;
      recognition.stop();
    };
  }, []);

  function toggleRecording() {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (isRecording) {
      keepGoingRef.current = false;
      recognition.stop();
      setIsRecording(false);
      return;
    }

    sessionFinalsRef.current = [];
    spokenAtRef.current = [];
    sessionWordsRef.current = [];
    lastChunkRef.current = { words: [], at: 0 };
    heardSpeechRef.current = false;
    sessionHadSpeechRef.current = false;
    keepGoingRef.current = true;
    try {
      recognition.start();
      setIsRecording(true);
    } catch {
      // start() throws if the previous session hasn't fully ended yet.
      keepGoingRef.current = false;
      toast.error('Mikrofon se još gasi. Pokušajte ponovno za sekundu.');
    }
  }

  return { isSupported, isRecording, interimText, toggleRecording };
}
