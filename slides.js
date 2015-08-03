var Pink = require("pink");

require("pink/node_modules/highlight.js/styles/vs.css");

new Pink("#slides", {
  "jsrepl": require("./modules/jsrepl"),
  "background": require("pink/modules/background"),
  "image": require("pink/modules/image"),
  "highlight": require("pink/modules/highlight")
});
