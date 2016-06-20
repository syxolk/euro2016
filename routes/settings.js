const instance = require('../models').instance;
const User = instance.model('User');

module.exports = function(app) {
    app.get('/settings', function(req, res) {
        if(! req.user) {
            res.redirect('/login');
            return;
        }

        res.render('settings', {user: req.user, csrfToken: req.csrfToken(),
            loggedIn: true, loggedUser: req.user});
    });

    app.post('/settings', function(req, res) {
        if(! req.user) {
            res.redirect('/login');
            return;
        }

        req.user.name = req.body.name;
        req.user.save().then(function() {
            res.redirect('/settings');
        }).catch(function() {
            res.redirect('/settings?error=1');
        });
    });
};
