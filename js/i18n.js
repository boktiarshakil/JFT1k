/**
 * JFT Exam Hub — i18n Module
 * English/Bengali language switching
 */
(function() {
  'use strict';

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
    var lang = localStorage.getItem('jft_lang') || 'en';
    return (I18N[lang] && I18N[lang][key]) || I18N['en'][key] || key;
  }

  function setLanguage(lang) {
    localStorage.setItem('jft_lang', lang);
    location.reload();
  }

  window.JFTi18n = { t: t, setLanguage: setLanguage };
})();
