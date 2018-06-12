const express = require('express');
const hbs = require('hbs');
const session = require('express-session');
const Store = require('express-sequelize-session')(session.Store);
const passport = require('passport');
const bodyParser = require('body-parser');
const compression = require('compression');
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
const scoreJob = require('./score-job');
const Umzug = require('umzug');
const umzug = new Umzug({
    storage: "sequelize",
    storageOptions: {
        sequelize: instance,
    },
    migrations: {
        params: [
            instance.getQueryInterface(),
            instance.constructor,
            instance,
        ]
    }
});

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

require('./hbs_helpers.js')();

app.use(compression());
require('./routes/static.js')(app);
app.use("/static", express.static(__dirname + '/static'));
app.use(express.static(__dirname + '/assets/images'));
app.use(express.static(__dirname + '/webroot'));

// Logging
if(process.env.NODE_ENV === 'production') {
    app.use(morgan('combined'));
} else {
    app.use(morgan('dev'));
}

app.use(helmet.contentSecurityPolicy({
    directives: {
        baseUri: ["'self'"],
        defaultSrc: ["'none'"],
        scriptSrc: ["'self'", "https://www.google.com/recaptcha/", "https://www.gstatic.com/recaptcha/"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
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

app.use((req, res, next) => {
    res.locals.user = req.user;
    res.locals.loggedIn = !!req.user;
    res.locals.csrfToken = req.csrfToken();
    res.locals.websiteName = "WorldCup 2018";

    if(!req.user) {
        // If not logged in there's nothing more to do
        next();
        return;
    }

    instance.query(`
        WITH
        upcoming_matches AS (
            SELECT m.id, m."HomeTeamId", m."AwayTeamId"
            FROM "Match" m
            WHERE m.when > now()
            ORDER BY m.when ASC
            LIMIT 6)
        SELECT m.id as id
        FROM upcoming_matches m
        WHERE
            m."HomeTeamId" IS NOT NULL AND
            m."AwayTeamId" IS NOT NULL AND
            NOT EXISTS (SELECT 1 FROM "Bet" b
                WHERE b."UserId" = $user_id AND
                b."MatchId" = m.id)
    `, {
        raw: true,
        type: instance.QueryTypes.SELECT,
        bind: {
            user_id: req.user.id,
        },
    }).then((result) => {
        res.locals.upcomingMatchesWithoutBet = result.length;
        res.locals.upcomingMatchesWithoutBetIds = result.map(x => x.id);
        next();
    }).catch((err) => {
        console.error(err);
        next();
    })
});

app.use((req, res, next) => {
    instance.query(`
        SELECT count(1)
        FROM "Match"
        WHERE now() > "Match"."when"
            AND "Match"."goalsHome" IS NULL
            AND "Match"."goalsAway" IS NULL
    `, {
        raw: true,
        plain: true,
    }).then((result) => {
        res.locals.hasLiveMatches = result.count > 0;
        next();
    });
});

app.use((req, res, next) => {
    if(!req.user) {
        // If not logged in there's nothing more to do
        next();
        return;
    }

    instance.query(`
        SELECT count(1)
        FROM "Match"
        WHERE now() > "Match"."when" AND
            "Match"."goalsHome" IS NOT NULL AND
            "Match"."goalsAway" IS NOT NULL AND
            ("goalsInsertedAt" > $last_visited or $last_visited is null)
    `, {
        raw: true,
        plain: true,
        bind: {
            last_visited: (req.user ? req.user.pastMatchesLastVisitedAt : null),
        },
    }).then((result) => {
        res.locals.unseenPastMatches = result.count;
        next();
    });
});

routes(app);

umzug.up().then((migrations) => {
    if(migrations.length > 0) {
        console.log("Executed migrations: %s", migrations.map(x => x.file).join(" "));
    } else {
        console.log("Database was up to date!");
    }
    app.listen(config.httpPort, function() {
        console.log('Visit %s', config.origin);
    });
}).catch((err) => {
    console.log("Umzug failed!");
    console.log(err);
});
