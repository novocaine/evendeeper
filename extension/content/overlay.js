EvenDeeperUI = {};

EvenDeeperUI.OverlayController = {
  // startup and rego
  onWindowLoad: function() {    
    // initialization code
    this.initialized = true;
    this.strings = document.getElementById("evendeeper-strings");
    gBrowser.tabContainer.addEventListener("onTabSelect", EvenDeeperUI.OverlayController.onTabSelect, false);
  },
    
  onMenuItemCommand: function(e) {
    var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                  .getService(Components.interfaces.nsIPromptService);
    promptService.alert(window, this.strings.getString("helloMessageTitle"),
                                this.strings.getString("helloMessage"));
  },
      
  onTabSelect: function() {
    Firebug.Console.log("on tab select");
  }
};

window.addEventListener("load", function(e) { EvenDeeperUI.OverlayController.onWindowLoad(e); }, false);

EvenDeeperUI.PageController = {
  // startup and rego
  onWindowLoad: function() {
    var appcontent = document.getElementById("appcontent");
    if (appcontent) {
      appcontent.addEventListener("DOMContentLoaded", EvenDeeperUI.PageController.onDOMContentLoaded, true);
      appcontent.addEventListener("pageshow", EvenDeeperUI.PageController.onPageShow, true);
    }    
  },
  
  onDOMContentLoaded: function(e) {        
    // conjure up context for EvenDeeper.Main; basically we pass it
    // a doc handle and some callbacks
    
    var context = { 
      doc: e.originalTarget, 
      onFinishedCalculatingSimilarities: function(main) {
        var sb = EvenDeeperUI.PageController.getSidebar();
        if (sb) sb.onFinishedCalculatingSimilarities(main);
      },
      
      onStartedCalculatingSimilarities: function(main) {
        var sb = EvenDeeperUI.PageController.getSidebar();
        if (sb) sb.onStartedCalculatingSimilarities(main);
      }
    };
    
    var main = new EvenDeeper.Main();    
    main.init(context);    
  },
  
  onPageShow: function(e) {
    var sb = EvenDeeperUI.PageController.getSidebar();
    if (sb) sb.onBrowserShowPage(e);
  },  
        
  getSidebar: function() {
    var sidebarWindow = document.getElementById("sidebar").contentWindow;
    
    if (sidebarWindow.location.href == "chrome://evendeeper/content/sidebar.xul" && sidebarWindow.EvenDeeperSidebar) {
      return sidebarWindow.EvenDeeperSidebar;
    } else {
      return null;
    }
  }
};

window.addEventListener("load", function(e) { EvenDeeperUI.PageController.onWindowLoad(e); }, false);