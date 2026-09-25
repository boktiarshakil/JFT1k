/**
 * JFT Exam Hub — Core Application Engine v2
 * Mimics the official JFT-Basic exam interface behavior exactly.
 */

// ============================================================
// LongCat AI Configuration
// API Key is now handled securely via Netlify environment variables
// ============================================================
const LONGCAT_API_KEY = ''; // Leave empty; backend proxy handles authentication

// ============================================================
// State
// ============================================================
let examData = null;
let examId = 'jft1';
let currentSectionIdx = 0;
let currentQIdx = 0;
let timeLeft = 3600;         // global 60-min timer
let timerInterval = null;
let examMode = 'exam';       // 'exam' | 'study'
let progressSaveInterval = null;
let timerWarningShown = { fiveMin: false, oneMin: false };
let keyboardHandler = null;

// Speech Synthesis Context
let synthVoices = [];
let activeUtterance = null; // Prevent garbage collection during playback
function loadVoices() {
  const voices = window.speechSynthesis.getVoices();
  // Filter for Japanese and sort by quality (Neural/Online first)
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

/**
 * Sanitizes Japanese text for smoother synthesis.
 */
function sanitizeJapanese(text) {
  if (!text) return "";
  return text
    .normalize('NFC') // Combine base characters and marks (e.g., ホ + ゛ -> ポ)
    .replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0)) // Full-width to Half-width
    .replace(/[-－]/g, 'ー') // Proper Katakana vowel marks
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width pauses
    .replace(/\s(?=[ぁ-んァ-ヶー々一-龠])/g, '') // Remove spaces
    .replace(/([ぁ-んァ-ヶー々一-龠])\s/g, '$1');
}

// Per-section, per-question state
// state[si][qi] = { selected: null|int, flagged: bool, answered: bool }
const state = {};

// Audio play counts for Listening section
const audioPlays = {};

// Whether answers have been locked (on result screen)
let examFinished = false;

// ============================================================
// Init
// ============================================================
async function initExam() {
  const params = new URLSearchParams(window.location.search);
  examId = params.get('exam') || 'jft1';
  examMode = params.get('mode') || 'exam';  // study mode support

  try {
    const res = await fetch(`exams/${examId}/data.json`);
    if (!res.ok) throw new Error('not found');
    examData = await res.json();
  } catch (e) {
    document.getElementById('exam-main').innerHTML = `
      <div style="text-align:center;padding:60px;color:#c00">
        <div style="font-size:48px;margin-bottom:16px">⚠️</div>
        <h3>Could not load exam: exams/${examId}/data.json</h3>
        <p style="color:#666;margin-top:8px">Make sure the file exists.</p>
        <a href="index.html" style="color:#2d6a2d;margin-top:16px;display:inline-block">← Back to Hub</a>
      </div>`;
    return;
  }

  document.title = examData.title + ' — JFT Exam Hub';
  document.getElementById('infobar-test-name').textContent = examData.title;
  try { localStorage.setItem('last_jft_exam', examId); } catch (e) {}

  // Check for saved progress
  const savedProgress = loadProgress(examId);
  const hasSaved = savedProgress && savedProgress.examId === examId;

  if (hasSaved && examMode === 'exam') {
    const resume = confirm(
      `You have a saved progress for this exam.\n` +
      `Section: ${savedProgress.currentSectionIdx + 1}, Question: ${savedProgress.currentQIdx + 1}\n` +
      `Time remaining: ${Math.floor(savedProgress.timeLeft / 60)}:${String(savedProgress.timeLeft % 60).padStart(2, '0')}\n\n` +
      `Resume where you left off?`
    );
    if (resume) {
      currentSectionIdx = savedProgress.currentSectionIdx;
      currentQIdx = savedProgress.currentQIdx;
      timeLeft = savedProgress.timeLeft;
      // Restore state
      Object.keys(savedProgress.state).forEach(si => {
        Object.keys(savedProgress.state[si]).forEach(qi => {
          state[si] = state[si] || {};
          state[si][qi] = savedProgress.state[si][qi];
        });
      });
    } else {
      initFreshState();
    }
  } else {
    initFreshState();
  }

  renderSidebar();
  goToQuestion(currentSectionIdx, currentQIdx);

  if (examMode === 'study') {
    // Study mode: no timer, show study UI
    const timerEl = document.getElementById('timer-display');
    if (timerEl) timerEl.textContent = 'Study Mode';
    const finishBtn = document.getElementById('btn-finish-section');
    if (finishBtn) finishBtn.textContent = 'End Review';
    const banner = document.getElementById('study-mode-banner');
    if (banner) banner.style.display = 'block';
  } else {
    startTimer();
    // Start periodic progress saving
    progressSaveInterval = setInterval(() => saveProgress(examId), 5000);
  }

  // Setup keyboard navigation
  setupKeyboardNav();
}

function initFreshState() {
  examData.sections.forEach((sec, si) => {
    state[si] = {};
    sec.questions.forEach((_, qi) => {
      state[si][qi] = { selected: null, flagged: false, answered: false };
    });
  });
}

// ============================================================
// Progress Persistence (Item #2)
// ============================================================
function saveProgress(examId) {
  try {
    const data = {
      examId,
      currentSectionIdx,
      currentQIdx,
      timeLeft,
      state,
      savedAt: Date.now()
    };
    localStorage.setItem(`jft_progress_${examId}`, JSON.stringify(data));
  } catch (e) { /* quota exceeded, silently fail */ }
}

function loadProgress(examId) {
  try {
    const raw = localStorage.getItem(`jft_progress_${examId}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Discard saves older than 24 hours
    if (Date.now() - data.savedAt > 86400000) {
      localStorage.removeItem(`jft_progress_${examId}`);
      return null;
    }
    return data;
  } catch (e) { return null; }
}

function clearProgress(examId) {
  try { localStorage.removeItem(`jft_progress_${examId}`); } catch (e) {}
}

// ============================================================
// Keyboard Navigation (Item #4)
// ============================================================
function setupKeyboardNav() {
  keyboardHandler = (e) => {
    // Don't capture when modal is open
    const modal = document.getElementById('lang-modal');
    if (modal && modal.classList.contains('open')) return;

    // Don't capture when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.key) {
      case '1':
      case '2':
      case '3':
      case '4':
        if (!examFinished) {
          const oi = parseInt(e.key) - 1;
          const sec = examData.sections[currentSectionIdx];
          const q = sec.questions[currentQIdx];
          const maxOpts = (q.imageOptions && q.imageOptions.length) || (q.options && q.options.length) || 0;
          if (oi < maxOpts) selectOption(currentSectionIdx, currentQIdx, oi);
        }
        break;
      case 'ArrowLeft':
        if (!examFinished) navigateQ(-1);
        break;
      case 'ArrowRight':
        if (!examFinished) navigateQ(1);
        break;
      case 'f':
      case 'F':
        if (!examFinished) toggleFlag();
        break;
      case 'Enter':
        if (!examFinished) {
          const sec = examData.sections[currentSectionIdx];
          if (currentQIdx < sec.questions.length - 1) {
            navigateQ(1);
          } else {
            handleFinishSection();
          }
        }
        break;
    }
  };
  document.addEventListener('keydown', keyboardHandler);
}

// ============================================================
// Timer
// ============================================================
function startTimer() {
  updateTimerUI();
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerUI();
    if (timeLeft <= 0) { clearInterval(timerInterval); finishExam(true); }
  }, 1000);
}

function updateTimerUI() {
  const el = document.getElementById('timer-display');
  if (!el) return;
  const m = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const s = String(timeLeft % 60).padStart(2, '0');
  el.textContent = `${m}:${s}`;

  // Timer warnings (Item #3)
  const timerArea = document.querySelector('.topbar-timer-area');
  if (timerArea) {
    if (timeLeft <= 300 && timeLeft > 60) {
      timerArea.style.background = 'rgba(255, 165, 0, 0.3)';
      timerArea.style.borderRadius = '4px';
      timerArea.style.padding = '2px 8px';
      if (!timerWarningShown.fiveMin) {
        timerWarningShown.fiveMin = true;
        try {
          // Subtle beep using Web Audio
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 800;
          gain.gain.value = 0.15;
          osc.start();
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
          osc.stop(ctx.currentTime + 0.3);
        } catch (e) {}
      }
    } else if (timeLeft <= 60) {
      timerArea.style.background = 'rgba(255, 0, 0, 0.4)';
      timerArea.style.borderRadius = '4px';
      timerArea.style.padding = '2px 8px';
      el.style.color = '#ff4444';
      if (!timerWarningShown.oneMin) {
        timerWarningShown.oneMin = true;
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 1000;
          gain.gain.value = 0.2;
          osc.start();
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
          osc.stop(ctx.currentTime + 0.5);
        } catch (e) {}
      }
    }
  }
}

// ============================================================
// Sidebar
// ============================================================
function renderSidebar() {
  const sidebar = document.getElementById('exam-sidebar');
  sidebar.innerHTML = '';

  examData.sections.forEach((sec, si) => {
    // Section tab
    const tab = document.createElement('div');
    tab.className = 'sidebar-section-tab' + (si === currentSectionIdx ? ' active' : (si < currentSectionIdx ? ' done' : ''));
    tab.id = `sec-tab-${si}`;
    tab.title = sec.name;
    // Show short label
    const labels = ['S&V', 'Con.', 'List.', 'Rea.'];
    tab.textContent = labels[si] || `S${si + 1}`;
    sidebar.appendChild(tab);

    // Question buttons (only for current section visible)
    if (si === currentSectionIdx) {
      const qList = document.createElement('div');
      qList.className = 'sidebar-q-list';
      qList.id = 'sidebar-q-list';
      sec.questions.forEach((_, qi) => {
        const btn = document.createElement('button');
        btn.className = getSidebarBtnClass(si, qi);
        btn.id = `sq-btn-${qi}`;
        btn.textContent = qi + 1;
        const isListening = sec.name.includes('Listening');
        if (isListening) {
          btn.classList.add('locked');
          btn.title = 'Navigation disabled in Listening section';
        } else {
          btn.onclick = () => goToQuestion(si, qi);
        }
        qList.appendChild(btn);
      });
      sidebar.appendChild(qList);
    }
  });
}

function getSidebarBtnClass(si, qi) {
  const s = state[si][qi];
  let cls = 'sidebar-q-btn';
  if (si === currentSectionIdx && qi === currentQIdx) cls += ' current';
  else if (s.flagged) cls += ' flagged';
  else if (s.answered) cls += ' answered';
  return cls;
}

function updateSidebarQ() {
  const sec = examData.sections[currentSectionIdx];
  sec.questions.forEach((_, qi) => {
    const btn = document.getElementById(`sq-btn-${qi}`);
    if (!btn) return;
    btn.className = getSidebarBtnClass(currentSectionIdx, qi);
    // Keep listening locked
    if (sec.name.includes('Listening') && qi !== currentQIdx) btn.classList.add('locked');
  });
}

// ============================================================
// Navigation
// ============================================================
function goToQuestion(si, qi) {
  currentSectionIdx = si;
  currentQIdx = qi;

  // Update topbar
  document.getElementById('topbar-q-num').textContent = qi + 1;
  document.getElementById('topbar-sec-name').textContent = examData.sections[si].name;

  // Render question
  renderQuestion(si, qi);

  // Update sidebar
  updateSidebarQ();

  // Update Back/Next buttons
  const isListening = examData.sections[si].name.includes('Listening');
  const backBtn = document.getElementById('btn-back');
  const nextBtn = document.getElementById('btn-next-q');

  // Back: disabled if first Q in section, OR in Listening section
  backBtn.disabled = (qi === 0 || isListening);

  // Next: if Listening, disabled until answered; else always enabled
  const qState = state[si][qi];
  if (isListening) {
    nextBtn.disabled = !qState.answered;
    nextBtn.textContent = 'Next ▶';
  } else {
    nextBtn.disabled = false;
    const isLastQ = qi === examData.sections[si].questions.length - 1;
    nextBtn.textContent = isLastQ ? 'Last ▶' : 'Next ▶';
  }

  // Update flag button
  updateFlagBtn();
}

function navigateQ(delta) {
  const sec = examData.sections[currentSectionIdx];
  const nextQi = currentQIdx + delta;
  if (nextQi < 0 || nextQi >= sec.questions.length) return;
  goToQuestion(currentSectionIdx, nextQi);
}

// ============================================================
// Render Question
// ============================================================
function renderQuestion(si, qi) {
  const q = examData.sections[si].questions[qi];
  const isListening = examData.sections[si].name.includes('Listening');
  const sec = examData.sections[si];
  const qState = state[si][qi];
  const main = document.getElementById('exam-main');
  main.innerHTML = '';
  main.scrollTop = 0;

  // --- Instruction box ---
  const instruction = q.instruction || defaultInstruction(q.type);
  const instBox = el('div', 'q-instruction-box', instruction);
  main.appendChild(instBox);

  // --- Language buttons ---
  if (q.translations) {
    const langRow = el('div', 'lang-buttons');
    Object.keys(q.translations).forEach((lang, i) => {
      const btn = document.createElement('button');
      btn.className = 'btn-lang';
      btn.innerHTML = `<span class="lang-icon">🌐</span> Your Language ${i + 1}`;
      btn.onclick = () => openLangModal(q, i);
      langRow.appendChild(btn);
    });
    main.appendChild(langRow);
  } else {
    // Default language buttons (just show generic ones)
    const langRow = el('div', 'lang-buttons');
    const btn1 = document.createElement('button');
    btn1.className = 'btn-lang';
    btn1.innerHTML = `<span class="lang-icon">🌐</span> Your Language 1`;
    btn1.onclick = () => openLangModal(q, 0);
    langRow.appendChild(btn1);
    main.appendChild(langRow);
  }

  // --- Stem (question text) ---
  if (q.stem) {
    const stemDiv = el('div', 'q-stem-text', q.stem);
    main.appendChild(stemDiv);
  }

  // --- Media: image / audio / text context / dialogue ---
  if (q.type === 'image') {
    const imgSrc = `exams/${examId}/images/${q.image}`;
    const img = document.createElement('img');
    img.className = 'q-illustration';
    img.src = imgSrc;
    img.alt = `Question ${qi + 1}`;
    img.onerror = function () {
      this.style.display = 'none';
      const ph = el('div', 'q-image-placeholder', `📷 ${q.image}`);
      if (q.imagePrompt) {
        const tip = el('div', '', `Prompt: ${q.imagePrompt}`);
        tip.style.cssText = 'font-size:10px;color:#aaa;text-align:center;padding:4px';
        ph.appendChild(tip);
      }
      this.parentNode.insertBefore(ph, this.nextSibling);
    };
    main.appendChild(img);

  } else if (q.type === 'audio') {
    const audioSrc = `exams/${examId}/audio/${q.audio}`;

    // Character icons
    if (q.characters) {
      const chars = el('div', 'conversation-chars');
      q.characters.forEach(c => {
        const ci = el('div', 'char-icon');
        ci.innerHTML = `<span class="char-face">${c.face || '👤'}</span><span class="char-name">${c.name || ''}</span>`;
        chars.appendChild(ci);
      });
      main.appendChild(chars);
    } else {
      const chars = el('div', 'conversation-chars');
      chars.innerHTML = `<div class="char-icon"><span class="char-face">👩</span><span class="char-name">A</span></div>
                         <div class="char-icon"><span class="char-face">👨</span><span class="char-name">B</span></div>`;
      main.appendChild(chars);
    }

    // Audio player (Web Speech API)
    if (!audioPlays[`${si}-${qi}`]) audioPlays[`${si}-${qi}`] = 0;
    const maxPlays = 2;
    const playsUsed = audioPlays[`${si}-${qi}`];
    const canPlay = playsUsed < maxPlays;

    const player = document.createElement('div');
    player.className = 'q-audio-player';

    // Store transcript on the element to avoid encoding issues in inline handlers
    const transcript = q.audioTranscript || '';

    player.innerHTML = `
      <button class="btn-audio-play" id="btn-play-${qi}" ${!canPlay ? 'disabled' : ''}>▶</button>
      <div class="audio-progress-bar"><div class="audio-fill" id="audio-fill-${qi}"></div></div>
      <span class="audio-plays-left" id="plays-left-${qi}">${maxPlays - playsUsed} plays left</span>`;
    main.appendChild(player);

    // Attach click handler properly to avoid encoding issues
    const playBtn = document.getElementById(`btn-play-${qi}`);
    if (playBtn) {
      playBtn.addEventListener('click', () => playAudio(transcript, si, qi));
    }

  } else if (q.type === 'text') {
    if (q.context) {
      main.appendChild(el('div', 'context-box', q.context));
    }
    if (q.dialogue) {
      const dlBox = el('div', 'dialogue-box');
      q.dialogue.forEach(line => {
        const lineDiv = el('div', 'dialogue-line');
        const speech = (line.speech || '').replace(/___/g, '<span class="blank"></span>');
        lineDiv.innerHTML = `<span class="speaker">${line.speaker}：</span><span class="speech">${speech}</span>`;
        dlBox.appendChild(lineDiv);
      });
      main.appendChild(dlBox);
    }
  }

  // --- Options ---
  if (q.imageOptions && isListening) {
    // Image option grid for Listening
    const grid = el('div', 'image-options-grid');
    const answerIndex = getAnswerIndex(q);
    q.imageOptions.forEach((opt, oi) => {
      const imgOpt = document.createElement('div');
      imgOpt.className = 'image-option' + (qState.selected === oi ? ' selected' : '');
      imgOpt.id = `opt-${qi}-${oi}`;
      if (examFinished) {
        if (oi === answerIndex) imgOpt.classList.add('correct');
        else if (qState.selected === oi) imgOpt.classList.add('wrong');
      }
      const optImgSrc = `exams/${examId}/images/${opt}`;
      imgOpt.innerHTML = `<img src="${optImgSrc}" alt="Option ${oi + 1}" onerror="this.parentNode.innerHTML='<div class=\\'image-option-placeholder\\'>📷 ${opt}</div>'">`;
      if (!examFinished) {
        imgOpt.onclick = () => selectOption(si, qi, oi);
      }
      grid.appendChild(imgOpt);
    });
    main.appendChild(grid);
  } else {
    // Text options
    const optList = el('div', 'options-list');
    const answerIndex = getAnswerIndex(q);
    q.options.forEach((opt, oi) => {
      const row = document.createElement('div');
      row.className = 'option-row';
      row.id = `opt-${qi}-${oi}`;
      row.textContent = opt;
      if (qState.selected === oi) row.classList.add('selected');
      if (examFinished) {
        if (oi === answerIndex) row.classList.add('correct');
        else if (qState.selected === oi && oi !== answerIndex) row.classList.add('wrong');
        row.style.cursor = 'default';
      } else {
        row.onclick = () => selectOption(si, qi, oi);
      }
      optList.appendChild(row);
    });
    main.appendChild(optList);
  }
}

function defaultInstruction(type) {
  if (type === 'image') return 'Look at the illustration and choose the correct word.';
  if (type === 'audio') return 'Listen to the audio and answer the question.';
  return 'Read and choose the best answer.';
}

function getAnswerIndex(q) {
  if (!q) return -1;
  if (Number.isInteger(q.answer)) return q.answer;
  if (!Array.isArray(q.options)) return -1;
  const numericAnswer = Number(q.answer);
  if (Number.isInteger(numericAnswer) && numericAnswer >= 1 && numericAnswer <= q.options.length) {
    return numericAnswer - 1;
  }
  return q.options.findIndex(opt => String(opt).trim() === String(q.answer).trim());
}

function getOptionText(q, optionIndex) {
  if (Array.isArray(q.options) && Number.isInteger(optionIndex) && optionIndex >= 0) {
    return q.options[optionIndex] || `option ${optionIndex + 1}`;
  }
  return optionIndex !== null && optionIndex !== undefined ? `option ${optionIndex + 1}` : '';
}

function isCorrectAnswer(q, selectedIndex) {
  return selectedIndex !== null && selectedIndex === getAnswerIndex(q);
}

// ============================================================
// Option Selection
// ============================================================
function selectOption(si, qi, oi) {
  if (examFinished) return;
  const qState = state[si][qi];
  qState.selected = oi;
  qState.answered = true;

  updateSidebarQ();

  // For Listening: enable Next button after answering
  const isListening = examData.sections[si].name.includes('Listening');
  if (isListening) {
    const nextBtn = document.getElementById('btn-next-q');
    if (nextBtn) nextBtn.disabled = false;
  }

  // Re-render options to show selection
  const q = examData.sections[si].questions[qi];
  const isImgOptions = q.imageOptions && isListening;

  if (isImgOptions) {
    q.imageOptions.forEach((_, o) => {
      const el = document.getElementById(`opt-${qi}-${o}`);
      if (el) el.classList.toggle('selected', o === oi);
    });
  } else {
    q.options.forEach((_, o) => {
      const el = document.getElementById(`opt-${qi}-${o}`);
      if (el) el.classList.toggle('selected', o === oi);
    });
  }
}

// ============================================================
// Audio
// ============================================================
// ============================================================
// Audio (Web Speech API)
// ============================================================
let isSpeechPlaying = false;

function playAudio(transcript, si, qi, idPrefix = '') {
  if (isSpeechPlaying) {
    // If stuck, reset and allow retry
    isSpeechPlaying = false;
    window.speechSynthesis.cancel();
    return;
  }
  if (!transcript) return;

  const maxPlays = 2;
  const key = `${si}-${qi}`;
  const isReview = !!idPrefix;

  if (!isReview) {
    if (!audioPlays[key]) audioPlays[key] = 0;
    if (audioPlays[key] >= maxPlays) return;
    audioPlays[key]++;

    const remaining = maxPlays - audioPlays[key];
    const plLabel = document.getElementById(`plays-left-${qi}`);
    if (plLabel) plLabel.textContent = `${remaining} play${remaining !== 1 ? 's' : ''} left`;

    if (audioPlays[key] >= maxPlays) {
      const playBtn = document.getElementById(`btn-play-${qi}`);
      if (playBtn) playBtn.disabled = true;
    }
  }

  // Cancel any existing speech and reset state
  window.speechSynthesis.cancel();
  isSpeechPlaying = true;

  // Progress animation
  const fill = document.getElementById(`${idPrefix}audio-fill-${qi}`);
  let progressInterval = null;
  if (fill) {
    fill.style.width = '0%';
    fill.style.transition = 'width 0.5s linear';
    const estimateMs = Math.max(transcript.length * 180, 2000);
    let elapsedMs = 0;
    progressInterval = setInterval(() => {
      elapsedMs += 500;
      let p = (elapsedMs / estimateMs) * 100;
      if (p > 95) p = 95;
      fill.style.width = p + '%';
    }, 500);
  }

  // Safety timeout: reset isSpeechPlaying after estimated duration + 5s buffer
  const safetyTimeout = setTimeout(() => {
    isSpeechPlaying = false;
    window.speechSynthesis.cancel();
    if (progressInterval) clearInterval(progressInterval);
    activeUtterance = null;
    if (fill) {
      fill.style.width = '100%';
      setTimeout(() => { if (!isSpeechPlaying) fill.style.width = '0%'; }, 1000);
    }
  }, Math.max(transcript.length * 180, 2000) + 5000);

  // Parse segments by speaker (detecting "Speaker:" at start of lines)
  const segments = [];
  const lines = transcript.split(/\r?\n/);
  const roleToVoiceIdx = {};
  let voiceCounter = 0;
  let currentRole = 'unknown';

  lines.forEach(line => {
    let text = line.trim();
    if (!text) return;

    // Check for speaker pattern: "Name：" or "Name:" at start
    const speakerMatch = text.match(/^([^：:\n]{1,8})[：:](.*)/);
    if (speakerMatch) {
      currentRole = speakerMatch[1].trim();
      text = speakerMatch[2].trim();

      if (!(currentRole in roleToVoiceIdx)) {
        roleToVoiceIdx[currentRole] = voiceCounter % 2;
        voiceCounter++;
      }
    }

    if (text) {
      segments.push({
        text: text,
        role: currentRole,
        voiceIdx: roleToVoiceIdx[currentRole] || 0
      });
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
        setTimeout(() => { if (!isSpeechPlaying) fill.style.width = '0%'; }, 1000);
      }
      return;
    }

    const item = segments[idx];
    const cleanText = sanitizeJapanese(item.text);
    if (!cleanText) return speakNext(idx + 1);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ja-JP';
    activeUtterance = utterance; // Retain reference to avoid GC pauses

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

    utterance.onend = () => {
      activeUtterance = null;
      speakNext(idx + 1);
    };
    utterance.onerror = (e) => {
      console.error('TTS Error:', e);
      activeUtterance = null;
      // Continue to next segment instead of stopping
      speakNext(idx + 1);
    };

    window.speechSynthesis.speak(utterance);
  }

  speakNext(0);
}

// ============================================================
// Flag for Review
// ============================================================
function toggleFlag() {
  if (examFinished) return;
  const qState = state[currentSectionIdx][currentQIdx];
  qState.flagged = !qState.flagged;
  updateFlagBtn();
  updateSidebarQ();
}

function updateFlagBtn() {
  const btn = document.getElementById('btn-flag');
  if (!btn) return;
  const flagged = state[currentSectionIdx] && state[currentSectionIdx][currentQIdx]
    ? state[currentSectionIdx][currentQIdx].flagged : false;
  btn.classList.toggle('flagged', flagged);
  btn.textContent = flagged ? '🚩 Flagged' : '🚩 Flag';
}

// ============================================================
// Finish Section
// ============================================================
function handleFinishSection() {
  if (!examData) return;
  const si = currentSectionIdx;
  const sec = examData.sections[si];

  // Check all answered
  const unanswered = sec.questions.filter((_, qi) => !state[si][qi].answered).length;
  if (unanswered > 0) {
    if (!confirm(`You have ${unanswered} unanswered question(s) in this section. Finish anyway?`)) return;
  }

  const nextSi = si + 1;
  if (nextSi < examData.sections.length) {
    currentSectionIdx = nextSi;
    currentQIdx = 0;
    renderSidebar();
    goToQuestion(nextSi, 0);
  } else {
    finishExam(false);
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('exam-sidebar');
  sidebar.style.display = sidebar.style.display === 'none' ? 'flex' : 'none';
}

// ============================================================
// Finish Exam & Results
// ============================================================
function finishExam(timeout) {
  if (examFinished) return;
  clearInterval(timerInterval);
  clearInterval(progressSaveInterval);
  examFinished = true;

  // Remove keyboard handler
  if (keyboardHandler) {
    document.removeEventListener('keydown', keyboardHandler);
    keyboardHandler = null;
  }

  // Clear saved progress
  clearProgress(examId);

  if (!examData) {
    const wrapper = document.querySelector('.exam-wrapper');
    if (wrapper) {
      wrapper.style.display = 'block';
      wrapper.style.height = 'auto';
      wrapper.style.minHeight = '100vh';
      wrapper.innerHTML = `<div style="text-align:center;padding:60px;color:#c00">
        <div style="font-size:48px;margin-bottom:16px">⚠️</div>
        <h3>Exam data could not be loaded.</h3>
        <a href="index.html" style="color:#2d6a2d;margin-top:16px;display:inline-block">← Back to Hub</a>
      </div>`;
    }
    return;
  }

  // Re-enable scroll for the results screen
  document.body.style.overflow = 'auto';
  document.body.style.height = 'auto';
  document.documentElement.style.overflow = 'auto';
  document.documentElement.style.height = 'auto';

  // Calculate scores
  let totalCorrect = 0, totalQ = 0;
  const sectionResults = [];

  examData.sections.forEach((sec, si) => {
    let secCorrect = 0;
    sec.questions.forEach((q, qi) => {
      totalQ++;
      if (isCorrectAnswer(q, state[si][qi].selected)) { secCorrect++; totalCorrect++; }
    });
    sectionResults.push({ name: sec.name, correct: secCorrect, total: sec.questions.length });
  });

  // Map to 10-250 scale: totalQ questions, max 250, min 10; pass at 200
  const rawPct = totalQ > 0 ? totalCorrect / totalQ : 0;
  const scaledScore = Math.round(10 + rawPct * 240); // 10 = all wrong, 250 = all correct
  const passingScore = 200;
  const passed = scaledScore >= passingScore;

  // Save exam history & wrong answers (Items #6, #10)
  saveExamHistory(examId, examData.title, scaledScore, passingScore, passed, sectionResults);
  saveWrongAnswers(examId, sectionResults);

  renderResultsScreen(scaledScore, passingScore, passed, sectionResults, timeout);
}

// ============================================================
// Exam History & Analytics (Item #6)
// ============================================================
function saveExamHistory(examId, title, score, passing, passed, sectionResults) {
  try {
    const history = JSON.parse(localStorage.getItem('jft_exam_history') || '[]');
    history.unshift({
      examId,
      title,
      score,
      passing,
      passed,
      sectionResults,
      date: Date.now()
    });
    // Keep last 50 exams
    if (history.length > 50) history.length = 50;
    localStorage.setItem('jft_exam_history', JSON.stringify(history));
  } catch (e) { /* quota exceeded */ }
}

function getExamHistory() {
  try {
    return JSON.parse(localStorage.getItem('jft_exam_history') || '[]');
  } catch (e) { return []; }
}

// ============================================================
// Wrong Answer Pool / Spaced Repetition (Item #10)
// ============================================================
function saveWrongAnswers(examId) {
  try {
    const pool = JSON.parse(localStorage.getItem('jft_wrong_pool') || '{}');
    examData.sections.forEach((sec, si) => {
      sec.questions.forEach((q, qi) => {
        if (!isCorrectAnswer(q, state[si][qi].selected)) {
          const key = `${examId}_${si}_${qi}`;
          if (!pool[key]) {
            pool[key] = {
              examId,
              sectionName: sec.name,
              si,
              qi,
              question: q,
              wrongCount: 0,
              lastWrong: Date.now(),
              nextReview: Date.now() + 86400000 // 1 day
            };
          }
          pool[key].wrongCount++;
          pool[key].lastWrong = Date.now();
          // Spaced repetition: 1d, 3d, 7d, 14d, 30d
          const intervals = [1, 3, 7, 14, 30];
          const idx = Math.min(pool[key].wrongCount - 1, intervals.length - 1);
          pool[key].nextReview = Date.now() + intervals[idx] * 86400000;
        }
      });
    });
    localStorage.setItem('jft_wrong_pool', JSON.stringify(pool));
  } catch (e) { /* quota exceeded */ }
}

function getWrongAnswerPool() {
  try {
    return JSON.parse(localStorage.getItem('jft_wrong_pool') || '{}');
  } catch (e) { return {}; }
}

function getDueReviewQuestions() {
  const pool = getWrongAnswerPool();
  const now = Date.now();
  return Object.values(pool).filter(item => item.nextReview <= now);
}

// ============================================================
// AI Inline Explanations (Item #1)
// ============================================================
const inlineAICache = {};

async function requestInlineExplanation(si, qi) {
  const wrapper = document.getElementById(`ai-exp-wrapper-${si}-${qi}`);
  const content = document.getElementById(`ai-exp-${si}-${qi}`);
  if (!wrapper || !content) return;

  // Check cache first
  const cacheKey = `${examId}_${si}_${qi}`;
  if (inlineAICache[cacheKey]) {
    wrapper.style.display = 'block';
    content.innerHTML = inlineAICache[cacheKey];
    return;
  }

  const q = examData.sections[si].questions[qi];
  const qState = state[si][qi];
  const correctIdx = getAnswerIndex(q);
  const userAnswer = qState.selected !== null ? getOptionText(q, qState.selected) : 'No answer';
  const correctAnswer = getOptionText(q, correctIdx);

  wrapper.style.display = 'block';
  content.innerHTML = `<div class="ai-loading-mini">Generating explanation...</div>`;

  const prompt = `আপনি একজন জাপানি ভাষার শিক্ষক। একজন শিক্ষার্থী এই JFT-Basic প্রশ্নটি ভুল করেছে। বাংলায় সংক্ষেপে ব্যাখ্যা করুন কেন সঠিক উত্তরটি সঠিক এবং ভুল উত্তরটি ভুল। জাপানি শব্দের সাথে রোমাজি (Romaji) ব্যবহার করুন। ২-৩ লাইনের মধ্যে রাখুন।

প্রশ্ন: ${q.stem || q.instruction || ''}${q.audioTranscript ? `\n\nঅডিও ট্রান্সক্রিপ্ট:\n${q.audioTranscript}` : ''}
অপশন: ${(q.options || q.imageOptions || []).join(', ')}
শিক্ষার্থীর উত্তর: ${userAnswer}
সঠিক উত্তর: ${correctAnswer}

ব্যাখ্যা:`;

  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 8000);
    const reportText = await fetchFromAI(prompt, controller.signal);
    inlineAICache[cacheKey] = marked.parse(reportText);
    content.innerHTML = inlineAICache[cacheKey];
  } catch (err) {
    content.innerHTML = `<div class="ai-error-mini">Could not load explanation. <button class="ai-retry-btn-small" onclick="requestInlineExplanation(${si}, ${qi})">Retry</button></div>`;
  }
}

// ============================================================
// Question Review Section
// ============================================================
function renderQuestionReview() {
  let html = `<div class="question-review-section">
    <div class="review-header">
      <div class="review-title">Detailed Question Review</div>
      <div class="review-subtitle">Review each question and see your results</div>
    </div>`;

  examData.sections.forEach((sec, si) => {
    html += `<div class="review-section-block">
      <div class="review-section-header">${sec.name}</div>`;

    sec.questions.forEach((q, qi) => {
      const qState = state[si][qi];
      const correctIdx = getAnswerIndex(q);
      const isCorrect = qState.selected === correctIdx;
      const isListening = sec.name.includes('Listening');
      const isImageOptions = q.imageOptions && Array.isArray(q.imageOptions);

      html += `<div class="review-q-item">
        <div class="review-q-meta">
          <span class="review-q-num">Question ${qi + 1}</span>
          <span class="review-q-status ${isCorrect ? 'correct' : 'wrong'}">
            ${isCorrect ? '✓ Correct' : '✗ Incorrect'}
          </span>
        </div>`;

      // --- SAME DESIGN AS EXAM SCREEN (Media Content) ---
      html += `<div class="review-q-media-content">`;

      // Instruction Box
      const instructionText = q.instruction || defaultInstruction(q.type);
      html += `<div class="review-instruction-box">${instructionText}</div>`;

      // Character Icons (for Listening)
      if (q.type === 'audio') {
        const charHtml = (q.characters || [
          { face: '👩', name: 'A' },
          { face: '👨', name: 'B' }
        ]).map(c => `<div class="char-icon"><span class="char-face">${c.face || '👤'}</span><span class="char-name">${c.name || ''}</span></div>`).join('');
        html += `<div class="conversation-chars review-chars">${charHtml}</div>`;

        // Audio Player
        html += `
          <div class="q-audio-player review-player" data-transcript="${encodeURIComponent(q.audioTranscript || '')}">
            <button class="btn-audio-play btn-play-review" id="btn-play-review-${si}-${qi}" data-si="${si}" data-qi="${qi}">▶</button>
            <div class="audio-progress-bar"><div class="audio-fill" id="review-${si}-audio-fill-${qi}"></div></div>
            <span class="audio-plays-left">Review Mode (Unlimited)</span>
          </div>`;
      }

      // Illustration
      if (q.type === 'image' && q.image) {
        const imgSrc = `exams/${examId}/images/${q.image}`;
        html += `<div class="review-illustration-wrapper">
          <img src="${imgSrc}" class="q-illustration review-illustration" onerror="this.parentNode.innerHTML='<div class=\\'q-image-placeholder\\'>📷 ${q.image}</div>'">
        </div>`;
      }

      // Context Box
      if (q.context) {
        html += `<div class="context-box review-context">${q.context}</div>`;
      }

      // Dialogue Box
      if (q.dialogue && Array.isArray(q.dialogue)) {
        const dlHtml = q.dialogue.map(line => {
          const speech = (line.speech || '').replace(/___/g, '<span class="blank"></span>');
          return `<div class="dialogue-line"><span class="speaker">${line.speaker}：</span><span class="speech">${speech}</span></div>`;
        }).join('');
        html += `<div class="dialogue-box review-dialogue">${dlHtml}</div>`;
      }

      // Stem text
      if (q.stem) {
        html += `<div class="q-stem-text review-stem">${q.stem}</div>`;
      }

      html += `</div>`; // End of media content

      // --- OPTIONS ---
      html += `<div class="review-options ${isImageOptions ? 'grid' : 'list'}">`;
      
      if (!isImageOptions && q.options) {
        q.options.forEach((opt, oi) => {
          let cls = 'review-option';
          if (oi === correctIdx) cls += ' correct';
          else if (oi === qState.selected && !isCorrect) cls += ' wrong';
          
          const icon = oi === correctIdx ? '✅' : (oi === qState.selected ? '❌' : '○');
          
          html += `<div class="${cls}">
            <span class="opt-icon">${icon}</span>
            <span class="opt-text">${opt}</span>
          </div>`;
        });
      } else if (isImageOptions) {
        q.imageOptions.forEach((img, oi) => {
          let cls = 'review-option-img';
          if (oi === correctIdx) cls += ' correct';
          else if (oi === qState.selected && !isCorrect) cls += ' wrong';
          const optImgSrc = `exams/${examId}/images/${img}`;
          html += `<div class="${cls}">
              <img src="${optImgSrc}" onerror="this.style.display='none'; this.parentNode.innerText='📷 ${img}'">
              <div class="opt-overlay">${oi === correctIdx ? '✅' : (oi === qState.selected ? '❌' : '')}</div>
          </div>`;
        });
      }
      
      html += `</div>
        <!-- AI Inline Explanation (Item #1) -->
        ${!isCorrect ? `
        <button class="ai-explain-btn" id="ai-explain-btn-${si}-${qi}" onclick="requestInlineExplanation(${si}, ${qi})">🤖 Explain</button>
        ` : ''}
        <div class="ai-inline-explanation-wrapper" id="ai-exp-wrapper-${si}-${qi}" style="display:none">
          <div class="ai-inline-tag">🤖 AI Teacher's Note</div>
          <div class="ai-inline-content" id="ai-exp-${si}-${qi}"></div>
        </div>
      </div>`;
    });
    html += `</div>`;
  });

  html += `</div>`;
  return html;
}

// ============================================================
// Results Screen
// ============================================================
function renderResultsScreen(score, passing, passed, sectionResults, timeout) {
  const wrapper = document.querySelector('.exam-wrapper');
  if (!wrapper) return;
  wrapper.style.display = 'block';
  wrapper.style.height = 'auto';
  wrapper.style.minHeight = '100vh';
  wrapper.style.overflow = 'visible';

  wrapper.innerHTML = `
    <div class="results-wrapper" id="results-wrapper">
      <div class="results-card">

        <div class="results-header-top">
          <div class="results-sample-badge">SAMPLE</div>
          <div class="results-org-logo">JAPAN FOUNDATION 🌸<br>国際交流基金</div>
        </div>

        <div class="results-title-jp">国際交流基金日本語基礎テスト 判定結果通知書</div>
        <div class="results-title-en">Japan Foundation Test for Basic Japanese Notification of assessment results</div>
        <hr class="results-divider"/>

        <div class="results-section-box">
          <div class="results-section-title">Examinee information</div>
          <div class="results-info-grid">
            <div class="results-info-item">Face Photo</div>
            <div class="results-info-item">Registration Number</div>
            <div class="results-info-item">Name</div>
            <div class="results-info-item">Nationality</div>
            <div class="results-info-item">Date of Birth</div>
            <div class="results-info-item">Sex</div>
          </div>
        </div>

        <div class="results-section-box">
          <div class="results-section-title">Test information</div>
          <div class="results-info-grid">
            <div class="results-info-item">Test Location</div>
            <div class="results-info-item">Test Date: ${new Date().toLocaleDateString()}</div>
          </div>
        </div>

        <div class="results-divider"></div>

        <!-- Score Box -->
        <div class="score-box">
          <span class="score-label">総合得点 ／ Total Score</span>
          <span class="score-num">${score}</span>
          <span class="score-unit">点 / points</span>
          <span class="score-meta">（得点範囲 / Range of Scores: 10–250 points ｜ 判定基準点 / Passing Score: ${passing} points）</span>
        </div>

        <!-- Score Scale Bar -->
        <div class="score-scale-container">
          <div class="score-scale-track" id="score-track">
            <!-- Passing line at 200 = (200-10)/(250-10) = 79.2% -->
            <div class="passing-line" style="left: 79.2%">
              <div class="passing-line-label">${passing}</div>
            </div>
            <!-- Score marker -->
            <div class="score-scale-marker" style="left: ${((score - 10) / 240 * 100).toFixed(1)}%" id="score-marker">
              <div class="score-marker-dot"></div>
            </div>
          </div>
          <div class="score-scale-labels">
            <span>10</span>
            <span>50</span>
            <span>100</span>
            <span>150</span>
            <span>${passing} (Pass)</span>
            <span>250</span>
          </div>
        </div>

        <div class="results-divider"></div>

        <!-- Assessment Result Text -->
        <div class="assessment-text">
          ${passed
      ? `<div class="japanese">あなたは国際交流基金日本語基礎テストにおいて、ある程度日常会話ができ、生活に支障がない程度の日本語能力水準に達していると判定されました。</div>
               <div class="english">You were assessed to have reached a level of Japanese language proficiency in Japan Foundation Test for Basic Japanese to be able to engage in everyday conversation to a certain extent and without difficulties in daily life.</div>`
      : `<div class="japanese">あなたは今回のテストで合格基準点に達しませんでした。引き続き学習を続けてください。</div>
               <div class="english">${timeout ? 'Time ran out.' : 'You did not reach the passing score.'} Continue studying and try again.</div>`}
        </div>

        <!-- Section Breakdown -->
        <div class="section-breakdown-title">セクション毎の正答率は次のとおりです。<br>The percentage of correct answers for each section are as follows.</div>

        ${sectionResults.map((sr, i) => {
        const pct = Math.round(sr.correct / sr.total * 100);
        const jpNames = ['文字と語彙', '会話と表現', '聴解', '読解'];
        return `
          <div class="section-bar-row">
            <div class="section-bar-name">${sr.name}</div>
            <div class="section-bar-name-jp">${jpNames[i] || ''}</div>
            <div class="section-bar-track">
              <div class="section-bar-fill" style="width:${pct}%;${pct === 0 ? 'min-width:0' : ''}" id="bar-fill-${i}">
                ${pct > 0 ? `<div class="section-bar-dot">${pct}%</div>` : ''}
              </div>
            </div>
          </div>`;
      }).join('')}

        <div class="results-divider"></div>

        <!-- Question Review Section -->
        ${renderQuestionReview()}

        <hr class="results-divider"/>

        <!-- ── AI Overview Section ── -->
        <div class="ai-overview-section" id="ai-overview-section">
          <div class="ai-overview-header">
            <div class="ai-overview-icon">🤖</div>
            <div class="ai-overview-title-group">
              <div class="ai-overview-title">LongCat AI লার্নিং রিপোর্ট</div>
              <div class="ai-overview-subtitle">AI-powered personal feedback in Bangla</div>
            </div>
            <div class="ai-overview-badge">AI বিশ্লেষণ</div>
          </div>
          <div class="ai-overview-body" id="ai-overview-body">
            <div class="ai-loading-state">
              <div class="ai-loading-dots"><span></span><span></span><span></span></div>
              <div class="ai-loading-text">আপনার লার্নিং রিপোর্ট তৈরি হচ্ছে…</div>
            </div>
          </div>
        </div>

        <div class="results-actions">
          <button class="btn-retry-hub" onclick="location.reload()">🔄 Retry This Exam</button>
          <button class="btn-retry-hub" onclick="location.href='exam.html?exam=${examId}&mode=study'" style="background:#4361ee">📖 Study Mode</button>
          <button class="btn-retry-hub secondary" onclick="location.href='index.html'">🏠 Back to Hub</button>
        </div>

      </div>
    </div>`;
  // Trigger AI overview after DOM is ready
  setTimeout(() => generateAIOverview(sectionResults), 100);

  // Attach review audio button listeners (delegated)
  setTimeout(() => {
    document.querySelectorAll('.btn-play-review').forEach(btn => {
      btn.addEventListener('click', function() {
        const player = this.closest('.q-audio-player');
        const transcript = decodeURIComponent(player?.dataset?.transcript || '');
        const si = parseInt(this.dataset.si);
        const qi = parseInt(this.dataset.qi);
        playAudio(transcript, si, qi, `review-${si}-`);
      });
    });
  }, 200);
}

// ============================================================
// AI Overview (LongCat AI - Consolidated Robust Version)
function buildSimplifiedPrompt(sectionResults) {
  if (!sectionResults || !Array.isArray(sectionResults)) return "";
  
  let prompt = `আপনি একজন জাপানি ভাষার শিক্ষক। একজন শিক্ষার্থী JFT-Basic পরীক্ষা দিয়েছে। নিচের ফলাফল বিশ্লেষণ করে বাংলায় একটি সংক্ষিপ্ত 'লার্নিং রিপোর্ট' দিন:

1. সামগ্রিক মূল্যায়ন (২ লাইন)
2. সেকশন বিশ্লেষণ (প্রতিটি সেকশনে ১ লাইন)
3. ভবিষ্যৎ পরিকল্পনা (২-৩ লাইন)

--- ফলাফল ---`;

  sectionResults.forEach((sr, i) => {
    const sec = examData.sections[i];
    if (!sec) return;
    prompt += `\nসেকশন ${i + 1}: ${sec.name} | ${sr.correct}/${sr.total} (${Math.round(sr.correct/sr.total*100)}%)`;

    // Include 1 wrong answer sample with transcript for context
    const wrong = sec.questions
      .map((q, qi) => ({ q, qi, st: state[i][qi] }))
      .find(item => !isCorrectAnswer(item.q, item.st.selected));
    if (wrong) {
      prompt += `\n  ভুল প্রশ্ন: ${wrong.q.stem || ''}`;
      if (wrong.q.audioTranscript) {
        const shortTranscript = wrong.q.audioTranscript.substring(0, 150);
        prompt += `\n  অডিও: ${shortTranscript}${wrong.q.audioTranscript.length > 150 ? '...' : ''}`;
      }
      prompt += `\n  শিক্ষার্থী: ${wrong.st.selected !== null ? getOptionText(wrong.q, wrong.st.selected) : 'দেয়নি'} → সঠিক: ${getOptionText(wrong.q, getAnswerIndex(wrong.q))}`;
    }
  });

  prompt += `\n\nসংক্ষেপে উত্তর দিন।`;
  return prompt;
}

async function fetchFromAI(prompt, signal) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    signal: signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'LongCat-Flash-Chat',
      messages: [
        { role: 'system', content: 'আপনি একজন জাপানি ভাষার শিক্ষক। শিক্ষার্থীদের পরীক্ষার ফলাফল বিশ্লেষণ করে বাংলায় সংক্ষিপ্ত গাইড করেন।' },
        { role: 'user', content: prompt }
      ],
      stream: false,
      max_tokens: 800,
      temperature: 0.7
    }),
    cache: 'no-cache'
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || '';
}

// AI report cache key
function getAIReportCacheKey(examId, sectionResults) {
  const sr = sectionResults.map(s => `${s.correct}/${s.total}`).join('|');
  return `jft_ai_report_${examId}_${sr}`;
}

let aiGenerationActive = false;
async function generateAIOverview(sectionResults) {
  const container = document.getElementById('ai-overview-body');
  if (!container || aiGenerationActive) return;

  // Guard against undefined on retry
  if (!sectionResults) {
    console.warn('AI Overview: sectionResults is missing');
    return;
  }

  // Check cache first (Item #5)
  const cacheKey = getAIReportCacheKey(examId, sectionResults);
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    container.innerHTML = `
      <div class="ai-response-container">
        <div class="ai-text-content">${marked.parse(cached)}</div>
      </div>
      <div class="ai-footer-note">এই বিশ্লেষণটি AI দ্বারা জেনারেট করা হয়েছে। কোনো প্রশ্ন থাকলে আপনার টিচারের সাথে আলোচনা করুন।</div>`;
    return;
  }

  aiGenerationActive = true;
  window.__lastSectionResults = sectionResults;

  container.innerHTML = `
    <div class="ai-loading-state">
      <div class="ai-loading-dots"><span></span><span></span><span></span></div>
      <div class="ai-loading-text">আপনার লার্নিং রিপোর্ট তৈরি হচ্ছে, দয়া করে অপেক্ষা করুন…</div>
    </div>`;

  // Retry logic with exponential backoff (Item #5)
  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      const prompt = buildSimplifiedPrompt(sectionResults);
      const reportText = await fetchFromAI(prompt, controller.signal);
      clearTimeout(timeoutId);

      if (reportText && reportText.trim().length > 0) {
        // Cache the result
        try { localStorage.setItem(cacheKey, reportText); } catch (e) {}

        container.innerHTML = `
          <div class="ai-response-container">
            <div class="ai-text-content">${marked.parse(reportText)}</div>
          </div>
          <div class="ai-footer-note">এই বিশ্লেষণটি AI দ্বারা জেনারেট করা হয়েছে। কোনো প্রশ্ন থাকলে আপনার টিচারের সাথে আলোচনা করুন।</div>`;
        aiGenerationActive = false;
        return;
      }
      throw new Error('Empty response');
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      console.error(`AI Error (attempt ${attempt + 1}/${maxRetries}):`, err);

      // Don't retry on abort (timeout) after last attempt
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        container.innerHTML = `
          <div class="ai-loading-state">
            <div class="ai-loading-dots"><span></span><span></span><span></span></div>
            <div class="ai-loading-text">আবার চেষ্টা করা হচ্ছে... (${attempt + 2}/${maxRetries})</div>
          </div>`;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  // All retries failed
  const isTimeout = lastError && (lastError.name === 'AbortError' || lastError.message.includes('aborted'));
  container.innerHTML = `
    <div class="ai-error-box">
      <div class="ai-error-icon">⚠️</div>
      <div class="ai-error-text">
        ${isTimeout ? 'সময় শেষ হয়ে গেছে (Timeout)। সার্ভার থেকে উত্তর পেতে দেরি হচ্ছে।' : 'দুঃখিত, রিপোর্ট তৈরি করা সম্ভব হয়নি: ' + (lastError?.message || 'Unknown error')}
      </div>
      <button class="ai-retry-btn" onclick="generateAIOverview(window.__lastSectionResults)">আবার চেষ্টা করুন (Retry)</button>
    </div>`;
  aiGenerationActive = false;
}

// ============================================================
// Language Modal
// ============================================================
function openLangModal(q, langIndex) {
  const modal = document.getElementById('lang-modal');
  const body = document.getElementById('lang-modal-body');
  const title = document.getElementById('lang-modal-title');

  title.textContent = `Your Language ${langIndex + 1}`;

  // Show multilingual translations from q.translations, or fallback to stem
  if (q.translations && q.translations.length > langIndex) {
    const langs = q.translations[langIndex];
    body.innerHTML = Object.entries(langs).map(([lang, text]) =>
      `<div class="lang-row">
        <div class="lang-name">${lang}</div>
        <div class="lang-text">${text}</div>
      </div>`
    ).join('');
  } else {
    // Fallback: show instruction + stem in English
    body.innerHTML = `
      <div class="lang-row">
        <div class="lang-name">English</div>
        <div class="lang-text">${q.instruction || ''}<br>${q.stem || ''}</div>
      </div>`;
  }

  modal.classList.add('open');
}

function closeLangModal() {
  document.getElementById('lang-modal').classList.remove('open');
}

// ============================================================
// Utility
// ============================================================
function el(tag, cls, text) {
  const d = document.createElement(tag);
  if (cls) d.className = cls;
  if (text) d.textContent = text;
  return d;
}

// Boot
window.addEventListener('DOMContentLoaded', initExam);

// ============================================================
// i18n System (Item #12)
// ============================================================
const I18N = {
  en: {
    'timer.label': 'Section Time Remaining',
    'finish.section': 'Finish Section',
    'flag': '🚩 Flag',
    'flagged': '🚩 Flagged',
    'back': '◀ Back',
    'next': 'Next ▶',
    'last': 'Last ▶',
    'question.review': 'Detailed Question Review',
    'review.subtitle': 'Review each question and see your results',
    'correct': '✓ Correct',
    'incorrect': '✗ Incorrect',
    'ai.teacher': "🤖 AI Teacher's Note",
    'study.mode': 'Study Mode',
    'study.banner': '📖 Study Mode — No timer, learn at your own pace',
    'keyboard.hints': '⌨️ 1-4: select | ←→: nav | F: flag | Enter: next',
  },
  bn: {
    'timer.label': 'সেকশনের অবশিষ্ট সময়',
    'finish.section': 'সেকশন শেষ করুন',
    'flag': '🚩 ফ্ল্যাগ',
    'flagged': '🚩 ফ্ল্যাগ করা হয়েছে',
    'back': '◀ পিছনে',
    'next': 'পরবর্তী ▶',
    'last': 'শেষ ▶',
    'question.review': 'বিস্তারিত প্রশ্ন পর্যালোচনা',
    'review.subtitle': 'প্রতিটি প্রশ্ন পর্যালোচনা করুন এবং ফলাফল দেখুন',
    'correct': '✓ সঠিক',
    'incorrect': '✗ ভুল',
    'ai.teacher': '🤖 AI শিক্ষকের নোট',
    'study.mode': 'স্টাডি মোড',
    'study.banner': '📖 স্টাডি মোড — কোনো টাইমার নেই, নিজের গতিতে শিখুন',
    'keyboard.hints': '⌨️ ১-৪: সিলেক্ট | ←→: নেভিগেট | F: ফ্ল্যাগ | Enter: পরবর্তী',
  }
};

function t(key) {
  const lang = localStorage.getItem('jft_lang') || 'en';
  return (I18N[lang] && I18N[lang][key]) || I18N['en'][key] || key;
}

function setLanguage(lang) {
  localStorage.setItem('jft_lang', lang);
  location.reload();
}
