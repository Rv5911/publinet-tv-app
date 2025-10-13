function LoginPage() {
  return `
    <div class="login-page-container">
      <div class="login-form-div">
      <img class="login-logo" src="../assets/main-logo.png" alt="">
      <h2 class="login-heading">Login Details</h2>
<div class="login-inputs-div">
<div>

        <input class="playlistname-input login-input" type="text" placeholder="Enter Any Name">
</div>

<div>
        <input class="username-input login-input login-input-focused" type="text" placeholder="Enter User Name">
</div>
        
<div>
        <input class="password-input login-input" type="text" placeholder="Enter Password">
</div>
<div class="login-buttons-div">

<button class="login-button">Login</button>
<div class="list-user-button-div">

<button class="list-button"><img src="../assets/list-users.png" alt="">List User</button>
</div>
</div>
</div>
</div>
      <div class="login-image-div">
<img class="login-right-image" src="../assets/login-right-image.png" alt="">
      </div>

    </div>
    `;
}
