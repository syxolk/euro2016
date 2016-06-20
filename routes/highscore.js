const instance = require('../models').instance;

module.exports = function(app) {
    app.get('/highscore', function(req, res) {
        var orderBy = 'score DESC, count3 DESC, count2 DESC, count1 DESC, count0 DESC, name ASC';
	var orderField = req.query.order;
        switch(req.query.order) {
            case 'name': orderBy = 'name ASC'; orderField = 'name'; break;
            case '3': orderBy = 'count3 DESC, score DESC, count2 DESC, count1 DESC, count0 ASC, name ASC'; break;
            case '2': orderBy = 'count2 DESC, score DESC, count3 DESC, count1 DESC, count0 ASC, name ASC'; break;
            case '1': orderBy = 'count1 DESC, score DESC, count3 DESC, count2 DESC, count0 ASC, name ASC'; break;
            case '0': orderBy = 'count0 DESC, score DESC, count3 DESC, count2 DESC, count1 DESC, name ASC'; break;
        }
        const onlyFriends = req.query.friends === '1';

        instance.query(`SELECT name, score, id, count3, count2, count1, count0,
            id = $id as isme, id in (SELECT "ToUserId" FROM "Friend" WHERE "FromUserId" = $id) as isfriend,
            user_rank_history(id, 3) as history,
            rank() over (order by score desc) as rank FROM score_table` +
            (onlyFriends ? ' WHERE id = $id OR id in (SELECT "ToUserId" FROM "Friend" WHERE "FromUserId" = $id)' : '') +
            ' ORDER BY ' + orderBy,
            {
                type: instance.QueryTypes.SELECT,
                bind: {id: (req.user ? req.user.id : 0)}
            })
        .then(function(results) {
            res.render('highscore', {
                csrfToken: req.csrfToken(),
                users: results,
                loggedIn: !!req.user,
                loggedUser: req.user,
                orderScore: orderField === '',
                orderName: orderField === 'name',
                order3: orderField === '3',
                order2: orderField === '2',
                order1: orderField === '1',
                order0: orderField === '0',
                friends: onlyFriends,
            });
        });
    });
};
