/** Pure Flow site config — client URLs */
(function () {
  var host = window.location.hostname || "";
  var origin = window.location.origin;
  var seg = (window.location.pathname || "").split("/").filter(Boolean)[0];
  var locale = ["en", "fr", "fa", "zh"].indexOf(seg) !== -1 ? seg : "en";
  var apiOrigin = "https://pureflow.sourcea.app";

  window.PUREFLOW_CONFIG = {
    siteUrl: origin + "/" + locale + "/",
    locale: locale,
    phone: "(604) 555-0123",
    phoneTel: "+16045550123",
    email: "hello@pureflow.sourcea.app",
    quoteApi: apiOrigin + "/api/quote",
    responseHours: 4,
    foundingSpotsLeft: 25,
  };
})();
