const bluebird = require('bluebird');
const instance = require('../models').instance;
const Team = instance.model('Team');
const MatchType = instance.model('MatchType');
const Match = instance.model('Match');
const moment = require('moment');
const push = require('./push');

module.exports = function(app) {
    app.get('/admin', function(req, res) {
        if(!req.user || req.user.admin !== true) {
            res.status(404).render('404', {loggedIn : !!req.user, loggedUser: req.user});
            return;
        }

        const now = new Date();

        bluebird.join(
            Team.findAll({order: [['code', 'ASC']]}),
            MatchType.findAll(),
            Match.findAll({
                where: {
                    when: { $lt: instance.fn('now') },
                    goalsHome: null,
                    goalsAway: null
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
                order: [['when', 'ASC']]
            }),
            function(teams, matchTypes, liveMatches) {
            res.render('admin', {
                teams,
                matchTypes,
                liveMatches,
                date: moment().format('YYYY-MM-DD'),
                time: moment().format('HH:mm'),
                loggedIn: !!req.user,
		loggedUser: req.user,
                csrfToken: req.csrfToken(),
                message: req.flash('message'),
                error: req.flash('error')
            });
        });
    });

    app.post('/admin', function(req, res) {
        if(!req.user || req.user.admin !== true) {
            res.redirect('/admin');
            return;
        }

        if(req.body.command === 'create_match') {
            Match.create({
                HomeTeamId: req.body.home,
                AwayTeamId: req.body.away,
                MatchTypeId: req.body.type,
                when: moment(req.body.date + ' ' + req.body.time, 'YYYY-MM-DD HH:mm').toDate()
            }).then(function(match) {
                pushMatchCreate(match.id);
                req.flash('message', 'Match ' + match.id + ' created.');
                res.redirect('/admin');
            }).catch(function(err) {
                req.flash('error', 'Failed to create match.');
                res.redirect('/admin');
            });
        } else if(req.body.command === 'match_result') {
            instance.query('SELECT set_match_result($id,$home,$away)', {
                raw: true,
                bind: {
                    id: parseInt(req.body.match),
                    home: parseInt(req.body.home),
                    away: parseInt(req.body.away)
                }
            }).then(function() {
                pushMatchResult(req.body.match);
                req.flash('message', 'Match ' + req.body.match + ' was updated.');
                res.redirect('/admin');
            }).catch(function() {
                req.flash('error', 'Failed to set match result');
                res.redirect('/admin');
            });
        } else if(req.body.command === 'publish_news') {
            push(req.body.headline).then(function() {
                req.flash('message', 'Published News.');
                res.redirect('/admin');
            }).catch(function() {
                req.flash('error', 'Failed to publish news');
                res.redirect('/admin');
            });
        } else {
            req.flash('error', 'Unknown command');
            res.redirect('/admin');
        }
    });
};

function pushMatchCreate(matchId) {
    Match.findOne({
        where: {
            id: matchId
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
        ]
    }).then(function(match) {
        const headline = 'New match: ' + match.HomeTeam.name +
            ' vs ' + match.AwayTeam.name + ' (' + match.MatchType.name +
            ') taking place ' + moment(match.when).calendar();
        push(headline);
    });
}

function pushMatchResult(matchId) {
    Match.findOne({
        where: {
            id: matchId
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
        ]
    }).then(function(match) {
        var headline = '';
        if(match.goalsHome > match.goalsAway) {
            headline = match.HomeTeam.name + ' wins against ' +
                match.AwayTeam.name + ' ' + match.goalsHome + ' : ' +
                match.goalsAway;
        } else if(match.goalsAway > match.goalsHome) {
            headline = match.AwayTeam.name + ' wins against ' +
                match.HomeTeam.name + ' ' + match.goalsAway + ' : ' +
                match.goalsHome;
        } else {
            headline = match.HomeTeam.name + ' vs ' + match.AwayTeam.name +
                ' ends up in a tie ' + match.goalsHome + ' : ' + match.goalsAway;
        }

        push(headline);
    });
}
