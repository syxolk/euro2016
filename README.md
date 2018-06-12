# Euro 2016

[![Code Climate](https://codeclimate.com/github/syxolk/euro2016/badges/gpa.svg)](https://codeclimate.com/github/syxolk/euro2016)
[![Codacy Badge](https://api.codacy.com/project/badge/grade/35f72d8dc9964c9389aa4937c98dd571)](https://www.codacy.com/app/hans-kirchner-info/euro2016)
[![David DM](https://david-dm.org/syxolk/euro2016.svg)](https://david-dm.org/syxolk/euro2016)

Euro 2016 is a web service written in [Node.js][nodejs],
giving you and your friends :boy: :girl: a platform of competition: Who is the
better forecaster of football :soccer: matches? Make bets of future matches,
collect scores and win the crown :crown:.

**Scoring**
- :star::star::star: correct bet
- :star::star: correct goal difference
- :star: correct winner

The [UEFA European Championship 2016][uefa] is taking place in France :fr:
from June 10 to July 10. Happy betting!

## Install
You need to have [PostgreSQL][postgres] :elephant: >= 9.3 installed and
configured with a new database. Node.js is required of course, recommended
versions are >=4.4.0.

    git clone https://github.com/syxolk/euro2016.git
    cd euro2016
    npm install

Now copy `template.config.coffee` to `config.coffee` and set the
database connection.

    cp template.config.coffee config.coffee
    nano config.coffee

Before the first run you usually want to add all matches and teams:

    node tools/populate.js tools/euro2016.json

## Run
The database structure will be created on first run automatically.

    node index.js

## Update
How to update euro2016 to the newest version:

    git pull
    npm install

## Notes

- Bower is no longer needed. We use gulp now. You can delete the
  `bower_components` folder.
- added code to check results from WorldCup 2018 at http://api.football-data.org/v1/competitions/467

## Credits
Icons made by [Papedesign][papedesign] from [www.flaticon.com][flaticon] is
licensed by [CC 3.0 BY][ccby]

[nodejs]: https://nodejs.org/en/
[uefa]: http://www.uefa.com/uefaeuro/
[postgres]: http://www.postgresql.org/
[papedesign]: http://www.flaticon.com/authors/papedesign
[flaticon]: http://www.flaticon.com
[ccby]: http://creativecommons.org/licenses/by/3.0/
