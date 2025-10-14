window.onload = function () {
        let mainEl=this.document.querySelector("#main-app-container");
    mainEl.innerHTML = SplashScreen();


    setTimeout(() => {
        
        mainEl.innerHTML = LoginPage();
    }, 5000);
}
