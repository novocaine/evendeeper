// secret sauce to get jquery working

jQuery.noConflict();
$ = function(selector,context){ return new jQuery.fn.init(selector, context || evendeeper.doc); };
$.fn = $.prototype = jQuery.fn;

var evendeeper = {
  onLoad: function() {
    var appcontent = document.getElementById("appcontent");
    if (appcontent) {
      appcontent.addEventListener("DOMContentLoaded", evendeeper.onPageLoad, true);
    }
    
    // initialization code
    this.initialized = true;
    this.strings = document.getElementById("evendeeper-strings");
  },
  
  onPageLoad: function(e) {
    // this gets used by $ so can't actually exec jquery
    evendeeper.doc = e.originalTarget;    
    EvenDeeper.Main.init(evendeeper.doc);    
  },
  
  onMenuItemCommand: function(e) {
    var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                  .getService(Components.interfaces.nsIPromptService);
    promptService.alert(window, this.strings.getString("helloMessageTitle"),
                                this.strings.getString("helloMessage"));
  }
};

window.addEventListener("load", function(e) { evendeeper.onLoad(e); }, false);