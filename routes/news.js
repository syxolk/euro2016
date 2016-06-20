const instance = require('../models').instance;
const News = instance.model('News');
const Feed = require('feed');
const config = require('../config');
const bluebird = require('bluebird');

module.exports = function(app) {
    app.get('/news', function (req, res) {
        News.findAll({limit: 10, order: [['createdAt', 'DESC']]}).then(function(news) {
            res.render('news', {news, loggedIn: !!req.user, loggedUser: req.user, telegramLink: config.telegram.link});
        }).catch(function() {
            res.status(500).send('Internal Error');
        });
    });

    app.get('/news.atom', function(req, res) {
        bluebird.join(
            News.max('createdAt'),
            News.findAll({limit: 10, order: [['createdAt', 'DESC']]}),
        function(maxDate, news) {
            const feed = new Feed({
                id: config.origin,
                title: 'Euro 2016',
                link: config.origin,
                updated: maxDate
            });
            for(var index in news) {
                feed.addItem({
                    id: config.origin + '/news/' + news[index].id,
                    title: news[index].headline,
                    link: config.origin + '/news',
                    date: news[index].createdAt,
                    author: [{
                        name: 'wetten2016.de',
                        email: 'info@wetten2016.de',
                        link: config.origin
                    }]
                });
            }
            res.setHeader('Content-Type', 'application/atom+xml; charset=utf-8');
            res.send(feed.render('atom-1.0'));
        }).catch(function() {
            res.status(500).send('Internal Error');
        });
    });
};
