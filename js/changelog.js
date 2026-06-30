let currentChangelogEntryId = null;

function canManageChangelog() {
  return normalizePhone(getCurrentOperatorPhone()) === ADMIN_EXTRA_ALLOWED_PHONE;
}

function canViewChangelog() {
  return !!getCurrentOperatorPhone();
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

function isDetailPageVisible(pageId) {
  const page = document.getElementById(pageId);
  return page && page.classList.contains('is-visible');
}


function updateChangelogFabVisibility() {
  const fab = document.getElementById('fab-changelog-add');
  if (!fab) return;
  const visible = isDetailPageVisible('detail-changelog')
    && !isDetailPageVisible('detail-changelog-entry')
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
  requestAnimationFrame(() => {
    updateChangelogFabVisibility();
  });
}

function renderChangelogEntryDetailUI(entry) {
  document.getElementById('changelog-entry-title').textContent = entry.title;
  document.getElementById('changelog-entry-version').textContent = 'v' + entry.version;
  document.getElementById('changelog-entry-date').textContent = entry.released_at;
  document.getElementById('changelog-entry-content').textContent = entry.content || '';

  const actions = document.getElementById('changelog-entry-actions');
  const canManage = canManageChangelog();
  actions.hidden = !canManage;
}

async function openChangelogEntryDetail(id) {
  if (!id) return;

  currentChangelogEntryId = id;
  const body = document.getElementById('changelog-entry-body');
  body.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:24px;">加载中...</p>';
  openDetailPage('detail-changelog-entry');
  updateChangelogFabVisibility();

  try {
    const entry = await fetchChangelogEntryById(id);
    if (!entry) {
      showToast('更新日志不存在');
      closeDetailPage('detail-changelog-entry');
      return;
    }
    body.innerHTML = `
      <div class="changelog-entry-panel">
        <div class="changelog-entry-meta">
          <span class="changelog-entry-version" id="changelog-entry-version"></span>
          <span class="changelog-entry-date" id="changelog-entry-date"></span>
        </div>
        <div class="changelog-entry-content" id="changelog-entry-content"></div>
      </div>
    `;
    renderChangelogEntryDetailUI(entry);
  } catch (err) {
    console.error(err);
    body.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:24px;">加载失败</p>';
    showToast(err.message || '加载详情失败');
  }
}

function openChangelogFormModal(entry) {
  if (!canManageChangelog()) return;

  const isEdit = !!entry;
  document.getElementById('changelog-form-id').value = isEdit ? entry.id : '';
  document.getElementById('modal-changelog-title-text').textContent = isEdit ? '编辑版本更新' : '版本更新';
  document.getElementById('changelog-form-title').value = isEdit ? entry.title : '';
  document.getElementById('changelog-form-version').value = isEdit ? entry.version : '';
  document.getElementById('changelog-form-released-at').value = isEdit ? entry.released_at : '';
  document.getElementById('changelog-form-content').value = isEdit ? (entry.content || '') : '';
  openModal('modal-changelog');
}

function openAddChangelogModal() {
  openChangelogFormModal(null);
}

async function openEditChangelogModal() {
  if (!currentChangelogEntryId || !canManageChangelog()) return;

  try {
    const entry = await fetchChangelogEntryById(currentChangelogEntryId);
    if (!entry) {
      showToast('更新日志不存在');
      return;
    }
    openChangelogFormModal(entry);
  } catch (err) {
    console.error(err);
    showToast(err.message || '加载失败');
  }
}

async function onChangelogFormSubmit(e) {
  e.preventDefault();
  if (!canManageChangelog()) return;

  const id = document.getElementById('changelog-form-id').value.trim();
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
    const payload = { title, version, released_at: releasedAt, content };

    if (id) {
      await updateChangelogEntry(id, payload);
      closeModal('modal-changelog');
      await renderChangelogListPage();
      if (isDetailPageOpen('detail-changelog-entry') && currentChangelogEntryId === id) {
        const entry = await fetchChangelogEntryById(id);
        renderChangelogEntryDetailUI(entry);
        document.getElementById('changelog-entry-title').textContent = entry.title;
      }
      showToast('保存成功');
      return;
    }

    await createChangelogEntry(payload);
    closeModal('modal-changelog');
    await renderChangelogListPage();
    showToast('版本更新已发布');
  } catch (err) {
    console.error(err);
    showToast(err.message || '保存失败');
  }
}

async function deleteCurrentChangelogEntry() {
  if (!currentChangelogEntryId || !canManageChangelog()) return;

  const title = document.getElementById('changelog-entry-title')?.textContent || '该条目';
  if (!confirm('确定删除「' + title + '」吗？此操作不可恢复。')) return;

  try {
    await deleteChangelogEntry(currentChangelogEntryId);
    currentChangelogEntryId = null;
    closeDetailPage('detail-changelog-entry');
    await renderChangelogListPage();
    showToast('已删除');
  } catch (err) {
    console.error(err);
    showToast(err.message || '删除失败');
  }
}
