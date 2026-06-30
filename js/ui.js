function formatTime(timeStr) {
  if (!timeStr) return '';
  return String(timeStr).slice(0, 5);
}


function formatTimeRange(start, end) {
  return formatTime(start) + ' - ' + formatTime(end);
}


const STUDENT_INDEX_ALPHABET = 'ABCDEFGHJKLMNOPQRSTWXYZ'.split('');
const PINYIN_INITIAL_BOUNDARIES = '啊八嚓哒妸发旮哈讥喀垃妈拏噢妑七呥撒塌挖昔压匝';


function getStudentNameInitial(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return null;

  const firstChar = trimmed.charAt(0);
  if (/^[A-Za-z]$/.test(firstChar)) {
    return firstChar.toUpperCase();
  }

  if (!/[\u4e00-\u9fff]/.test(firstChar)) {
    return null;
  }

  for (let i = PINYIN_INITIAL_BOUNDARIES.length - 1; i >= 0; i--) {
    if (firstChar.localeCompare(PINYIN_INITIAL_BOUNDARIES[i], 'zh-CN') >= 0) {
      return STUDENT_INDEX_ALPHABET[i];
    }
  }

  return 'A';
}


function groupStudentsByInitial(students) {
  const groups = new Map();

  students.forEach(student => {
    const initial = getStudentNameInitial(student.name);
    const letter = initial && STUDENT_INDEX_ALPHABET.includes(initial) ? initial : '#';
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter).push(student);
  });

  return groups;
}


function formatCompactTimeRange(start, end) {
  const startStr = formatTime(start);
  const endStr = formatTime(end);
  if (startStr && endStr) return startStr + '-' + endStr;
  return startStr || endStr || '';
}


function formatWeekdays(days) {
  if (!days || !days.length) return '—';
  return [...days].sort((a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b)).join('、');
}


function formatCourseListWeekdays(days) {
  if (!days || !days.length) return '—';

  const sorted = [...new Set(days)].sort((a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b));
  const workdays = ['周一', '周二', '周三', '周四', '周五'];
  const weekend = ['周六', '周日'];

  if (sorted.length === 7 && WEEKDAY_ORDER.every(d => sorted.includes(d))) {
    return '每天';
  }
  if (sorted.length === 5 && workdays.every(d => sorted.includes(d))) {
    return '工作日';
  }
  if (sorted.length === 2 && weekend.every(d => sorted.includes(d))) {
    return '周末';
  }

  return sorted.join('、');
}


function formatStudentCourseSchedule(enrollment) {
  const days = formatCourseListWeekdays(enrollment.weekdays);
  const start = formatTime(enrollment.startTime);
  const end = formatTime(enrollment.endTime);
  const time = start && end ? start + '-' + end : '';

  if (days === '—' && !time) return '—';
  if (days === '—') return time;
  if (!time) return days;
  return days + ' ' + time;
}


function getSelectedWeekdays(containerId) {
  return Array.from(document.querySelectorAll(containerId + ' input[name="weekday"]:checked'))
    .map(el => el.value);
}


function setWeekdayCheckboxes(containerId, days) {
  document.querySelectorAll(containerId + ' input[name="weekday"]').forEach(cb => {
    cb.checked = days.includes(cb.value);
  });
}


function validateCourseTimes(startTime, endTime) {
  if (!startTime || !endTime) return false;
  return startTime < endTime;
}


function timeToMinutes(timeStr) {
  const t = formatTime(timeStr);
  if (!t) return 0;
  const parts = t.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}


function renderListEmptyHtml(message) {
  return `<div class="list-empty">${escapeHtml(message)}</div>`;
}


function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}


function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}


function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  if (!document.querySelector('.modal-overlay.open')) {
    document.body.style.overflow = '';
  }
}


function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
  document.body.style.overflow = '';
}


function updateDetailPageScrollLock() {
  const detailVisible = !!document.querySelector('.detail-page.is-visible');
  document.documentElement.classList.toggle('detail-page-open', detailVisible);
  document.body.classList.toggle('detail-page-open', detailVisible);
}


function getTopDetailPageZIndex() {
  let top = DETAIL_PAGE_BASE_Z_INDEX;
  document.querySelectorAll('.detail-page.is-visible').forEach(page => {
    const value = parseInt(page.style.zIndex, 10);
    if (!Number.isNaN(value) && value > top) top = value;
  });
  return top;
}


function getTopOpenDetailPage() {
  let topPage = null;
  let topZ = -1;

  document.querySelectorAll('.detail-page.is-open').forEach(page => {
    const z = parseInt(page.style.zIndex, 10) || DETAIL_PAGE_BASE_Z_INDEX;
    if (z >= topZ) {
      topZ = z;
      topPage = page;
    }
  });

  return topPage;
}


function isDetailSwipeBlocked() {
  return !!document.querySelector('.modal-overlay.open');
}


function lockDetailPageScroll(page) {
  const inner = page.querySelector('.detail-page-inner');
  if (!inner) return null;

  const scrollTop = inner.scrollTop;
  inner.classList.add('is-swipe-scroll-locked');
  inner.dataset.swipeScrollTop = String(scrollTop);
  return { inner, scrollTop };
}


function pinDetailPageScroll(scrollLock) {
  if (!scrollLock) return;
  scrollLock.inner.scrollTop = scrollLock.scrollTop;
}


function releaseDetailPageScrollLock(page) {
  if (!page) return;

  page.classList.remove('is-swipe-scroll-locked');

  const inner = page.querySelector('.detail-page-inner.is-swipe-scroll-locked');
  if (!inner) return;

  const scrollTop = parseInt(inner.dataset.swipeScrollTop || '0', 10);
  inner.classList.remove('is-swipe-scroll-locked');
  inner.scrollTop = scrollTop;
  delete inner.dataset.swipeScrollTop;
}


function applySwipeDragOffset(dx, width) {
  const safeDx = Math.max(0, dx);
  const freeLimit = width * DETAIL_SWIPE_RUBBER_BAND_START;
  if (safeDx <= freeLimit) return safeDx;
  return freeLimit + (safeDx - freeLimit) * DETAIL_SWIPE_RUBBER_BAND_FACTOR;
}


function getSwipeDismissDuration(fromOffset, width) {
  const remainingRatio = Math.max(0, Math.min(1, (width - fromOffset) / width));
  return Math.round(260 + remainingRatio * 180);
}


function bindDetailPageEdgeSwipe() {
  let swipeState = null;

  function resetSwipeState() {
    if (swipeState && swipeState.page) {
      releaseDetailPageScrollLock(swipeState.page);
    }
    swipeState = null;
  }

  function onSwipeStart(clientX, clientY, pointerId) {
    if (swipeState || isDetailSwipeBlocked()) return;

    const page = getTopOpenDetailPage();
    if (!page || clientX > DETAIL_SWIPE_EDGE_WIDTH) return;

    swipeState = {
      page,
      pageId: page.id,
      pointerId,
      startX: clientX,
      startY: clientY,
      startTime: Date.now(),
      lastX: clientX,
      lastTime: Date.now(),
      dragging: false,
      scrollLock: null,
      width: window.innerWidth
    };
  }

  function onSwipeMove(clientX, clientY, pointerId) {
    if (!swipeState || swipeState.pointerId !== pointerId) return;

    const { page, startX, startY, width } = swipeState;
    const dx = clientX - startX;
    const dy = clientY - startY;

    if (!swipeState.dragging) {
      if (dx <= 0 || Math.abs(dx) < 6) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        resetSwipeState();
        return;
      }

      swipeState.dragging = true;
      swipeState.scrollLock = lockDetailPageScroll(page);
      page.classList.add('is-swipe-dragging', 'is-swipe-scroll-locked');
      if (page.setPointerCapture) {
        try {
          page.setPointerCapture(pointerId);
        } catch (err) {
          /* ignore */
        }
      }
    }

    pinDetailPageScroll(swipeState.scrollLock);

    swipeState.lastX = clientX;
    swipeState.lastTime = Date.now();

    const offset = applySwipeDragOffset(dx, width);
    page.style.transform = 'translate3d(' + offset + 'px, 0, 0)';
  }

  function shouldDismissSwipe(dx, width, startTime, startX, clientX, lastX, lastTime) {
    const threshold = Math.max(DETAIL_SWIPE_TRIGGER_MIN, width * DETAIL_SWIPE_TRIGGER_RATIO);
    if (dx >= threshold) return true;

    const flickDt = Math.max(1, Date.now() - lastTime);
    const flickVelocity = (clientX - lastX) / flickDt;
    const overallVelocity = dx / Math.max(1, Date.now() - startTime);

    return Math.max(flickVelocity, overallVelocity) >= DETAIL_SWIPE_VELOCITY_MIN
      && dx >= DETAIL_SWIPE_TRIGGER_MIN * 0.55;
  }

  function onSwipeEnd(clientX, pointerId) {
    if (!swipeState || swipeState.pointerId !== pointerId) return;

    const { page, dragging, startX, startTime, lastX, lastTime, width } = swipeState;
    const dx = clientX - startX;
    const dismiss = dragging && shouldDismissSwipe(dx, width, startTime, startX, clientX, lastX, lastTime);
    const dragOffset = applySwipeDragOffset(dx, width);
    resetSwipeState();

    if (!dragging) return;

    page.classList.remove('is-swipe-dragging');

    if (dismiss) {
      closeDetailPage(page.id, { fromSwipeOffset: dragOffset });
      return;
    }

    page.classList.add('is-swipe-rebound');
    page.style.transform = 'translate3d(0, 0, 0)';

    const onReboundEnd = (e) => {
      if (e.target !== page || e.propertyName !== 'transform') return;
      page.removeEventListener('transitionend', onReboundEnd);
      page.classList.remove('is-swipe-rebound');
      page.style.transform = '';
      page.style.transitionDuration = '';
    };

    page.addEventListener('transitionend', onReboundEnd);
    setTimeout(() => {
      page.removeEventListener('transitionend', onReboundEnd);
      page.classList.remove('is-swipe-rebound');
      page.style.transitionDuration = '';
      if (page.classList.contains('is-open')) page.style.transform = '';
    }, 460);
  }

  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    onSwipeStart(e.clientX, e.clientY, e.pointerId);
  });

  document.addEventListener('pointermove', (e) => {
    if (!swipeState || swipeState.pointerId !== e.pointerId) return;

    const dx = e.clientX - swipeState.startX;
    const dy = Math.abs(e.clientY - swipeState.startY);
    if (swipeState.dragging || (dx > 0 && dx >= dy)) {
      e.preventDefault();
    }

    onSwipeMove(e.clientX, e.clientY, e.pointerId);
  }, { passive: false });

  document.addEventListener('pointerup', (e) => {
    if (!swipeState || swipeState.pointerId !== e.pointerId) return;
    onSwipeEnd(e.clientX, e.pointerId);
  });

  document.addEventListener('pointercancel', (e) => {
    if (!swipeState || swipeState.pointerId !== e.pointerId) return;
    const page = swipeState.page;
    resetSwipeState();
    if (!page || !page.classList.contains('is-open')) return;
    page.classList.remove('is-swipe-dragging');
    page.style.transform = '';
  });
}


function openDetailPage(pageId) {
  const page = document.getElementById(pageId);
  if (!page) return;

  const inner = page.querySelector('.detail-page-inner');
  if (inner) inner.scrollTop = 0;

  page.style.zIndex = String(getTopDetailPageZIndex() + 1);
  page.classList.add('is-visible');
  page.setAttribute('aria-hidden', 'false');
  updateDetailPageScrollLock();

  requestAnimationFrame(() => {
    page.classList.add('is-open');
  });
}


function closeDetailPage(pageId, options = {}) {
  const { fromSwipeOffset = 0 } = options;
  const page = document.getElementById(pageId);
  if (!page || !page.classList.contains('is-open')) return;

  if (pageId === 'detail-student') {
    exitStudentDetailEditMode();
    currentStudentDetailId = null;
    studentDetailData = { records: [], courses: [] };
  }

  if (pageId === 'detail-course') {
    currentCourseDetailId = null;
  }

  if (pageId === 'detail-teacher') {
    exitTeacherDetailEditMode();
    currentTeacherDetailId = null;
    teacherDetailData = { courses: [] };
  }

  if (pageId === 'detail-changelog-entry') {
    exitChangelogEntryEditMode();
    currentChangelogEntryId = null;
    currentChangelogEntryData = null;
  }

  if (pageId === 'detail-changelog') {
    updateChangelogFabVisibility();
  }

  if (pageId === 'detail-changelog-form') {
    updateChangelogFabVisibility();
  }

  if (pageId === 'detail-teachers') {
    updateFabVisibility(getActiveMainPage());
  }

  page.classList.remove('is-open', 'is-swipe-dragging');
  page.setAttribute('aria-hidden', 'true');

  const finishClose = () => {
    page.classList.remove('is-visible', 'is-swipe-rebound', 'is-swipe-dismiss');
    page.style.transform = '';
    page.style.transitionDuration = '';
    page.style.zIndex = '';
    updateDetailPageScrollLock();
    updateFabVisibility(getActiveMainPage());
    updateChangelogFabVisibility();
  };

  const onTransitionEnd = (e) => {
    if (e.target !== page || e.propertyName !== 'transform') return;
    page.removeEventListener('transitionend', onTransitionEnd);
    finishClose();
  };

  page.addEventListener('transitionend', onTransitionEnd);

  const width = window.innerWidth;
  const startOffset = fromSwipeOffset > 0 ? fromSwipeOffset : 0;
  page.classList.add('is-swipe-dismiss');
  page.style.transitionDuration = getSwipeDismissDuration(startOffset, width) + 'ms';
  page.style.transform = 'translate3d(' + startOffset + 'px, 0, 0)';

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      page.style.transform = 'translate3d(100%, 0, 0)';
    });
  });

  setTimeout(() => {
    if (page.classList.contains('is-visible') && !page.classList.contains('is-open')) {
      page.removeEventListener('transitionend', onTransitionEnd);
      finishClose();
    }
  }, getSwipeDismissDuration(startOffset, width) + 80);

  updateFabVisibility(getActiveMainPage());
  updateChangelogFabVisibility();
}


function getActiveMainPage() {
  const activePage = document.querySelector('.page.active');
  if (!activePage) return 'students';
  return activePage.id.replace('page-', '');
}


function closeAllDetailPages() {
  ['detail-student', 'detail-course', 'detail-teacher', 'detail-teachers', 'detail-course-add', 'detail-course-edit', 'detail-changelog', 'detail-changelog-entry', 'detail-changelog-form', 'detail-operation-logs', 'detail-system-general', 'detail-system-privacy'].forEach(id => {
    const page = document.getElementById(id);
    if (!page) return;
    page.classList.remove('is-open', 'is-visible');
    page.style.zIndex = '';
    page.setAttribute('aria-hidden', 'true');
  });
  exitStudentDetailEditMode();
  exitTeacherDetailEditMode();
  currentStudentDetailId = null;
  currentTeacherDetailId = null;
  currentCourseDetailId = null;
  currentChangelogEntryId = null;
  currentChangelogEntryData = null;
  exitChangelogEntryEditMode();
  studentDetailData = { records: [], courses: [] };
  teacherDetailData = { courses: [] };
  updateDetailPageScrollLock();
  updateFabVisibility(getActiveMainPage());
  updateChangelogFabVisibility();
}


function isDetailPageOpen(pageId) {
  const page = document.getElementById(pageId);
  return page && page.classList.contains('is-open');
}


function isTeacherDetailPageActive() {
  const page = document.getElementById('detail-teacher');
  return page && page.classList.contains('is-visible');
}


function isOperationLogsPageActive() {
  const page = document.getElementById('detail-operation-logs');
  return page && page.classList.contains('is-visible');
}


function isTeachersListPageActive() {
  const page = document.getElementById('detail-teachers');
  return page && page.classList.contains('is-visible');
}


function updateFabVisibility(page) {
  const studentDetailOpen = isDetailPageOpen('detail-student');
  const teacherDetailOpen = isTeacherDetailPageActive();
  const changelogOpen = isChangelogListPageActive()
    || isChangelogEntryPageActive()
    || isChangelogFormPageActive();
  const overlayDetailOpen = changelogOpen || isOperationLogsPageActive();
  const teachersListOpen = isTeachersListPageActive();
  document.getElementById('fab-add-student').classList.toggle('visible', page === 'students' && !studentDetailOpen && !overlayDetailOpen);
  document.getElementById('fab-add-course').classList.toggle('visible', page === 'courses' && !overlayDetailOpen);
  document.getElementById('fab-add-teacher').classList.toggle('visible', teachersListOpen && !teacherDetailOpen && !overlayDetailOpen);
}


function setStudentDetailEditButtonLabel(label) {
  const btn = document.getElementById('btn-student-detail-edit');
  if (!btn) return;
  btn.textContent = label;
}


function exitStudentDetailEditMode() {
  studentDetailEditMode = false;
  setStudentDetailEditButtonLabel('编辑');
}


function enterStudentDetailEditMode() {
  if (!currentStudentDetailId) return;

  const student = coreDataCache.students.find(s => s.id === currentStudentDetailId);
  if (!student) return;

  studentDetailEditMode = true;
  renderStudentDetailUI(student, studentDetailData.records, studentDetailData.courses);
  setStudentDetailEditButtonLabel('取消');
}


function cancelStudentDetailEdit() {
  if (!currentStudentDetailId) return;

  const student = coreDataCache.students.find(s => s.id === currentStudentDetailId);
  if (!student) return;

  exitStudentDetailEditMode();
  renderStudentDetailUI(student, studentDetailData.records, studentDetailData.courses);
}


function toggleStudentDetailEditMode() {
  if (studentDetailEditMode) {
    cancelStudentDetailEdit();
  } else {
    enterStudentDetailEditMode();
  }
}


function setTeacherDetailEditButtonLabel(label) {
  const btn = document.getElementById('btn-teacher-detail-edit');
  if (!btn) return;
  btn.textContent = label;
}


function exitTeacherDetailEditMode() {
  teacherDetailEditMode = false;
  setTeacherDetailEditButtonLabel('编辑');
}


function enterTeacherDetailEditMode() {
  if (!currentTeacherDetailId) return;

  const teacher = coreDataCache.teachers.find(t => t.id === currentTeacherDetailId);
  if (!teacher) return;

  teacherDetailEditMode = true;
  renderTeacherDetailUI(teacher, teacherDetailData.courses);
  setTeacherDetailEditButtonLabel('取消');
}


function cancelTeacherDetailEdit() {
  if (!currentTeacherDetailId) return;

  const teacher = coreDataCache.teachers.find(t => t.id === currentTeacherDetailId);
  if (!teacher) return;

  exitTeacherDetailEditMode();
  renderTeacherDetailUI(teacher, teacherDetailData.courses);
}


function toggleTeacherDetailEditMode() {
  if (teacherDetailEditMode) {
    cancelTeacherDetailEdit();
  } else {
    enterTeacherDetailEditMode();
  }
}


function updateWeekPageScrollLock(active) {
  document.documentElement.classList.toggle('week-page-active', active);
  document.body.classList.toggle('week-page-active', active);
}


function navigateTo(page) {
  if (!['students', 'week', 'courses', 'system'].includes(page)) return;

  closeAllDetailPages();
  updateWeekPageScrollLock(page === 'week');

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.tab-bar-item').forEach(tab => {
    const isActive = tab.dataset.page === page;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  updateFabVisibility(page);
  if (page === 'students') {
    renderStudentsPage();
  }
  if (page === 'week') {
    renderWeekPage();
  }
  if (page === 'courses') {
    renderCoursesPage();
  }
  if (page === 'system') {
    renderSystemPage();
  }
}


function bindClickableRow(listEl, selector, openFn) {
  listEl.querySelectorAll(selector).forEach(el => {
    el.addEventListener('click', () => openFn(el.dataset.id));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openFn(el.dataset.id);
      }
    });
  });
}


function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}


function formatPhoneDigitsHtml(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';

  const groups = digits.length === 11
    ? [digits.slice(0, 3), digits.slice(3, 7), digits.slice(7, 11)]
    : [digits];

  return groups.map((group, index) => {
    const gap = index > 0 ? '<span class="phone-digit-gap" aria-hidden="true"></span>' : '';
    const digitSpans = group.split('').map(digit => `<span class="phone-digit">${escapeHtml(digit)}</span>`).join('');
    return gap + digitSpans;
  }).join('');
}


function isDarkModeActive() {
  const theme = document.documentElement.getAttribute('data-theme');
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}


function setThemePreference(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  if (typeof updateSystemThemeUI === 'function') {
    updateSystemThemeUI();
  }
}


function getTodayDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}


function buildConsumedAtDate(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  return dateStr;
}


function formatConsumedAt(isoStr) {
  if (!isoStr) return '—';
  const str = String(isoStr);
  const datePart = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (datePart) return datePart[1];
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '—';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}


function getCurrentOperatorPhone() {
  return normalizePhone(localStorage.getItem(ADMIN_AUTH_STORAGE_KEY));
}


function canViewOperationLogs() {
  return !!getCurrentOperatorPhone();
}


function initLucideIcons() {
  if (window.lucide && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
}


function preventViewportZoom() {
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(eventName => {
    document.addEventListener(eventName, (e) => e.preventDefault(), { passive: false });
  });
}
