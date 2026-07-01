function renderSystemSettingsRowHtml(options = {}) {
  const {
    label,
    value = '',
    sublineHtml = '',
    monoSubline = false,
    icon = '',
    detailPage = '',
    action = '',
    danger = false,
    staticRow = false,
    showChevron = true,
  } = options;

  const iconHtml = icon
    ? `<span class="system-settings-icon${danger ? ' system-settings-icon--danger' : ''}" aria-hidden="true"><i data-lucide="${icon}"></i></span>`
    : '';

  let valueContent = '';
  if (sublineHtml) {
    valueContent = sublineHtml;
  } else if (value) {
    valueContent = escapeHtml(value);
  }

  const valueHtml = valueContent
    ? `<span class="system-settings-subline${monoSubline ? ' student-island-phone' : ''}">${valueContent}</span>`
    : '';

  const leadingHtml = `
    <div class="system-settings-leading">
      ${iconHtml}
      <div class="student-island-main system-settings-main">
        <span class="student-name">${escapeHtml(label)}</span>
        ${valueHtml}
      </div>
    </div>
  `;

  const chevronHtml = showChevron && !staticRow
    ? '<span class="student-island-chevron" aria-hidden="true"><i data-lucide="chevron-right"></i></span>'
    : '';

  if (staticRow) {
    return `
      <li class="student-island-item system-settings-item--static">
        <div class="student-island-link system-settings-row">
          ${leadingHtml}
        </div>
      </li>
    `;
  }

  const attrs = [
    'type="button"',
    'class="student-island-link system-settings-link system-settings-row' + (danger ? ' system-settings-link--danger' : '') + '"',
  ];
  if (detailPage) attrs.push(`data-detail-open="${detailPage}"`);
  if (action) attrs.push(`data-system-action="${action}"`);

  return `
    <li class="student-island-item">
      <button ${attrs.join(' ')}>
        ${leadingHtml}
        ${chevronHtml}
      </button>
    </li>
  `;
}


function getSelectedThemePreference() {
  const theme = localStorage.getItem(THEME_STORAGE_KEY);
  if (theme === 'light' || theme === 'dark') return theme;
  return isDarkModeActive() ? 'dark' : 'light';
}


function updateSystemThemeUI() {
  const theme = getSelectedThemePreference();
  const lightCheck = document.getElementById('system-theme-check-light');
  const darkCheck = document.getElementById('system-theme-check-dark');
  if (lightCheck) lightCheck.classList.toggle('is-on', theme === 'light');
  if (darkCheck) darkCheck.classList.toggle('is-on', theme === 'dark');
}


const ACCENT_CHOICES = ACCENT_THEME_KEYS;


function getSelectedAccentPreference() {
  const stored = localStorage.getItem(ACCENT_STORAGE_KEY);
  return normalizeAccentKey(stored);
}


function updateSystemAccentUI() {
  const accent = getSelectedAccentPreference();
  ACCENT_CHOICES.forEach((choice) => {
    const tile = document.querySelector(`.system-accent-option[data-accent-choice="${choice}"]`);
    const selected = accent === choice;
    if (tile) {
      tile.classList.toggle('is-selected', selected);
      tile.setAttribute('aria-checked', selected ? 'true' : 'false');
    }
  });
}


function buildAccountSublineHtml() {
  const name = getCurrentOperatorDisplayName();
  const phone = getCurrentOperatorPhone();
  if (!phone && (!name || name === '—')) return '—';
  if (!phone) return escapeHtml(name);
  const phoneHtml = `<span class="student-island-phone">${formatPhoneDigitsHtml(phone)}</span>`;
  if (!name || name === '—') return phoneHtml;
  return `${escapeHtml(name)}<span class="system-settings-subline-sep">·</span>${phoneHtml}`;
}


async function fetchLatestAppVersion() {
  try {
    const entries = await fetchChangelogEntries();
    if (!entries.length) return '—';
    return entries[0].version || '—';
  } catch (err) {
    console.error(err);
    return '—';
  }
}


async function renderSystemPage() {
  const version = await fetchLatestAppVersion();
  const body = document.getElementById('system-settings-body');
  if (!body) return;

  body.innerHTML = `
    <div class="system-settings-group">
      <ul class="student-island-list system-settings-list">
        ${renderSystemSettingsRowHtml({
          label: '账号',
          sublineHtml: buildAccountSublineHtml(),
          icon: 'user',
          staticRow: true,
        })}
      </ul>
    </div>
    <div class="system-settings-group">
      <h3 class="system-settings-group-title">通用与隐私</h3>
      <ul class="student-island-list system-settings-list">
        ${renderSystemSettingsRowHtml({ label: '通用', icon: 'sliders-horizontal', detailPage: 'detail-system-general' })}
        ${renderSystemSettingsRowHtml({ label: '隐私设置', icon: 'shield', detailPage: 'detail-system-privacy' })}
      </ul>
    </div>
    <div class="system-settings-group">
      <h3 class="system-settings-group-title">关于系统</h3>
      <ul class="student-island-list system-settings-list">
        ${renderSystemSettingsRowHtml({
          label: '当前版本',
          value: 'v' + version,
          icon: 'badge-info',
          monoSubline: true,
          staticRow: true,
          showChevron: false,
        })}
        ${canViewChangelog()
          ? renderSystemSettingsRowHtml({ label: '更新日志', icon: 'scroll-text', action: 'changelog' })
          : ''}
      </ul>
    </div>
    <div class="system-settings-group">
      <ul class="student-island-list system-settings-list">
        ${renderSystemSettingsRowHtml({
          label: '退出当前账号',
          icon: 'log-out',
          action: 'logout',
          danger: true,
          showChevron: false,
        })}
      </ul>
    </div>
  `;

  bindSystemSettingsEvents(body);
  if (window.lucide && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
}


function bindSystemSettingsEvents(root) {
  root.querySelectorAll('[data-detail-open]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pageId = btn.dataset.detailOpen;
      if (pageId === 'detail-system-general') {
        openSystemGeneralPage();
        return;
      }
      if (pageId === 'detail-system-privacy') {
        openSystemPrivacyPage();
      }
    });
  });

  root.querySelectorAll('[data-system-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.systemAction === 'changelog') {
        openChangelogPage();
        return;
      }
      if (btn.dataset.systemAction === 'logout') {
        logoutAdmin();
      }
    });
  });
}


function openSystemGeneralPage() {
  openDetailPage('detail-system-general');
  updateSystemThemeUI();
  updateSystemAccentUI();
  initLucideIcons();
}


function openSystemPrivacyPage() {
  openDetailPage('detail-system-privacy');
  initLucideIcons();
}


function bindSystemGeneralEvents() {
  document.querySelectorAll('.system-theme-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.themeChoice;
      if (theme === 'light' || theme === 'dark') {
        setThemePreference(theme);
      }
    });
  });

  document.querySelectorAll('.system-accent-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const accent = btn.dataset.accentChoice;
      if (ACCENT_CHOICES.includes(accent)) {
        setAccentPreference(accent);
      }
    });
  });
}


function bindSystemPrivacyEvents() {
  const teachersBtn = document.getElementById('btn-system-privacy-teachers');
  if (teachersBtn) {
    teachersBtn.addEventListener('click', () => {
      openTeachersPage();
    });
  }

  const logsBtn = document.getElementById('btn-system-privacy-logs');
  if (logsBtn) {
    logsBtn.addEventListener('click', () => {
      openOperationLogsPage();
    });
  }
}


function renderSystemPageIfActive() {
  const page = document.getElementById('page-system');
  if (page && page.classList.contains('active')) {
    renderSystemPage();
  }
}
