function getLeaveRecordIdsWithMakeup(records) {
  const pairedLeaveIds = new Set();
  const byCourse = new Map();

  (records || []).forEach(record => {
    if (!record.courseId) return;
    if (!byCourse.has(record.courseId)) {
      byCourse.set(record.courseId, { leaves: [], makeups: [] });
    }

    const status = normalizeLessonRecordStatus(record.status);
    if (status === '请假') byCourse.get(record.courseId).leaves.push(record);
    if (status === '补课') byCourse.get(record.courseId).makeups.push(record);
  });

  byCourse.forEach(({ leaves, makeups }) => {
    leaves.sort((a, b) => formatConsumedAt(a.consumedAt).localeCompare(formatConsumedAt(b.consumedAt)));
    makeups.sort((a, b) => formatConsumedAt(a.consumedAt).localeCompare(formatConsumedAt(b.consumedAt)));
    const pairCount = Math.min(leaves.length, makeups.length);
    for (let i = 0; i < pairCount; i++) {
      pairedLeaveIds.add(leaves[i].id);
    }
  });

  return pairedLeaveIds;
}


function normalizeLessonRecordStatus(status) {
  return LESSON_RECORD_STATUSES.includes(status) ? status : '上课';
}


function lessonRecordStatusBadgeHtml(status) {
  const value = normalizeLessonRecordStatus(status);
  const classMap = { '上课': 'attend', '请假': 'leave', '补课': 'makeup' };
  return `<span class="lesson-record-status lesson-record-status--${classMap[value]}">${escapeHtml(value)}</span>`;
}


function renderLessonRecordItemHtml(record, student, enrollmentId, leaveIdsWithMakeup) {
  const status = normalizeLessonRecordStatus(record.status);
  const hasMakeup = leaveIdsWithMakeup && leaveIdsWithMakeup.has(record.id);
  const makeupBtn = status === '请假' && !hasMakeup
    ? `<button type="button" class="btn btn-outline btn-sm btn-makeup-record"
        data-student-id="${escapeHtml(student.id)}"
        data-course-id="${escapeHtml(record.courseId || '')}"
        data-enrollment-id="${escapeHtml(enrollmentId || '')}">补课</button>`
    : '';

  return `
    <li class="lesson-record-item">
      <div class="lesson-record-content">
        <div class="student-course-line">
          <span class="student-course-name">${escapeHtml(record.courseType || '摩登舞')} · ${escapeHtml(record.courseName || '—')}${courseSeasonBadgeHtml(record.classSize, record.season)}</span>
        </div>
        <div class="lesson-record-meta-line">
          <span class="lesson-record-date">${escapeHtml(formatConsumedAt(record.consumedAt))}</span>
          ${lessonRecordStatusBadgeHtml(status)}
        </div>
      </div>
      <div class="lesson-record-actions">
        ${makeupBtn}
        <button type="button" class="btn btn-outline btn-sm btn-delete-record"
          data-id="${escapeHtml(record.id)}"
          data-student-id="${escapeHtml(student.id)}"
          data-status="${escapeHtml(status)}">删除</button>
      </div>
    </li>
  `;
}


function formatOperationLogTime(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return y + '-' + m + '-' + day + ' ' + h + ':' + min;
}


function renderOperationLogItem(log) {
  const content = log.target
    ? escapeHtml(log.action) + '：' + escapeHtml(log.target)
    : escapeHtml(log.action);
  return `
    <li class="operation-log-item">
      <div class="operation-log-content">${content}</div>
      <div class="operation-log-meta">
        <span>${escapeHtml(log.operator || '—')}</span>
        <span>${formatOperationLogTime(log.created_at)}</span>
      </div>
    </li>
  `;
}


async function renderOperationLogsPage() {
  const body = document.getElementById('operation-logs-body');
  if (!body) return;

  body.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:24px;">加载中...</p>';

  const logs = await fetchOperationLogs();
  if (!logs.length) {
    body.innerHTML = renderListEmptyHtml('暂无操作记录');
    return;
  }

  body.innerHTML = '<ul class="operation-log-list">' + logs.map(renderOperationLogItem).join('') + '</ul>';
}


async function openOperationLogsPage() {
  if (!canViewOperationLogs()) return;

  try {
    await renderOperationLogsPage();
  } catch (err) {
    console.error(err);
    showToast(err.message || '加载操作日志失败');
    return;
  }

  openDetailPage('detail-operation-logs');
  updateFabVisibility(getActiveMainPage());
}


async function exportAllAdminData() {
  const btn = document.getElementById('btn-export-data');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '导出中...';
  }

  try {
    const db = getSupabase();
    if (!db) throw new Error('Supabase 库未加载');

    const [studentsResult, coursesResult, recordsResult] = await Promise.all([
      db.from('students').select('*').order('created_at', { ascending: false }),
      db.from('courses').select('*').order('created_at', { ascending: false }),
      db.from('lesson_records').select('*').order('consumed_at', { ascending: false })
    ]);

    if (studentsResult.error) throw studentsResult.error;
    if (coursesResult.error) throw coursesResult.error;
    if (recordsResult.error) throw recordsResult.error;

    const payload = {
      exported_at: new Date().toISOString(),
      students: studentsResult.data || [],
      courses: coursesResult.data || [],
      lesson_records: recordsResult.data || []
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'yydance-export-' + getTodayDateString() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('数据已导出');
  } catch (err) {
    console.error(err);
    showToast(err.message || '导出失败');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '导出数据';
    }
  }
}


function formatLessonRecordText(record) {
  const date = formatConsumedAt(record.consumedAt);
  const type = (record.courseType || '').trim();
  const name = (record.courseName || '').trim();
  if (type && name) {
    return date + ' ' + type + '·' + name;
  }
  return date;
}


function getFilteredStudents() {
  const query = studentSearchQuery.trim().toLowerCase();
  if (!query) return coreDataCache.students;

  return coreDataCache.students.filter(s => {
    const name = (s.name || '').toLowerCase();
    const phone = (s.phone || '').trim();
    return name.includes(query) || phone.includes(query);
  });
}


function renderStudentListItemHtml(student) {
  const phone = (student.phone || '').trim();
  return `
    <li class="student-island-item">
      <div class="student-island-link student-info-clickable" data-id="${escapeHtml(student.id)}" role="button" tabindex="0" aria-label="查看${escapeHtml(student.name)}详情">
        <div class="student-island-main">
          <span class="student-name-row">
            <span class="student-name">${escapeHtml(student.name)}</span>
            ${seasonBadgesHtml(student.id)}
            ${renewalBadgeHtml(studentNeedsRenewalById(student.id))}
          </span>
          <span class="student-island-phone">${formatPhoneDigitsHtml(phone)}</span>
        </div>
        <span class="student-island-chevron" aria-hidden="true"><i data-lucide="chevron-right"></i></span>
      </div>
    </li>
  `;
}


function renderStudentIndexBar(activeLetters) {
  const bar = document.getElementById('student-index-bar');
  if (!bar) return;

  if (!activeLetters.length) {
    bar.hidden = true;
    bar.innerHTML = '';
    return;
  }

  bar.hidden = false;
  bar.innerHTML = activeLetters.map(letter => `
    <button type="button" class="student-index-letter" data-letter="${letter}" aria-label="跳转到${letter}">${letter}</button>
  `).join('');

  bar.querySelectorAll('.student-index-letter').forEach(btn => {
    btn.addEventListener('click', () => scrollToStudentIndexLetter(btn.dataset.letter));
  });
}


function scrollToStudentIndexLetter(letter) {
  const anchor = document.getElementById('student-index-' + letter);
  if (!anchor) return;

  anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
}


function renderStudentListUI() {
  const students = getFilteredStudents();
  const countEl = document.getElementById('student-count');
  const emptyEl = document.getElementById('empty-state');
  const listEl = document.getElementById('student-list');
  const sortedStudents = sortStudentsForList(students);

  countEl.textContent = '共 ' + sortedStudents.length + ' 人';

  if (sortedStudents.length === 0) {
    emptyEl.style.display = 'block';
    listEl.style.display = 'none';
    renderStudentIndexBar([]);
    emptyEl.textContent = studentSearchQuery.trim()
      ? '没有匹配的学员'
      : '暂无学员，点击右下角添加';
    return;
  }

  emptyEl.style.display = 'none';
  listEl.style.display = 'flex';

  const groups = groupStudentsByInitial(sortedStudents);
  const activeLetters = STUDENT_INDEX_ALPHABET.filter(letter => groups.has(letter));
  let listHtml = '';

  activeLetters.forEach(letter => {
    listHtml += `
      <li class="student-letter-anchor" id="student-index-${letter}" data-letter="${letter}">
        <span class="student-letter-label">${letter}</span>
      </li>
    `;
    listHtml += groups.get(letter).map(renderStudentListItemHtml).join('');
  });

  if (groups.has('#')) {
    listHtml += groups.get('#').map(renderStudentListItemHtml).join('');
  }

  listEl.innerHTML = listHtml;
  renderStudentIndexBar(activeLetters);

  bindClickableRow(listEl, '.student-info-clickable', openStudentDetailModal);
  if (window.lucide && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
}


function openConsumeModalForCourse(studentId, course) {
  const student = coreDataCache.students.find(s => s.id === studentId);
  if (!student || !course) return;

  document.getElementById('consume-student-id').value = studentId;
  document.getElementById('consume-course-id').value = course.courseId;
  document.getElementById('consume-enrollment-id').value = course.enrollmentId;
  document.getElementById('consume-student-hint').textContent =
    student.name + ' · ' + course.courseType + ' · ' + course.name + ' · 剩余 ' + course.remainingLessons + ' 课时';
  document.getElementById('consume-date').value = getTodayDateString();
  openModal('modal-consume');
}


function openEditStudentCourseModal(studentId, course) {
  document.getElementById('edit-student-course-enrollment-id').value = course.enrollmentId;
  document.getElementById('edit-student-course-student-id').value = studentId;
  document.getElementById('edit-student-course-label').textContent = course.courseType + ' · ' + course.name;
  document.getElementById('edit-student-course-hours').value = course.remainingLessons;
  openModal('modal-edit-student-course');
}


async function openAddStudentCourseModal(studentId, enrolledCourses) {
  try {
    await ensureCoursesCache();
    const enrolledIds = (enrolledCourses || []).map(c => c.courseId);
    const hasAvailable = populateStudentCourseSelect('add-student-course-select', enrolledIds);
    document.getElementById('add-student-course-student-id').value = studentId;
    document.getElementById('add-student-course-hours').value = '';
    document.getElementById('add-student-course-hours').disabled = !hasAvailable;
    const submitBtn = document.querySelector('#form-add-student-course button[type="submit"]');
    if (submitBtn) submitBtn.disabled = !hasAvailable;
    openModal('modal-add-student-course');
  } catch (err) {
    console.error(err);
    showToast('加载课程列表失败');
  }
}


async function refreshStudentDetailModal(studentId) {
  if (document.getElementById('page-students').classList.contains('active')) {
    renderStudentListUI();
  }
  if (isDetailPageOpen('detail-student')) {
    await openStudentDetailModal(studentId);
  }
}


async function openStudentDetailModal(id) {
  const student = coreDataCache.students.find(s => s.id === id);
  if (!student) return;

  currentStudentDetailId = id;
  exitStudentDetailEditMode();
  studentDetailData = { records: [], courses: [] };

  const body = document.getElementById('student-detail-body');
  body.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:24px;">加载中...</p>';
  document.getElementById('student-detail-title').innerHTML =
    `<span class="detail-page-title-name-row"><span class="detail-page-title-name">${escapeHtml(student.name)}</span></span>`;
  openDetailPage('detail-student');
  updateFabVisibility('students');

  try {
    const records = await fetchLessonRecords(id);
    const courses = await fetchStudentCourses(id);
    studentDetailData = { records, courses };
    renderStudentDetailUI(student, records, courses);
  } catch (err) {
    console.error(err);
    body.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:24px;">加载失败</p>';
    showToast('加载消课记录失败');
  }
}


function renderStudentDetailInfoHtml(student) {
  if (studentDetailEditMode) {
    return `
      <div class="course-detail-info">
        <div class="student-detail-row">
          <span class="label">姓名</span>
          <input type="text" class="student-detail-input" id="student-detail-edit-name" value="${escapeHtml(student.name)}" required placeholder="请输入姓名">
        </div>
        <div class="student-detail-row">
          <span class="label">电话</span>
          <input type="tel" class="student-detail-input" id="student-detail-edit-phone" value="${escapeHtml(student.phone || '')}" placeholder="选填">
        </div>
      </div>
    `;
  }

  return `
    <div class="course-detail-info">
      <div class="student-detail-row"><span class="label">姓名</span><span class="value">${escapeHtml(student.name)}</span></div>
      <div class="student-detail-row"><span class="label">电话</span><span class="value">${escapeHtml(student.phone || '—')}</span></div>
    </div>
  `;
}


function renderStudentDetailEditActionsHtml() {
  return `
    <div class="student-detail-edit-actions is-visible">
      <button type="button" class="student-detail-action-btn student-detail-action-btn--danger" id="btn-student-detail-delete">删除学员</button>
      <button type="button" class="student-detail-action-btn student-detail-action-btn--primary" id="btn-student-detail-save">保存</button>
    </div>
  `;
}


function renderStudentDetailInfoBlockHtml(student) {
  return `<div class="course-detail-panel student-detail-info-panel">${renderStudentDetailInfoHtml(student)}</div>`;
}


function renderStudentDetailRecordsBlockHtml(recordsHtml) {
  const panelHtml = `
    <div class="course-detail-panel student-detail-panel">
      <div class="student-detail-section">
        <div class="student-detail-section-head">
          <h4 class="student-detail-section-title">上课记录</h4>
        </div>
        <div class="student-detail-section-body">
          ${recordsHtml}
        </div>
      </div>
    </div>
  `;

  if (!studentDetailEditMode) {
    return panelHtml;
  }

  return `
    <div class="student-detail-records-block">
      ${panelHtml}
      ${renderStudentDetailEditActionsHtml()}
    </div>
  `;
}


function renderStudentDetailUI(student, records, courses) {
  const body = document.getElementById('student-detail-body');

  document.getElementById('student-detail-title').innerHTML =
    `<span class="detail-page-title-name-row"><span class="detail-page-title-name">${escapeHtml(student.name)}</span>${renewalBadgeHtml(studentNeedsRenewalFromCourses(courses))}</span>`;

  const enrollmentByCourseId = new Map((courses || []).map(c => [c.courseId, c.enrollmentId]));
  const leaveIdsWithMakeup = getLeaveRecordIdsWithMakeup(records || []);

  const coursesListHtml = !courses || courses.length === 0
    ? '<div class="student-detail-empty">暂未加入任何课程</div>'
    : '<ul class="detail-section-list">' + courses.map(c => `
        <li class="student-course-item">
          <div class="student-course-info student-course-info-clickable" role="button" tabindex="0"
            data-enrollment-id="${escapeHtml(c.enrollmentId)}"
            data-course-id="${escapeHtml(c.courseId)}"
            data-course-type="${escapeHtml(c.courseType)}"
            data-course-name="${escapeHtml(c.name)}"
            data-remaining="${c.remainingLessons}"
            aria-label="编辑${escapeHtml(c.courseType)} · ${escapeHtml(c.name)}">
            <div class="student-course-line">
              <span class="student-course-name">${escapeHtml(c.courseType)} · ${escapeHtml(c.name)}${courseSeasonBadgeHtml(c.classSize, c.season)}</span>
              <span class="student-course-hours">剩余 <span class="student-course-hours-num">${c.remainingLessons}</span> 课时</span>
            </div>
            <span class="student-course-schedule">${escapeHtml(formatStudentCourseSchedule(c))}</span>
          </div>
          <button type="button" class="btn btn-outline btn-sm btn-consume-course"
            data-student-id="${escapeHtml(student.id)}"
            data-enrollment-id="${escapeHtml(c.enrollmentId)}"
            data-course-id="${escapeHtml(c.courseId)}"
            data-course-type="${escapeHtml(c.courseType)}"
            data-course-name="${escapeHtml(c.name)}"
            data-remaining="${c.remainingLessons}">消课</button>
        </li>
      `).join('') + '</ul>';

  const recordsHtml = !records || records.length === 0
    ? '<div class="student-detail-empty">暂无上课记录</div>'
    : '<ul class="lesson-records-list">' + records.map(r =>
        renderLessonRecordItemHtml(r, student, enrollmentByCourseId.get(r.courseId), leaveIdsWithMakeup)
      ).join('') + '</ul>';

  body.innerHTML = `
    ${renderStudentDetailInfoBlockHtml(student)}
    <div class="course-detail-panel student-detail-panel">
      <div class="student-detail-section">
        <div class="student-detail-section-head">
          <h4 class="student-detail-section-title">所在课程</h4>
          <div class="student-detail-section-actions">
            <button type="button" class="btn btn-outline btn-sm" id="btn-add-student-course" data-student-id="${escapeHtml(student.id)}">添加课程</button>
          </div>
        </div>
        <div class="student-detail-section-body">
          ${coursesListHtml}
        </div>
      </div>
    </div>
    ${renderStudentDetailRecordsBlockHtml(recordsHtml)}
  `;

  const addCourseBtn = document.getElementById('btn-add-student-course');
  if (addCourseBtn) {
    addCourseBtn.addEventListener('click', () => openAddStudentCourseModal(student.id, courses || []));
  }

  body.querySelectorAll('.student-course-info-clickable').forEach(el => {
    const openEdit = () => {
      openEditStudentCourseModal(student.id, {
        enrollmentId: el.dataset.enrollmentId,
        courseId: el.dataset.courseId,
        courseType: el.dataset.courseType,
        name: el.dataset.courseName,
        remainingLessons: parseInt(el.dataset.remaining, 10) || 0
      });
    };
    el.addEventListener('click', openEdit);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openEdit();
      }
    });
  });

  body.querySelectorAll('.btn-consume-course').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openConsumeModalForCourse(btn.dataset.studentId, {
        enrollmentId: btn.dataset.enrollmentId,
        courseId: btn.dataset.courseId,
        courseType: btn.dataset.courseType,
        name: btn.dataset.courseName,
        remainingLessons: parseInt(btn.dataset.remaining, 10) || 0
      });
    });
  });

  body.querySelectorAll('.btn-delete-record').forEach(btn => {
    btn.addEventListener('click', () => deleteLessonRecord(btn.dataset.id, btn.dataset.studentId, btn.dataset.status));
  });

  body.querySelectorAll('.btn-makeup-record').forEach(btn => {
    btn.addEventListener('click', () => openMakeupLessonModal(
      btn.dataset.studentId,
      btn.dataset.courseId,
      btn.dataset.enrollmentId
    ));
  });
}


function openMakeupLessonModal(studentId, courseId, enrollmentId) {
  if (!studentId || !courseId || !enrollmentId) {
    showToast('补课信息不完整');
    return;
  }

  document.getElementById('makeup-student-id').value = studentId;
  document.getElementById('makeup-course-id').value = courseId;
  document.getElementById('makeup-enrollment-id').value = enrollmentId;
  document.getElementById('makeup-date').value = getTodayDateString();
  openModal('modal-makeup-lesson');
}


async function loadAndRenderStudents() {
  try {
    await refreshStudentsCacheData();
  } catch (err) {
    console.error(err);
    showToast('加载学员失败，请检查网络或数据库配置');
  }
}


async function onEditStudentCourse(e) {
  e.preventDefault();

  const enrollmentId = document.getElementById('edit-student-course-enrollment-id').value;
  const studentId = document.getElementById('edit-student-course-student-id').value;
  const hours = parseInt(document.getElementById('edit-student-course-hours').value, 10);

  if (!enrollmentId || !studentId) return;

  if (isNaN(hours) || hours < 0) {
    showToast('剩余课时数须为不小于 0 的整数');
    return;
  }

  try {
    await updateCourseStudentRemaining(enrollmentId, hours);
    closeModal('modal-edit-student-course');
    await refreshCourseStudentsCacheData();
    await refreshStudentDetailModal(studentId);
    showToast('保存成功');
  } catch (err) {
    console.error(err);
    showToast(err.message || '保存失败');
  }
}


async function onRemoveStudentCourseFromEdit() {
  const enrollmentId = document.getElementById('edit-student-course-enrollment-id').value;
  const studentId = document.getElementById('edit-student-course-student-id').value;
  const label = document.getElementById('edit-student-course-label').textContent || '该课程';

  if (!enrollmentId || !studentId) return;

  if (!confirm('确定将学员移出「' + label + '」吗？')) return;

  try {
    await removeCourseStudent(enrollmentId);
    closeModal('modal-edit-student-course');
    await refreshCourseStudentsCacheData();
    await refreshStudentDetailModal(studentId);
    showToast('已移出课程');
  } catch (err) {
    console.error(err);
    showToast(err.message || '移除失败');
  }
}


async function onAddStudentCourse(e) {
  e.preventDefault();

  const studentId = document.getElementById('add-student-course-student-id').value;
  const courseId = document.getElementById('add-student-course-select').value;
  const hours = parseInt(document.getElementById('add-student-course-hours').value, 10);

  if (!studentId) return;

  if (!courseId) {
    showToast('请选择课程');
    return;
  }

  if (isNaN(hours) || hours < 0) {
    showToast('课时数须为不小于 0 的整数');
    return;
  }

  try {
    await addCourseStudent(courseId, studentId, hours);
    closeModal('modal-add-student-course');
    await refreshCourseStudentsCacheData();
    await refreshStudentDetailModal(studentId);
    showToast('课程添加成功');
  } catch (err) {
    console.error(err);
    showToast(err.message || '添加失败');
  }
}


async function onConsumeLesson(e) {
  e.preventDefault();

  const studentId = document.getElementById('consume-student-id').value;
  const courseId = document.getElementById('consume-course-id').value;
  const enrollmentId = document.getElementById('consume-enrollment-id').value;
  const dateStr = document.getElementById('consume-date').value;

  if (!studentId || !courseId || !enrollmentId) {
    showToast('消课信息不完整');
    return;
  }

  if (!dateStr) {
    showToast('请选择日期');
    return;
  }

  try {
    const db = getSupabase();
    if (!db) {
      showToast('Supabase 库未加载，请刷新页面');
      return;
    }

    const { data: enrollment, error: fetchError } = await db
      .from('course_students')
      .select('remaining_lessons')
      .eq('id', enrollmentId)
      .single();

    if (fetchError) throw fetchError;

    if (!enrollment || enrollment.remaining_lessons < 1) {
      showToast('该课程剩余课时不足，无法消课');
      return;
    }

    const { error: recordError } = await db.from('lesson_records').insert({
      student_id: studentId,
      course_id: courseId,
      consumed_at: dateStr,
      status: '上课'
    });

    if (recordError) throw recordError;

    const { error: updateError } = await db.from('course_students').update({
      remaining_lessons: enrollment.remaining_lessons - 1
    }).eq('id', enrollmentId);

    if (updateError) throw updateError;

    const studentName = getStudentNameById(studentId);
    const courseLabel = getCourseLabelById(courseId);
    await logOperation('消课', studentName + ' · ' + courseLabel + ' · ' + dateStr);

    closeModal('modal-consume');
    await refreshCourseStudentsCacheData();
    await refreshStudentDetailModal(studentId);
    showToast('消课成功');
  } catch (err) {
    console.error(err);
    showToast(err.message || '消课失败');
  }
}


async function onMakeupLesson(e) {
  e.preventDefault();

  const studentId = document.getElementById('makeup-student-id').value;
  const courseId = document.getElementById('makeup-course-id').value;
  const enrollmentId = document.getElementById('makeup-enrollment-id').value;
  const dateStr = document.getElementById('makeup-date').value;

  if (!studentId || !courseId || !enrollmentId) {
    showToast('补课信息不完整');
    return;
  }

  if (!dateStr) {
    showToast('请选择补课日期');
    return;
  }

  try {
    const db = getSupabase();
    if (!db) {
      showToast('Supabase 库未加载，请刷新页面');
      return;
    }

    const { data: enrollment, error: fetchError } = await db
      .from('course_students')
      .select('remaining_lessons')
      .eq('id', enrollmentId)
      .single();

    if (fetchError) throw fetchError;

    if (!enrollment || enrollment.remaining_lessons < 1) {
      showToast('该课程剩余课时不足，无法补课');
      return;
    }

    const { error: recordError } = await db.from('lesson_records').insert({
      student_id: studentId,
      course_id: courseId,
      consumed_at: dateStr,
      status: '补课'
    });
    if (recordError) throw recordError;

    const { error: updateError } = await db.from('course_students').update({
      remaining_lessons: enrollment.remaining_lessons - 1
    }).eq('id', enrollmentId);
    if (updateError) throw updateError;

    const studentName = getStudentNameById(studentId);
    const courseLabel = getCourseLabelById(courseId);
    await logOperation('补课', studentName + ' · ' + courseLabel + ' · ' + dateStr);

    closeModal('modal-makeup-lesson');
    await refreshCourseStudentsCacheData();
    await refreshStudentDetailModal(studentId);
    showToast('补课成功');
  } catch (err) {
    console.error(err);
    showToast(err.message || '补课失败');
  }
}


async function deleteLessonRecord(recordId, studentId, status) {
  const normalizedStatus = normalizeLessonRecordStatus(status);
  const confirmMessage = normalizedStatus === '请假'
    ? '确定删除这条请假记录吗？'
    : '确定删除这条记录吗？删除后该课程剩余课时将加回 1 节。';

  if (!confirm(confirmMessage)) {
    return;
  }

  try {
    const db = getSupabase();
    if (!db) {
      showToast('Supabase 库未加载，请刷新页面');
      return;
    }

    const { data: record, error: fetchError } = await db
      .from('lesson_records')
      .select('course_id, status')
      .eq('id', recordId)
      .single();

    if (fetchError) throw fetchError;

    const recordStatus = normalizeLessonRecordStatus(record?.status || normalizedStatus);

    const { error: delError } = await db.from('lesson_records').delete().eq('id', recordId);
    if (delError) throw delError;

    if (record && record.course_id && (recordStatus === '上课' || recordStatus === '补课')) {
      const { data: enrollment, error: enrollmentError } = await db
        .from('course_students')
        .select('id, remaining_lessons')
        .eq('student_id', studentId)
        .eq('course_id', record.course_id)
        .maybeSingle();

      if (enrollmentError) throw enrollmentError;

      if (enrollment) {
        const { error: updateError } = await db.from('course_students').update({
          remaining_lessons: enrollment.remaining_lessons + 1
        }).eq('id', enrollment.id);
        if (updateError) throw updateError;
      }
    }

    await refreshCourseStudentsCacheData();
    await refreshStudentDetailModal(studentId);
    showToast('记录已删除');
  } catch (err) {
    console.error(err);
    showToast(err.message || '删除失败');
  }
}


async function onAddStudent(e) {
  e.preventDefault();

  const name = document.getElementById('add-name').value.trim();
  const phone = document.getElementById('add-phone').value.trim();

  if (!name) {
    showToast('请填写姓名');
    return;
  }

  try {
    if (phone && await isPhoneTaken(phone)) {
      showToast('该联系电话已存在');
      return;
    }

    const db = getSupabase();
    if (!db) {
      showToast('Supabase 库未加载，请刷新页面');
      return;
    }

    const { error } = await db.from('students').insert({
      name,
      phone: phone || null
    });

    if (error) throw error;

    await logOperation('添加学员', name);

    e.target.reset();
    closeModal('modal-add');
    await loadAndRenderStudents();
    showToast('学员添加成功');
  } catch (err) {
    console.error(err);
    showToast(err.message || '添加失败');
  }
}


async function saveStudentProfile(id, name, phone) {
  if (!id) {
    showToast('学员不存在');
    return false;
  }

  if (!name) {
    showToast('请填写姓名');
    return false;
  }

  if (phone && await isPhoneTaken(phone, id)) {
    showToast('该联系电话已被其他学员使用');
    return false;
  }

  const db = getSupabase();
  if (!db) {
    showToast('Supabase 库未加载，请刷新页面');
    return false;
  }

  const { error } = await db.from('students').update({
    name,
    phone: phone || null
  }).eq('id', id);

  if (error) throw error;
  return true;
}


async function saveStudentDetailEdit() {
  if (!currentStudentDetailId) return;

  const nameInput = document.getElementById('student-detail-edit-name');
  const phoneInput = document.getElementById('student-detail-edit-phone');
  if (!nameInput || !phoneInput) return;

  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();

  try {
    const saved = await saveStudentProfile(currentStudentDetailId, name, phone);
    if (!saved) return;

    await refreshAfterStudentChanged();
    const student = coreDataCache.students.find(s => s.id === currentStudentDetailId);
    if (!student) return;

    const courses = getStudentCoursesFromCache(currentStudentDetailId);
    studentDetailData.courses = courses;

    exitStudentDetailEditMode();
    renderStudentDetailUI(student, studentDetailData.records, courses);
    await logOperation('编辑学员', name);
    showToast('保存成功');
  } catch (err) {
    console.error(err);
    showToast(err.message || '保存失败');
  }
}


async function deleteStudentProfile(id, name) {
  if (!id) return false;

  if (!confirm('确定要删除「' + (name || '该学员') + '」吗？此操作不可恢复。')) {
    return false;
  }

  const db = getSupabase();
  if (!db) {
    showToast('Supabase 库未加载，请刷新页面');
    return false;
  }

  const { error } = await db.from('students').delete().eq('id', id);
  if (error) throw error;
  return true;
}


async function deleteStudentDetailStudent() {
  if (!currentStudentDetailId) return;

  const nameInput = document.getElementById('student-detail-edit-name');
  const student = coreDataCache.students.find(s => s.id === currentStudentDetailId);
  const name = nameInput ? nameInput.value.trim() : (student ? student.name : '该学员');

  try {
    const deleted = await deleteStudentProfile(currentStudentDetailId, name);
    if (!deleted) return;

    closeDetailPage('detail-student');
    await refreshAfterStudentChanged();
    await logOperation('删除学员', name);
    showToast('学员已删除');
  } catch (err) {
    console.error(err);
    showToast(err.message || '删除失败');
  }
}
