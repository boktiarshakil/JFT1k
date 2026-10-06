/**
 * JFT Exam Hub — Core Application Engine v3
 * Requires: js/audio.js, js/i18n.js (loaded before this file)
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
let sectionTimers = {};       // { [si]: secondsRemaining }
let activeTimerSi = null;     // which section timer is currently running
let timerInterval = null;
let examMode = 'exam';       // 'exam' | 'study'
let progressSaveInterval = null;
let timerWarningShown = {};   // { [si]: { fiveMin: bool, oneMin: bool } }

// Per-section durations (seconds) — matches real JFT-Basic timing
const SECTION_DURATIONS = {
  0: 20 * 60,   // Script and Vocabulary: 20 min
  1: 15 * 60,   // Conversation and Expression: 15 min
  2: 25 * 60,   // Listening Comprehension: 25 min
  3: 30 * 60,   // Reading Comprehension: 30 min
};
const DEFAULT_SECTION_DURATION = 20 * 60;
let keyboardHandler = null;

// Speech Synthesis Context

// Audio module loaded separately via js/audio.js
// i18n module loaded separately via js/i18n.js


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
  sidebar.style.display = sidebar.style.display === 'none' ? '' : 'none';
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
  saveWrongAnswers(examId);

  updateReviewPool(examId, sectionResults);
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

function cleanupStaleReviewItems() {
  try {
    const pool = JSON.parse(localStorage.getItem('jft_wrong_pool') || '{}');
    const now = Date.now();
    const STALE_DAYS = 90;
    let changed = false;
    Object.keys(pool).forEach(key => {
      const item = pool[key];
      // Remove items not reviewed in 90 days (mastered or abandoned)
      if (item.lastWrong && now - item.lastWrong > STALE_DAYS * 86400000) {
        delete pool[key];
        changed = true;
      }
    });
    if (changed) localStorage.setItem('jft_wrong_pool', JSON.stringify(pool));
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

  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      const reportText = await fetchFromAI(prompt, controller.signal);
      clearTimeout(timeoutId);

      if (reportText && reportText.trim().length > 0) {
        inlineAICache[cacheKey] = marked.parse(reportText);
        content.innerHTML = inlineAICache[cacheKey];
        return;
      }
      throw new Error('Empty response');
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      console.error(`Inline AI Error (attempt ${attempt + 1}/${maxRetries}):`, err);

      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s
        content.innerHTML = `<div class="ai-loading-mini">Retrying... (${attempt + 2}/${maxRetries})</div>`;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  // All retries failed
  const isTimeout = lastError && (lastError.name === 'AbortError' || lastError.message.includes('aborted'));
  const isNetworkError = lastError && (lastError.message.includes('Failed to fetch') || lastError.message.includes('NetworkError'));
  content.innerHTML = `<div class="ai-error-mini">${isTimeout ? '⏱️ সময় শেষ হয়ে গেছে।' : (isNetworkError ? '📡 নেটওয়ার্ক সমস্যা।' : 'দুঃখিত, ব্যাখ্যা লোড করা যায়নি।')} <button class="ai-retry-btn-small" onclick="requestInlineExplanation(${si}, ${qi})">Retry</button></div>`;
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
  wrapper.style.minHeight = '100dvh';
  wrapper.style.overflow = 'visible';

  const studyBanner = examMode === 'study' ? '<div class="study-mode-results-banner">📖 Study Mode — Practice without time pressure</div>' : '';

  wrapper.innerHTML = `
    <div class="results-wrapper" id="results-wrapper">
      <div class="results-card">
        ${studyBanner}

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
            <div class="score-scale-marker" style="left: clamp(0%, ${((score - 10) / 240 * 100).toFixed(1)}%, calc(100% - 14px))" id="score-marker">
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
          <button class="btn-retry-hub secondary" onclick="location.href='history.html'">← Back to Progress</button>
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
        window.JFTAudio.playAudio(transcript, si, qi, `review-${si}-`);
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
    // Try to parse structured error from our proxy
    let errMsg = `HTTP ${response.status}`;
    try {
      const errData = await response.json();
      if (errData?.error?.message) {
        errMsg = errData.error.message;
      }
    } catch (_) {
      // Non-JSON error — use status text
      errMsg = `HTTP ${response.status}: ${response.statusText || 'Server error'}`;
    }
    throw new Error(errMsg);
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
  const isNetworkError = lastError && (lastError.message.includes('Failed to fetch') || lastError.message.includes('NetworkError') || lastError.message.includes('network'));
  let errorTitle, errorDesc;
  if (isTimeout) {
    errorTitle = '⏱️ সময় শেষ হয়ে গেছে';
    errorDesc = 'LongCat API থেকে উত্তর পেতে বেশি সময় লাগছে। ইন্টারনেট কানেকশন চেক করে আবার চেষ্টা করুন।';
  } else if (isNetworkError) {
    errorTitle = '📡 নেটওয়ার্ক সমস্যা';
    errorDesc = 'সার্ভারে সংযোগ করা যাচ্ছে না। আপনার ইন্টারনেট কানেকশন চেক করুন।';
  } else {
    errorTitle = '⚠️ রিপোর্ট তৈরি করা সম্ভব হয়নি';
    errorDesc = lastError?.message || 'Unknown error';
  }
  container.innerHTML = `
    <div class="ai-error-box">
      <div class="ai-error-icon">${isTimeout ? '⏱️' : (isNetworkError ? '📡' : '⚠️')}</div>
      <div class="ai-error-text">
        <strong>${errorTitle}</strong><br>
        <span style="font-size:13px;color:#888">${errorDesc}</span>
      </div>
      <button class="ai-retry-btn" onclick="generateAIOverview(window.__lastSectionResults)">🔄 আবার চেষ্টা করুন (Retry)</button>
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
// ============================================================
// Review Pool Update
// ============================================================
function updateReviewPool(examId, sectionResults) {
  if (examId !== 'review') return;
  try {
    const pool = JSON.parse(localStorage.getItem('jft_wrong_pool') || '{}');
    examData.sections.forEach((sec, si) => {
      sec.questions.forEach((q, qi) => {
        const key = q._reviewKey;
        if (!key || !pool[key]) return;
        if (isCorrectAnswer(q, state[si][qi].selected)) {
          delete pool[key];
        } else {
          pool[key].wrongCount++;
          pool[key].lastWrong = Date.now();
          const intervals = [1, 3, 7, 14, 30];
          const idx = Math.min(pool[key].wrongCount - 1, intervals.length - 1);
          pool[key].nextReview = Date.now() + intervals[idx] * 86400000;
        }
      });
    });
    localStorage.setItem('jft_wrong_pool', JSON.stringify(pool));
  } catch (e) { /* quota exceeded */ }
}
