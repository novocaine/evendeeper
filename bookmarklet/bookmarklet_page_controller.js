EvenDeeper.Bookmarklet.PageController = function() {
	var _corpus = new NLP.Corpus();
	var _currentArticle = null;

  function onFinishedCalculatingSimilarities(scores) {
    EvenDeeper.Bookmarklet.UI.showResults(scores);
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

	function onGoogleReaderSuccess(googleReader) {
		var items = googleReader.loadedItems();
		var articles = [];

		// add all the articles to the corpus
		for (var i=0; i < items.length; ++i) {
			var article = googleReader.createArticleFromItem(items[i]);
			articles.push(article);
			addArticleToCorpus(article);
		}

		// do similarity calculation
    _similarity = new EvenDeeper.Similarity(_currentArticle, articles, _corpus);
    _similarity.run(onFinishedCalculatingSimilarities);  
	}

	function addArticleToCorpus(article) {
		var nlpDoc = new NLP.Document(_corpus, article.body(), article.url());
		_corpus.addDocument(nlpDoc);
		// TODO: the best way to fix this atrocity (stashing nlpdocs in articles)
		// would be to make article a subclass of nlpdoc
		article.nlpdoc = nlpDoc;
	}

  return {
    init: function() {            
      EvenDeeper.Bookmarklet.UI.init();
     	EvenDeeper.Bookmarklet.UI.showLoading(); 
			// create article for the current page
			var result = EvenDeeper.ArticleExtractor.findData(document);
			if (!result.body) {
				// the article extractor couldn't find a suitable article body, tell the user
				onWontProcessThisPage();
			} else {
				// Article object representing the current page; i.e. the page the user is looking at
				_currentArticle = new EvenDeeper.Article(result.sourceName, result.title, result.body, document.location.href);
				addArticleToCorpus(_currentArticle);

				var googleReader = new EvenDeeper.GoogleReaderShared.ArticleLoader(document);
				googleReader.loadFeeds(onGoogleReaderSuccess, onArticleFetchError);
			}
    },
  };
}();

// run it immediately because we've just been loaded from the bookmarklet
EvenDeeper.Bookmarklet.PageController.init();

