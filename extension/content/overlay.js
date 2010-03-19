// secret sauce to get jquery working

jQuery.noConflict();
$ = function(selector,context){ return new jQuery.fn.init(selector, context || EvenDeeperUI.Overlay.doc); };
$.fn = $.prototype = jQuery.fn;

EvenDeeperUI = {};

EvenDeeperUI.Overlay = {
  onLoad: function() {
    var appcontent = document.getElementById("appcontent");
    if (appcontent) {
      appcontent.addEventListener("DOMContentLoaded", EvenDeeperUI.Overlay.onPageLoad, true);
      appcontent.addEventListener("pageshow", EvenDeeperUI.Overlay.onPageShow, true);
    }
    
    // initialization code
    this.initialized = true;
    this.strings = document.getElementById("evendeeper-strings");
  },
  
  onPageLoad: function(e) {    
    EvenDeeperUI.Overlay.doc = e.originalTarget;
    
    // conjure up context for EvenDeeper.Main; basically we pass it
    // a doc handle and some callbacks
    
    var context = { 
      doc: EvenDeeperUI.Overlay.doc, 
      onFinishedCalculatingSimilarities: function() {
        var sb = EvenDeeperUI.Overlay.getSidebar();
        if (sb) sb.displayArticles(_articles);
      },
      onStartedCalculatingSimilarities: function() {
        var sb = EvenDeeperUI.Overlay.getSidebar();
        if (sb) sb.showLoading();
      }
    };
    
    var main = new EvenDeeper.Main();    
    main.init(context);
  },
  
  onPageShow: function(e) {
    var sb = EvenDeeperUI.Overlay.getSidebar();
    if (sb) sb.clearSidebar();
  },
  
  onMenuItemCommand: function(e) {
    var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                  .getService(Components.interfaces.nsIPromptService);
    promptService.alert(window, this.strings.getString("helloMessageTitle"),
                                this.strings.getString("helloMessage"));
  },
  
  getSidebar: function(e) {
    var sidebarWindow = document.getElementById("sidebar").contentWindow;
    if (sidebarWindow.location.href == "chrome://evendeeper/content/sidebar.xul" && sidebarWindow.EvenDeeperSidebar) {
      return sidebarWindow.EvenDeeperSidebar;
    } else {
      return null;
    }
  }
};

window.addEventListener("load", function(e) { EvenDeeperUI.Overlay.onLoad(e); }, false);