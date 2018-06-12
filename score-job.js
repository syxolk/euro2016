const schedule = require('node-schedule');
const bluebird = require('bluebird');
const instance = require('./models').instance;
const Team = instance.model('Team');
const MatchType = instance.model('MatchType');
const Match = instance.model('Match');
const moment = require('moment');
const Request = require("request");
const config = require('./config');

Match.findAll({
    where: {
        //when: { $lt: instance.fn('now') },
        goalsHome: null,
        goalsAway: null
    },
    include: [{
        model: Team,
        as: 'HomeTeam'
    }, {
        model: Team,
        as: 'AwayTeam'
    }, {
        model: MatchType
    }],
    order: [
        ['when', 'ASC']
    ]
}).then(matches => {
    var arrayLength = matches.length;
    if (arrayLength < 1) {
        console.log("All matches have results! no further game result check is scheduled.")
        return;
    }
    var jobs = new Array();
    for (var i = 0; i < arrayLength; i++) {
        if (null === matches[i].FixtureId)
            continue;
        var jobDate = /*new Date(Date.now() + 7 * 1000);*/ matches[i].when;
        var jobEnds = new Date(jobDate.getTime() + (60 * 60 * 1000));
        console.log('football-data.org - get result for fixture:' + matches[i].FixtureId + ' scheduled at: ' + jobDate);
        var j = schedule.scheduleJob({
            start: jobDate,
            end: jobEnds,
            rule: '* * */1 * * *'
        }, function (fixtureId, jobIdx) {
            if (null === fixtureId)
                return;
            var url = "http://api.football-data.org/v1/fixtures/" + fixtureId;
            Request.get({
                url: url,
                headers: {
                    "X-Auth-Token": config.footbalDataApiKey
                }
            }, (error, response, body) => {
                if (error) {
                    return console.log(error);
                }
                var result = JSON.parse(body);
                var readFixture = result.fixture;
                if (null === readFixture || typeof readFixture == 'undefined') {
                    console.log("received null fixture result:", result);
                    return;
                }
                var home = readFixture.homeTeamName;
                var away = readFixture.awayTeamName;
                var homeGoals = readFixture.result.goalsHomeTeam;
                var awayGoals = readFixture.result.goalsAwayTeam;

                console.log('received result for: ', home, ' vs ', away, ' :', homeGoals, ' - ', awayGoals);
                if (homeGoals !== null && awayGoals !== null) {
                    Match.update({
                        goalsHome: parseInt(homeGoals),
                        goalsAway: parseInt(awayGoals),
                        goalsInsertedAt: new Date(Date.now())
                    }, {
                        where: {
                            FixtureId: fixtureId
                        }
                    });
                    jobs[jobIdx].cancel();
                }

            });
        }.bind(null, matches[i].FixtureId, i));
        jobs.push(j);
    }
});