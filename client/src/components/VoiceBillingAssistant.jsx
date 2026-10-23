import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Sparkles, Check, AlertCircle } from 'lucide-react';

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  half: 0.5, 'a half': 0.5, double: 2, triple: 3,
};

export default function VoiceBillingAssistant({ products = [], onAddToCart, onClearCart }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState('info'); // 'info', 'success', 'error'
  const [voiceFeedbackEnabled, setVoiceFeedbackEnabled] = useState(true);
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const current = event.resultIndex;
      const text = event.results[current][0].transcript.trim().toLowerCase();
      setTranscript(text);
      handleVoiceCommand(text);
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setStatusMessage('Microphone access denied. Please allow microphone in browser.');
        setStatusType('error');
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      // If still supposed to be listening, restart
      if (recognitionRef.current && isListening) {
        try {
          recognition.start();
        } catch {}
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, [isListening, products]);

  const speak = (msg) => {
    if (!voiceFeedbackEnabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(msg);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch {}
  };

  const handleVoiceCommand = (rawText) => {
    const text = rawText.toLowerCase().replace(/[.,!?;:]/g, '');

    // 1. Check for clear cart command
    if (text.includes('clear cart') || text.includes('empty cart') || text.includes('remove all')) {
      if (onClearCart) onClearCart();
      setStatusMessage('Cart cleared via voice command.');
      setStatusType('success');
      speak('Cart cleared');
      return;
    }

    // 2. Parse quantity and product name
    // Strip common filler words
    const cleanText = text
      .replace(/\b(please|add|give me|put|item|pack|packet|bottle|can|box|pieces|piece|pcs|of)\b/g, '')
      .trim();

    // Check for numbers: "2 milk", "two soaps", "milk 2"
    let qty = 1;
    let productSearchTerm = cleanText;

    // Check leading digit: "2 milk"
    const digitMatch = cleanText.match(/^(\d+(\.\d+)?)\s+(.*)$/);
    if (digitMatch) {
      qty = Math.max(1, parseFloat(digitMatch[1]) || 1);
      productSearchTerm = digitMatch[3].trim();
    } else {
      // Check word number: "two milk"
      const words = cleanText.split(/\s+/);
      if (words.length > 1 && NUMBER_WORDS[words[0]]) {
        qty = NUMBER_WORDS[words[0]];
        productSearchTerm = words.slice(1).join(' ').trim();
      } else if (words.length > 1 && NUMBER_WORDS[words[words.length - 1]]) {
        // "milk two"
        qty = NUMBER_WORDS[words[words.length - 1]];
        productSearchTerm = words.slice(0, -1).join(' ').trim();
      }
    }

    if (!productSearchTerm) {
      setStatusMessage(`Heard "${rawText}" - could not recognize product name.`);
      setStatusType('error');
      return;
    }

    // Fuzzy match against product list
    let matchedProduct = products.find(
      (p) => p.name.toLowerCase() === productSearchTerm || p.sku.toLowerCase() === productSearchTerm
    );

    if (!matchedProduct) {
      // Check partial contains
      matchedProduct = products.find(
        (p) =>
          p.name.toLowerCase().includes(productSearchTerm) ||
          productSearchTerm.includes(p.name.toLowerCase()) ||
          p.category.toLowerCase().includes(productSearchTerm)
      );
    }

    if (!matchedProduct) {
      // Check word by word match
      const queryWords = productSearchTerm.split(' ');
      matchedProduct = products.find((p) => {
        const pName = p.name.toLowerCase();
        return queryWords.some((w) => w.length > 2 && pName.includes(w));
      });
    }

    if (matchedProduct) {
      if (matchedProduct.stock_quantity <= 0) {
        setStatusMessage(`"${matchedProduct.name}" is OUT OF STOCK!`);
        setStatusType('error');
        speak(`${matchedProduct.name} is out of stock`);
        return;
      }

      onAddToCart(matchedProduct, qty);
      const successText = `Added ${qty}x "${matchedProduct.name}"`;
      setStatusMessage(successText);
      setStatusType('success');
      speak(`Added ${qty} ${matchedProduct.name}`);
    } else {
      setStatusMessage(`No product matched for: "${productSearchTerm}"`);
      setStatusType('error');
      speak(`Could not find ${productSearchTerm}`);
    }
  };

  const toggleListening = () => {
    if (!isSupported) {
      alert('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      try {
        recognitionRef.current?.stop();
      } catch {}
      setStatusMessage('');
    } else {
      setIsListening(true);
      setStatusMessage('Listening... Speak (e.g. "Add 2 Milk", "Clear Cart")');
      setStatusType('info');
      try {
        recognitionRef.current?.start();
      } catch (err) {
        console.warn('Could not start recognition:', err);
      }
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <div className="relative inline-flex items-center">
      {/* Voice Assistant Toggle Button */}
      <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 rounded-2xl p-1 shadow-sm">
        <button
          type="button"
          onClick={toggleListening}
          title={isListening ? 'Click to stop voice billing' : 'Click to start voice billing (Hands-free POS)'}
          className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
            isListening
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/40 animate-pulse'
              : 'bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white border border-indigo-500/30'
          }`}
        >
          {isListening ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-300"></span>
              </span>
              <Mic className="w-3.5 h-3.5 animate-bounce" />
              <span className="hidden sm:inline">Listening...</span>
            </>
          ) : (
            <>
              <Mic className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Voice POS</span>
            </>
          )}
        </button>

        {/* Audio response mute/unmute toggle */}
        <button
          type="button"
          onClick={() => setVoiceFeedbackEnabled(!voiceFeedbackEnabled)}
          title={voiceFeedbackEnabled ? 'Voice audio feedback enabled (Click to mute)' : 'Voice audio feedback muted'}
          className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
        >
          {voiceFeedbackEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
        </button>
      </div>

      {/* Live Voice Status Popover/Tooltip */}
      {isListening && statusMessage && (
        <div className="absolute top-full left-0 mt-2 z-50 w-72 p-2.5 rounded-2xl bg-slate-900/95 border border-indigo-500/40 shadow-2xl backdrop-blur-xl animate-fadeIn">
          <div className="flex items-start gap-2">
            {statusType === 'success' && <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />}
            {statusType === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />}
            {statusType === 'info' && <Sparkles className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5 animate-spin" />}
            <div className="flex-1 text-xs">
              <p className="font-semibold text-white m-0">{statusMessage}</p>
              {transcript && (
                <p className="text-[11px] text-slate-400 font-mono mt-1 m-0 truncate">
                  Heard: &ldquo;{transcript}&rdquo;
                </p>
              )}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
            <span>Try: &quot;Add 2 Milk&quot;</span>
            <span>&quot;Clear Cart&quot;</span>
          </div>
        </div>
      )}
    </div>
  );
}
