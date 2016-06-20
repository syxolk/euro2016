const bluebird = require('bluebird');
const instance = require('../models').instance;
const Bet = instance.model('Bet');
const User = instance.model('User');
const Match = instance.model('Match');
const Team = instance.model('Team');
const MatchType = instance.model('MatchType');

module.exports = function(app) {
    app.get('/live', function(req, res) {
        instance.query('SELECT * FROM match_table', {type: instance.QueryTypes.SELECT})
        .then(function(matches) {
            bluebird.map(matches, function(match) {
                return Bet.findAll({
                    where: {
                        MatchId: match.id
                    },
                    include: [ User ],
                    order: [['goalsHome', 'DESC'], ['goalsAway', 'DESC'], [User, 'name', 'ASC']]
                });
            }).then(function(bets) {
                for(var i = 0; i < matches.length; i++) {
                    matches[i].bets = bets[i];
                    matches[i].draw = 100 - matches[i].winnerhome - matches[i].winneraway;
		    matches[i].nobet = [];
		    for(var j = 0; j < matches[i].listnobetids.length; j++) {
			matches[i]['nobet'].push({
				id: matches[i].listnobetids[j],
				name: matches[i].listnobetnames[j]
			});
		    } 
                }

                Match.findAll({
                    where: {
                        when: { $gt: instance.fn('now') }
                    },
                    include: [
                        {
                            model: Team,
                            as: 'HomeTeam'
                        }, {
                            model: Team,
                            as: 'AwayTeam'
                        }, {
                            model: MatchType
                        }
                    ],
                    order: [['when', 'ASC']],
                    limit: 3
                }).then(function(nextMatches) {
                    res.render('live', {matches, nextMatches, loggedIn: !!req.user, loggedUser: req.user});
                });
            });
        });
    });
};
