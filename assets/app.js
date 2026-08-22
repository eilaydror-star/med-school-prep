// ===================================================================
// APP: מוכנים לשנה א' - רפואה
// ===================================================================

const STORAGE_KEY = "medprep-state-v1";
const TS_KEY = STORAGE_KEY + "-ts";

let state = loadState();
let currentView = { name: "dashboard" };
let currentUser = null;
let cloudSaveTimer = null;

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){ /* ignore corrupt state */ }
  return { courses: {} };
}

function getLocalTs(){
  return Number(localStorage.getItem(TS_KEY) || 0);
}

function setLocalTs(ts){
  localStorage.setItem(TS_KEY, String(ts));
}

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const ts = Date.now();
  setLocalTs(ts);
  queueCloudSave(ts);
}

function queueCloudSave(ts){
  if(!currentUser || !window.MedPrepSync) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => {
    window.MedPrepSync.saveRemote(currentUser.uid, state, ts).catch(e => console.error("cloud save failed", e));
  }, 800);
}

function getCourseState(courseId){
  if(!state.courses[courseId]){
    state.courses[courseId] = { topics: {}, flashKnown: {}, quizScore: null, quizProgress: null };
  }
  return state.courses[courseId];
}

function getCourse(id){
  return COURSES.find(c => c.id === id);
}

// ---------- Progress calculation ----------

function courseProgress(course){
  const cs = getCourseState(course.id);
  const totalTopics = course.topics.length;
  const doneTopics = Object.values(cs.topics).filter(Boolean).length;
  const topicsPct = totalTopics ? doneTopics / totalTopics : 0;

  const totalCards = course.flashcards.length;
  const knownCards = Object.values(cs.flashKnown).filter(Boolean).length;
  const cardsPct = totalCards ? knownCards / totalCards : 0;

  const quizPct = cs.quizScore ? cs.quizScore.correct / cs.quizScore.total : 0;
  const quizDone = cs.quizScore ? 1 : 0;

  const parts = [topicsPct, cardsPct];
  if(course.quiz.length) parts.push(quizDone ? Math.max(quizPct, 0.5) : 0);

  const avg = parts.reduce((a,b) => a+b, 0) / parts.length;
  return Math.round(avg * 100);
}

function overallStats(){
  const total = COURSES.length;
  let completed = 0;
  let sum = 0;
  COURSES.forEach(c => {
    const p = courseProgress(c);
    sum += p;
    if(p >= 100) completed++;
  });
  return {
    avgPct: total ? Math.round(sum / total) : 0,
    completed,
    total,
  };
}

// ---------- Countdown ----------

function daysUntil(dateStr){
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const nowMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = target - nowMid;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function formatDateHe(dateStr){
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("he-IL", { year: "numeric", month: "long", day: "numeric" });
}

// ---------- Rendering: sidebar ----------

function renderSidebar(){
  const nav = document.getElementById("nav");
  nav.innerHTML = "";

  const dashItem = document.createElement("button");
  dashItem.className = "nav-item" + (currentView.name === "dashboard" ? " active" : "");
  dashItem.innerHTML = `<span class="nav-icon">🏠</span><span class="nav-label">דשבורד</span>`;
  dashItem.onclick = () => {
    navigate({ name: "dashboard" });
    closeSidebarMobile();
  };
  nav.appendChild(dashItem);

  const label = document.createElement("div");
  label.className = "nav-section-label";
  label.textContent = "קורסים";
  nav.appendChild(label);

  COURSES.forEach(course => {
    const pct = courseProgress(course);
    const item = document.createElement("button");
    const isActive = currentView.name === "course" && currentView.courseId === course.id;
    item.className = "nav-item" + (isActive ? " active" : "");
    item.innerHTML = `
      <span class="nav-icon">${course.icon}</span>
      <span class="nav-label">${course.title}</span>
      <span class="nav-progress">${pct}%</span>
    `;
    item.onclick = () => {
      navigate({ name: "course", courseId: course.id, tab: "overview" });
      closeSidebarMobile();
    };
    nav.appendChild(item);
  });
}

function closeSidebarMobile(){
  document.getElementById("sidebar").classList.remove("open");
}

// ---------- Navigation ----------

function navigate(view){
  currentView = view;
  renderSidebar();
  renderContent();
  window.scrollTo(0, 0);
}

// ---------- Rendering: content router ----------

function renderContent(){
  const content = document.getElementById("content");
  content.innerHTML = "";

  if(currentView.name === "dashboard"){
    content.appendChild(renderDashboard());
  }else if(currentView.name === "course"){
    const course = getCourse(currentView.courseId);
    if(!course){
      navigate({ name: "dashboard" });
      return;
    }
    content.appendChild(renderCoursePage(course, currentView.tab || "overview"));
  }else if(currentView.name === "topic"){
    const course = getCourse(currentView.courseId);
    if(!course || !course.topics[currentView.topicIdx]){
      navigate({ name: "dashboard" });
      return;
    }
    content.appendChild(renderTopicPage(course, currentView.topicIdx));
  }
}

// ---------- Dashboard ----------

function renderDashboard(){
  const wrap = document.createElement("div");

  const header = document.createElement("div");
  header.className = "page-header";
  header.innerHTML = `
    <h1 class="page-title">ברוכים הבאים 👋</h1>
    <p class="page-sub">מסלול הכנה לשנה א' ברפואה. עקבו אחרי ההתקדמות שלכם בכל קורס.</p>
  `;
  wrap.appendChild(header);

  const days = daysUntil(SEMESTER_START_DEFAULT);
  const countdown = document.createElement("div");
  countdown.className = "countdown-card";
  const daysLabel = days > 0 ? "ימים עד תחילת הסמסטר" : (days === 0 ? "הסמסטר מתחיל היום!" : "הסמסטר כבר התחיל");
  countdown.innerHTML = `
    <div class="countdown-info">
      <div class="countdown-label">תחילת שנה א'</div>
      <div class="countdown-number">${Math.max(days, 0)}</div>
      <div class="countdown-days-label">${daysLabel}</div>
      <div class="countdown-date">${formatDateHe(SEMESTER_START_DEFAULT)}</div>
    </div>
  `;
  wrap.appendChild(countdown);

  const stats = overallStats();
  const statRow = document.createElement("div");
  statRow.className = "stat-row";
  statRow.innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${stats.avgPct}%</div>
      <div class="stat-label">התקדמות כוללת</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.completed}/${stats.total}</div>
      <div class="stat-label">קורסים הושלמו</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${COURSES.filter(c => c.priority === "high").length}</div>
      <div class="stat-label">קורסי עדיפות גבוהה</div>
    </div>
  `;
  wrap.appendChild(statRow);

  const sectionTitle = document.createElement("div");
  sectionTitle.className = "section-title";
  sectionTitle.textContent = "כל הקורסים";
  wrap.appendChild(sectionTitle);

  const grid = document.createElement("div");
  grid.className = "course-grid";
  COURSES.forEach(course => grid.appendChild(renderCourseCard(course)));
  wrap.appendChild(grid);

  return wrap;
}

function priorityLabel(p){
  if(p === "high") return "עדיפות גבוהה";
  if(p === "medium") return "עדיפות בינונית";
  return "עדיפות נמוכה";
}

function renderCourseCard(course){
  const pct = courseProgress(course);
  const card = document.createElement("div");
  card.className = "course-card";
  card.onclick = () => navigate({ name: "course", courseId: course.id, tab: "overview" });
  card.innerHTML = `
    <div class="course-card-top">
      <div class="course-icon">${course.icon}</div>
      <div class="priority-badge ${course.priority}">${priorityLabel(course.priority)}</div>
    </div>
    <div>
      <div class="course-title">${course.title}</div>
      <div class="course-short">${course.short}</div>
    </div>
    <div class="progress-bar-track">
      <div class="progress-bar-fill ${pct >= 100 ? 'complete' : ''}" style="width:${pct}%"></div>
    </div>
    <div class="course-card-footer">
      <span>${pct}% הושלם</span>
      <span>${course.topics.length} נושאים</span>
    </div>
  `;
  return card;
}

// ---------- Course page ----------

function renderCoursePage(course, activeTab){
  const wrap = document.createElement("div");
  const pct = courseProgress(course);

  const crumb = document.createElement("div");
  crumb.className = "breadcrumb";
  crumb.innerHTML = `<span>←</span><span>חזרה לדשבורד</span>`;
  crumb.onclick = () => navigate({ name: "dashboard" });
  wrap.appendChild(crumb);

  const header = document.createElement("div");
  header.className = "course-header";
  header.innerHTML = `
    <div class="course-icon">${course.icon}</div>
    <div>
      <h1 class="course-header-title">${course.title}</h1>
      <p class="course-header-short">${course.short}</p>
    </div>
  `;
  wrap.appendChild(header);

  const progressLine = document.createElement("div");
  progressLine.className = "course-progress-line";
  progressLine.innerHTML = `
    <div class="progress-bar-track">
      <div class="progress-bar-fill ${pct >= 100 ? 'complete' : ''}" style="width:${pct}%"></div>
    </div>
    <div class="progress-pct">${pct}%</div>
  `;
  wrap.appendChild(progressLine);

  const tabs = document.createElement("div");
  tabs.className = "tabs";
  const tabDefs = [
    { key: "overview", label: "סקירה" },
    { key: "topics", label: `נושאים (${course.topics.length})` },
    { key: "resources", label: `מקורות (${course.resources.length})` },
    { key: "flashcards", label: `כרטיסיות (${course.flashcards.length})` },
    { key: "quiz", label: `חידון (${course.quiz.length})` },
  ];
  tabDefs.forEach(t => {
    const btn = document.createElement("button");
    btn.className = "tab-btn" + (activeTab === t.key ? " active" : "");
    btn.textContent = t.label;
    btn.onclick = () => navigate({ name: "course", courseId: course.id, tab: t.key });
    tabs.appendChild(btn);
  });
  wrap.appendChild(tabs);

  const panel = document.createElement("div");
  panel.className = "tab-panel active";

  if(activeTab === "overview") panel.appendChild(renderOverviewTab(course));
  else if(activeTab === "topics") panel.appendChild(renderTopicsTab(course));
  else if(activeTab === "resources") panel.appendChild(renderResourcesTab(course));
  else if(activeTab === "flashcards") panel.appendChild(renderFlashcardsTab(course));
  else if(activeTab === "quiz") panel.appendChild(renderQuizTab(course));

  wrap.appendChild(panel);
  return wrap;
}

function renderOverviewTab(course){
  const div = document.createElement("div");
  const p = document.createElement("p");
  p.className = "summary-text";
  p.textContent = course.summary;
  div.appendChild(p);
  return div;
}

function renderTopicsTab(course){
  const div = document.createElement("div");
  const list = document.createElement("div");
  list.className = "topic-list";
  const cs = getCourseState(course.id);

  course.topics.forEach((topic, idx) => {
    const checked = !!cs.topics[idx];
    const item = document.createElement("div");
    item.className = "topic-item" + (checked ? " checked" : "");
    item.innerHTML = `
      <span class="topic-checkbox">${checked ? "✓" : ""}</span>
      <span class="topic-label">${topic.title}</span>
      <span class="topic-arrow">←</span>
    `;
    item.onclick = () => {
      navigate({ name: "topic", courseId: course.id, topicIdx: idx });
    };
    list.appendChild(item);
  });

  div.appendChild(list);
  return div;
}

function renderTopicPage(course, idx){
  const topic = course.topics[idx];
  const cs = getCourseState(course.id);
  const wrap = document.createElement("div");
  wrap.className = "topic-page";

  const crumb = document.createElement("div");
  crumb.className = "breadcrumb";
  crumb.innerHTML = `<span>←</span><span>חזרה לנושאים - ${course.title}</span>`;
  crumb.onclick = () => navigate({ name: "course", courseId: course.id, tab: "topics" });
  wrap.appendChild(crumb);

  const header = document.createElement("div");
  header.className = "topic-page-header";
  header.innerHTML = `
    <div class="topic-page-counter">נושא ${idx + 1} מתוך ${course.topics.length}</div>
    <h1 class="topic-page-title">${topic.title}</h1>
  `;
  wrap.appendChild(header);

  const body = document.createElement("div");
  body.className = "topic-content";
  body.innerHTML = topic.content || "<p>תוכן לנושא זה יתווסף בקרוב.</p>";
  wrap.appendChild(body);

  const readRow = document.createElement("div");
  readRow.className = "topic-read-row";
  const readBtn = document.createElement("button");
  const checked = !!cs.topics[idx];
  readBtn.className = "btn-mark-read" + (checked ? " done" : "");
  readBtn.textContent = checked ? "✓ סומן כנקרא" : "סמן כנקרא";
  readBtn.onclick = () => {
    cs.topics[idx] = !cs.topics[idx];
    saveState();
    navigate(currentView);
  };
  readRow.appendChild(readBtn);
  wrap.appendChild(readRow);

  const nav = document.createElement("div");
  nav.className = "topic-nav-row";
  const prevBtn = document.createElement("button");
  prevBtn.className = "btn-topic-nav";
  prevBtn.textContent = "→ נושא קודם";
  prevBtn.disabled = idx === 0;
  prevBtn.onclick = () => navigate({ name: "topic", courseId: course.id, topicIdx: idx - 1 });
  const nextBtn = document.createElement("button");
  nextBtn.className = "btn-topic-nav";
  nextBtn.textContent = "נושא הבא ←";
  nextBtn.disabled = idx === course.topics.length - 1;
  nextBtn.onclick = () => navigate({ name: "topic", courseId: course.id, topicIdx: idx + 1 });
  nav.appendChild(prevBtn);
  nav.appendChild(nextBtn);
  wrap.appendChild(nav);

  return wrap;
}

function renderResourcesTab(course){
  const div = document.createElement("div");
  const list = document.createElement("div");
  list.className = "resource-list";

  course.resources.forEach(res => {
    const item = document.createElement("div");
    item.className = "resource-item";

    const icon = document.createElement("span");
    icon.className = "resource-icon";
    icon.textContent = res.youtubeId ? "▶️" : (res.image ? "🖼️" : "📎");
    item.appendChild(icon);

    const body = document.createElement("div");
    body.className = "resource-body";

    const nameEl = document.createElement("div");
    nameEl.className = "resource-name";
    if(res.url){
      const a = document.createElement("a");
      a.href = res.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = res.name;
      nameEl.appendChild(a);
    } else {
      nameEl.textContent = res.name;
    }
    body.appendChild(nameEl);

    const noteEl = document.createElement("div");
    noteEl.className = "resource-note";
    noteEl.textContent = res.note;
    body.appendChild(noteEl);

    if(res.image){
      const img = document.createElement("img");
      img.className = "resource-image";
      img.src = res.image;
      img.alt = res.name;
      img.loading = "lazy";
      body.appendChild(img);
    }

    if(res.youtubeId){
      body.appendChild(renderYoutubeEmbed(res.youtubeId, res.name));
    }

    item.appendChild(body);
    list.appendChild(item);
  });

  div.appendChild(list);

  if(course.media && course.media.length){
    const mediaHeading = document.createElement("div");
    mediaHeading.className = "section-subheading";
    mediaHeading.textContent = "מדיה נוספת";
    div.appendChild(mediaHeading);

    const mediaGrid = document.createElement("div");
    mediaGrid.className = "media-grid";
    course.media.forEach(m => {
      const card = document.createElement("div");
      card.className = "media-card";
      if(m.caption){
        const cap = document.createElement("div");
        cap.className = "media-caption";
        cap.textContent = m.caption;
        card.appendChild(cap);
      }
      if(m.type === "youtube"){
        card.appendChild(renderYoutubeEmbed(m.id_or_url, m.caption || course.title));
      } else if(m.type === "image"){
        const img = document.createElement("img");
        img.className = "resource-image";
        img.src = m.id_or_url;
        img.alt = m.caption || course.title;
        img.loading = "lazy";
        card.appendChild(img);
      }
      mediaGrid.appendChild(card);
    });
    div.appendChild(mediaGrid);
  }

  return div;
}

function renderYoutubeEmbed(youtubeId, label){
  const wrap = document.createElement("div");
  wrap.className = "video-embed";

  const thumb = document.createElement("button");
  thumb.type = "button";
  thumb.className = "video-thumb";
  thumb.setAttribute("aria-label", `הפעל סרטון: ${label}`);
  thumb.style.backgroundImage = `url(https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg)`;

  const playIcon = document.createElement("span");
  playIcon.className = "video-play-icon";
  playIcon.textContent = "▶";
  thumb.appendChild(playIcon);

  thumb.onclick = () => {
    const iframe = document.createElement("iframe");
    iframe.className = "video-iframe";
    iframe.src = `https://www.youtube.com/embed/${youtubeId}?autoplay=1`;
    iframe.title = label;
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;
    wrap.replaceChildren(iframe);
  };

  wrap.appendChild(thumb);
  return wrap;
}

// ---------- Flashcards ----------

function renderFlashcardsTab(course){
  const div = document.createElement("div");

  if(!course.flashcards.length){
    div.innerHTML = `<div class="empty-state">אין כרטיסיות זמינות לקורס זה.</div>`;
    return div;
  }

  const cs = getCourseState(course.id);
  let idx = 0;
  let flipped = false;

  const toolbar = document.createElement("div");
  toolbar.className = "flash-toolbar";
  div.appendChild(toolbar);

  const stage = document.createElement("div");
  stage.className = "flash-stage";
  div.appendChild(stage);

  const controls = document.createElement("div");
  controls.className = "flash-controls";
  div.appendChild(controls);

  function renderCard(){
    const card = course.flashcards[idx];
    const known = !!cs.flashKnown[idx];

    toolbar.innerHTML = `
      <span>כרטיסיה ${idx + 1} מתוך ${course.flashcards.length}</span>
      <span>${Object.values(cs.flashKnown).filter(Boolean).length} ידועות</span>
    `;

    stage.innerHTML = "";
    const cardEl = document.createElement("div");
    cardEl.className = "flashcard" + (flipped ? " flipped" : "");
    cardEl.innerHTML = `
      <div class="flash-face front">
        <div class="flash-face-label">שאלה</div>
        <div class="flash-face-text">${card.q}</div>
        <div class="flash-hint">לחצו כדי להפוך</div>
      </div>
      <div class="flash-face back">
        <div class="flash-face-label">תשובה</div>
        <div class="flash-face-text">${card.a}</div>
        <div class="flash-hint">לחצו כדי להפוך חזרה</div>
      </div>
    `;
    cardEl.onclick = () => {
      flipped = !flipped;
      renderCard();
    };
    stage.appendChild(cardEl);

    controls.innerHTML = "";

    const prevBtn = document.createElement("button");
    prevBtn.className = "btn";
    prevBtn.textContent = "← הקודם";
    prevBtn.disabled = idx === 0;
    prevBtn.onclick = () => { idx--; flipped = false; renderCard(); };
    controls.appendChild(prevBtn);

    const knownBtn = document.createElement("button");
    knownBtn.className = "btn " + (known ? "success" : "");
    knownBtn.textContent = known ? "✓ ידוע" : "סמן כידוע";
    knownBtn.onclick = () => {
      cs.flashKnown[idx] = !cs.flashKnown[idx];
      saveState();
      renderCard();
      renderSidebar();
    };
    controls.appendChild(knownBtn);

    const spacer = document.createElement("div");
    spacer.className = "flash-spacer";
    controls.appendChild(spacer);

    const counter = document.createElement("span");
    counter.className = "flash-counter";
    counter.textContent = `${idx + 1} / ${course.flashcards.length}`;
    controls.appendChild(counter);

    const nextBtn = document.createElement("button");
    nextBtn.className = "btn primary";
    nextBtn.textContent = "הבא →";
    nextBtn.disabled = idx === course.flashcards.length - 1;
    nextBtn.onclick = () => { idx++; flipped = false; renderCard(); };
    controls.appendChild(nextBtn);
  }

  renderCard();
  return div;
}

// ---------- Quiz ----------

function renderQuizTab(course){
  const div = document.createElement("div");
  div.className = "quiz-wrap";

  if(!course.quiz.length){
    div.innerHTML = `<div class="empty-state">אין חידון זמין לקורס זה.</div>`;
    return div;
  }

  const cs = getCourseState(course.id);
  const saved = cs.quizProgress;
  let idx = saved ? saved.idx : 0;
  let selected = saved ? saved.selected : null;
  let answered = saved ? saved.answered : false;
  let correctCount = saved ? saved.correctCount : 0;
  let finished = false;

  function saveQuizProgress(){
    cs.quizProgress = { idx, selected, answered, correctCount };
    saveState();
  }

  function renderQuiz(){
    div.innerHTML = "";

    if(finished){
      const totalQ = course.quiz.length;
      const pct = Math.round((correctCount / totalQ) * 100);
      const result = document.createElement("div");
      result.className = "quiz-result";
      result.innerHTML = `
        <div class="quiz-result-score">${correctCount}/${totalQ}</div>
        <div class="quiz-result-label">ענית נכון על ${pct}% מהשאלות</div>
      `;
      const retryBtn = document.createElement("button");
      retryBtn.className = "btn primary";
      retryBtn.textContent = "נסו שוב";
      retryBtn.onclick = () => {
        idx = 0; selected = null; answered = false; correctCount = 0; finished = false;
        saveQuizProgress();
        renderQuiz();
      };
      result.appendChild(retryBtn);
      div.appendChild(result);
      return;
    }

    const q = course.quiz[idx];

    const progressLabel = document.createElement("div");
    progressLabel.className = "quiz-progress-label";
    progressLabel.textContent = `שאלה ${idx + 1} מתוך ${course.quiz.length}`;
    div.appendChild(progressLabel);

    const qCard = document.createElement("div");
    qCard.className = "quiz-question-card";

    const qText = document.createElement("div");
    qText.className = "quiz-question-text";
    qText.textContent = q.q;
    qCard.appendChild(qText);

    const options = document.createElement("div");
    options.className = "quiz-options";

    q.options.forEach((opt, optIdx) => {
      const btn = document.createElement("button");
      let cls = "quiz-option";
      if(answered){
        if(optIdx === q.correct) cls += " correct";
        else if(optIdx === selected) cls += " incorrect";
      }else if(optIdx === selected){
        cls += " selected";
      }
      btn.className = cls;
      btn.textContent = opt;
      btn.disabled = answered;
      btn.onclick = () => {
        selected = optIdx;
        answered = true;
        if(optIdx === q.correct) correctCount++;
        saveQuizProgress();
        renderQuiz();
      };
      options.appendChild(btn);
    });
    qCard.appendChild(options);

    if(answered){
      const explain = document.createElement("div");
      explain.className = "quiz-explain";
      explain.innerHTML = `<b>${selected === q.correct ? "נכון! " : "לא מדויק. "}</b>${q.explain}`;
      qCard.appendChild(explain);
    }

    div.appendChild(qCard);

    const footer = document.createElement("div");
    footer.className = "quiz-footer";
    footer.innerHTML = `<span></span>`;

    const nextBtn = document.createElement("button");
    nextBtn.className = "btn primary";
    nextBtn.textContent = idx === course.quiz.length - 1 ? "סיום" : "השאלה הבאה →";
    nextBtn.disabled = !answered;
    nextBtn.onclick = () => {
      if(idx === course.quiz.length - 1){
        finished = true;
        cs.quizScore = { correct: correctCount, total: course.quiz.length };
        cs.quizProgress = null;
        saveState();
        renderSidebar();
      }else{
        idx++;
        selected = null;
        answered = false;
        saveQuizProgress();
      }
      renderQuiz();
    };
    footer.appendChild(nextBtn);
    div.appendChild(footer);
  }

  renderQuiz();
  return div;
}

// ---------- Reset ----------

function resetProgress(){
  if(confirm("האם למחוק את כל ההתקדמות השמורה? פעולה זו אינה הפיכה.")){
    state = { courses: {} };
    navigate({ name: "dashboard" });
    saveState();
  }
}

// ---------- Auth / cloud sync ----------

function renderAuthUI(){
  const box = document.getElementById("auth-box");
  if(!box) return;
  box.innerHTML = "";

  if(currentUser){
    const info = document.createElement("div");
    info.className = "auth-user";
    info.innerHTML = `
      ${currentUser.photoURL ? `<img class="auth-avatar" src="${currentUser.photoURL}" alt="">` : `<span class="auth-avatar auth-avatar-fallback">👤</span>`}
      <span class="auth-name">${currentUser.displayName || currentUser.email || "משתמש"}</span>
    `;
    box.appendChild(info);

    const btn = document.createElement("button");
    btn.className = "btn-ghost auth-btn";
    btn.textContent = "התנתקות";
    btn.onclick = () => window.MedPrepSync && window.MedPrepSync.signOutUser();
    box.appendChild(btn);
  }else{
    const btn = document.createElement("button");
    btn.className = "btn-ghost auth-btn auth-google-btn";
    btn.textContent = "התחברות עם Google";
    btn.onclick = () => window.MedPrepSync && window.MedPrepSync.signIn();
    box.appendChild(btn);

    const note = document.createElement("div");
    note.className = "auth-note";
    note.textContent = "התחברו כדי לסנכרן התקדמות בין מכשירים";
    box.appendChild(note);
  }
}

function setupAuthSync(){
  function attach(){
    if(!window.MedPrepSync) return;
    window.MedPrepSync.onAuthChange(async (user) => {
      currentUser = user;
      renderAuthUI();

      if(!user) return;

      try{
        const remote = await window.MedPrepSync.loadRemote(user.uid);
        const localTs = getLocalTs();
        const remoteTs = remote && remote.updatedAt ? remote.updatedAt : 0;

        if(remote && remoteTs > localTs){
          state = remote.state || { courses: {} };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
          setLocalTs(remoteTs);
        }else{
          queueCloudSave(localTs || Date.now());
        }
      }catch(e){
        console.error("cloud sync failed", e);
      }

      navigate(currentView);
    });
  }

  if(window.MedPrepSync) attach();
  else window.addEventListener("medprep-sync-ready", attach, { once: true });
}

// ---------- Init ----------

function init(){
  document.getElementById("reset-progress-btn").onclick = resetProgress;

  const toggle = document.getElementById("sidebar-toggle");
  toggle.onclick = () => {
    document.getElementById("sidebar").classList.toggle("open");
  };

  renderAuthUI();
  navigate({ name: "dashboard" });
  setupAuthSync();
}

document.addEventListener("DOMContentLoaded", init);
