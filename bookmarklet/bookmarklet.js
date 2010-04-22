// loaded in and executed by the bookmarklet; bookmarklet executes EvenDeeper.Bookmarklet.PageController.init()

EvenDeeper.Bookmarklet = {};

EvenDeeper.Bookmarklet.PageController = function() {
  function onFinishedCalculatingSimilarities(page) {
    EvenDeeper.debug(page.scores());
  }
  
  function onStartedCalculatingSimilarities(page) {
    
  }
  
  function onWontProcessThisPage(page) {

  }
  
  return {
    init: function() {            
      var context = {
        doc: document,
        articleDataSource: "GoogleReaderShared",
        onFinishedCalculatingSimilarities: onFinishedCalculatingSimilarities,
        onStartedCalculatingSimilarities: onStartedCalculatingSimilarities,
        onWontProcessThisPage: onWontProcessThisPage
      };
      
      _page = new EvenDeeper.Page(context);
      _page.process();
    }
  };
}();

// run it immediately because we've just been loaded from the bookmarklet
EvenDeeper.Bookmarklet.PageController.init();