/**
 * JFT Exam Hub — Audio Module
 * Web Speech API for Japanese TTS playback
 */
(function() {
  'use strict';

  let synthVoices = [];
  let activeUtterance = null;
  let isSpeechPlaying = false;

  function loadVoices() {
    const voices = window.speechSynthesis.getVoices();
    synthVoices = voices
      .filter(v => v.lang.includes('ja'))
      .sort((a, b) => {
        const q = (v) => v.name.includes('Google') || v.name.includes('Online') || v.name.includes('Natural') || v.name.includes('Neural');
        return q(b) - q(a);
      });
  }

  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
  }

  function sanitizeJapanese(text) {
    if (!text) return '';
    return text
      .normalize('NFC')
      .replace(/[！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
      .replace(/[-－]/g, 'ー')
      .replace(/[​-‍﻿]/g, '')
      .replace(/s(?=[ぁ-ゖァ-ーー々一-鿿])/g, '')
      .replace(/([ぁ-ゖァ-ーー々一-鿿])s/g, '$1');
  }

  function playAudio(transcript, si, qi, idPrefix) {
    idPrefix = idPrefix || '';
    if (isSpeechPlaying) {
      isSpeechPlaying = false;
      window.speechSynthesis.cancel();
      return;
    }
    if (!transcript) return;

    var maxPlays = 2;
    var key = si + '-' + qi;
    var isReview = !!idPrefix;

    if (!isReview) {
      if (!window._audioPlays) window._audioPlays = {};
      if (!window._audioPlays[key]) window._audioPlays[key] = 0;
      if (window._audioPlays[key] >= maxPlays) return;
      window._audioPlays[key]++;

      var remaining = maxPlays - window._audioPlays[key];
      var plLabel = document.getElementById('plays-left-' + qi);
      if (plLabel) plLabel.textContent = remaining + ' play' + (remaining !== 1 ? 's' : '') + ' left';

      if (window._audioPlays[key] >= maxPlays) {
        var playBtn = document.getElementById('btn-play-' + qi);
        if (playBtn) playBtn.disabled = true;
      }
    }

    window.speechSynthesis.cancel();
    isSpeechPlaying = true;

    var fill = document.getElementById(idPrefix + 'audio-fill-' + qi);
    var progressInterval = null;
    if (fill) {
      fill.style.width = '0%';
      fill.style.transition = 'width 0.5s linear';
      var estimateMs = Math.max(transcript.length * 180, 2000);
      var elapsedMs = 0;
      progressInterval = setInterval(function() {
        elapsedMs += 500;
        var p = (elapsedMs / estimateMs) * 100;
        if (p > 95) p = 95;
        fill.style.width = p + '%';
      }, 500);
    }

    var safetyTimeout = setTimeout(function() {
      isSpeechPlaying = false;
      window.speechSynthesis.cancel();
      if (progressInterval) clearInterval(progressInterval);
      activeUtterance = null;
      if (fill) {
        fill.style.width = '100%';
        setTimeout(function() { if (!isSpeechPlaying) fill.style.width = '0%'; }, 1000);
      }
    }, Math.max(transcript.length * 180, 2000) + 5000);

    var segments = [];
    var rawLines = transcript.split(/\r?\n/);
    var roleToVoiceIdx = {};
    var voiceCounter = 0;
    var currentRole = 'unknown';

    rawLines.forEach(function(line) {
      var text = line.trim();
      if (!text) return;
      var speakerMatch = text.match(/^([^：:\n]{1,8})[：:](.*)/);
      if (speakerMatch) {
        currentRole = speakerMatch[1].trim();
        text = speakerMatch[2].trim();
        if (!(currentRole in roleToVoiceIdx)) {
          roleToVoiceIdx[currentRole] = voiceCounter % 2;
          voiceCounter++;
        }
      }
      if (text) {
        segments.push({ text: text, role: currentRole, voiceIdx: roleToVoiceIdx[currentRole] || 0 });
      }
    });

    function speakNext(idx) {
      if (idx >= segments.length) {
        clearTimeout(safetyTimeout);
        isSpeechPlaying = false;
        if (progressInterval) clearInterval(progressInterval);
        activeUtterance = null;
        if (fill) {
          fill.style.width = '100%';
          setTimeout(function() { if (!isSpeechPlaying) fill.style.width = '0%'; }, 1000);
        }
        return;
      }
      var item = segments[idx];
      var cleanText = sanitizeJapanese(item.text);
      if (!cleanText) return speakNext(idx + 1);

      var utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'ja-JP';
      activeUtterance = utterance;

      if (synthVoices.length > 0) {
        if (item.voiceIdx === 0) {
          utterance.voice = synthVoices[0];
          utterance.pitch = 1.05;
          utterance.rate = 1.05;
        } else {
          utterance.voice = synthVoices[synthVoices.length > 1 ? 1 : 0];
          utterance.pitch = 0.7;
          utterance.rate = 1.05;
        }
      }

      utterance.onend = function() { activeUtterance = null; speakNext(idx + 1); };
      utterance.onerror = function(e) { activeUtterance = null; speakNext(idx + 1); };
      window.speechSynthesis.speak(utterance);
    }

    speakNext(0);
  }

  window.JFTAudio = { playAudio: playAudio, sanitizeJapanese: sanitizeJapanese };
})();
