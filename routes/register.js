const config = require('../config');
const instance = require('../models').instance;
const User = instance.model('User');
const request = require('request');
const bcrypt = require('bcrypt');
const mailgun = require('mailgun-js')({
    apiKey: config.mailgun.secretKey,
    domain: config.mailgun.domain
});
const nodemailer = require("nodemailer").createTransport( config.nodemailer ) ;
const uuid = require('uuid');
const mustache = require('mustache');

const RECAPTCHA_URL = 'https://www.google.com/recaptcha/api/siteverify';
const BCRYPT_ROUNDS = 10;

const MAIL_TEMPLATE =
`Hello {{{name}}},
thank you for registering on {{{domain}}}

Please confirm your email address:
{{{url}}}`;

record_user = function ( req, res ) {
    bcrypt.hash(req.body.password, BCRYPT_ROUNDS, function(err, encrypted) {
        const token = uuid.v4();
        User.create({
            name: req.body.name,
            password: encrypted,
            email: req.body.email,
            emailConfirmed: false,
            emailConfirmToken: token
        }).then(function(user) {
            var mail = {
                from: config.email.from,
                to: req.body.email,
                subject: 'Activate your Euro 2016 account',
                text: mustache.render(MAIL_TEMPLATE, {
                    name: req.body.name,
                    domain: config.origin,
                    url: config.origin + '/activate/' + token
                })
            };

            if ( config.email.solution=="mailgun" ) {
                console.log ( "Sending email to %s using mailgun", req.body.email ) ;
                mailgun.messages().send(mail, function(err, body) {
                    if(err) {
                        req.flash('error', 'Could not send confirmation email.');
                        res.redirect('/register');
                    } else {
                        res.redirect('/me');
                    }
                });
            }
            else if ( config.email.solution=="nodemailer" ) {
                console.log ( "Sending email to %s using nodemailer", req.body.email ) ;
                nodemailer.sendMail(mail, function(err, response){
                    if ( err ) {
                        req.flash('error', 'Could not send confirmation email.');
                        res.redirect('/register');
                    } else {
                        res.redirect('/me');
                    }
                    nodemailer.close();
                });
            }
            else {
                console.log ( "Configuration error, unsupported email.solution: %s", config.email.solution ) ;
            }
        }).catch(function(err) {
            req.flash('error', 'Email address is already in use: '+ JSON.stringify(err));
            res.redirect('/register');
        });
    });
};

module.exports = function(app) {
    app.get('/register', function(req, res) {
        res.render('register', {
            csrfToken: req.csrfToken(),
            key: config.recaptcha.key,
            loggedIn: !!req.user,
            loggedUser: req.user,
            error: req.flash('error'),
            name: req.flash('name'),
            email: req.flash('email')
        });
    });

    app.post('/register', function(req, res) {
        // Save name and email in flash
        req.flash('name', req.body.name);
        req.flash('email', req.body.email);
 
        if ( config.recaptcha.active ) {
            request.post({
                url: RECAPTCHA_URL,
                form: {
                    secret: config.recaptcha.secret,
                    response: req.body['g-recaptcha-response']
                }
            }, function(err, httpResponse, body) {
                if(JSON.parse(body).success === true) {
                    record_user ( req, res );
                } else {
                    req.flash('error', 'Wrong captcha solution');
                    res.redirect('/register');
                }
            });
        }
        else {
            record_user ( req, res );
        }
    });

    app.get('/activate/:code', function(req, res) {
        User.findOne({
            where: {
                emailConfirmToken: req.params.code
            }
        }).then(function(user) {
            user.emailConfirmToken = null; // delete token, may be used only once
            user.emailConfirmed = true;
            return user.save();
        }).then(function(user) {
            res.render('activate', {
                success: true,
                loggedIn: !!req.user,
                loggedUser: req.user
            });
        }).catch(function() {
            res.render('activate', {
                success: false,
                loggedIn: !!req.user,
                loggedUser: req.user
            });
        });
    });
};
