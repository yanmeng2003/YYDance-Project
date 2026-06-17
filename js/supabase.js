const SUPABASE_URL = 'https://dcjqllqpzihbjjoytrzt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjanFsbHFwemloYmpqb3l0cnp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MzE0ODAsImV4cCI6MjA5NTMwNzQ4MH0.EACmM5pQlZ2K-EaM-S5lmM91Uq5aL5Q_tIMRJmcaf30';

const ADMIN_AUTH_STORAGE_KEY = 'yydance_admin_auth_phone';
const THEME_STORAGE_KEY = 'yydance_admin_theme';
const ADMIN_EXTRA_ALLOWED_PHONE = '18015208086';

const WEEKDAY_ORDER = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const WEEK_GRID_START_MIN = 8 * 60;
const WEEK_GRID_END_MIN = 20 * 60;
const WEEK_SLOT_MINUTES = 30;
const WEEK_SLOT_HEIGHT = 28;
const WEEK_SLOT_COUNT = (WEEK_GRID_END_MIN - WEEK_GRID_START_MIN) / WEEK_SLOT_MINUTES;
const WEEK_VIEW_PAD_Y = 10;
const WEEK_GRID_HEIGHT = WEEK_SLOT_COUNT * WEEK_SLOT_HEIGHT;

const TEACHER_COLOR_PALETTE = [
  { bg: '#e8daef', border: '#9b59b6', text: '#5b2c6f' },
  { bg: '#fce4ec', border: '#e91e8c', text: '#880e4f' },
  { bg: '#d5f5e3', border: '#27ae60', text: '#1e5631' },
  { bg: '#fdebd0', border: '#e67e22', text: '#7e5109' },
  { bg: '#d6eaf8', border: '#3498db', text: '#1a5276' },
  { bg: '#fcf3cf', border: '#f1c40f', text: '#7d6608' },
  { bg: '#e8f8f5', border: '#1abc9c', text: '#0e6251' },
  { bg: '#f5eef8', border: '#8e44ad', text: '#4a235a' },
  { bg: '#fdedec', border: '#e74c3c', text: '#78281f' },
  { bg: '#ebf5fb', border: '#5dade2', text: '#1b4f72' }
];

const DEFAULT_COURSE_COLOR = { bg: '#f4f2f6', border: '#a89bb0', text: '#4a3f52' };

const COURSE_TYPES = ['摩登舞', '拉丁舞'];
const COURSE_STATUSES = ['待开课', '开课中', '已结课'];
const LESSON_RECORD_STATUSES = ['上课', '请假', '补课'];

let coursesViewTab = 'week';

let supabaseClient = null;
const coreDataCache = {
  students: [],
  courses: [],
  teachers: [],
  courseStudents: [],
  loaded: false,
  loading: null
};
let studentsRenewalSet = new Set();
let studentSeasonsMap = new Map();
let studentSearchQuery = '';
let studentDetailEditMode = false;
let currentStudentDetailId = null;
let currentCourseDetailId = null;
let studentDetailData = { records: [], courses: [] };
let teacherDetailEditMode = false;
let currentTeacherDetailId = null;
let teacherDetailData = { courses: [] };

const DETAIL_PAGE_BASE_Z_INDEX = 200;
const DETAIL_SWIPE_EDGE_WIDTH = 28;
const DETAIL_SWIPE_TRIGGER_RATIO = 0.16;
const DETAIL_SWIPE_TRIGGER_MIN = 44;
const DETAIL_SWIPE_VELOCITY_MIN = 0.32;
const DETAIL_SWIPE_RUBBER_BAND_START = 0.72;
const DETAIL_SWIPE_RUBBER_BAND_FACTOR = 0.28;

const RENEWAL_LESSONS_THRESHOLD = 3;
const SEASON_TERM_ORDER = { '春季': 0, '暑期': 1, '秋季': 2 };


function initSupabaseClient() {
  const lib = window.supabase || globalThis.supabase;
  if (!lib) return null;
  if (typeof lib.createClient === 'function') {
    return lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return null;
}


function getSupabase() {
  if (!supabaseClient) {
    supabaseClient = initSupabaseClient();
  }
  return supabaseClient;
}


function mapStudent(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    wechat: row.wechat || ''
  };
}


async function fetchStudents() {
  const db = getSupabase();
  if (!db) throw new Error('Supabase 库未加载，请检查网络后刷新页面');

  const { data, error } = await db
    .from('students')
    .select('id, name, phone, wechat')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapStudent);
}


async function isPhoneTaken(phone, excludeId) {
  if (!phone) return false;

  const db = getSupabase();
  if (!db) throw new Error('Supabase 库未加载');

  let query = db
    .from('students')
    .select('id')
    .eq('phone', phone);

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data, error } = await query.limit(1);
  if (error) throw error;
  return data && data.length > 0;
}


function mapLessonRecord(row) {
  const course = row.courses;
  return {
    id: row.id,
    studentId: row.student_id,
    courseId: row.course_id || null,
    consumedAt: row.consumed_at,
    status: normalizeLessonRecordStatus(row.status),
    courseType: course ? (course.course_type || '') : '',
    courseName: course ? (course.name || '') : '',
    classSize: course ? (course.class_size || '大课') : '大课',
    season: course ? (course.season || '') : ''
  };
}


async function fetchLessonRecords(studentId) {
  const db = getSupabase();
  if (!db) throw new Error('Supabase 库未加载');

  const { data, error } = await db
    .from('lesson_records')
    .select('id, student_id, course_id, consumed_at, status, courses(course_type, name, class_size, season)')
    .eq('student_id', studentId)
    .order('consumed_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapLessonRecord);
}


function mapTeacher(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    wechat: row.wechat || '',
    notes: row.notes || '',
    createdAt: row.created_at
  };
}


async function fetchTeachers() {
  const db = getSupabase();
  if (!db) throw new Error('Supabase 库未加载，请检查网络后刷新页面');

  const { data, error } = await db
    .from('teachers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapTeacher);
}


function mapCourse(row) {
  const teacher = row.teachers;
  return {
    id: row.id,
    courseType: row.course_type || '摩登舞',
    name: row.name,
    classSize: row.class_size || '大课',
    season: row.season || '',
    status: normalizeCourseStatus(row.status),
    weekdays: row.weekdays || [],
    startTime: row.start_time,
    endTime: row.end_time,
    teacherId: row.teacher_id || null,
    teacherName: teacher ? teacher.name : null
  };
}


function normalizeCourseStatus(status) {
  return COURSE_STATUSES.includes(status) ? status : '开课中';
}


function isActiveCourse(course) {
  return normalizeCourseStatus(course.status) === '开课中';
}


async function fetchCourses() {
  const db = getSupabase();
  if (!db) throw new Error('Supabase 库未加载，请检查网络后刷新页面');

  const { data, error } = await db
    .from('courses')
    .select('*, teachers(id, name)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapCourse);
}


function mapCourseStudent(row) {
  const student = row.students;
  return {
    id: row.id,
    courseId: row.course_id,
    studentId: row.student_id,
    studentName: student ? student.name : '未知学员',
    remainingLessons: row.remaining_lessons ?? 0
  };
}


async function fetchAllCourseStudents() {
  const db = getSupabase();
  if (!db) throw new Error('Supabase 库未加载');

  const { data, error } = await db
    .from('course_students')
    .select('id, course_id, student_id, remaining_lessons, students(id, name), courses(id, course_type, name, class_size, season, weekdays, start_time, end_time)');

  if (error) throw error;
  return (data || []).map(mapCoreEnrollment);
}


function mapCoreEnrollment(row) {
  const student = row.students;
  const course = row.courses;
  return {
    id: row.id,
    courseId: row.course_id,
    studentId: row.student_id,
    studentName: student ? student.name : '未知学员',
    remainingLessons: row.remaining_lessons ?? 0,
    courseType: course ? (course.course_type || '摩登舞') : '摩登舞',
    courseName: course ? course.name : '—',
    classSize: course ? (course.class_size || '大课') : '大课',
    season: course ? (course.season || '') : '',
    weekdays: course ? (course.weekdays || []) : [],
    startTime: course ? course.start_time : null,
    endTime: course ? course.end_time : null
  };
}


function getCourseStudentsFromCache(courseId) {
  return sortEnrollmentsByStudentName(
    coreDataCache.courseStudents
      .filter(item => item.courseId === courseId)
      .map(item => ({
        id: item.id,
        courseId: item.courseId,
        studentId: item.studentId,
        studentName: item.studentName,
        remainingLessons: item.remainingLessons
      }))
  );
}


function getStudentCoursesFromCache(studentId) {
  return coreDataCache.courseStudents
    .filter(item => item.studentId === studentId)
    .map(item => ({
      enrollmentId: item.id,
      courseId: item.courseId,
      courseType: item.courseType,
      name: item.courseName,
      classSize: item.classSize,
      season: item.season,
      weekdays: item.weekdays,
      startTime: item.startTime,
      endTime: item.endTime,
      remainingLessons: item.remainingLessons
    }));
}


function rebuildStudentTagsFromCache() {
  const temp = new Map();
  coreDataCache.courseStudents.forEach(row => {
    if (!isLargeClassCourse(row.classSize)) return;
    const season = (row.season || '').trim();
    if (!season) return;
    if (!temp.has(row.studentId)) temp.set(row.studentId, new Set());
    temp.get(row.studentId).add(season);
  });

  const nextSeasons = new Map();
  temp.forEach((seasons, studentId) => {
    nextSeasons.set(studentId, Array.from(seasons).sort(compareSeason));
  });
  studentSeasonsMap = nextSeasons;

  const byStudent = new Map();
  coreDataCache.courseStudents.forEach(row => {
    if (!isLargeClassCourse(row.classSize)) return;
    if (!byStudent.has(row.studentId)) byStudent.set(row.studentId, []);
    byStudent.get(row.studentId).push({
      remaining_lessons: row.remainingLessons,
      courses: { class_size: row.classSize, season: row.season }
    });
  });

  const nextRenewal = new Set();
  byStudent.forEach((rows, studentId) => {
    if (rows.some(row => enrollmentRowNeedsRenewal(row, rows))) {
      nextRenewal.add(studentId);
    }
  });
  studentsRenewalSet = nextRenewal;
}


async function preloadCoreData() {
  if (coreDataCache.loaded) return true;
  if (coreDataCache.loading) return coreDataCache.loading;
  if (!getSupabase()) return false;

  coreDataCache.loading = (async () => {
    const [students, courses, teachers, courseStudents] = await Promise.all([
      fetchStudents(),
      fetchCourses(),
      fetchTeachers(),
      fetchAllCourseStudents()
    ]);

    coreDataCache.students = students;
    coreDataCache.courses = courses;
    coreDataCache.teachers = teachers;
    coreDataCache.courseStudents = courseStudents;
    rebuildStudentTagsFromCache();
    coreDataCache.loaded = true;
    return true;
  })().catch(err => {
    coreDataCache.loading = null;
    throw err;
  });

  return coreDataCache.loading;
}


async function refreshStudentsCacheData() {
  coreDataCache.students = await fetchStudents();
  if (document.getElementById('page-students').classList.contains('active')) {
    renderStudentListUI();
  }
}


async function refreshCoursesCacheData() {
  coreDataCache.courses = await fetchCourses();
  if (document.getElementById('page-courses').classList.contains('active')) {
    renderCourseListUI(coreDataCache.courses);
    renderWeekViewUI(coreDataCache.courses);
  }
}


async function refreshTeachersCacheData() {
  coreDataCache.teachers = await fetchTeachers();
  if (document.getElementById('page-teachers').classList.contains('active')) {
    renderTeacherListUI(coreDataCache.teachers);
  }
}


async function refreshCourseStudentsCacheData() {
  coreDataCache.courseStudents = await fetchAllCourseStudents();
  rebuildStudentTagsFromCache();
  if (document.getElementById('page-students').classList.contains('active')) {
    renderStudentListUI();
  }
  if (document.getElementById('page-courses').classList.contains('active')) {
    renderCourseListUI(coreDataCache.courses);
    renderWeekViewUI(coreDataCache.courses);
  }
}


function renderStudentsPage() {
  renderStudentListUI();
}


function renderCoursesPage() {
  renderCourseListUI(coreDataCache.courses);
  renderWeekViewUI(coreDataCache.courses);
}


function renderTeachersPage() {
  renderTeacherListUI(coreDataCache.teachers);
}


async function refreshAfterTeacherChanged() {
  await refreshTeachersCacheData();
  await refreshCoursesCacheData();
}


async function refreshAfterCourseChanged() {
  await refreshCoursesCacheData();
  await refreshCourseStudentsCacheData();
}


async function refreshAfterStudentChanged() {
  await refreshStudentsCacheData();
  await refreshCourseStudentsCacheData();
}


async function fetchCourseStudents(courseId) {
  if (coreDataCache.loaded) {
    return getCourseStudentsFromCache(courseId);
  }

  const db = getSupabase();
  if (!db) throw new Error('Supabase 库未加载');

  const { data, error } = await db
    .from('course_students')
    .select('id, course_id, student_id, remaining_lessons, students(id, name)')
    .eq('course_id', courseId);

  if (error) throw error;
  return (data || []).map(mapCourseStudent);
}


async function fetchStudentCourses(studentId) {
  if (coreDataCache.loaded) {
    return getStudentCoursesFromCache(studentId);
  }

  const db = getSupabase();
  if (!db) throw new Error('Supabase 库未加载');

  const { data, error } = await db
    .from('course_students')
    .select('id, course_id, remaining_lessons, courses(id, course_type, name, class_size, season, weekdays, start_time, end_time)')
    .eq('student_id', studentId);

  if (error) throw error;
  return (data || []).map(mapStudentCourseEnrollment);
}


function mapStudentCourseEnrollment(row) {
  const course = row.courses;
  return {
    enrollmentId: row.id,
    courseId: row.course_id,
    courseType: course ? (course.course_type || '摩登舞') : '摩登舞',
    name: course ? course.name : '—',
    classSize: course ? (course.class_size || '大课') : '大课',
    season: course ? (course.season || '') : '',
    weekdays: course ? (course.weekdays || []) : [],
    startTime: course ? course.start_time : null,
    endTime: course ? course.end_time : null,
    remainingLessons: row.remaining_lessons ?? 0
  };
}


function isLargeClassCourse(classSize) {
  return (classSize || '大课') !== '小课';
}


function parseSeason(seasonStr) {
  if (!seasonStr) return null;
  const match = String(seasonStr).trim().match(/^(\d{4})(春季|暑期|秋季)$/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const term = match[2];
  return {
    year,
    term,
    sortKey: year * 3 + SEASON_TERM_ORDER[term]
  };
}


function compareSeason(seasonA, seasonB) {
  const a = parseSeason(seasonA);
  const b = parseSeason(seasonB);
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return a.sortKey - b.sortKey;
}


function isSeasonLaterThan(seasonA, seasonB) {
  return compareSeason(seasonA, seasonB) > 0;
}


function enrollmentRowNeedsRenewal(currentRow, largeClassRows) {
  if (!isLargeClassCourse(currentRow.courses?.class_size)) return false;
  if ((currentRow.remaining_lessons ?? 0) > RENEWAL_LESSONS_THRESHOLD) return false;

  const currentSeason = currentRow.courses?.season || '';
  const hasLaterSeason = largeClassRows.some(other => {
    if (other === currentRow) return false;
    return isSeasonLaterThan(other.courses?.season, currentSeason);
  });
  return !hasLaterSeason;
}


function courseEnrollmentNeedsRenewal(current, allLargeCourses) {
  if (!isLargeClassCourse(current.classSize)) return false;
  if ((current.remainingLessons ?? 0) > RENEWAL_LESSONS_THRESHOLD) return false;

  const currentSeason = current.season || '';
  const hasLaterSeason = allLargeCourses.some(other => {
    if (other.courseId === current.courseId) return false;
    return isSeasonLaterThan(other.season, currentSeason);
  });
  return !hasLaterSeason;
}


async function refreshStudentSeasonsMap() {
  try {
    const db = getSupabase();
    if (!db) {
      studentSeasonsMap = new Map();
      return;
    }

    const { data, error } = await db
      .from('course_students')
      .select('student_id, courses(class_size, season)');

    if (error) throw error;

    const temp = new Map();
    (data || []).forEach(row => {
      if (!isLargeClassCourse(row.courses?.class_size)) return;
      const season = (row.courses?.season || '').trim();
      if (!season) return;
      if (!temp.has(row.student_id)) temp.set(row.student_id, new Set());
      temp.get(row.student_id).add(season);
    });

    const next = new Map();
    temp.forEach((seasons, studentId) => {
      next.set(studentId, Array.from(seasons).sort(compareSeason));
    });
    studentSeasonsMap = next;
  } catch (err) {
    console.error(err);
    studentSeasonsMap = new Map();
  }
}


async function refreshStudentsRenewalSet() {
  try {
    const db = getSupabase();
    if (!db) {
      studentsRenewalSet = new Set();
      return;
    }

    const { data, error } = await db
      .from('course_students')
      .select('student_id, remaining_lessons, courses(class_size, season)');

    if (error) throw error;

    const byStudent = new Map();
    (data || []).forEach(row => {
      if (!isLargeClassCourse(row.courses?.class_size)) return;
      if (!byStudent.has(row.student_id)) byStudent.set(row.student_id, []);
      byStudent.get(row.student_id).push(row);
    });

    const next = new Set();
    byStudent.forEach((rows, studentId) => {
      if (rows.some(row => enrollmentRowNeedsRenewal(row, rows))) {
        next.add(studentId);
      }
    });
    studentsRenewalSet = next;
  } catch (err) {
    console.error(err);
    studentsRenewalSet = new Set();
  }
}


async function refreshStudentTagsData() {
  if (coreDataCache.loaded) {
    rebuildStudentTagsFromCache();
    return;
  }
  await refreshStudentSeasonsMap();
  await refreshStudentsRenewalSet();
}


function studentNeedsRenewalFromCourses(courses) {
  const largeCourses = (courses || []).filter(c => isLargeClassCourse(c.classSize));
  return largeCourses.some(c => courseEnrollmentNeedsRenewal(c, largeCourses));
}


function studentNeedsRenewalById(studentId) {
  return studentsRenewalSet.has(studentId);
}


function renewalBadgeHtml(show) {
  return show ? '<span class="renewal-badge">待续报</span>' : '';
}


function seasonBadgesHtml(studentId) {
  const seasons = studentSeasonsMap.get(studentId) || [];
  return seasons.map(season => `<span class="season-badge">${escapeHtml(season)}</span>`).join('');
}


function courseSeasonBadgeHtml(classSize, season) {
  const value = (season || '').trim();
  if (!isLargeClassCourse(classSize) || !value) return '';
  return `<span class="season-badge">${escapeHtml(value)}</span>`;
}


function updateCourseSeasonFieldVisibility(classSizeSelectId, seasonGroupId, seasonInputId) {
  const classSize = document.getElementById(classSizeSelectId).value;
  const group = document.getElementById(seasonGroupId);
  const input = document.getElementById(seasonInputId);
  const isLarge = isLargeClassCourse(classSize);

  group.classList.toggle('is-visible', isLarge);
  input.required = isLarge;
  if (!isLarge) input.value = '';
}


function bindCourseClassSizeToggle(classSizeSelectId, seasonGroupId, seasonInputId) {
  document.getElementById(classSizeSelectId).addEventListener('change', () => {
    updateCourseSeasonFieldVisibility(classSizeSelectId, seasonGroupId, seasonInputId);
  });
}


function sortStudentsForList(students) {
  return [...students].sort((a, b) => {
    const aRenewal = studentNeedsRenewalById(a.id);
    const bRenewal = studentNeedsRenewalById(b.id);
    if (aRenewal !== bRenewal) return aRenewal ? -1 : 1;
    return compareBySurnamePinyin(a.name, b.name);
  });
}

const PINNED_TEACHER_NAME = '陈毅';


function compareBySurnamePinyin(aName, bName) {
  const a = (aName || '').trim();
  const b = (bName || '').trim();
  const surnameCompare = getSurnameSortKey(a).localeCompare(getSurnameSortKey(b), 'zh-CN');
  if (surnameCompare !== 0) return surnameCompare;
  return a.localeCompare(b, 'zh-CN');
}


function getSurnameSortKey(name) {
  const trimmed = (name || '').trim();
  return trimmed ? trimmed.charAt(0) : '';
}


function sortTeachersForList(teachers) {
  return [...teachers].sort((a, b) => {
    const aPinned = (a.name || '').trim() === PINNED_TEACHER_NAME;
    const bPinned = (b.name || '').trim() === PINNED_TEACHER_NAME;
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    return compareBySurnamePinyin(a.name, b.name);
  });
}


function sortEnrollmentsByStudentName(enrollments) {
  return [...enrollments].sort((a, b) => compareBySurnamePinyin(a.studentName, b.studentName));
}


async function addCourseStudent(courseId, studentId, remainingLessons) {
  const db = getSupabase();
  if (!db) throw new Error('Supabase 库未加载');

  const { error } = await db.from('course_students').insert({
    course_id: courseId,
    student_id: studentId,
    remaining_lessons: remainingLessons
  });

  if (error) throw error;
}


async function removeCourseStudent(enrollmentId) {
  const db = getSupabase();
  if (!db) throw new Error('Supabase 库未加载');

  const { error } = await db.from('course_students').delete().eq('id', enrollmentId);
  if (error) throw error;
}


async function updateCourseStudentRemaining(enrollmentId, remainingLessons) {
  const db = getSupabase();
  if (!db) throw new Error('Supabase 库未加载');

  const { error } = await db.from('course_students').update({
    remaining_lessons: remainingLessons
  }).eq('id', enrollmentId);

  if (error) throw error;
}


async function ensureCoursesCache() {
  if (coreDataCache.loaded) return;
  await preloadCoreData();
}


function populateCourseStudentSelect(selectId, enrolledStudentIds) {
  const select = document.getElementById(selectId);
  if (!select) return false;

  const enrolled = new Set(enrolledStudentIds || []);
  const available = coreDataCache.students.filter(s => !enrolled.has(s.id));

  if (!available.length) {
    select.innerHTML = '<option value="">暂无可添加学员</option>';
    select.disabled = true;
    return false;
  }

  select.disabled = false;
  const sorted = sortStudentsBySurname(available);
  select.innerHTML = '<option value="">选择学员</option>' +
    sorted.map(s => `
      <option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>
    `).join('');
  return true;
}


function populateStudentCourseSelect(selectId, enrolledCourseIds) {
  const select = document.getElementById(selectId);
  if (!select) return false;

  const enrolled = new Set(enrolledCourseIds || []);
  const available = coreDataCache.courses.filter(c => !enrolled.has(c.id));

  if (!available.length) {
    select.innerHTML = '<option value="">暂无可添加课程</option>';
    select.disabled = true;
    return false;
  }

  select.disabled = false;
  select.innerHTML = '<option value="">选择课程</option>' +
    available.map(c => `
      <option value="${escapeHtml(c.id)}">${escapeHtml(c.courseType)} · ${escapeHtml(c.name)}</option>
    `).join('');
  return true;
}


function sortStudentsBySurname(students) {
  return [...students].sort((a, b) => compareBySurnamePinyin(a.name, b.name));
}


function populateTeacherSelect(selectId, selectedId) {
  const select = document.getElementById(selectId);
  if (!select) return;

  const current = selectedId || '';
  const sorted = sortTeachersForList(coreDataCache.teachers);
  select.innerHTML = '<option value="">请选择（可选）</option>' +
    sorted.map(t => `
      <option value="${escapeHtml(t.id)}"${t.id === current ? ' selected' : ''}>${escapeHtml(t.name)}</option>
    `).join('');
}


async function refreshTeachersCache() {
  coreDataCache.teachers = await fetchTeachers();
}


function getStudentNameById(studentId) {
  const student = coreDataCache.students.find(s => s.id === studentId);
  return student ? student.name : (studentId || '未知学员');
}


function getCourseLabelById(courseId) {
  const course = coreDataCache.courses.find(c => c.id === courseId);
  return course ? formatCourseShortLabel(course) : (courseId || '未知课程');
}


async function logOperation(action, target) {
  try {
    const db = getSupabase();
    if (!db) return;
    const operator = getCurrentOperatorName();
    if (!operator) return;
    const { error } = await db.from('operation_logs').insert({
      operator,
      action,
      target: target || ''
    });
    if (error) throw error;
  } catch (err) {
    console.error('logOperation failed', err);
  }
}


async function fetchOperationLogs() {
  const db = getSupabase();
  if (!db) throw new Error('Supabase 库未加载');

  const { data, error } = await db
    .from('operation_logs')
    .select('id, operator, action, target, created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}


async function fetchAllowedTeacherPhones() {
  if (coreDataCache.loaded) {
    return coreDataCache.teachers
      .map(t => normalizePhone(t.phone))
      .filter(Boolean);
  }

  const teachers = await fetchTeachers();
  return teachers
    .map(t => normalizePhone(t.phone))
    .filter(Boolean);
}


async function isPhoneAllowedForAdmin(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;
  if (normalized === ADMIN_EXTRA_ALLOWED_PHONE) return true;

  const teacherPhones = await fetchAllowedTeacherPhones();
  return teacherPhones.includes(normalized);
}


function getTeacherIdFromSelect(selectId) {
  const val = document.getElementById(selectId).value;
  return val || null;
}


function normalizePhone(phone) {
  return String(phone || '').trim();
}
