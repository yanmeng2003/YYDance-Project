async function openTeachersPage() {
  try {
    if (!coreDataCache.loaded && getSupabase()) {
      await preloadCoreData();
    }
    renderTeacherListUI(coreDataCache.teachers);
  } catch (err) {
    console.error(err);
    showToast(err.message || '加载老师失败');
    return;
  }

  openDetailPage('detail-teachers');
  updateFabVisibility(getActiveMainPage());
  requestAnimationFrame(() => {
    updateFabVisibility(getActiveMainPage());
  });
}


async function openTeacherDetailModal(id) {
  const teacher = coreDataCache.teachers.find(t => t.id === id);
  if (!teacher) return;

  currentTeacherDetailId = id;
  exitTeacherDetailEditMode();
  teacherDetailData = { courses: [] };

  const body = document.getElementById('teacher-detail-body');
  body.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:24px;">加载中...</p>';
  document.getElementById('teacher-detail-title').innerHTML =
    `<span class="detail-page-title-name-row"><span class="detail-page-title-name">${escapeHtml(teacher.name)}</span></span>`;
  openDetailPage('detail-teacher');
  const fab = document.getElementById('fab-add-teacher');
  if (fab) fab.classList.remove('visible');
  updateFabVisibility(getActiveMainPage());

  try {
    const teacherCourses = sortTeacherDetailCourses(coreDataCache.courses.filter(c => c.teacherId === id));
    teacherDetailData = { courses: teacherCourses };
    renderTeacherDetailUI(teacher, teacherCourses);
  } catch (err) {
    console.error(err);
    body.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:24px;">加载失败</p>';
    showToast('加载老师详情失败');
  }
}


function renderTeacherDetailInfoHtml(teacher) {
  if (teacherDetailEditMode) {
    return `
      <div class="course-detail-info">
        <div class="student-detail-row">
          <span class="label">姓名</span>
          <input type="text" class="student-detail-input" id="teacher-detail-edit-name" value="${escapeHtml(teacher.name)}" required placeholder="请输入姓名">
        </div>
        <div class="student-detail-row">
          <span class="label">电话</span>
          <input type="tel" class="student-detail-input" id="teacher-detail-edit-phone" value="${escapeHtml(teacher.phone || '')}" required placeholder="请输入手机号">
        </div>
        <div class="student-detail-row">
          <span class="label">微信</span>
          <input type="text" class="student-detail-input" id="teacher-detail-edit-wechat" value="${escapeHtml(teacher.wechat || '')}" placeholder="选填">
        </div>
        <div class="student-detail-row">
          <span class="label">备注</span>
          <textarea class="student-detail-textarea" id="teacher-detail-edit-notes" placeholder="选填">${escapeHtml(teacher.notes || '')}</textarea>
        </div>
      </div>
    `;
  }

  return `
    <div class="course-detail-info">
      <div class="student-detail-row"><span class="label">电话</span><span class="value">${escapeHtml(teacher.phone || '—')}</span></div>
      <div class="student-detail-row"><span class="label">微信</span><span class="value">${escapeHtml(teacher.wechat || '—')}</span></div>
      <div class="student-detail-row"><span class="label">备注</span><span class="value">${escapeHtml(teacher.notes || '—')}</span></div>
    </div>
  `;
}


function renderTeacherDetailEditActionsHtml() {
  return `
    <div class="student-detail-edit-actions is-visible">
      <button type="button" class="student-detail-action-btn student-detail-action-btn--danger" id="btn-teacher-detail-delete">删除老师</button>
      <button type="button" class="student-detail-action-btn student-detail-action-btn--primary" id="btn-teacher-detail-save">保存</button>
    </div>
  `;
}


function renderTeacherDetailInfoBlockHtml(teacher) {
  return `<div class="course-detail-panel student-detail-info-panel">${renderTeacherDetailInfoHtml(teacher)}</div>`;
}


function renderTeacherDetailCoursesBlockHtml(courses) {
  const sortedCourses = sortTeacherDetailCourses(courses || []);
  const coursesListHtml = !sortedCourses.length
    ? '<div class="student-detail-empty">暂无负责课程</div>'
    : '<ul class="detail-section-list">' + sortedCourses.map(c => `
        <li>
          <div class="teacher-course-info teacher-course-info-clickable" role="button" tabindex="0" data-id="${escapeHtml(c.id)}" aria-label="查看${escapeHtml(c.courseType)} · ${escapeHtml(c.name)}详情">
            <div class="student-course-line">
              <span class="student-course-name">${escapeHtml(c.courseType)} · ${escapeHtml(c.name)}${courseSeasonBadgeHtml(c.classSize, c.season)}</span>
            </div>
            <span class="student-course-schedule">${escapeHtml(formatCourseListSubline(c))}</span>
          </div>
        </li>
      `).join('') + '</ul>';

  const panelHtml = `
    <div class="course-detail-panel student-detail-panel">
      <div class="student-detail-section">
        <div class="student-detail-section-head">
          <h4 class="student-detail-section-title">负责课程</h4>
        </div>
        <div class="student-detail-section-body">
          ${coursesListHtml}
        </div>
      </div>
    </div>
  `;

  if (!teacherDetailEditMode) {
    return panelHtml;
  }

  return `
    <div class="student-detail-records-block">
      ${panelHtml}
      ${renderTeacherDetailEditActionsHtml()}
    </div>
  `;
}


function renderTeacherDetailUI(teacher, courses) {
  const body = document.getElementById('teacher-detail-body');

  document.getElementById('teacher-detail-title').innerHTML =
    `<span class="detail-page-title-name-row"><span class="detail-page-title-name">${escapeHtml(teacher.name)}</span></span>`;

  body.innerHTML = `
    ${renderTeacherDetailInfoBlockHtml(teacher)}
    ${renderTeacherDetailCoursesBlockHtml(courses)}
  `;

  bindClickableRow(body, '.teacher-course-info-clickable', openCourseDetailModal);
}


async function refreshTeacherDetailModal(teacherId) {
  if (isDetailPageOpen('detail-teacher')) {
    await openTeacherDetailModal(teacherId);
  }
}


function renderTeacherListUI(teachers) {
  const countEl = document.getElementById('teacher-count');
  const emptyEl = document.getElementById('teacher-empty-state');
  const listEl = document.getElementById('teacher-list');

  countEl.textContent = '共 ' + teachers.length + ' 人';

  if (teachers.length === 0) {
    emptyEl.style.display = 'block';
    listEl.style.display = 'none';
    return;
  }

  emptyEl.style.display = 'none';
  listEl.style.display = 'flex';

  const sortedTeachers = sortTeachersForList(teachers);

  listEl.innerHTML = sortedTeachers.map(t => {
    const phone = (t.phone || '').trim();
    return `
    <li class="student-island-item">
      <div class="student-island-link student-info-clickable" data-id="${escapeHtml(t.id)}" role="button" tabindex="0" aria-label="查看${escapeHtml(t.name)}详情">
        <div class="student-island-main">
          <span class="student-name-row">
            <span class="student-name">${escapeHtml(t.name)}</span>
          </span>
          <span class="student-island-phone">${formatPhoneDigitsHtml(phone)}</span>
        </div>
        <span class="student-island-chevron" aria-hidden="true"><i data-lucide="chevron-right"></i></span>
      </div>
    </li>
  `;
  }).join('');

  bindClickableRow(listEl, '.student-info-clickable', openTeacherDetailModal);
  if (window.lucide && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
}


async function loadAndRenderTeachers() {
  try {
    await refreshTeachersCacheData();
  } catch (err) {
    console.error(err);
    showToast('加载老师失败，请检查网络或数据库配置');
  }
}


async function onAddTeacher(e) {
  e.preventDefault();

  const name = document.getElementById('teacher-name').value.trim();
  const phone = document.getElementById('teacher-phone').value.trim();
  const wechat = document.getElementById('teacher-wechat').value.trim();
  const notes = document.getElementById('teacher-notes').value.trim();

  if (!name || !phone) {
    showToast('请填写老师姓名和联系电话');
    return;
  }

  try {
    const db = getSupabase();
    if (!db) {
      showToast('Supabase 库未加载，请刷新页面');
      return;
    }

    const { error } = await db.from('teachers').insert({
      name,
      phone,
      wechat: wechat || null,
      notes: notes || null
    });

    if (error) throw error;

    await logOperation('添加老师', name);

    e.target.reset();
    closeModal('modal-add-teacher');
    await loadAndRenderTeachers();
    showToast('老师添加成功');
  } catch (err) {
    console.error(err);
    showToast(err.message || '添加失败');
  }
}


async function saveTeacherProfile(id, name, phone, wechat, notes) {
  if (!id) return false;

  if (!name || !phone) {
    showToast('请填写老师姓名和联系电话');
    return false;
  }

  const db = getSupabase();
  if (!db) {
    showToast('Supabase 库未加载，请刷新页面');
    return false;
  }

  const { error } = await db.from('teachers').update({
    name,
    phone,
    wechat: wechat || null,
    notes: notes || null
  }).eq('id', id);

  if (error) throw error;
  return true;
}


async function deleteTeacherProfile(id, name) {
  if (!id) return false;

  if (!confirm('确定要删除「' + (name || '该老师') + '」吗？此操作不可恢复。')) {
    return false;
  }

  const db = getSupabase();
  if (!db) {
    showToast('Supabase 库未加载，请刷新页面');
    return false;
  }

  const { error } = await db.from('teachers').delete().eq('id', id);
  if (error) throw error;
  return true;
}


async function saveTeacherDetailEdit() {
  if (!currentTeacherDetailId) return;

  const nameInput = document.getElementById('teacher-detail-edit-name');
  const phoneInput = document.getElementById('teacher-detail-edit-phone');
  const wechatInput = document.getElementById('teacher-detail-edit-wechat');
  const notesInput = document.getElementById('teacher-detail-edit-notes');
  if (!nameInput || !phoneInput || !wechatInput || !notesInput) return;

  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();
  const wechat = wechatInput.value.trim();
  const notes = notesInput.value.trim();

  try {
    const saved = await saveTeacherProfile(currentTeacherDetailId, name, phone, wechat, notes);
    if (!saved) return;

    await refreshAfterTeacherChanged();
    const teacher = coreDataCache.teachers.find(t => t.id === currentTeacherDetailId);
    if (!teacher) return;

    const teacherCourses = sortTeacherDetailCourses(coreDataCache.courses.filter(c => c.teacherId === currentTeacherDetailId));
    teacherDetailData = { courses: teacherCourses };

    exitTeacherDetailEditMode();
    renderTeacherDetailUI(teacher, teacherCourses);
    await logOperation('编辑老师', name);
    showToast('保存成功');
  } catch (err) {
    console.error(err);
    showToast(err.message || '保存失败');
  }
}


async function deleteTeacherDetailTeacher() {
  if (!currentTeacherDetailId) return;

  const nameInput = document.getElementById('teacher-detail-edit-name');
  const teacher = coreDataCache.teachers.find(t => t.id === currentTeacherDetailId);
  const name = nameInput ? nameInput.value.trim() : (teacher ? teacher.name : '该老师');

  try {
    const deleted = await deleteTeacherProfile(currentTeacherDetailId, name);
    if (!deleted) return;

    closeDetailPage('detail-teacher');
    await refreshAfterTeacherChanged();
    await logOperation('删除老师', name);
    showToast('老师已删除');
  } catch (err) {
    console.error(err);
    showToast(err.message || '删除失败');
  }
}
