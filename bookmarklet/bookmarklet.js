// loaded in and executed by the bookmarklet; bookmarklet executes EvenDeeper.Bookmarklet.PageController.init()

// EvenDeeper.Bookmarklet = {};

EvenDeeper.Bookmarklet.PageController = function() {
  function onFinishedCalculatingSimilarities(page) {
    EvenDeeper.Bookmarklet.UI.showResults(page.scores());
  }
  
  function onStartedCalculatingSimilarities(page) {
    EvenDeeper.Bookmarklet.UI.showLoading();
  }
  
  function onWontProcessThisPage(page) {
    alert("Sorry - EvenDeeper couldn't find a large enough news article in this page to process.");
  }

	function onArticleFetchError() {
		alert("Sorry - a problem occured fetching similar articles.");
	}
  
  return {
    init: function() {            
      EvenDeeper.Bookmarklet.UI.init();
      
      var context = {
        doc: document,
        articleDataSource: "GoogleReaderShared",
        onFinishedCalculatingSimilarities: onFinishedCalculatingSimilarities,
        onStartedCalculatingSimilarities: onStartedCalculatingSimilarities,
				onArticleFetchError: onArticleFetchError,
        onWontProcessThisPage: onWontProcessThisPage
      };
      
      _page = new EvenDeeper.Page(context);
      _page.process();
    }
  };
}();

// run it immediately because we've just been loaded from the bookmarklet
EvenDeeper.Bookmarklet.PageController.init();

