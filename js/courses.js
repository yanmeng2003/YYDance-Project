function buildTeacherColorMap() {
  const sorted = [...coreDataCache.teachers].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return ta - tb;
  });
  const map = {};
  sorted.forEach((t, i) => {
    map[t.id] = TEACHER_COLOR_PALETTE[i % TEACHER_COLOR_PALETTE.length];
  });
  return map;
}


function getCourseColor(course, colorMap) {
  if (course.teacherId && colorMap[course.teacherId]) {
    return colorMap[course.teacherId];
  }
  return DEFAULT_COURSE_COLOR;
}


function formatWeekDayHead(day) {
  return String(day || '').replace(/^周/, '');
}


function getWeekViewLegendTeachers(activeCourses, colorMap) {
  const teacherMap = new Map();

  WEEKDAY_ORDER.forEach(day => {
    collectWeekDayEvents(activeCourses, day).forEach(event => {
      const course = event.course;
      const id = course.teacherId || '__unassigned__';
      if (teacherMap.has(id)) return;

      teacherMap.set(id, {
        id,
        name: course.teacherName || '未分配',
        colors: getCourseColor(course, colorMap)
      });
    });
  });

  return Array.from(teacherMap.values()).sort((a, b) => {
    if (a.id === '__unassigned__') return 1;
    if (b.id === '__unassigned__') return -1;
    const aPinned = (a.name || '').trim() === PINNED_TEACHER_NAME;
    const bPinned = (b.name || '').trim() === PINNED_TEACHER_NAME;
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    return compareBySurnamePinyin(a.name, b.name);
  });
}


function renderWeekViewLegendHtml(activeCourses, colorMap) {
  const teachers = getWeekViewLegendTeachers(activeCourses, colorMap);
  if (!teachers.length) return '';

  const teacherItems = teachers.map(entry => `
    <span class="week-legend-item">
      <span class="week-legend-swatch" style="background:${entry.colors.bg};border-color:${entry.colors.text};"></span>
      <span class="week-legend-label">${escapeHtml(entry.name)}</span>
    </span>
  `).join('');

  return `
    <div class="week-view-legend" aria-label="周视图图注">
      ${teacherItems}
      <span class="week-legend-divider" aria-hidden="true"></span>
      <span class="week-legend-item">
        <span class="week-legend-swatch week-legend-swatch--small-class">
          <span class="week-legend-corner" aria-hidden="true"></span>
        </span>
        <span class="week-legend-label">小课</span>
      </span>
    </div>
  `;
}


let weekViewResizeObserver = null;
let weekViewFocusedDay = null;
let weekViewMidnightTimer = null;

const WEEK_VIEW_FOCUS_COL_FR = 'minmax(0, 2.5fr)';
const WEEK_VIEW_COMPACT_COL_FR = 'minmax(0, 1fr)';


function getChinaNowParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);
  const pick = (type) => parts.find(part => part.type === type)?.value || '0';

  return {
    year: +pick('year'),
    month: +pick('month'),
    day: +pick('day'),
    hour: +pick('hour'),
    minute: +pick('minute'),
    second: +pick('second')
  };
}


function getTodayWeekdayInChina() {
  const weekdayShort = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    weekday: 'short'
  }).format(new Date());
  const indexMap = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

  return WEEKDAY_ORDER[indexMap[weekdayShort] ?? 0];
}


function getWeekViewFocusedDay() {
  return weekViewFocusedDay || getTodayWeekdayInChina();
}


function getWeekViewGridTemplateColumns(focusedDay) {
  const dayCols = WEEKDAY_ORDER.map(day =>
    day === focusedDay ? WEEK_VIEW_FOCUS_COL_FR : WEEK_VIEW_COMPACT_COL_FR
  );

  return `var(--week-time-col) ${dayCols.join(' ')}`;
}


function applyWeekViewFocus() {
  const container = document.getElementById('week-view-container');
  const schedule = container?.querySelector('.week-schedule');
  if (!schedule) return;

  const focusedDay = getWeekViewFocusedDay();
  const gridCols = getWeekViewGridTemplateColumns(focusedDay);

  schedule.dataset.focusedDay = focusedDay;

  const headerRow = schedule.querySelector('.week-header-row');
  const bodyRow = schedule.querySelector('.week-body');
  if (headerRow) headerRow.style.gridTemplateColumns = gridCols;
  if (bodyRow) bodyRow.style.gridTemplateColumns = gridCols;

  schedule.querySelectorAll('.week-day-head').forEach(head => {
    const isFocused = head.dataset.day === focusedDay;
    head.classList.toggle('week-day-head--focused', isFocused);
    head.setAttribute('aria-pressed', isFocused ? 'true' : 'false');
  });

  schedule.querySelectorAll('.week-day-column').forEach(column => {
    const isFocused = column.dataset.day === focusedDay;
    column.classList.toggle('week-day-column--focused', isFocused);
    column.classList.toggle('week-day-column--compact', !isFocused);
  });

  requestAnimationFrame(() => fitWeekViewToWidth());
}


function setWeekViewFocusedDay(day) {
  if (!WEEKDAY_ORDER.includes(day)) return;
  weekViewFocusedDay = day;
  applyWeekViewFocus();
}


function resetWeekViewFocusedDayToToday() {
  weekViewFocusedDay = null;
  applyWeekViewFocus();
}


function scheduleWeekViewMidnightRefresh() {
  if (weekViewMidnightTimer) {
    clearTimeout(weekViewMidnightTimer);
    weekViewMidnightTimer = null;
  }

  const parts = getChinaNowParts();
  const msUntilMidnight = (
    (23 - parts.hour) * 3600 +
    (59 - parts.minute) * 60 +
    (60 - parts.second)
  ) * 1000 + 500;

  weekViewMidnightTimer = setTimeout(() => {
    resetWeekViewFocusedDayToToday();
    if (document.getElementById('page-week').classList.contains('active') && coreDataCache.courses.length) {
      renderWeekViewUI(coreDataCache.courses);
    } else {
      scheduleWeekViewMidnightRefresh();
    }
  }, msUntilMidnight);
}


function bindWeekViewDayHeads(container) {
  container.querySelectorAll('.week-day-head').forEach(head => {
    head.addEventListener('click', () => setWeekViewFocusedDay(head.dataset.day));
  });
}


function fitWeekViewToWidth() {
  const container = document.getElementById('week-view-container');
  const scroll = container?.querySelector('.week-view-scroll');
  const scaler = container?.querySelector('.week-view-scaler');
  const schedule = container?.querySelector('.week-schedule');
  if (!scroll || !scaler || !schedule) return;

  schedule.style.transform = '';
  scaler.style.height = '';

  const isMobile = window.matchMedia('(max-width: 640px)').matches;
  if (!isMobile) return;

  const availableWidth = scroll.clientWidth;
  const designWidth = schedule.offsetWidth;
  if (!availableWidth || !designWidth) return;

  const scale = Math.min(1, availableWidth / designWidth);
  schedule.style.transform = `scale(${scale})`;
  scaler.style.height = `${schedule.offsetHeight * scale}px`;
}


function observeWeekViewResize() {
  const container = document.getElementById('week-view-container');
  const scroll = container?.querySelector('.week-view-scroll');
  if (!scroll) return;

  if (weekViewResizeObserver) {
    weekViewResizeObserver.disconnect();
  }

  weekViewResizeObserver = new ResizeObserver(() => {
    fitWeekViewToWidth();
  });
  weekViewResizeObserver.observe(scroll);
}


function weekEventsOverlap(a, b) {
  return a.startMin < b.endMin && b.startMin < a.endMin;
}


function collectWeekDayEvents(activeCourses, day) {
  const events = [];

  activeCourses.forEach(course => {
    if (!course.weekdays || !course.weekdays.includes(day)) return;

    const startMin = timeToMinutes(course.startTime);
    const endMin = timeToMinutes(course.endTime);
    const visibleStart = Math.max(startMin, WEEK_GRID_START_MIN);
    const visibleEnd = Math.min(endMin, WEEK_GRID_END_MIN);

    if (visibleEnd <= visibleStart) return;

    events.push({
      course,
      startMin: visibleStart,
      endMin: visibleEnd,
      column: 0,
      totalColumns: 1
    });
  });

  return events;
}


function layoutWeekDayEvents(events) {
  if (!events.length) return events;

  if (events.length === 1) {
    events[0].column = 0;
    events[0].totalColumns = 1;
    return events;
  }

  const parent = events.map((_, i) => i);

  function find(i) {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }

  function union(i, j) {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) parent[rootI] = rootJ;
  }

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      if (weekEventsOverlap(events[i], events[j])) union(i, j);
    }
  }

  const clusters = new Map();
  events.forEach((event, index) => {
    const root = find(index);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(event);
  });

  clusters.forEach(cluster => {
    if (cluster.length === 1) {
      cluster[0].column = 0;
      cluster[0].totalColumns = 1;
      return;
    }

    cluster.sort((a, b) => {
      if (a.startMin !== b.startMin) return a.startMin - b.startMin;
      return (b.endMin - b.startMin) - (a.endMin - a.startMin);
    });

    const columnEnds = [];
    cluster.forEach(event => {
      let col = columnEnds.findIndex(end => end <= event.startMin);
      if (col === -1) {
        col = columnEnds.length;
        columnEnds.push(event.endMin);
      } else {
        columnEnds[col] = event.endMin;
      }
      event.column = col;
    });

    const totalColumns = columnEnds.length;
    cluster.forEach(event => {
      event.totalColumns = totalColumns;
    });
  });

  return events;
}


function weekEventColumnStyle(column, totalColumns) {
  if (totalColumns <= 1) {
    return 'left:3px;width:calc(100% - 6px);';
  }

  const slotWidth = 100 / totalColumns;
  return `left:calc(${slotWidth * column}% + 3px);width:calc(${slotWidth}% - 6px);`;
}


function buildWeekEventHtml(eventLayout, colorMap) {
  const course = eventLayout.course;
  const top = ((eventLayout.startMin - WEEK_GRID_START_MIN) / WEEK_SLOT_MINUTES) * WEEK_SLOT_HEIGHT;
  const height = Math.max(
    ((eventLayout.endMin - eventLayout.startMin) / WEEK_SLOT_MINUTES) * WEEK_SLOT_HEIGHT - 2,
    18
  );
  const colors = getCourseColor(course, colorMap);
  const timeLabel = formatCompactTimeRange(course.startTime, course.endTime);
  const courseLabel = formatCourseShortLabel(course);
  const teacherLabel = course.teacherName || '未分配';
  const smallClass = course.classSize === '小课' ? ' week-event-small' : '';
  const positionStyle = weekEventColumnStyle(eventLayout.column, eventLayout.totalColumns);
  const title = `${courseLabel} · ${teacherLabel} · ${timeLabel}`;

  return `
    <div class="week-event${smallClass}" role="button" tabindex="0" data-course-id="${escapeHtml(course.id)}"
      style="top:${top}px;height:${height}px;${positionStyle}background:${colors.bg};color:${colors.text}"
      title="${escapeHtml(title)}">
      <span class="week-event-class">${escapeHtml(courseLabel)}</span>
      <span class="week-event-time">${escapeHtml(timeLabel)}</span>
    </div>
  `;
}


function renderWeekViewUI(courses) {
  const container = document.getElementById('week-view-container');
  const activeCourses = courses.filter(isActiveCourse);

  if (!activeCourses.length) {
    container.innerHTML = `
      <div class="week-view-scroll">
        <div class="week-empty">
          <div class="icon">📅</div>
          <p>暂无课程，点击右下角添加</p>
        </div>
      </div>
    `;
    return;
  }

  const colorMap = buildTeacherColorMap();
  const focusedDay = getWeekViewFocusedDay();
  const gridCols = getWeekViewGridTemplateColumns(focusedDay);

  const hourLabelsHtml = [];
  for (let h = WEEK_GRID_START_MIN / 60; h <= WEEK_GRID_END_MIN / 60; h++) {
    const top = WEEK_VIEW_PAD_Y + (h - WEEK_GRID_START_MIN / 60) * 2 * WEEK_SLOT_HEIGHT;
    hourLabelsHtml.push(
      `<div class="week-hour-label" style="top:${top}px">${String(h).padStart(2, '0')}:00</div>`
    );
  }

  const slotBgHtml = Array.from({ length: WEEK_SLOT_COUNT }, (_, i) => {
    const slotClass = i % 2 === 0 ? 'week-slot-half' : 'week-slot-hour';
    const firstClass = i === 0 ? ' week-slot-first' : '';
    return `<div class="week-slot-bg ${slotClass}${firstClass}"></div>`;
  }).join('');

  const dayColumnsHtml = WEEKDAY_ORDER.map(day => {
    const dayEvents = layoutWeekDayEvents(collectWeekDayEvents(activeCourses, day));
    const eventsHtml = dayEvents.map(eventLayout => buildWeekEventHtml(eventLayout, colorMap)).join('');
    const isFocused = day === focusedDay;

    return `
      <div class="week-day-column${isFocused ? ' week-day-column--focused' : ' week-day-column--compact'}" data-day="${day}">
        ${slotBgHtml}
        <div class="week-events-layer">${eventsHtml}</div>
      </div>
    `;
  }).join('');

  const dayHeadsHtml = WEEKDAY_ORDER.map(day => {
    const isFocused = day === focusedDay;
    return `
      <button type="button" class="week-day-head${isFocused ? ' week-day-head--focused' : ''}"
        data-day="${day}" aria-pressed="${isFocused ? 'true' : 'false'}"
        aria-label="查看${day}课程">
        ${formatWeekDayHead(day)}
      </button>
    `;
  }).join('');

  const legendHtml = renderWeekViewLegendHtml(activeCourses, colorMap);

  container.innerHTML = `
    <div class="week-view-scroll">
      <div class="week-view-scaler">
        <div class="week-schedule" style="--week-grid-height: ${WEEK_GRID_HEIGHT}px; --week-slot-height: ${WEEK_SLOT_HEIGHT}px" data-focused-day="${escapeHtml(focusedDay)}">
          <div class="week-header-row" style="grid-template-columns: ${gridCols}">
            <div class="week-corner"></div>
            ${dayHeadsHtml}
          </div>
          <div class="week-body" style="grid-template-columns: ${gridCols}">
            <div class="week-time-labels">${hourLabelsHtml.join('')}</div>
            ${dayColumnsHtml}
          </div>
        </div>
      </div>
    </div>
    ${legendHtml}
  `;

  container.querySelectorAll('.week-event').forEach(el => {
    const open = () => openCourseDetailModal(el.dataset.courseId);
    el.addEventListener('click', open);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  });

  bindWeekViewDayHeads(container);
  scheduleWeekViewMidnightRefresh();

  requestAnimationFrame(() => {
    applyWeekViewFocus();
    fitWeekViewToWidth();
    observeWeekViewResize();
  });
}


function renderCourseStudentsSection(courseId, enrollments) {
  const sortedEnrollments = sortEnrollmentsByStudentName(enrollments || []);
  const listHtml = !sortedEnrollments.length
    ? '<div class="student-detail-empty">暂无学员</div>'
    : '<ul class="course-students-list">' + sortedEnrollments.map(e => `
        <li class="course-student-row">
          <span class="course-student-name">
            <span>${escapeHtml(e.studentName)}</span>
            ${renewalBadgeHtml(studentNeedsRenewalById(e.studentId))}
          </span>
          <button type="button" class="course-student-remove" data-enrollment-id="${escapeHtml(e.id)}" aria-label="移除${escapeHtml(e.studentName)}">&times;</button>
        </li>
      `).join('') + '</ul>';

  return `
    <div class="course-detail-students-block">
      <div class="course-detail-panel course-detail-students">
        <div class="detail-section">
          <div class="detail-section-header student-detail-section-head">
            <h4>学员名单</h4>
            <div class="detail-section-actions">
              <button type="button" class="btn btn-outline btn-sm" id="btn-add-course-student" data-course-id="${escapeHtml(courseId)}">添加学员</button>
            </div>
          </div>
          ${listHtml}
        </div>
      </div>
      <button type="button" class="btn btn-outline course-detail-edit-btn" id="btn-course-detail-edit">编辑</button>
    </div>
  `;
}


function bindCourseStudentsEvents(courseId, enrollments) {
  const root = document.getElementById('course-detail-body');

  root.querySelectorAll('.course-student-remove').forEach(btn => {
    btn.addEventListener('click', () => removeStudentFromCourseDetail(btn.dataset.enrollmentId, courseId));
  });

  const addBtn = root.querySelector('#btn-add-course-student');
  if (addBtn) {
    addBtn.addEventListener('click', () => openAddCourseStudentModal(courseId, enrollments));
  }

  const editBtn = root.querySelector('#btn-course-detail-edit');
  if (editBtn) {
    editBtn.addEventListener('click', openCourseEditFromDetail);
  }
}


async function openBulkConsumeModal(courseId) {
  document.getElementById('bulk-consume-course-id').value = courseId;
  document.getElementById('bulk-consume-date').value = getTodayDateString();

  const listEl = document.getElementById('bulk-consume-students-list');
  listEl.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:12px 0;">加载中...</p>';
  openModal('modal-bulk-consume');

  try {
    if (!coreDataCache.loaded) await preloadCoreData();
    const enrollments = getCourseStudentsFromCache(courseId);
    if (!enrollments.length) {
      listEl.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:12px 0;">暂无学员</p>';
      return;
    }

    listEl.innerHTML = enrollments.map(e => `
      <label class="bulk-consume-student-row">
        <input type="checkbox" name="bulk-consume-student" value="${escapeHtml(e.id)}"
          data-student-id="${escapeHtml(e.studentId)}"
          data-remaining="${e.remainingLessons}" checked>
        <span class="bulk-consume-student-name">${escapeHtml(e.studentName)}</span>
        <span class="bulk-consume-student-hours">剩余 ${e.remainingLessons} 课时</span>
      </label>
    `).join('');
  } catch (err) {
    console.error(err);
    listEl.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:12px 0;">加载失败</p>';
    showToast('加载学员列表失败');
  }
}


async function openAddCourseStudentModal(courseId, enrollments) {
  try {
    if (!coreDataCache.loaded) await preloadCoreData();
    const enrolledIds = (enrollments || []).map(e => e.studentId);
    const hasAvailable = populateCourseStudentSelect('add-course-student-select', enrolledIds);
    document.getElementById('add-course-student-course-id').value = courseId;
    document.getElementById('add-course-student-hours').value = '';
    document.getElementById('add-course-student-hours').disabled = !hasAvailable;
    const submitBtn = document.querySelector('#form-add-course-student button[type="submit"]');
    if (submitBtn) submitBtn.disabled = !hasAvailable;
    openModal('modal-add-course-student');
  } catch (err) {
    console.error(err);
    showToast('加载学员列表失败');
  }
}


async function onAddCourseStudentToCourse(e) {
  e.preventDefault();

  const courseId = document.getElementById('add-course-student-course-id').value;
  const studentId = document.getElementById('add-course-student-select').value;
  const hoursRaw = document.getElementById('add-course-student-hours').value.trim();

  if (!courseId) return;

  if (!studentId) {
    showToast('请选择要添加的学员');
    return;
  }

  if (hoursRaw === '') {
    showToast('请填写课时数');
    return;
  }

  const hours = parseInt(hoursRaw, 10);
  if (isNaN(hours) || hours < 0) {
    showToast('课时数须为不小于 0 的整数');
    return;
  }

  try {
    await addCourseStudent(courseId, studentId, hours);
    closeModal('modal-add-course-student');
    await refreshCourseStudentsCacheData();
    await openCourseDetailModal(courseId);
    showToast('学员已加入课程');
  } catch (err) {
    console.error(err);
    showToast(err.message || '添加失败');
  }
}


async function removeStudentFromCourseDetail(enrollmentId, courseId) {
  if (!confirm('确定将该学员移出此课程吗？')) return;

  try {
    await removeCourseStudent(enrollmentId);
    await refreshCourseStudentsCacheData();
    await openCourseDetailModal(courseId);
    showToast('已移出课程');
  } catch (err) {
    console.error(err);
    showToast(err.message || '移除失败');
  }
}


async function openCourseDetailModal(id) {
  const course = coreDataCache.courses.find(c => c.id === id);
  if (!course) return;

  currentCourseDetailId = id;
  const body = document.getElementById('course-detail-body');
  body.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:24px;">加载中...</p>';
  document.getElementById('course-detail-title').textContent = formatCourseShortLabel(course);
  openDetailPage('detail-course');

  try {
    const enrollments = getCourseStudentsFromCache(id);
    body.innerHTML = `
      <div class="course-detail-panel">
        <div class="course-detail-info">
          <div class="student-detail-row"><span class="label">课程类型</span><span class="value">${escapeHtml(course.courseType || '—')}</span></div>
          <div class="student-detail-row"><span class="label">课程班级</span><span class="value">${escapeHtml(course.name || '—')}</span></div>
          <div class="student-detail-row"><span class="label">课程规模</span><span class="value">${escapeHtml(course.classSize || '大课')}</span></div>
          ${isLargeClassCourse(course.classSize) ? `<div class="student-detail-row"><span class="label">课程季度</span><span class="value">${escapeHtml(course.season || '—')}</span></div>` : ''}
          <div class="student-detail-row"><span class="label">课程状态</span><span class="value">${escapeHtml(normalizeCourseStatus(course.status))}</span></div>
          <div class="student-detail-row"><span class="label">上课日期</span><span class="value">${escapeHtml(formatCourseListWeekdays(course.weekdays))}</span></div>
          <div class="student-detail-row"><span class="label">上课时间</span><span class="value">${escapeHtml(formatTimeRange(course.startTime, course.endTime))}</span></div>
          <div class="student-detail-row"><span class="label">负责老师</span><span class="value">${escapeHtml(course.teacherName || '未分配')}</span></div>
        </div>
      </div>
      ${renderCourseStudentsSection(id, enrollments)}
    `;
    bindCourseStudentsEvents(id, enrollments);
  } catch (err) {
    console.error(err);
    body.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:24px;">加载失败</p>';
    showToast('加载课程详情失败');
  }
}


function formatCourseShortLabel(course) {
  const type = course.courseType || '摩登舞';
  const name = course.name || '';
  return type + '·' + name;
}


function formatCourseListSubline(course) {
  const days = formatCourseListWeekdays(course.weekdays);
  const start = formatTime(course.startTime);
  const end = formatTime(course.endTime);
  const time = start && end ? start + '-' + end : (start || end || '');
  if (days && time) return days + '·' + time;
  return days || time || '';
}


function sortTeacherDetailCourses(courses) {
  return [...courses].sort((a, b) => {
    const aLarge = isLargeClassCourse(a.classSize);
    const bLarge = isLargeClassCourse(b.classSize);
    if (aLarge !== bLarge) return aLarge ? -1 : 1;

    if (aLarge && bLarge) {
      const seasonDiff = getCourseSeasonSortKey(a.season) - getCourseSeasonSortKey(b.season);
      if (seasonDiff !== 0) return seasonDiff;
    }

    const typeDiff = compareCourseTypeForList(a, b);
    if (typeDiff !== 0) return typeDiff;

    return compareCourseScheduleTime(a, b);
  });
}


function getCourseStatusListOrder(status) {
  const normalized = normalizeCourseStatus(status);
  if (normalized === '开课中') return 0;
  if (normalized === '已结课') return 1;
  if (normalized === '待开课') return 2;
  return 1;
}


function getCourseSeasonSortKey(season) {
  const parsed = parseSeason(season);
  return parsed ? parsed.sortKey : Number.MAX_SAFE_INTEGER;
}


function compareCourseTypeForList(a, b) {
  const typeOrder = { '拉丁舞': 0, '摩登舞': 1 };
  const aOrder = typeOrder[a.courseType || '摩登舞'] ?? 2;
  const bOrder = typeOrder[b.courseType || '摩登舞'] ?? 2;
  return aOrder - bOrder;
}


function getEarliestWeekdayIndex(weekdays) {
  if (!weekdays || !weekdays.length) return 99;
  return Math.min(...weekdays.map(day => {
    const index = WEEKDAY_ORDER.indexOf(day);
    return index >= 0 ? index : 99;
  }));
}


function compareCourseScheduleTime(a, b) {
  const startDiff = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
  if (startDiff !== 0) return startDiff;

  const weekdayDiff = getEarliestWeekdayIndex(a.weekdays) - getEarliestWeekdayIndex(b.weekdays);
  if (weekdayDiff !== 0) return weekdayDiff;

  return timeToMinutes(a.endTime) - timeToMinutes(b.endTime);
}


function sortCoursesForList(courses) {
  return [...courses].sort((a, b) => {
    const statusDiff = getCourseStatusListOrder(a.status) - getCourseStatusListOrder(b.status);
    if (statusDiff !== 0) return statusDiff;

    if (normalizeCourseStatus(a.status) === '待开课') {
      return compareCourseScheduleTime(a, b);
    }

    const seasonDiff = getCourseSeasonSortKey(a.season) - getCourseSeasonSortKey(b.season);
    if (seasonDiff !== 0) return seasonDiff;

    const typeDiff = compareCourseTypeForList(a, b);
    if (typeDiff !== 0) return typeDiff;

    return compareCourseScheduleTime(a, b);
  });
}


function renderCourseListUI(courses) {
  const countEl = document.getElementById('course-count');
  const emptyEl = document.getElementById('course-empty-state');
  const listEl = document.getElementById('course-list');
  const sortedCourses = sortCoursesForList(courses);

  countEl.textContent = '共 ' + sortedCourses.length + ' 门';

  if (sortedCourses.length === 0) {
    emptyEl.style.display = 'block';
    listEl.style.display = 'none';
    return;
  }

  emptyEl.style.display = 'none';
  listEl.style.display = 'flex';

  listEl.innerHTML = sortedCourses.map(c => {
    const subline = formatCourseListSubline(c);
    return `
    <li class="student-island-item${isActiveCourse(c) ? '' : ' course-list-item-inactive'}">
      <div class="student-island-link student-info-clickable" data-id="${escapeHtml(c.id)}" role="button" tabindex="0" aria-label="查看课程详情">
        <div class="student-island-main">
          <span class="student-name-row">
            <span class="student-name">${escapeHtml(formatCourseShortLabel(c))}</span>
            ${courseSeasonBadgeHtml(c.classSize, c.season)}
          </span>
          <span class="student-island-subline">${escapeHtml(subline)}</span>
        </div>
        <span class="student-island-chevron" aria-hidden="true"><i data-lucide="chevron-right"></i></span>
      </div>
    </li>
  `;
  }).join('');

  bindClickableRow(listEl, '.student-info-clickable', openCourseDetailModal);
  if (window.lucide && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
}


async function loadAndRenderCourses() {
  try {
    await refreshCoursesCacheData();
  } catch (err) {
    console.error(err);
    showToast('加载课程失败，请检查网络或数据库配置');
  }
}


function finishCourseFormSave(pageId) {
  closeAllDetailPages();
  navigateTo('courses');
}


function openCourseEditFromDetail() {
  if (!currentCourseDetailId) return;
  openEditCourseModal(currentCourseDetailId);
}


async function openAddCoursePage() {
  document.getElementById('form-add-course').reset();
  try {
    if (!coreDataCache.loaded) await preloadCoreData();
    populateTeacherSelect('course-teacher', '');
  } catch (err) {
    console.error(err);
  }
  updateCourseSeasonFieldVisibility('course-class-size', 'course-season-group', 'course-season');
  document.getElementById('course-status').value = '开课中';
  openDetailPage('detail-course-add');
}


async function openEditCourseModal(id) {
  const course = coreDataCache.courses.find(c => c.id === id);
  if (!course) return;

  if (!coreDataCache.loaded) await preloadCoreData();
  document.getElementById('edit-course-id').value = course.id;
  document.getElementById('edit-course-type').value = COURSE_TYPES.includes(course.courseType) ? course.courseType : '摩登舞';
  document.getElementById('edit-course-class').value = course.name;
  document.getElementById('edit-course-class-size').value = course.classSize === '小课' ? '小课' : '大课';
  document.getElementById('edit-course-season').value = course.season || '';
  document.getElementById('edit-course-status').value = normalizeCourseStatus(course.status);
  setWeekdayCheckboxes('#edit-course-weekdays', course.weekdays);
  document.getElementById('edit-course-start-time').value = formatTime(course.startTime);
  document.getElementById('edit-course-end-time').value = formatTime(course.endTime);
  populateTeacherSelect('edit-course-teacher', course.teacherId || '');
  updateCourseSeasonFieldVisibility('edit-course-class-size', 'edit-course-season-group', 'edit-course-season');

  openDetailPage('detail-course-edit');
}


async function onAddCourse(e) {
  e.preventDefault();

  const courseType = document.getElementById('course-type').value;
  const courseClass = document.getElementById('course-class').value.trim();
  const classSize = document.getElementById('course-class-size').value;
  const status = document.getElementById('course-status').value;
  const season = document.getElementById('course-season').value.trim();
  const weekdays = getSelectedWeekdays('#course-weekdays');
  const startTime = document.getElementById('course-start-time').value;
  const endTime = document.getElementById('course-end-time').value;

  if (!courseType) {
    showToast('请选择课程类型');
    return;
  }

  if (!courseClass) {
    showToast('请填写课程班级');
    return;
  }

  if (isLargeClassCourse(classSize) && !season) {
    showToast('请填写课程季度');
    return;
  }

  if (weekdays.length === 0) {
    showToast('请至少选择一个星期');
    return;
  }

  if (!validateCourseTimes(startTime, endTime)) {
    showToast('请填写有效的开始与结束时间，且结束时间须晚于开始时间');
    return;
  }

  try {
    const db = getSupabase();
    if (!db) {
      showToast('Supabase 库未加载，请刷新页面');
      return;
    }

    const teacherId = getTeacherIdFromSelect('course-teacher');

    const { error } = await db.from('courses').insert({
      course_type: courseType,
      name: courseClass,
      class_size: classSize,
      status,
      season: isLargeClassCourse(classSize) ? season : null,
      weekdays,
      start_time: startTime,
      end_time: endTime,
      teacher_id: teacherId
    });

    if (error) throw error;

    await logOperation('添加课程', courseType + '·' + courseClass);

    e.target.reset();
    finishCourseFormSave('detail-course-add');
    await loadAndRenderCourses();
    showToast('课程添加成功');
  } catch (err) {
    console.error(err);
    showToast(err.message || '添加失败');
  }
}


async function onEditCourse(e) {
  e.preventDefault();

  const id = document.getElementById('edit-course-id').value;
  const courseType = document.getElementById('edit-course-type').value;
  const courseClass = document.getElementById('edit-course-class').value.trim();
  const classSize = document.getElementById('edit-course-class-size').value;
  const status = document.getElementById('edit-course-status').value;
  const season = document.getElementById('edit-course-season').value.trim();
  const weekdays = getSelectedWeekdays('#edit-course-weekdays');
  const startTime = document.getElementById('edit-course-start-time').value;
  const endTime = document.getElementById('edit-course-end-time').value;

  if (!courseType) {
    showToast('请选择课程类型');
    return;
  }

  if (!courseClass) {
    showToast('请填写课程班级');
    return;
  }

  if (isLargeClassCourse(classSize) && !season) {
    showToast('请填写课程季度');
    return;
  }

  if (weekdays.length === 0) {
    showToast('请至少选择一个星期');
    return;
  }

  if (!validateCourseTimes(startTime, endTime)) {
    showToast('请填写有效的开始与结束时间，且结束时间须晚于开始时间');
    return;
  }

  try {
    const db = getSupabase();
    if (!db) {
      showToast('Supabase 库未加载，请刷新页面');
      return;
    }

    const teacherId = getTeacherIdFromSelect('edit-course-teacher');

    const { error } = await db.from('courses').update({
      course_type: courseType,
      name: courseClass,
      class_size: classSize,
      status,
      season: isLargeClassCourse(classSize) ? season : null,
      weekdays,
      start_time: startTime,
      end_time: endTime,
      teacher_id: teacherId
    }).eq('id', id);

    if (error) throw error;

    await logOperation('编辑课程', courseType + '·' + courseClass);

    finishCourseFormSave('detail-course-edit');
    await refreshAfterCourseChanged();
    showToast('保存成功');
  } catch (err) {
    console.error(err);
    showToast(err.message || '保存失败');
  }
}


async function onDeleteCourseFromEdit() {
  const id = document.getElementById('edit-course-id').value;
  const courseType = document.getElementById('edit-course-type').value;
  const courseClass = document.getElementById('edit-course-class').value.trim();
  const label = (courseType || '') + (courseClass ? ' · ' + courseClass : '') || '该课程';

  if (!id) return;

  if (!confirm('确定要删除「' + label + '」吗？此操作不可恢复。')) {
    return;
  }

  try {
    const db = getSupabase();
    if (!db) {
      showToast('Supabase 库未加载，请刷新页面');
      return;
    }

    const { error } = await db.from('courses').delete().eq('id', id);
    if (error) throw error;

    await logOperation('删除课程', label);

    closeDetailPage('detail-course-edit');
    navigateTo('courses');
    await refreshAfterCourseChanged();
    showToast('课程已删除');
  } catch (err) {
    console.error(err);
    showToast(err.message || '删除失败');
  }
}


async function onBulkConsumeCourse(e) {
  e.preventDefault();

  const courseId = document.getElementById('bulk-consume-course-id').value;
  const dateStr = document.getElementById('bulk-consume-date').value;
  const checkboxes = Array.from(document.querySelectorAll('#bulk-consume-students-list input[name="bulk-consume-student"]'));

  if (!courseId) return;

  if (!dateStr) {
    showToast('请选择日期');
    return;
  }

  if (!checkboxes.length) {
    showToast('本课程暂无学员');
    return;
  }

  try {
    const db = getSupabase();
    if (!db) {
      showToast('Supabase 库未加载，请刷新页面');
      return;
    }

    let skippedAttend = 0;
    let presentCount = 0;
    let absentCount = 0;

    for (const checkbox of checkboxes) {
      const enrollmentId = checkbox.value;
      const studentId = checkbox.dataset.studentId;
      const remaining = parseInt(checkbox.dataset.remaining, 10) || 0;
      const isPresent = checkbox.checked;

      if (isPresent) {
        if (remaining < 1) {
          skippedAttend++;
          continue;
        }

        presentCount++;

        const { error: recordError } = await db.from('lesson_records').insert({
          student_id: studentId,
          course_id: courseId,
          consumed_at: dateStr,
          status: '上课'
        });
        if (recordError) throw recordError;

        const { error: updateError } = await db.from('course_students').update({
          remaining_lessons: remaining - 1
        }).eq('id', enrollmentId);
        if (updateError) throw updateError;
      } else {
        absentCount++;

        const { error: recordError } = await db.from('lesson_records').insert({
          student_id: studentId,
          course_id: courseId,
          consumed_at: dateStr,
          status: '请假'
        });
        if (recordError) throw recordError;
      }
    }

    const courseLabel = getCourseLabelById(courseId);
    await logOperation('批量消课', courseLabel + ' · ' + dateStr + ' · 到场' + presentCount + '人/请假' + absentCount + '人');

    closeModal('modal-bulk-consume');
    await refreshCourseStudentsCacheData();
    await openCourseDetailModal(courseId);

    if (skippedAttend > 0) {
      showToast('已跳过' + skippedAttend + '名课时不足的学员');
    } else {
      showToast('批量消课成功');
    }
  } catch (err) {
    console.error(err);
    showToast(err.message || '批量消课失败');
  }
}
