module.exports = function(app) {
    require('./login')(app);
    require('./register')(app);
    require('./facebook')(app);
    require('./google')(app);
    require('./user')(app);
    require('./save_bet')(app);
    require('./highscore')(app);
    require('./settings')(app);
    require('./intro')(app);
    require('./live')(app);
    require('./past')(app);
    require('./admin')(app);
    require('./news')(app);
    require('./friend')(app);

    app.use(function (req, res, next) {
        res.status(404).render('404', {loggedIn : !!req.user, loggedUser: req.user});
    });
};
