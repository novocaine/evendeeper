// nlp utilities for even deeper
// author: James Salter 2010

var NLP = {};

NLP.Document = function(text) {
	var _text = text;
	
	// associative array of the frequencies of each word
	var _wordCounts = null;
	var _numWords = null;
	var _tfidfs = null;
	var _accentRegexes = null;
	var __accentReplacements = null;			
	
	function removeAccents(r) {
	  if (_accentRegexes == null) {
	    _accentRegexes = [];
	    _accentRegexes.push(new RegExp("[àáâãäå]", 'g'));
	    _accentRegexes.push(new RegExp("æ", 'g'));
	    _accentRegexes.push(new RegExp("ç", 'g'));
	    _accentRegexes.push(new RegExp("[èéêë]", 'g'));
	    _accentRegexes.push(new RegExp("[ìíîï]", 'g'));
	    _accentRegexes.push(new RegExp("ñ", 'g'));
	    _accentRegexes.push(new RegExp("òóôõö", 'g'));
	    _accentRegexes.push(new RegExp("ùúûü", 'g'));
	    _accentRegexes.push(new RegExp("ýÿ", 'g'));
	    
	    _accentReplacements = [];
	    _accentReplacements.push('a');
	    _accentReplacements.push('ae');
	    _accentReplacements.push('c');
	    _accentReplacements.push('e');
	    _accentReplacements.push('i');    
	    _accentReplacements.push('n');
	    _accentReplacements.push('o');
	    _accentReplacements.push('u');
	    _accentReplacements.push('y');	    
	  }
	  
	  for (i in _accentRegexes) {
      r = r.replace(_accentRegexes[i], _accentReplacements[i]);
    }
    
    return r;
	}
	
	return {
		text: function() { return _text; },
		
		wordCounts: function() {
			if (_wordCounts === null) {	
				_wordCounts = {};					
				// split document into separate words
				var words = _text.split(/\s/);
				
				// save number of words
				_numWords = words.length;
				
				for (var i=0; i < words.length; ++i) {
					var word = words[i];
					word = word.toLowerCase();
					// remove trailing and leading non-alphanumeric chars
					word = word.replace(/[^a-z0-9]+$/, "");
					word = word.replace(/^[^a-z0-9]+/, "");
					// convert accents to ascii chars
					word = removeAccents(word);
					
					if (word.length != 0) {					
  					if (!_wordCounts[word]) {
  						_wordCounts[word] = 1;
  					} else {
  						_wordCounts[word] = _wordCounts[word] + 1;
  					}
  				}
				}
			}
			
			return _wordCounts;
		},
				
		termFrequencies: function() {
			var wordCounts = this.wordCounts();
			var termFrequencies = {};
			
			for (var word in wordCounts) {
				termFrequencies[word] = wordCounts[word] / _numWords;
			}
			
			return termFrequencies;
		},
		
		// term frequency * inverse document frequency
		tfidfs: function() {
			if (_tfidfs === null) {							
				_tfidfs = {};
				
				var termFrequencies = this.termFrequencies();
				
				for (var term in termFrequencies) {				
					_tfidfs[term] = termFrequencies[term] * NLP.Corpus.idf(term);
				}				
			}
			
			return _tfidfs;
		}
	};
};

NLP.Corpus = function() {
	var _documents = [];
	
	return {		
		// inverse document frequency
		idf: function(term) {
			var count = 0;
			// find num docs where the term appears
			for (var doc in _documents) {				
				if (_documents[doc].wordCounts()[term]) { ++count; }					
			}
			
			return Math.log(_documents.length / (count + 1));
		},
		
		docSimilarity: function(doc1, doc2) {
			// form union of terms in both doc1 and doc2
			var unionTerms = {};
			var tfidfs1 = doc1.tfidfs();
			var tfidfs2 = doc2.tfidfs();
			
			for (var term1 in tfidfs1) { unionTerms[term1] = 0; }
			for (var term2 in tfidfs2) { unionTerms[term2] = 0; }
			
			var dotproduct = 0;
			var mag1 = 0;
			var mag2 = 0;						
			
			for (var term in unionTerms) {
				var delta = 0;
				var tfidf1 = tfidfs1[term] ? tfidfs1[term] : delta;				
				var tfidf2 = tfidfs2[term] ? tfidfs2[term] : delta;				
			
				dotproduct += tfidf1 * tfidf2;
				mag1 += (tfidf1 * tfidf1);
								
				mag2 += (tfidf2 * tfidf2);
			}
			
			mag1 = Math.sqrt(mag1);
			mag2 = Math.sqrt(mag2);						
			
			return dotproduct / (mag1 * mag2);
		},
		
		addDocument: function(document) {	_documents.push(document); }
	};
}();