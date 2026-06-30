function bindEvents() {
  document.getElementById('form-admin-login').addEventListener('submit', onAdminLoginSubmit);
  document.getElementById('admin-login-phone').addEventListener('input', hideAdminLoginError);
  bindNavbarMenu();
  bindDetailPageEdgeSwipe();

  document.querySelectorAll('.tab-bar-item').forEach(tab => {
    tab.addEventListener('click', () => navigateTo(tab.dataset.page));
  });

  const studentSearchInput = document.getElementById('student-search-input');
  if (studentSearchInput) {
    studentSearchInput.addEventListener('input', (e) => {
      studentSearchQuery = e.target.value;
      renderStudentListUI();
    });
  }

  document.getElementById('fab-add-student').addEventListener('click', () => {
    document.getElementById('form-add-student').reset();
    openModal('modal-add');
  });

  document.getElementById('detail-student').addEventListener('click', (e) => {
    const target = e.target.closest('#btn-student-detail-save, #btn-student-detail-delete');
    if (!target) return;
    if (target.id === 'btn-student-detail-save') saveStudentDetailEdit();
    if (target.id === 'btn-student-detail-delete') deleteStudentDetailStudent();
  });

  document.getElementById('btn-student-detail-edit').addEventListener('click', toggleStudentDetailEditMode);

  document.getElementById('detail-teacher').addEventListener('click', (e) => {
    const target = e.target.closest('#btn-teacher-detail-save, #btn-teacher-detail-delete');
    if (!target) return;
    if (target.id === 'btn-teacher-detail-save') saveTeacherDetailEdit();
    if (target.id === 'btn-teacher-detail-delete') deleteTeacherDetailTeacher();
  });

  document.getElementById('btn-teacher-detail-edit').addEventListener('click', toggleTeacherDetailEditMode);

  document.getElementById('detail-changelog-entry').addEventListener('click', (e) => {
    const target = e.target.closest('#btn-changelog-entry-save, #btn-changelog-entry-delete');
    if (!target) return;
    if (target.id === 'btn-changelog-entry-save') saveChangelogEntryInline();
    if (target.id === 'btn-changelog-entry-delete') deleteCurrentChangelogEntry();
  });

  document.getElementById('btn-changelog-entry-edit').addEventListener('click', toggleChangelogEntryEditMode);

  document.getElementById('btn-course-detail-consume').addEventListener('click', () => {
    if (currentCourseDetailId) openBulkConsumeModal(currentCourseDetailId);
  });

  document.getElementById('fab-add-course').addEventListener('click', () => {
    openAddCoursePage();
  });

  document.getElementById('fab-add-teacher').addEventListener('click', () => {
    document.getElementById('form-add-teacher').reset();
    openModal('modal-add-teacher');
  });

  const fabChangelogAdd = document.getElementById('fab-changelog-add');
  if (fabChangelogAdd) {
    fabChangelogAdd.addEventListener('click', openAddChangelogPage);
  }

  const formChangelog = document.getElementById('form-changelog');
  if (formChangelog) {
    formChangelog.addEventListener('submit', onChangelogFormSubmit);
  }

  document.querySelectorAll('[data-close]').forEach(el => {
    el.addEventListener('click', () => closeModal(el.dataset.close));
  });

  document.querySelectorAll('[data-detail-back]').forEach(btn => {
    btn.addEventListener('click', () => closeDetailPage(btn.dataset.detailBack));
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  document.getElementById('form-add-student').addEventListener('submit', onAddStudent);
  document.getElementById('form-consume-lesson').addEventListener('submit', onConsumeLesson);
  document.getElementById('form-bulk-consume').addEventListener('submit', onBulkConsumeCourse);
  document.getElementById('form-makeup-lesson').addEventListener('submit', onMakeupLesson);
  document.getElementById('form-add-course-student').addEventListener('submit', onAddCourseStudentToCourse);
  document.getElementById('form-edit-student-course').addEventListener('submit', onEditStudentCourse);
  document.getElementById('btn-remove-student-course').addEventListener('click', onRemoveStudentCourseFromEdit);
  document.getElementById('form-add-student-course').addEventListener('submit', onAddStudentCourse);
  document.getElementById('form-add-course').addEventListener('submit', onAddCourse);
  document.getElementById('form-edit-course').addEventListener('submit', onEditCourse);
  document.getElementById('btn-delete-course').addEventListener('click', onDeleteCourseFromEdit);
  bindCourseClassSizeToggle('course-class-size', 'course-season-group', 'course-season');
  bindCourseClassSizeToggle('edit-course-class-size', 'edit-course-season-group', 'edit-course-season');
  document.getElementById('form-add-teacher').addEventListener('submit', onAddTeacher);

  const exportDataBtn = document.getElementById('btn-export-data');
  if (exportDataBtn) {
    exportDataBtn.addEventListener('click', exportAllAdminData);
  }
}


function runSplashScreen(onComplete) {
  const splash = document.getElementById('splash-screen');
  if (!splash) {
    if (onComplete) onComplete();
    return;
  }

  const LOGO_ANIM_MS = 800;
  const HOLD_MS = 1000;
  const FADE_OUT_MS = 600;

  setTimeout(() => {
    splash.classList.add('is-exiting');
    splash.setAttribute('aria-hidden', 'true');

    setTimeout(() => {
      splash.remove();
      document.body.classList.remove('splash-active');
      if (onComplete) onComplete();
    }, FADE_OUT_MS);
  }, LOGO_ANIM_MS + HOLD_MS);
}


function hasAdminSession() {
  return !!localStorage.getItem(ADMIN_AUTH_STORAGE_KEY);
}


function saveAdminSession(phone) {
  localStorage.setItem(ADMIN_AUTH_STORAGE_KEY, normalizePhone(phone));
}


function clearAdminSession() {
  localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
}


function logoutAdmin() {
  clearAdminSession();
  closeAllModals();
  closeAllDetailPages();
  document.body.style.overflow = '';
  document.getElementById('admin-login-phone').value = '';
  hideAdminLoginError();
  showAdminLoginScreen();
  initLucideIcons();
}


function showAdminLoginScreen() {
  document.getElementById('app-shell').classList.remove('visible');
  document.getElementById('login-screen').classList.remove('hidden');
}


function hideAdminLoginError() {
  const errEl = document.getElementById('admin-login-error');
  errEl.textContent = '无访问权限，请联系管理员';
  errEl.classList.remove('visible');
}


function showAdminLoginError() {
  document.getElementById('admin-login-error').classList.add('visible');
}


async function enterAdminApp(phone, preloadPromise) {
  saveAdminSession(phone);
  hideAdminLoginError();
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-shell').classList.add('visible');
  initLucideIcons();
  updateNavbarMenuVisibility();

  try {
    if (preloadPromise) {
      await preloadPromise;
    } else if (!coreDataCache.loaded && getSupabase()) {
      await preloadCoreData();
    }
  } catch (err) {
    console.error(err);
    showToast(err.message || '数据加载失败，请刷新页面重试');
  }

  navigateTo('week');
}


function startAdminApp(preloadPromise) {
  if (hasAdminSession()) {
    enterAdminApp(localStorage.getItem(ADMIN_AUTH_STORAGE_KEY), preloadPromise);
    return;
  }

  showAdminLoginScreen();
}


async function onAdminLoginSubmit(e) {
  e.preventDefault();
  hideAdminLoginError();

  const phoneInput = document.getElementById('admin-login-phone');
  const phone = normalizePhone(phoneInput.value);
  if (!phone) return;

  const btn = document.getElementById('btn-admin-login');
  btn.disabled = true;
  btn.textContent = '验证中...';

  try {
    const db = getSupabase();
    if (!db) {
      const errEl = document.getElementById('admin-login-error');
      errEl.textContent = '网络加载失败，请刷新页面';
      errEl.classList.add('visible');
      return;
    }

    const allowed = await isPhoneAllowedForAdmin(phone);
    if (allowed) {
      await preloadCoreData().catch(err => console.error(err));
      enterAdminApp(phone);
    } else {
      showAdminLoginError();
    }
  } catch (err) {
    console.error(err);
    const errEl = document.getElementById('admin-login-error');
    errEl.textContent = err.message || '验证失败，请稍后重试';
    errEl.classList.add('visible');
  } finally {
    btn.disabled = false;
    btn.textContent = '确认';
  }
}


function initApp() {
  preventViewportZoom();
  bindEvents();
  initLucideIcons();
  const preloadPromise = hasAdminSession() && getSupabase()
    ? preloadCoreData().catch(err => {
        console.error('预加载核心数据失败', err);
        return false;
      })
    : null;
  runSplashScreen(() => startAdminApp(preloadPromise));
}
