function renderSystemSettingsRowHtml(options = {}) {
  const {
    label,
    value = '',
    detailPage = '',
    action = '',
    danger = false,
    staticRow = false,
    showChevron = true,
  } = options;

  const valueHtml = value
    ? `<span class="system-settings-value">${escapeHtml(value)}</span>`
    : '';
  const chevronHtml = showChevron && !staticRow && !value
    ? '<span class="student-island-chevron" aria-hidden="true"><i data-lucide="chevron-right"></i></span>'
    : (showChevron && value
      ? '<span class="student-island-chevron" aria-hidden="true"><i data-lucide="chevron-right"></i></span>'
      : '');

  if (staticRow) {
    return `
      <li class="student-island-item system-settings-item--static">
        <div class="student-island-link">
          <div class="student-island-main system-settings-main">
            <span class="student-name">${escapeHtml(label)}</span>
            ${value ? `<span class="system-settings-value-inline">${escapeHtml(value)}</span>` : ''}
          </div>
        </div>
      </li>
    `;
  }

  const attrs = [
    'type="button"',
    'class="student-island-link system-settings-link' + (danger ? ' system-settings-link--danger' : '') + '"',
  ];
  if (detailPage) attrs.push(`data-detail-open="${detailPage}"`);
  if (action) attrs.push(`data-system-action="${action}"`);

  return `
    <li class="student-island-item">
      <button ${attrs.join(' ')}>
        <div class="student-island-main system-settings-main">
          <span class="student-name">${escapeHtml(label)}</span>
          ${valueHtml}
        </div>
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
  const phone = getCurrentOperatorPhone();
  const version = await fetchLatestAppVersion();
  const body = document.getElementById('system-settings-body');
  if (!body) return;

  body.innerHTML = `
    <div class="system-settings-group">
      <ul class="student-island-list system-settings-list">
        ${renderSystemSettingsRowHtml({
          label: '账号',
          value: phone || '—',
          staticRow: true,
        })}
        ${renderSystemSettingsRowHtml({ label: '通用', detailPage: 'detail-system-general' })}
        ${renderSystemSettingsRowHtml({ label: '隐私设置', detailPage: 'detail-system-privacy' })}
      </ul>
    </div>
    <div class="system-settings-group">
      <h3 class="system-settings-group-title">关于系统</h3>
      <ul class="student-island-list system-settings-list">
        ${renderSystemSettingsRowHtml({
          label: '当前版本',
          value: 'v' + version,
          staticRow: true,
          showChevron: false,
        })}
        ${canViewChangelog()
          ? renderSystemSettingsRowHtml({ label: '更新日志', action: 'changelog' })
          : ''}
      </ul>
    </div>
    <div class="system-settings-group">
      <ul class="student-island-list system-settings-list">
        ${renderSystemSettingsRowHtml({
          label: '退出当前账号',
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
}


function openSystemPrivacyPage() {
  openDetailPage('detail-system-privacy');
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
