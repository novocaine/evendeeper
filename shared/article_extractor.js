// simplified version of the approach used in http://lab.arc90.com/experiments/readability/js/readability.js;
// idea is to score each p and add the score to its parent element; the element with the greatest score is the winner
EvenDeeper.ArticleExtractor = {
	findData: function(doc) {
		var bodyDiv = null;
		
		var ps = doc.getElementsByTagName("p");
		var len = ps.length;
		
		var p = null;
		var score = 0;
		var content = null;
		var candidates = [];
		var candidate_scores = [];
		
		for (var i=0; i < len; ++i) {
			p = ps[i];        
			content = p.textContent;
			
			if (content.length < 25) {
				continue;
			}
			
			// base of 1
			score = 1;
			
			// 1 for each comma;
			var index;
			do {
				index = content.indexOf(",", index) + 1;
				++score;
			} while (index != 0);
			
			// add a point for each 100 chars up to a max of 3 points
			if (content.length > 100) {
				score += 1;
			} else if (content.length > 200) {
				score += 2;
			} else if (content.length > 300) {
				score += 3;
			}
			
			var parentNode = p.parentNode;        
			parentNode.EvenDeeper_score = (parentNode.EvenDeeper_score || 0) + score;        
			candidates.push(parentNode);

			var grandParentNode = parentNode.parentNode;
			// grandparent gets half score
			score = score >> 1;                
			grandParentNode.EvenDeeper_score = (grandParentNode.EvenDeeper_score || 0) + score;        
			candidates.push(grandParentNode);
		}
		
		// figure out candidate with best score
		var highest_score = -1;
		var best_candidate = null;
		
		for (i=0, len = candidates.length; i < len; ++i) {
			var node_score = candidates[i].EvenDeeper_score;
			if (node_score > highest_score) {
				highest_score = node_score;
				best_candidate = candidates[i];
			}
		}
		
		EvenDeeper.debug("extracted: ");
		EvenDeeper.debug(best_candidate);
												
		return {
			body: best_candidate,
			title: document.title,
			sourceName: document.location.href
		};
	}
};
