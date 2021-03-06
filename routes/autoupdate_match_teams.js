const axios = require("axios");
const { knex } = require("../db");

const router = require("express-promise-router")();
module.exports = router;

function getTeamId(teamData) {
    const type = teamData.typeTeam;

    if (type === "PLACEHOLDER") {
        return null;
    } else if (type === "NATIONAL") {
        return teamData.id;
    } else {
        throw new Error(`Unknown team type: ${type}`);
    }
}

async function updateMatchTeam(trx, uefaMatchId, teamData, column) {
    const uefaTeamId = getTeamId(teamData);

    if (uefaTeamId === null) {
        // team is not yet known -> skip it
        return false;
    }

    const team = await trx("team")
        .select("id")
        .where({ uefa_id: uefaTeamId })
        .first();

    if (team === undefined) {
        throw new Error(`Could not find team with id: ${uefaTeamId}`);
    }

    const match = await trx("match")
        .select("id", column)
        .where({ uefa_id: uefaMatchId })
        .first();

    if (match === undefined) {
        throw new Error(`Could not find match with id: ${uefaMatchId}`);
    }

    if (match[column] !== null) {
        // team is already set -> skip it
        return false;
    }

    await trx("match")
        .update({ [column]: team.id })
        .where({ id: match.id });

    return true;
}

router.get("/autoupdate_match_teams", async (req, res) => {
    const matches = await knex("match")
        .select("id", "uefa_id")
        .whereRaw("home_team_id is null OR away_team_id is null");

    const { data } = await axios.get("https://match.uefa.com/v2/matches", {
        params: {
            offset: "0",
            matchId: matches.map((x) => x.uefa_id).join(","),
        },
    });

    const result = [];

    await knex.transaction(async (trx) => {
        for (const matchData of data) {
            if (
                await updateMatchTeam(
                    trx,
                    matchData.id,
                    matchData.homeTeam,
                    "home_team_id"
                )
            ) {
                result.push(`Home team updated for match ${matchData.id}`);
            }

            if (
                await updateMatchTeam(
                    trx,
                    matchData.id,
                    matchData.awayTeam,
                    "away_team_id"
                )
            ) {
                result.push(`Away team updated for match ${matchData.id}`);
            }
        }
    });

    res.json({
        ok: true,
        result,
    });
});
