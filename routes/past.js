const bluebird = require('bluebird');
const instance = require('../models').instance;
const Bet = instance.model('Bet');
const User = instance.model('User');

module.exports = function(app) {
    app.get('/past', function(req, res) {
        instance.query('SELECT * FROM past_match_table', {type: instance.QueryTypes.SELECT})
        .then(function(matches) {
            for(var i = 0; i < matches.length; i++) {
                var match = matches[i];
                match.draw = 100 - match.winnerhome - match.winneraway;
                var bets = {0: [], 1: [], 2: [], 3: []};
		var nobet = [];
		match.nobet = nobet;
                for(var j = 0; j < match.listscore.length; j++) {
                    bets[match.listscore[j]].push({
                        name: match.listname[j],
                        goalsHome: match.listhome[j],
                        goalsAway: match.listaway[j],
                        id: match.listid[j]
                    });
                }
		for(var j = 0; j < match.listnobetids.length; j++) {
		    match['nobet'].push({
			name: match.listnobetnames[j],
			id: match.listnobetids[j]
		   });
		} 
                for(var s = 0; s <= 3; s++) {
                    match['score' + s] = bets[s];
                }
            }

            res.render('past', {matches, loggedIn: !!req.user, loggedUser: req.user});
        });
    });
};
