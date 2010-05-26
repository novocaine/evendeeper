// define EvenDeeper namespaace, global constants and some utility methods

EvenDeeper = {};

EvenDeeper.userAgent = 'EvenDeeper_0.1';
EvenDeeper.debugging_enabled = true;

EvenDeeper.debug = function(msg) { 
  if (EvenDeeper.debugging_enabled) {
    if (window.hasOwnProperty("Firebug")) {
      Firebug.Console.log(msg);
    } else if (window.hasOwnProperty("console")) {
      console.log(msg);
    }
  }
};

EvenDeeper.dateDaysAgo = function(days) {
  return (new Date().getTime() / 1000).toFixed(0) - 60*60*days*24;
};

EvenDeeper.errorMsg = function(msg) {
  alert("EvenDeeper: " + msg);
};
