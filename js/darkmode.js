/**
 * Shared Dark Mode Module
 * Include on any page that needs the floating dark mode toggle.
 * Creates a FAB button and applies saved preference on load.
 */
(function() {
  function applyDarkMode() {
    const isDark = localStorage.getItem('jft_dark_mode') === '1';
    document.body.classList.toggle('dark-mode', isDark);
    updateFabIcon(isDark);
  }

  function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('jft_dark_mode', isDark ? '1' : '0');
    updateFabIcon(isDark);
  }

  function updateFabIcon(isDark) {
    const fab = document.getElementById('dark-mode-fab');
    if (fab) {
      fab.textContent = isDark ? '☀️' : '🌙';
      fab.title = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    }
  }

  // Create FAB
  const fab = document.createElement('button');
  fab.id = 'dark-mode-fab';
  fab.className = 'dark-mode-fab';
  fab.onclick = toggleDarkMode;
  document.body.appendChild(fab);

  // Apply saved preference
  applyDarkMode();

  // Expose for settings popup integration
  window.JFTDarkMode = { applyDarkMode, toggleDarkMode, updateFabIcon };
})();
