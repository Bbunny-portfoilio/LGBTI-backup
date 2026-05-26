
const postsContainer = document.getElementById("posts");
const trigger = document.getElementById("sentinel");
const loading = document.getElementById("loading");
const tags = document.querySelectorAll(".tag");

let postData = [];
let filteredData = [];
let selectedTags = [];
let visibleCount = 0;

const postsPerLoad = 4;
let isLoading = false;

// 데이터 불러오기
async function loadData() {
    try {

        const res =
            await fetch("./data/log.json");

        postData = await res.json();

        filteredData = postData;

        renderPosts(true);

    } catch (error) {

        console.error(error);

        postsContainer.innerHTML =
            "<p>데이터를 불러오지 못했습니다.</p>";
    }
}

loadData().then(() => {
    requestAnimationFrame(() => {
        observer.observe(trigger);
    });
});

// 게시글 렌더링
function renderPosts(reset = false) {

    if (reset) {
        postsContainer.innerHTML = "";
        visibleCount = 0;
    }

    const nextPosts =
        filteredData.slice(
            visibleCount,
            visibleCount + postsPerLoad
        );

    nextPosts.forEach((post, index) => {

        const postEl = document.createElement("div");

        postEl.className = "post";

        postEl.style.animationDelay = `${(visibleCount + index) * 0.1}s`;
        postEl.innerHTML = `
            <h3>${post.title}</h3>
            <p>${post.desc}</p>
            <div class="post-tags">
                ${post.tags.map(tag =>
            `<span class="post-tag">${tag}</span>`
        ).join("")}
            </div>
        `;

        postsContainer.appendChild(postEl);
    });

    visibleCount += postsPerLoad;

    if (visibleCount >= filteredData.length) {
        loading.innerText = "마지막 게시글입니다.";
        return;
    } else {
        loading.innerText = "게시글 불러오는 중...";
    }
}

// 무한 스크롤 감지
const observer = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    if (isLoading) return;
    if (visibleCount >= filteredData.length) return;

    isLoading = true;

    setTimeout(() => {
        renderPosts();
        isLoading = false;
    }, 300);

}, {
    threshold: 0,
    rootMargin: "100px"
});


//리셋
function applyFilter() {
    if (selectedTags.length === 0) {
        filteredData = postData;
    } else {
        filteredData = postData.filter(post =>
            selectedTags.some(tag =>
                post.tags.includes(tag)
            )
        );
    }

    visibleCount = 0;
    postsContainer.innerHTML = "";

    loading.innerText = "게시글 불러오는 중...";

    renderPosts(true);

    setTimeout(() => {
        trigger.scrollIntoView({ block: "end" });
    }, 0);

}

// 태그 클릭
tags.forEach(tag => {

    tag.addEventListener("click", () => {

        const tagName =
            tag.dataset.tag;

        tag.classList.toggle("active");

        // 태그 추가/삭제
        if (selectedTags.includes(tagName)) {

            selectedTags =
                selectedTags.filter(t => t !== tagName);

        } else {

            selectedTags.push(tagName);
        }

        // 필터 변경 시 초기화 후 다시 렌더링
        applyFilter();
    });
});

