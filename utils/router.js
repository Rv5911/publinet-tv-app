const Router = (() => {
    const pages = {
        login: { el: document.getElementById("login-page"), render: LoginPage },
        listPage: { el: document.getElementById("list-users-page"), render: ListUsersPage },
        splashScreen: { el: document.getElementById("splash-page"), render: SplashScreen },


    };

    let currentPageName = null;

    function showPage(name) {
        // Run cleanup of the current page if available
        if (currentPageName && typeof pages[currentPageName].cleanup === "function") {
            pages[currentPageName].cleanup();
        }

        // Hide all pages
        Object.values(pages).forEach(p => {
            if (p.el) p.el.style.display = "none";
        });

        const page = pages[name];
        if (!page) return;

        // Render new content
        if (typeof page.render === "function") {
            page.el.innerHTML = page.render();
        }

        // Show the page
        page.el.style.display = "block";

        // Run page-specific init
        if (typeof page.init === "function") {
            page.init(page.el);
        }

        currentPageName = name;
    }

    return { showPage };
})();

window.Router = Router;
