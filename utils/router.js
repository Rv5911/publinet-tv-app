const Router = (() => {
    const pages = {
        login: { el: document.getElementById("login-page"), render: LoginPage },
        listPage: { el: document.getElementById("list-users-page"), render: ListUsersPage },
        splashScreen: { el: document.getElementById("splash-page"), render: SplashScreen },
        homePage: { el: document.getElementById("home-page"), render: HomePage },
        settingsPage: { el: document.getElementById("settings-page"), render: SettingsPage },


    };

    let currentPageName = null;

    function showPage(name) {
        if (currentPageName && typeof pages[currentPageName].cleanup === "function") {
            pages[currentPageName].cleanup();
        }

        Object.values(pages).forEach(p => {
            if (p.el) p.el.style.display = "none";
        });

        const page = pages[name];
        if (!page) return;

        if (typeof page.render === "function") {
            page.el.innerHTML = page.render();
        }

        page.el.style.display = "block";

        if (typeof page.init === "function") {
            page.init(page.el);
        }

        currentPageName = name;
    }

    return { showPage };
})();

window.Router = Router;
