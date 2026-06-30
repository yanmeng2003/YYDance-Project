let currentChangelogEntryId = null;
let currentChangelogEntryData = null;
let changelogEntryEditMode = false;

function canManageChangelog() {
  return normalizePhone(getCurrentOperatorPhone()) === ADMIN_EXTRA_ALLOWED_PHONE;
}

function canViewChangelog() {
  return !!getCurrentOperatorPhone();
}

function updateChangelogManageVisibility() {
  const canManage = canManageChangelog();
  const editBtn = document.getElementById('btn-changelog-entry-edit');

  if (editBtn) {
    editBtn.hidden = !canManage;
    editBtn.style.display = canManage ? '' : 'none';
  }

  if (!canManage && changelogEntryEditMode) {
    exitChangelogEntryEditMode();
    if (currentChangelogEntryData) {
      renderChangelogEntryUI(currentChangelogEntryData);
      return;
    }
  }

  updateChangelogFabVisibility();
}

function setChangelogEntryEditButtonLabel(label) {
  const btn = document.getElementById('btn-changelog-entry-edit');
  if (!btn) return;
  btn.textContent = label;
}

function exitChangelogEntryEditMode() {
  changelogEntryEditMode = false;
  setChangelogEntryEditButtonLabel('编辑');
}

function enterChangelogEntryEditMode() {
  if (!currentChangelogEntryData || !canManageChangelog()) return;

  changelogEntryEditMode = true;
  renderChangelogEntryUI(currentChangelogEntryData);
  setChangelogEntryEditButtonLabel('取消');
}

function cancelChangelogEntryEdit() {
  if (!currentChangelogEntryData) return;

  exitChangelogEntryEditMode();
  renderChangelogEntryUI(currentChangelogEntryData);
}

function toggleChangelogEntryEditMode() {
  if (changelogEntryEditMode) {
    cancelChangelogEntryEdit();
  } else {
    enterChangelogEntryEditMode();
  }
}

function renderChangelogListItemHtml(entry) {
  return `
    <li class="changelog-item">
      <button type="button" class="changelog-item-link" data-id="${escapeHtml(entry.id)}" aria-label="查看${escapeHtml(entry.title)}">
        <span class="changelog-item-title">${escapeHtml(entry.title)}</span>
        <span class="changelog-item-meta">
          <span class="changelog-item-version">v${escapeHtml(entry.version)}</span>
          <span class="changelog-item-date">${escapeHtml(entry.released_at)}</span>
        </span>
      </button>
    </li>
  `;
}

async function renderChangelogListPage() {
  const body = document.getElementById('changelog-list-body');
  if (!body) return;

  body.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:24px;">加载中...</p>';

  try {
    const entries = await fetchChangelogEntries();
    if (!entries.length) {
      body.innerHTML = renderListEmptyHtml('暂无更新日志');
      return;
    }

    body.innerHTML = '<ul class="changelog-list">' + entries.map(renderChangelogListItemHtml).join('') + '</ul>';

    body.querySelectorAll('.changelog-item-link').forEach(btn => {
      btn.addEventListener('click', () => openChangelogEntryDetail(btn.dataset.id));
    });
  } catch (err) {
    console.error(err);
    body.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:24px;">加载失败</p>';
    showToast(err.message || '加载更新日志失败');
  }
}

function isChangelogListPageActive() {
  const page = document.getElementById('detail-changelog');
  return page
    && page.classList.contains('is-visible')
    && page.classList.contains('is-open');
}

function isChangelogEntryPageActive() {
  const page = document.getElementById('detail-changelog-entry');
  return page && page.classList.contains('is-visible');
}

function isChangelogFormPageActive() {
  const page = document.getElementById('detail-changelog-form');
  return page && page.classList.contains('is-visible');
}

function updateChangelogFabVisibility() {
  const fab = document.getElementById('fab-changelog-add');
  if (!fab) return;
  const visible = isChangelogListPageActive()
    && !isChangelogEntryPageActive()
    && !isChangelogFormPageActive()
    && canManageChangelog();
  fab.classList.toggle('visible', visible);
}

async function openChangelogPage() {
  if (!canViewChangelog()) return;

  closeNavbarMenu();

  try {
    await renderChangelogListPage();
  } catch (err) {
    console.error(err);
    showToast(err.message || '加载更新日志失败');
    return;
  }

  openDetailPage('detail-changelog');
  updateFabVisibility(getActiveMainPage());
  updateChangelogManageVisibility();
  requestAnimationFrame(() => {
    updateChangelogFabVisibility();
  });
}

function renderChangelogEntryViewHtml(entry) {
  return `
    <div class="changelog-entry-panel">
      <div class="changelog-entry-meta">
        <span class="changelog-entry-version">v${escapeHtml(entry.version)}</span>
        <span class="changelog-entry-date">${escapeHtml(entry.released_at)}</span>
      </div>
      <div class="changelog-entry-content">${escapeHtml(entry.content || '')}</div>
    </div>
  `;
}

function renderChangelogEntryEditHtml(entry) {
  return `
    <div class="student-detail-records-block">
      <div class="changelog-entry-panel changelog-entry-panel--edit">
        <div class="form-grid">
          <div class="form-group form-group--full">
            <label for="changelog-entry-edit-title">标题 *</label>
            <input type="text" id="changelog-entry-edit-title" value="${escapeHtml(entry.title)}" required placeholder="例如：周视图交互优化">
          </div>
          <div class="form-group">
            <label for="changelog-entry-edit-version">版本号 *</label>
            <input type="text" id="changelog-entry-edit-version" value="${escapeHtml(entry.version)}" required placeholder="例如：1.2.0">
          </div>
          <div class="form-group">
            <label for="changelog-entry-edit-released-at">更新时间 *</label>
            <input type="text" id="changelog-entry-edit-released-at" value="${escapeHtml(entry.released_at)}" required placeholder="例如：2026-06-18">
          </div>
          <div class="form-group form-group--full">
            <label for="changelog-entry-edit-content">更新内容 *</label>
            <textarea id="changelog-entry-edit-content" rows="8" required placeholder="详细说明本次更新内容">${escapeHtml(entry.content || '')}</textarea>
          </div>
        </div>
      </div>
      <div class="student-detail-edit-actions is-visible">
        <button type="button" class="student-detail-action-btn student-detail-action-btn--danger" id="btn-changelog-entry-delete">删除</button>
        <button type="button" class="student-detail-action-btn student-detail-action-btn--primary" id="btn-changelog-entry-save">保存</button>
      </div>
    </div>
  `;
}

function renderChangelogEntryUI(entry) {
  if (!entry) return;

  currentChangelogEntryData = entry;

  const titleEl = document.getElementById('changelog-entry-title');
  if (titleEl) titleEl.textContent = entry.title;

  const body = document.getElementById('changelog-entry-body');
  if (body) {
    body.innerHTML = changelogEntryEditMode
      ? renderChangelogEntryEditHtml(entry)
      : renderChangelogEntryViewHtml(entry);
  }

  const canManage = canManageChangelog();
  const editBtn = document.getElementById('btn-changelog-entry-edit');

  if (editBtn) {
    editBtn.hidden = !canManage;
    editBtn.style.display = canManage ? '' : 'none';
    if (canManage) {
      editBtn.textContent = changelogEntryEditMode ? '取消' : '编辑';
    }
  }
}

async function openChangelogEntryDetail(id) {
  if (!id) return;

  currentChangelogEntryId = id;
  exitChangelogEntryEditMode();

  const body = document.getElementById('changelog-entry-body');
  body.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:24px;">加载中...</p>';

  const editBtn = document.getElementById('btn-changelog-entry-edit');
  if (editBtn) {
    editBtn.hidden = true;
    editBtn.style.display = 'none';
  }

  openDetailPage('detail-changelog-entry');
  const fab = document.getElementById('fab-changelog-add');
  if (fab) fab.classList.remove('visible');
  updateChangelogFabVisibility();

  try {
    const entry = await fetchChangelogEntryById(id);
    if (!entry) {
      showToast('更新日志不存在');
      closeDetailPage('detail-changelog-entry');
      return;
    }
    renderChangelogEntryUI(entry);
  } catch (err) {
    console.error(err);
    body.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:24px;">加载失败</p>';
    showToast(err.message || '加载详情失败');
  }
}

function openChangelogFormPage() {
  if (!canManageChangelog()) return;

  document.getElementById('changelog-form-id').value = '';
  document.getElementById('changelog-form-page-title').textContent = '版本更新';
  document.getElementById('changelog-form-title').value = '';
  document.getElementById('changelog-form-version').value = '';
  document.getElementById('changelog-form-released-at').value = '';
  document.getElementById('changelog-form-content').value = '';

  const fab = document.getElementById('fab-changelog-add');
  if (fab) fab.classList.remove('visible');

  openDetailPage('detail-changelog-form');
  updateChangelogFabVisibility();
}

function openAddChangelogPage() {
  openChangelogFormPage();
}

async function onChangelogFormSubmit(e) {
  e.preventDefault();
  if (!canManageChangelog()) return;

  const title = document.getElementById('changelog-form-title').value.trim();
  const version = document.getElementById('changelog-form-version').value.trim();
  const releasedAt = document.getElementById('changelog-form-released-at').value.trim();
  const content = document.getElementById('changelog-form-content').value.trim();

  if (!title) {
    showToast('请填写标题');
    return;
  }
  if (!version) {
    showToast('请填写版本号');
    return;
  }
  if (!releasedAt) {
    showToast('请填写更新时间');
    return;
  }
  if (!content) {
    showToast('请填写更新内容');
    return;
  }

  try {
    await createChangelogEntry({ title, version, released_at: releasedAt, content });
    closeDetailPage('detail-changelog-form');
    await renderChangelogListPage();
    showToast('版本更新已发布');
  } catch (err) {
    console.error(err);
    showToast(err.message || '保存失败');
  }
}

async function saveChangelogEntryInline() {
  if (!currentChangelogEntryId || !changelogEntryEditMode || !canManageChangelog()) return;

  const title = document.getElementById('changelog-entry-edit-title').value.trim();
  const version = document.getElementById('changelog-entry-edit-version').value.trim();
  const releasedAt = document.getElementById('changelog-entry-edit-released-at').value.trim();
  const content = document.getElementById('changelog-entry-edit-content').value.trim();

  if (!title) {
    showToast('请填写标题');
    return;
  }
  if (!version) {
    showToast('请填写版本号');
    return;
  }
  if (!releasedAt) {
    showToast('请填写更新时间');
    return;
  }
  if (!content) {
    showToast('请填写更新内容');
    return;
  }

  try {
    await updateChangelogEntry(currentChangelogEntryId, {
      title,
      version,
      released_at: releasedAt,
      content,
    });

    const entry = await fetchChangelogEntryById(currentChangelogEntryId);
    if (!entry) {
      showToast('更新日志不存在');
      return;
    }

    exitChangelogEntryEditMode();
    renderChangelogEntryUI(entry);
    await renderChangelogListPage();
    showToast('保存成功');
  } catch (err) {
    console.error(err);
    showToast(err.message || '保存失败');
  }
}

async function deleteCurrentChangelogEntry() {
  if (!currentChangelogEntryId || !canManageChangelog()) return;

  const title = currentChangelogEntryData?.title
    || document.getElementById('changelog-entry-edit-title')?.value.trim()
    || document.getElementById('changelog-entry-title')?.textContent
    || '该条目';

  if (!confirm('确定删除「' + title + '」吗？此操作不可恢复。')) return;

  try {
    await deleteChangelogEntry(currentChangelogEntryId);
    currentChangelogEntryId = null;
    currentChangelogEntryData = null;
    exitChangelogEntryEditMode();
    closeDetailPage('detail-changelog-entry');
    await renderChangelogListPage();
    showToast('已删除');
  } catch (err) {
    console.error(err);
    showToast(err.message || '删除失败');
  }
}
