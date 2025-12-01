var firebaseConfig = {
    apiKey: "AIzaSyC_pzuTpAnFz3mAbiFlQOb7PBt63l0Bm50",
    authDomain: "smarttv-megatv.firebaseapp.com",
    projectId: "smarttv-megatv",
    storageBucket: "smarttv-megatv.firebasestorage.app",
    messagingSenderId: "740889747008",
    appId: "1:740889747008:web:d950dafeece58808d109a5"
  };

firebase.initializeApp(firebaseConfig);
firebase.analytics();

var db = firebase.firestore();

window.logAllDnsEntries = function () {
  db.collection("DNS").get()
    .then(function (snapshot) {
      snapshot.forEach(function (doc) {
        console.log("DNS Entry:", doc.id, "=>", doc.data());
        localStorage.setItem("all_dns", JSON.stringify(doc.data().DNS));
      });

    })
    .catch(function (error) {
      alert("Error getting DNS entries: " + error.message);
    });
};

window.getTmbdId = function () {
  db.collection("TMDBID").get()
    .then(function (snapshot) {
      snapshot.forEach(function (doc) {
        const tmbdId=doc.data().tmbd_api_key? doc.data().tmbd_api_key : ""
        console.log("TMDBID Entry:", doc.id, "=>", tmbdId);
        localStorage.setItem("tmbdId", tmbdId);
      });

    })
    .catch(function (error) {
      alert("Error getting TMDBID entries: " + error.message);
    });
};
