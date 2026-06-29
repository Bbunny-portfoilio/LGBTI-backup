import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
  import {
    getFirestore, collection, addDoc, getDocs,
    doc, getDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, where
  } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

  // ✅ 여기에 Firebase 설정값을 입력하세요

    const firebaseConfig = {
      apiKey: "AIzaSyA5-r1UVTU5t8vr6GhnDJxFm5R7cp-UZVE",
      authDomain: "lgbti-0423.firebaseapp.com",
      projectId: "lgbti-0423",
      storageBucket: "lgbti-0423.firebasestorage.app",
      messagingSenderId: "171455513695",
      appId: "1:171455513695:web:83f185306f4d9a965847ea"
    };
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

  // ── 전역 상태 ──
  let posts = [];
  let currentTags = [];
  let filterTags = new Set(); // 다중 선택
  let currentUser = null;
  let filterCategory = null;
  let viewMode = 'list'; // 'list' | 'thumb'

  const CATEGORIES = ["SEOMIN", "TTUTTO", "THIRD PARTY"];
  const CATEGORY_COLORS = {
    "SEOMIN":      { bg: "#e8f0fd", text: "#1a4fa8", border: "#a8c4f0" },
    "TTUTTO":      { bg: "#fde8f5", text: "#a01870", border: "#f0a8d8" },
    "THIRD PARTY": { bg: "#edfaee", text: "#1a7a2e", border: "#a0dba8" },
    "미분류":       { bg: "#f0f0f0", text: "#666666", border: "#cccccc" },
  };

  function categoryBadgeHtml(cat, clickable) {
    const c = CATEGORY_COLORS[cat] || CATEGORY_COLORS["미분류"];
    const active = filterCategory === cat;
    const bg     = active ? c.text : c.bg;
    const color  = active ? "#fff" : c.text;
    const cursor = clickable ? "pointer" : "default";
    const style  = "background:" + bg + ";color:" + color + ";border:1px solid " + c.border + ";border-radius:20px;padding:3px 12px;font-size:0.75rem;font-weight:700;cursor:" + cursor + ";white-space:nowrap;letter-spacing:0.03em;transition:background 0.15s,color 0.15s;";
    return '<span class="cat-badge" style="' + style + '" data-cat="' + cat + '">' + escapeHtml(cat) + '</span>';
  }
  let editingPostId = null; // 수정 중인 글 ID

  // ── 유틸 ──
  function hashPassword(pw) {
    let h = 0;
    for (let i = 0; i < pw.length; i++) h = (Math.imul(31, h) + pw.charCodeAt(i)) | 0;
    return h.toString(36);
  }
  function formatDate(ts) {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
  }
  function el(id) { return document.getElementById(id); }
  function show(id) { el(id).style.display = "initial"; }
  function hide(id) { el(id).style.display = "none"; }
  function escapeHtml(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  // ── 태그 색상 ──
  const TAG_COLORS = [
    { bg:"#e8f4fd", text:"#1a6fa8", border:"#a8d4f0" },
    { bg:"#edf7ee", text:"#1e7a2e", border:"#a3d9ab" },
    { bg:"#fef3e2", text:"#9a5a00", border:"#f5c97a" },
    { bg:"#fde8f0", text:"#a0204e", border:"#f0a0c0" },
    { bg:"#ede8fd", text:"#4a27a8", border:"#c0aef5" },
    { bg:"#e8fdf8", text:"#0f7060", border:"#8ad8c8" },
    { bg:"#fde8e8", text:"#a02020", border:"#f0a0a0" },
    { bg:"#f0f0f0", text:"#444444", border:"#cccccc" },
  ];
  function tagColor(tag) {
    let h = 0;
    for (let i = 0; i < tag.length; i++) h = (Math.imul(31, h) + tag.charCodeAt(i)) | 0;
    return TAG_COLORS[Math.abs(h) % TAG_COLORS.length];
  }
  function tagBadgeHtml(tag, clickable = false) {
    const c = tagColor(tag);
    const active = filterTags.has(tag);
    const style = `background:${active ? c.text : c.bg};color:${active ? '#fff' : c.text};border:1px solid ${c.border};border-radius:20px;padding:2px 10px;font-size:0.75rem;font-weight:500;cursor:${clickable ? 'pointer' : 'default'};white-space:nowrap;transition:background 0.15s,color 0.15s;`;
    return `<span class="tag-badge" style="${style}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</span>`;
  }
  function getAllTags() {
    const set = new Set();
    posts.forEach(p => (p.tags || []).forEach(t => set.add(t)));
    return [...set];
  }

  // ── 헤더 업데이트 ──
  function updateHeader() {
    const loginBtn = el("header-login-btn");
    const userInfo = el("header-user-info");
    const userName = el("header-user-name");
    if (currentUser) {
      loginBtn.style.display = "none";
      userInfo.style.display = "flex";
      userName.textContent = currentUser.name + "님";
    } else {
      loginBtn.style.display = "flex";
      userInfo.style.display = "none";
    }
    // 글쓰기 버튼
    const writeBtn = el("write-btn");
    if (writeBtn) writeBtn.style.display = currentUser ? "" : "none";
  }

  // ── 로그인 모달 ──
  window.openLoginModal = () => {
    el("login-id").value = "";
    el("login-pw").value = "";
    el("login-error").textContent = "";
    el("login-modal-overlay").style.display = "flex";
    setTimeout(() => el("login-id").focus(), 50);
  };
  window.closeLoginModal = () => {
    el("login-modal-overlay").style.display = "none";
  };
  window.doLogin = async () => {
    const id = el("login-id").value.trim();
    const pw = el("login-pw").value;
    if (!id || !pw) { el("login-error").textContent = "아이디와 비밀번호를 입력하세요."; return; }

    const btn = el("login-submit-btn");
    btn.disabled = true; btn.textContent = "로그인 중...";
    el("login-error").textContent = "";

    try {
      const q = query(collection(db, "members"), where("userId", "==", id));
      const snap = await getDocs(q);
      if (snap.empty) { el("login-error").textContent = "아이디 또는 비밀번호가 틀렸습니다."; return; }
      const member = snap.docs[0].data();
      if (member.passwordHash !== hashPassword(pw)) {
        el("login-error").textContent = "아이디 또는 비밀번호가 틀렸습니다."; return;
      }
      currentUser = { id: member.userId, name: member.name || member.userId };
      window.closeLoginModal();
      updateHeader();
      renderCategoryFilter();
      renderTagFilter();
      renderList();
    } catch (e) {
      el("login-error").textContent = "오류: " + e.message;
    } finally {
      btn.disabled = false; btn.textContent = "로그인";
    }
  };
  window.doLogout = () => {
    currentUser = null;
    updateHeader();
    renderList();
  };

  // ── 글 목록 ──
  async function loadPosts() {
    el("list-loading").style.display = "flex";
    el("post-list").innerHTML = "";
    try {
      const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderCategoryFilter();
      renderTagFilter();
      renderList();
    } catch (e) {
      el("list-loading").innerHTML = `<span style="color:#c0392b">불러오기 실패: ${e.message}</span>`;
    }
  }

  function renderCategoryFilter() {
    const wrap = el("category-filter-wrap");
    if (!wrap) return;
    const allActive = filterCategory === null;
    let html = `<span class="tag-filter-label">카테고리:</span>`;
    // 전체 버튼
    html += `<span class="cat-badge" style="cursor:pointer;border-radius:20px;padding:3px 12px;font-size:0.75rem;font-weight:700;letter-spacing:0.03em;background:${allActive ? '#1e1812' : '#f0ebe0'};color:${allActive ? '#f0e8d0' : '#7a6848'};border:1px solid ${allActive ? '#1e1812' : '#d0c4ae'}" data-cat="">전체</span>`;
    // 카테고리 버튼
    [...CATEGORIES, "미분류"].forEach(cat => {
      html += categoryBadgeHtml(cat, true);
    });
    wrap.innerHTML = html;
    wrap.querySelectorAll(".cat-badge").forEach(b => {
      b.addEventListener("click", () => {
        filterCategory = b.dataset.cat || null;
        renderCategoryFilter();
        // 카테고리 클릭 시 항상 목록으로 이동
        hide("view-detail");
        hide("view-write");
        show("view-list");
        const s = document.getElementById("post-custom-style");
        if (s) s.remove();
        const topPag = document.getElementById("tab-pagination-top");
        if (topPag) topPag.remove();
        editingPostId = null;
        history.pushState({ view: "list" }, "", "#");
        renderList();
      });
    });
  }

  function renderTagFilter() {
    const allTags = getAllTags();
    const wrap = el("tag-filter-wrap");
    if (allTags.length === 0) { wrap.innerHTML = ""; return; }
    const allActive = filterTags.size === 0;
    const allBtnStyle = `cursor:pointer;border-radius:20px;padding:2px 10px;font-size:0.75rem;font-weight:500;background:${allActive ? '#1e1812' : '#f0ebe0'};color:${allActive ? '#f0e8d0' : '#7a6848'};border:1px solid ${allActive ? '#1e1812' : '#d0c4ae'}`;
    wrap.innerHTML = `
      <span class="tag-filter-label">태그 필터 (복수 선택):</span>
      <span class="tag-all-btn" style="${allBtnStyle}">전체</span>
      ${allTags.map(t => tagBadgeHtml(t, true)).join("")}
    `;
    // 전체 버튼
    wrap.querySelector(".tag-all-btn").addEventListener("click", () => {
      filterTags.clear();
      renderTagFilter();
      renderList();
    });
    // 태그 토글
    wrap.querySelectorAll(".tag-badge").forEach(b => {
      b.addEventListener("click", () => {
        const tag = b.dataset.tag;
        if (filterTags.has(tag)) {
          filterTags.delete(tag);
        } else {
          filterTags.add(tag);
        }
        renderTagFilter();
        renderList();
      });
    });
  }

  // 썸네일: thumbnail 필드 우선, 없으면 content 첫 img 태그에서 추출
  function extractThumb(post) {
    if (post.thumbnail) return post.thumbnail;
    if (!post.content) return null;
    const m = post.content.match(/<img[^>]+src=["']([^"']+)["']/i);
    return m ? m[1] : null;
  }
  // 글 내용에서 텍스트만 추출 (태그 제거)
  function stripHtml(html) {
    const d = document.createElement("div");
    d.innerHTML = html;
    return d.textContent || d.innerText || "";
  }

  window.setViewMode = (mode) => {
    viewMode = mode;
    el("view-btn-list").classList.toggle("active", mode === "list");
    el("view-btn-thumb").classList.toggle("active", mode === "thumb");
    el("board-header-row").style.display = mode === "list" ? "" : "none";
    renderList();
  };

  function renderList() {
    const container = el("post-list");
    el("list-loading").style.display = "none";
    let filtered = filterCategory
      ? posts.filter(p => (p.category || "미분류") === filterCategory)
      : posts;
    filtered = filterTags.size > 0 ? filtered.filter(p => [...filterTags].every(t => (p.tags || []).includes(t))) : filtered;
    if (filtered.length === 0) {
      container.innerHTML = `<div class="empty-state"><span class="lock-icon">📭</span><p>${filterTags.size > 0 ? `선택한 태그의 글이 없습니다` : '아직 등록된 글이 없습니다'}</p></div>`;
      return;
    }
    if (viewMode === "thumb") {
      container.className = "thumb-grid";
      container.innerHTML = filtered.map((p) => {
        const tagsHtml = (p.tags || []).map(t => tagBadgeHtml(t, false)).join(" ");
        const isSecret = !!p.passwordHash;
        const canOpen = true;
        const thumb = (!isSecret || currentUser) ? extractThumb(p) : null;
        const excerpt = (!isSecret || currentUser) ? stripHtml(p.content).slice(0, 80) : "🔒 비밀번호를 입력하면 열람할 수 있어요";
        return `
          <div class="thumb-card ${canOpen ? 'clickable' : 'locked-row'}" ${canOpen ? `onclick="openPost('${p.id}')"` : ''}>
            <div class="thumb-img-wrap">
              ${thumb
                ? `<img src="${thumb}" alt="썸네일" onerror="this.parentElement.innerHTML='<div class=thumb-no-img>🖼️</div>'">`
                : `<div class="thumb-no-img">${isSecret && !currentUser ? '🔒' : '📄'}</div>`}
            </div>
            <div class="thumb-body">
              <div class="thumb-title">${escapeHtml(p.title)}</div>
              <div class="thumb-excerpt">${escapeHtml(excerpt)}</div>
              <div class="thumb-footer">
                <span class="thumb-date">${formatDate(p.createdAt)}</span>
              </div>
            </div>
          </div>
        `;
      }).join("");
    } else {
      container.className = "";
      container.innerHTML = filtered.map((p, i) => {
        const tagsHtml = (p.tags || []).map(t => tagBadgeHtml(t, false)).join(" ");
        const isSecret = !!p.passwordHash;
        const canOpen = true;
        return `
          <div class="post-row ${canOpen ? 'clickable' : 'locked-row'}" ${canOpen ? `onclick="openPost('${p.id}')"` : ''}>
            <span class="post-num">${filtered.length - i}</span>
            <span class="post-secret-badge">${isSecret ? (currentUser ? '🔓' : '🔑') : '📄'}</span>
            <span class="post-title-wrap">
              <span class="post-title-text">${escapeHtml(p.title)}</span>
              ${tagsHtml ? `<span class="post-tags">${tagsHtml}</span>` : ""}
            </span>
            <span class="post-date">${formatDate(p.createdAt)}</span>
          </div>
        `;
      }).join("");
    }
  }

  // ── 태그 입력 ──
  window.addTag = () => {
    const input = el("tag-input");
    const raw = input.value.trim().replace(/^#+/, "");
    if (!raw) return;
    if (currentTags.includes(raw)) { input.value = ""; return; }
    if (currentTags.length >= 5) { el("write-error").textContent = "태그는 최대 5개까지 추가할 수 있어요."; return; }
    currentTags.push(raw);
    input.value = "";
    el("write-error").textContent = "";
    renderWriteTags();
  };
  window.removeTag = (tag) => {
    currentTags = currentTags.filter(t => t !== tag);
    renderWriteTags();
  };
  function renderWriteTags() {
    const wrap = el("write-tags-display");
    wrap.innerHTML = currentTags.map(t => {
      const c = tagColor(t);
      return `<span style="background:${c.bg};color:${c.text};border:1px solid ${c.border};border-radius:20px;padding:2px 10px;font-size:0.78rem;font-weight:500;display:inline-flex;align-items:center;gap:5px;">
        ${escapeHtml(t)}
        <span onclick="removeTag('${escapeHtml(t)}')" style="cursor:pointer;font-size:0.85rem;line-height:1;opacity:0.7;">✕</span>
      </span>`;
    }).join("");
  }

  // ── 탭 전환 ──
  window.switchTab = (tab) => {
    if (tab === 'preview') {
      const html = el("write-content").value;
      el("html-preview").innerHTML = html;
      el("editor-write-area").style.display = "none";
      el("editor-preview-area").style.display = "";
      el("tab-write").classList.remove("active");
      el("tab-preview").classList.add("active");
    } else {
      el("editor-write-area").style.display = "";
      el("editor-preview-area").style.display = "none";
      el("tab-write").classList.add("active");
      el("tab-preview").classList.remove("active");
    }
  };

  // ── 썸네일 미리보기 ──
  window.previewThumbnail = () => {
    const url = el("write-thumbnail").value.trim();
    const img = el("thumb-preview-img");
    if (url) {
      img.src = url;
      img.style.display = "block";
      img.onerror = () => { img.style.display = "none"; };
    } else {
      img.style.display = "none";
    }
  };

  window.switchCssTab = (tab) => {
    if (tab === 'preview') {
      const css = el("write-custom-css").value.trim();
      el("css-preview-code").textContent = css || "(CSS 없음)";
      el("write-custom-css").style.display = "none";
      el("css-preview-area").style.display = "";
      el("css-tab-edit").classList.remove("active");
      el("css-tab-preview").classList.add("active");
    } else {
      el("write-custom-css").style.display = "";
      el("css-preview-area").style.display = "none";
      el("css-tab-edit").classList.add("active");
      el("css-tab-preview").classList.remove("active");
    }
  };

  window.previewCustomCss = () => {
    // 미리보기 탭이 열려있으면 실시간 반영
    if (el("css-preview-area").style.display !== "none") {
      el("css-preview-code").textContent = el("write-custom-css").value.trim() || "(CSS 없음)";
    }
  };

  // ── 글쓰기 ──
  window.goWrite = () => {
    if (!currentUser) { openLoginModal(); return; }
    currentTags = [];
    hide("view-list");
    show("view-write");
    history.pushState({ view: "write" }, "", "#write");
    el("write-title").value = "";
    el("write-content").value = "";
    switchTab('write');
    el("write-pw").value = "";
    el("write-pw-confirm").value = "";
    el("tag-input").value = "";
    el("write-error").textContent = "";
    renderWriteTags();
  };
  window.cancelWrite = (fromHistory = false) => {
    hide("view-write");
    editingPostId = null;
    show("view-list");
    el("write-form-title").textContent = "✏️ 새 글 작성";
    el("submit-btn").textContent = "등록하기";
    if (!fromHistory) history.back();
  };



  // ── 글 열람 ──
  // ── ccb-tab 페이징 ──
  let tabCurrentPage = 1;
  let tabTotalPages = 1;
  let tabsPerPage = 1;
  let allTabEls = [];
  const PAGE_BLOCK = 5; // 페이지 번호 블록 단위
  const PAGE_JUMP  = 5; // ‹ › 이동 단위

  window.renderTabPage = function(page, scrollTop = true) {
    if (page < 1) page = 1;
    if (page > tabTotalPages) page = tabTotalPages;
    tabCurrentPage = page;
    allTabEls.forEach((tabEl, i) => {
      const pageOfEl = Math.floor(i / tabsPerPage) + 1;
      tabEl.style.display = pageOfEl === page ? "" : "none";
    });
    renderPagination();
    if (scrollTop) {
      // #cocoback 최상단으로 스크롤, 없으면 view-detail로
      const target = document.getElementById("cocoback") || document.getElementById("view-detail");
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  function buildPaginationHTML() {
    if (tabTotalPages <= 1) return "";

    // 현재 블록의 시작/끝 페이지 계산
    const blockStart = Math.floor((tabCurrentPage - 1) / PAGE_BLOCK) * PAGE_BLOCK + 1;
    const blockEnd   = Math.min(blockStart + PAGE_BLOCK - 1, tabTotalPages);

    // 5페이지 이전/다음 계산
    const jumpPrev = Math.max(1, tabCurrentPage - PAGE_JUMP);
    const jumpNext = Math.min(tabTotalPages, tabCurrentPage + PAGE_JUMP);

    const dis = (cond) => cond ? 'disabled' : '';
    const cls = (cond) => cond ? 'pg-disabled' : '';

    let btns = `<div class="pg-wrap">`;
    // 최초
    btns += `<button class="pg-btn pg-edge ${cls(tabCurrentPage===1)}" onclick="renderTabPage(1)" ${dis(tabCurrentPage===1)} title="첫 페이지">«</button>`;
    // 5페이지 이전
    btns += `<button class="pg-btn pg-jump ${cls(tabCurrentPage===1)}" onclick="renderTabPage(${jumpPrev})" ${dis(tabCurrentPage===1)} title="${PAGE_JUMP}페이지 이전">‹</button>`;

    // 번호 블록
    btns += `<div class="pg-numbers">`;
    for (let i = blockStart; i <= blockEnd; i++) {
      btns += `<button class="pg-btn ${i===tabCurrentPage ? 'pg-active' : ''}" onclick="renderTabPage(${i})">${i}</button>`;
    }
    btns += `</div>`;

    // 5페이지 다음
    btns += `<button class="pg-btn pg-jump ${cls(tabCurrentPage===tabTotalPages)}" onclick="renderTabPage(${jumpNext})" ${dis(tabCurrentPage===tabTotalPages)} title="${PAGE_JUMP}페이지 다음">›</button>`;
    // 최종
    btns += `<button class="pg-btn pg-edge ${cls(tabCurrentPage===tabTotalPages)}" onclick="renderTabPage(${tabTotalPages})" ${dis(tabCurrentPage===tabTotalPages)} title="마지막 페이지">»</button>`;
    btns += `</div>`;

    // 페이지 정보
    btns += `<div class="pg-info">${tabCurrentPage} / ${tabTotalPages} 페이지</div>`;

    return btns;
  }

  function renderPagination() {
    const html = buildPaginationHTML();

    // 하단 페이지네이션
    const bot = document.getElementById("tab-pagination");
    if (bot) bot.innerHTML = html;

    // 상단: #cocoback 바로 위에 동적 삽입/갱신
    const cocoback = document.getElementById("cocoback");
    let top = document.getElementById("tab-pagination-top");
    if (cocoback) {
      if (!top) {
        top = document.createElement("div");
        top.id = "tab-pagination-top";
        top.className = "tab-pagination";
        cocoback.parentNode.insertBefore(top, cocoback);
      }
      top.innerHTML = html;
    } else if (top) {
      // cocoback 없으면 detail-content 상단에 유지
      top.innerHTML = html;
    }
  }

  function initTabPaging(data) {
    const container = el("detail-content");
    allTabEls = Array.from(container.querySelectorAll(".ccb-tab"));
    const perPage = data.tabsPerPage;
    if (!perPage || allTabEls.length === 0) {
      const top = document.getElementById("tab-pagination-top");
      const bot = document.getElementById("tab-pagination");
      if (top) top.remove(); // 동적 삽입이므로 완전 제거
      if (bot) bot.innerHTML = "";
      return;
    }
    tabsPerPage = perPage;
    tabTotalPages = Math.ceil(allTabEls.length / tabsPerPage);
    renderTabPage(1, false); // 초기 로드 시 스크롤 없음
  }

  function showPostContent(data) {
    hide("view-pw-check");
    // 전용 CSS 주입 (기존 제거 후 재삽입)
    const existing = document.getElementById("post-custom-style");
    if (existing) existing.remove();
    if (data.customCss) {
      const styleEl = document.createElement("style");
      styleEl.id = "post-custom-style";
      styleEl.textContent = data.customCss;
      document.head.appendChild(styleEl);
    }
    el("detail-title").textContent = data.title;
    el("detail-date").textContent  = formatDate(data.createdAt);
    el("detail-author-wrap").style.display = data.author ? "" : "none";
    el("detail-author").textContent = data.author || "";
    el("detail-content").innerHTML = data.content;
    el("detail-category").innerHTML = categoryBadgeHtml(data.category || "미분류", false);
    el("detail-tags").innerHTML = (data.tags || []).map(t => tagBadgeHtml(t, false)).join(" ");
    el("detail-actions").style.display = currentUser ? "flex" : "none";
    // ccb-tab 페이징 초기화
    initTabPaging(data);
    show("view-detail-content");
  }

  window.openPost = async (id, fromHistory = false) => {
    hide("view-list");
    show("view-detail");
    el("current-post-id").value = id;
    hide("view-detail-content");
    hide("view-pw-check");
    if (!fromHistory) history.pushState({ view: "detail", id }, "", `#post-${id}`);
    const snap = await getDoc(doc(db, "posts", id));
    if (!snap.exists()) return;
    const data = snap.data();
    // 회원이면 비밀글도 바로 열람
    if (!data.passwordHash || currentUser) {
      showPostContent(data);
    } else {
      // 비회원도 비밀번호 알면 열람 가능
      el("pw-input").value = "";
      el("pw-error").textContent = "";
      show("view-pw-check");
    }
  };

  window.checkPassword = async () => {
    const id = el("current-post-id").value;
    const pw = el("pw-input").value;
    if (!pw) { el("pw-error").textContent = "비밀번호를 입력하세요."; return; }
    const btn = el("pw-check-btn");
    btn.disabled = true; btn.textContent = "확인 중...";
    try {
      const snap = await getDoc(doc(db, "posts", id));
      if (!snap.exists()) { el("pw-error").textContent = "존재하지 않는 글입니다."; return; }
      const data = snap.data();
      if (hashPassword(pw) !== data.passwordHash) {
        el("pw-error").textContent = "비밀번호가 틀렸습니다.";
        btn.disabled = false; btn.textContent = "확인"; return;
      }
      showPostContent(data);
    } catch (e) {
      el("pw-error").textContent = "오류: " + e.message;
    } finally {
      btn.disabled = false; btn.textContent = "확인";
    }
  };

  window.goList = (fromHistory = false) => {
    hide("view-detail"); show("view-list"); editingPostId = null;
    const s = document.getElementById("post-custom-style");
    if (s) s.remove();
    const topPag = document.getElementById("tab-pagination-top");
    if (topPag) topPag.remove();
    if (!fromHistory) history.pushState({ view: "list" }, "", "#");
  };

  // ── 삭제 ──
  window.deletePost = async () => {
    const id = el("current-post-id").value;
    if (!id || !currentUser) return;
    if (!confirm("정말 이 글을 삭제할까요?")) return;
    try {
      await deleteDoc(doc(db, "posts", id));
      window.goList();
      await loadPosts();
    } catch (e) {
      alert("삭제 실패: " + e.message);
    }
  };

  // ── 수정 모드 진입 ──
  window.startEdit = async (targetId, fromHistory = false) => {
    const id = targetId || el("current-post-id").value;
    if (!id || !currentUser) return;
    const snap = await getDoc(doc(db, "posts", id));
    if (!snap.exists()) return;
    const data = snap.data();
    editingPostId = id;
    currentTags = data.tags || [];

    hide("view-detail");
    show("view-write");
    if (!fromHistory) history.pushState({ view: "edit", id }, "", "#edit");
    el("write-form-title").textContent = "✏️ 글 수정";
    el("write-title").value = data.title || "";
    el("write-content").value = data.content || "";
    el("write-thumbnail").value = data.thumbnail || "";
    el("write-tabs-per-page").value = data.tabsPerPage || "";
    el("write-category").value = data.category || "";
    el("write-custom-css").value = data.customCss || "";
    el("write-pw").value = "";
    el("write-pw-confirm").value = "";
    el("tag-input").value = "";
    el("write-error").textContent = "";
    // 썸네일 미리보기
    const img = el("thumb-preview-img");
    if (data.thumbnail) { img.src = data.thumbnail; img.style.display = "block"; }
    else { img.style.display = "none"; }
    renderWriteTags();
    switchTab('write');
  };

  // ── 수정 저장 ──
  window.submitPost = async () => {
    const title   = el("write-title").value.trim();
    const content = el("write-content").value.trim();
    const pw      = el("write-pw").value;
    const pw2     = el("write-pw-confirm").value;
    const errEl   = el("write-error");
    if (!title || !content) { errEl.textContent = "제목과 내용은 필수입니다."; return; }
    if (pw && pw !== pw2)   { errEl.textContent = "비밀번호가 일치하지 않습니다."; return; }
    if (pw && pw.length < 4){ errEl.textContent = "비밀번호는 4자 이상이어야 합니다."; return; }
    const btn = el("submit-btn");
    btn.disabled = true; btn.textContent = editingPostId ? "수정 중..." : "등록 중...";
    errEl.textContent = "";
    try {
      const payload = {
        title, content,
        tags: currentTags,
        author: currentUser.name,
        category: el("write-category").value || "미분류",
        thumbnail: el("write-thumbnail").value.trim() || null,
        tabsPerPage: parseInt(el("write-tabs-per-page").value) || null,
        customCss: el("write-custom-css").value.trim() || null,
      };
      if (pw) payload.passwordHash = hashPassword(pw);

      if (editingPostId) {
        // 수정
        await updateDoc(doc(db, "posts", editingPostId), payload);
        editingPostId = null;
      } else {
        // 신규 등록
        if (!pw) payload.passwordHash = null;
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, "posts"), payload);
      }
      btn.disabled = false; btn.textContent = "등록하기";
      window.cancelWrite();
      await loadPosts();
    } catch (e) {
      errEl.textContent = "저장 실패: " + e.message;
      btn.disabled = false; btn.textContent = editingPostId ? "수정 완료" : "등록하기";
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    el("pw-input")?.addEventListener("keydown", e => { if (e.key === "Enter") window.checkPassword(); });
    el("tag-input")?.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); window.addTag(); } });
    el("login-pw")?.addEventListener("keydown", e => { if (e.key === "Enter") window.doLogin(); });
    el("login-modal-overlay")?.addEventListener("click", e => { if (e.target === el("login-modal-overlay")) window.closeLoginModal(); });

    // 초기 history 상태 설정
    history.replaceState({ view: "list" }, "", "#");

    // 뒤로가기 / 앞으로가기 처리
    window.addEventListener("popstate", async (e) => {
      const state = e.state;
      if (!state) return;
      // 모든 뷰 숨기기
      hide("view-list"); hide("view-write"); hide("view-detail");
      const s = document.getElementById("post-custom-style");
      if (s) s.remove();

      if (state.view === "list") {
        editingPostId = null;
        el("write-form-title").textContent = "✏️ 새 글 작성";
        el("submit-btn").textContent = "등록하기";
        show("view-list");
      } else if (state.view === "write") {
        // 글쓰기 상태 복원 (빈 폼)
        if (!currentUser) { show("view-list"); return; }
        show("view-write");
      } else if (state.view === "edit" && state.id) {
        if (!currentUser) { show("view-list"); return; }
        // startEdit 재호출 (fromHistory)
        await window.startEdit(state.id, true);
      } else if (state.view === "detail" && state.id) {
        await window.openPost(state.id, true);
      }
    });

    updateHeader();
    loadPosts();
  });