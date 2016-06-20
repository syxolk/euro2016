require('coffee-script').register();
const http = require('http');
const https = require('https');
const express = require('express');
const hbs = require('hbs');
const session = require('express-session');
const Store = require('express-sequelize-session')(session.Store);
const passport = require('passport');
const bodyParser = require('body-parser');
const compression = require('compression');
const moment = require('moment');
const csrf = require('csurf');
const fs = require('fs');
const helmet = require('helmet');
const ms = require('ms');
const morgan = require('morgan');
const flash = require('connect-flash');
const packageJson = require('./package.json');
const routes = require('./routes');
const config = require('./config');
const instance = require('./models').instance;

passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    instance.model('User').findById(id).then(function(user) {
        done(null, user);
    }).catch(function(err) {
        done(err, false);
    });
});

hbs.registerPartials(__dirname + '/views/partials');

const app = express();
app.set('view engine', 'hbs');
app.set('views', __dirname + '/views');
app.disable('x-powered-by');
app.enable('strict routing');
app.enable('case sensitive routing');

app.locals.origin = config.origin;
hbs.localsAsTemplateData(app);

hbs.registerHelper('asset', function(path) {
    return path;
});

moment.updateLocale('en', {
    calendar : {
        lastDay : '[Yesterday at] H:mm',
        sameDay : '[Today at] H:mm',
        nextDay : '[Tomorrow at] H:mm',
        lastWeek : '[Last] dddd [at] H:mm',
        nextWeek : 'dddd [at] H:mm',
        sameElse : 'L'
    }
});

hbs.registerHelper('calendar', function(when) {
    return moment(when).format('dddd, MMMM Do, H:mm');
});

hbs.registerHelper('eq', function(param1, param2) {
    return param1 == param2;
});

hbs.registerHelper('sup', function(param1, param2) {
    return param1 > param2;
});

hbs.registerHelper('calendarShort', function(when) {
    return moment(when).format('MMM D, H:mm');
});

hbs.registerHelper('newsDate', function(when) {
    return moment(when).calendar();
});

hbs.registerHelper('toFixed1', function(number) {
    return Math.round(number * 10) / 10;
});

hbs.registerHelper('showGoals', function (goals) {
    return goals === undefined || goals === null ? '-' : goals + '';
});

hbs.registerHelper('isZero', function(num) {
    return num === 0 || num === '0';
});

hbs.registerHelper('gt0', function(val) {
    return val > 0;
});

hbs.registerHelper('eq0', function(val) {
    return val === 0;
});

hbs.registerHelper('lt0', function(val) {
    return val < 0;
});

app.use(compression());
app.use(express.static(__dirname + '/dist'));
app.use(express.static(__dirname + '/assets/images'));
app.use(express.static(__dirname + '/webroot'));

// Logging
if(process.env.NODE_ENV === 'production') {
    const logDirectory = __dirname + '/log';
    if(! fs.existsSync(logDirectory)) {
        fs.mkdirSync(logDirectory);
    }
    const logStream = require('file-stream-rotator').getStream({
        date_format: 'YYYYMMDD',
        filename: logDirectory + '/access%DATE%.log',
        frequency: 'daily',
        verbose: false
    });
    app.use(morgan('combined', {stream: logStream}));
} else {
    app.use(morgan('dev'));
}

app.use(helmet.csp({
    directives: {
        baseUri: ["'self'"],
        defaultSrc: ["'none'"],
        scriptSrc: ["'self'", "https://www.google.com/recaptcha/", "https://www.gstatic.com/recaptcha/"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        formAction: ["'self'"],
        childSrc: ["https://www.google.com/recaptcha/"],
        frameAncestors: ["'none'"]
    },
    setAllHeaders: false,
    browserSniff: false
}));
app.use(helmet.frameguard({
    action: 'deny'
}));
app.use(helmet.noSniff());
app.use(helmet.xssFilter());
if(config.https) {
    app.use(helmet.hsts({
        maxAge: ms('365d')
    }));
}
app.use(bodyParser.urlencoded({extended: false}));
app.use(session({
    name: 'sid',
    secret: config.sessionSecret,
    store: new Store(instance),
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: !!config.https
    }
}));
app.use(flash());
app.use(csrf());
app.use(passport.initialize());
app.use(passport.session());

routes(app);

instance.sync().then(function() {
    return instance.query(fs.readFileSync(__dirname + '/functions.sql').toString('utf8'), {raw: true});
}).then(function () {
    if(config.https) {
        http.createServer(function(req, res) {
            res.writeHead(301, { 'Location': 'https://' + req.headers.host + req.url });
            res.end();
        }).listen(config.httpPort, function() {
            console.log('HTTPS redirect server running');
        });
        const options = {
            key: fs.readFileSync(config.key),
            cert: fs.readFileSync(config.cert),
            ca: fs.readFileSync(config.ca)
        };
        https.createServer(options, app).listen(config.httpsPort, function() {
            console.log('Visit %s', config.origin);
        });
    } else {
        app.listen(config.httpPort, function() {
            console.log('Visit %s', config.origin);
        });
    }
});
