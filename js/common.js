let postData = [];

async function loadData() {

    const res = await fetch("./data/log.json");

    postData = await res.json();

    console.log(postData);

    // 데이터 로딩 완료 후 렌더링
    renderPosts();
}

loadData();

const postsContainer = document.getElementById("posts");
const paginationContainer = document.getElementById("pagination");
const tags = document.querySelectorAll(".tag");

let selectedTags = [];
let currentPage = 1;

const postsPerPage = 3;


// 필터링된 게시글 반환
function getFilteredPosts() {

    if (selectedTags.length === 0) {
        return postData;
    }

    return postData.filter(post =>
        selectedTags.some(tag =>
            post.tags.includes(tag)
        )
    );
}


// 게시글 렌더링
function renderPosts() {

    const filteredPosts = getFilteredPosts();

    const start = (currentPage - 1) * postsPerPage;
    const end = start + postsPerPage;

    const currentPosts = filteredPosts.slice(start, end);

    postsContainer.innerHTML = "";

    if (currentPosts.length === 0) {
        postsContainer.innerHTML = "<p>게시글이 없습니다.</p>";
        return;
    }

    currentPosts.forEach(post => {

        const postEl = document.createElement("div");

        postEl.className = "post";

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

    renderPagination(filteredPosts.length);
}


// 페이지 버튼 생성
function renderPagination(totalPosts) {

    paginationContainer.innerHTML = "";

    const totalPages = Math.ceil(totalPosts / postsPerPage);

    for (let i = 1; i <= totalPages; i++) {

        const btn = document.createElement("button");

        btn.className = "page-btn";

        if (i === currentPage) {
            btn.classList.add("active");
        }

        btn.textContent = i;

        btn.addEventListener("click", () => {

            currentPage = i;

            renderPosts();
        });

        paginationContainer.appendChild(btn);
    }
}


// 태그 클릭
tags.forEach(tag => {

    tag.addEventListener("click", () => {

        const tagName = tag.dataset.tag;

        tag.classList.toggle("active");

        if (selectedTags.includes(tagName)) {

            selectedTags = selectedTags.filter(t => t !== tagName);

        } else {

            selectedTags.push(tagName);
        }

        currentPage = 1;

        renderPosts();
    });
});