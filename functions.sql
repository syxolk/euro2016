CREATE OR REPLACE FUNCTION calc_score(integer, integer, integer, integer, integer) RETURNS integer AS
$$
-- $1 matchHome, $2 matchAway, $3 betHome, $3 betAway
SELECT CASE
WHEN $1 = $3 AND $2 = $4 THEN 3 * $5            -- 3 points for correct result
WHEN $1 - $2 = $3 - $4 THEN 2 * $5             -- 2 points for correct goal difference
WHEN sign($1 - $2) = sign($3 - $4) THEN 1 * $5 -- 1 point for correct winner
ELSE 0
END
$$
LANGUAGE SQL IMMUTABLE RETURNS NULL ON NULL INPUT;

CREATE OR REPLACE FUNCTION user_rank_history(integer, integer) RETURNS integer AS
$$
-- $1 User ID, $2 number of matches to go back
WITH ranks as (SELECT array(
SELECT rank FROM "History"
JOIN "Match" ON ("History"."MatchId" = "Match".id)
WHERE "History"."UserId" = $1 ORDER BY "Match"."when" DESC LIMIT $2) AS x)
SELECT x[array_length(x,1)] - x[1]  FROM ranks;
$$
LANGUAGE SQL STABLE RETURNS NULL ON NULL INPUT;

CREATE OR REPLACE VIEW score_table
AS WITH bets AS (
SELECT b."UserId" as id, sum(calc_score(m."goalsHome", m."goalsAway", b."goalsHome", b."goalsAway", mt."coef")) as score,
count(CASE WHEN calc_score(m."goalsHome", m."goalsAway", b."goalsHome", b."goalsAway", mt."coef") = 3 * mt."coef" THEN 1 END) as count3,
count(CASE WHEN calc_score(m."goalsHome", m."goalsAway", b."goalsHome", b."goalsAway", mt."coef") = 2 * mt."coef" THEN 1 END) as count2,
count(CASE WHEN calc_score(m."goalsHome", m."goalsAway", b."goalsHome", b."goalsAway", mt."coef") = 1 * mt."coef" THEN 1 END) as count1,
count(CASE WHEN calc_score(m."goalsHome", m."goalsAway", b."goalsHome", b."goalsAway", mt."coef") = 0 * mt."coef" THEN 1 END) as count0
FROM "Bet" as b
JOIN "Match" as m ON m."id" = b."MatchId"
JOIN "MatchType" as mt ON m."MatchTypeId" = mt."id" 
WHERE now() > m."when"  -- check if match is expired
GROUP BY b."UserId"
)
SELECT "User"."name" as name,
"User"."id" as id, coalesce(bets.score, 0) as score,
coalesce(count3, 0) as count3, coalesce(count2, 0) as count2,
coalesce(count1, 0) as count1, coalesce(count0, 0) as count0
FROM "User" LEFT JOIN bets ON "User"."id" = bets.id
WHERE "User"."emailConfirmed" = true
;

CREATE OR REPLACE FUNCTION set_match_result(integer, integer, integer) RETURNS void AS
$$
-- $1 match ID, $2 goals home, $3 goals away
UPDATE "Match" SET "goalsHome" = $2, "goalsAway" = $3 WHERE id = $1;
DELETE FROM "History" WHERE "MatchId" = $1;
INSERT INTO "History"("UserId","MatchId",rank)
SELECT id, $1, rank() over (order by score desc) as rank FROM score_table
$$
LANGUAGE SQL;

CREATE OR REPLACE VIEW match_table
AS SELECT "Match"."id" as id,
"Match"."when" as when,
(SELECT name FROM "MatchType" WHERE "MatchType"."id" = "Match"."MatchTypeId") as matchtype,
(SELECT name FROM "Team" WHERE "Team"."id" = "Match"."HomeTeamId") as hometeam,
(SELECT name FROM "Team" WHERE "Team"."id" = "Match"."AwayTeamId") as awayteam,
count("Bet"."id") as countbets,
round(100.0 * count(CASE WHEN "Bet"."goalsHome" > "Bet"."goalsAway" THEN 1 END) / count("Bet"."id")) as winnerhome,
round(100.0 * count(CASE WHEN "Bet"."goalsHome" < "Bet"."goalsAway" THEN 1 END) / count("Bet"."id")) as winneraway,
avg("Bet"."goalsHome") as avghome,
avg("Bet"."goalsAway") as avgaway,
"Match"."tv" as tv,
(SELECT array_agg("User"."name") FROM "User" WHERE "User"."emailConfirmed" = true AND "Match"."when" > "User"."createdAt" AND NOT EXISTS (SELECT 1 FROM "Bet" WHERE "Bet"."UserId" = "User"."id" AND "Bet"."MatchId" = "Match"."id")) as listnobetnames,
(SELECT array_agg("User"."id") FROM "User" WHERE "User"."emailConfirmed" = true AND "Match"."when" > "User"."createdAt" AND NOT EXISTS (SELECT 1 FROM "Bet" WHERE "Bet"."UserId" = "User"."id" AND "Bet"."MatchId" = "Match"."id" )) as listnobetids
FROM "Match"
 -- No LEFT JOIN here to discard matches without bets (and prevent division by zero)
JOIN "Bet" ON "Match"."id" = "Bet"."MatchId"
WHERE now() > "Match"."when" AND "Match"."goalsHome" IS NULL AND "Match"."goalsAway" IS NULL
GROUP BY "Match"."id";

CREATE OR REPLACE VIEW past_match_table
AS SELECT "Match"."id" as id,
"Match"."when" as when,
(SELECT name FROM "MatchType" WHERE "MatchType"."id" = "Match"."MatchTypeId") as matchtype,
 "Match"."goalsHome" as goalshome,
 "Match"."goalsAway" as goalsaway,
(SELECT name FROM "Team" WHERE "Team"."id" = "Match"."HomeTeamId") as hometeam,
(SELECT name FROM "Team" WHERE "Team"."id" = "Match"."AwayTeamId") as awayteam,
array_agg("Bet"."goalsHome" ORDER BY "Bet"."goalsHome" DESC, "Bet"."goalsAway" DESC, "User"."name" ASC) as listhome,
array_agg("Bet"."goalsAway" ORDER BY "Bet"."goalsHome" DESC, "Bet"."goalsAway" DESC, "User"."name" ASC) as listaway,
array_agg("User"."name" ORDER BY "Bet"."goalsHome" DESC, "Bet"."goalsAway" DESC, "User"."name" ASC) as listname,
array_agg("User"."id" ORDER BY "Bet"."goalsHome" DESC, "Bet"."goalsAway" DESC, "User"."name" ASC) as listid,
array_agg(calc_score("Match"."goalsHome", "Match"."goalsAway", "Bet"."goalsHome", "Bet"."goalsAway", "MatchType"."coef" ) ORDER BY "Bet"."goalsHome" DESC, "Bet"."goalsAway" DESC, "User"."name" ASC) as listscore,
count("Bet"."id") as countbets,
round(100.0 * count(CASE WHEN "Bet"."goalsHome" > "Bet"."goalsAway" THEN 1 END) / count("Bet"."id")) as winnerhome,
round(100.0 * count(CASE WHEN "Bet"."goalsHome" < "Bet"."goalsAway" THEN 1 END) / count("Bet"."id")) as winneraway,
avg("Bet"."goalsHome") as avghome,
avg("Bet"."goalsAway") as avgaway,
(SELECT array_agg("User"."name") FROM "User" WHERE "User"."emailConfirmed" = true AND "Match"."when" > "User"."createdAt" AND NOT EXISTS (SELECT 1 FROM "Bet" WHERE "Bet"."UserId" = "User"."id" AND "Bet"."MatchId" = "Match"."id" )) as listnobetnames,
(SELECT array_agg("User"."id") FROM "User" WHERE "User"."emailConfirmed" = true AND "Match"."when" > "User"."createdAt" AND NOT EXISTS (SELECT 1 FROM "Bet" WHERE "Bet"."UserId" = "User"."id" AND "Bet"."MatchId" = "Match"."id" )) as listnobetids
FROM "Match"
 -- No LEFT JOIN here to discard matches without bets (and prevent division by zero)
JOIN "Bet" ON "Match"."id" = "Bet"."MatchId"
JOIN "MatchType" ON "Match"."MatchTypeId" = "MatchType"."id"
JOIN "User" ON "User"."id" = "Bet"."UserId"
WHERE now() > "Match"."when" AND "Match"."goalsHome" IS NOT NULL AND "Match"."goalsAway" IS NOT NULL
GROUP BY "Match"."id"
ORDER BY "Match"."when" DESC;
