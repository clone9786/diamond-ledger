# Diamond Ledger

A personal sports research viewer for five leagues — **MLB, NFL, NBA, NHL and college football** — with a **Parlay Lab** for exploring hypothetical multi-leg tickets.

**▶ Live site: https://clone9786.github.io/diamond-ledger/**

## What is this?

Diamond Ledger gathers each day's games, model forecasts and reported prices into a single "sports desk" you can browse. It's a hobby project, built for curiosity and for playing around with friends — a way to see how a model reads a slate and to experiment with parlay combinations.

**It is not betting advice.** The forecasts carry no validated betting edge, the figures are illustrative model scenarios, and nothing here is a tip, a prediction you should act on, or a recommendation to wager. Treat it as entertainment.

## How to use it

1. Open the live site. The **home page** shows today's slate across all five sports — click any matchup to inspect its forecast and the reported market.
2. Use the search box, sport filters and sort options to find games.
3. Open **Parlay Lab** from the top navigation to build a hypothetical ticket: choose a sport, number of legs, and how to rank candidates, and the lab estimates a hit chance and payout for each combination. "Full-hit chance" means every leg wins; payouts and returns shown are illustrative only.

The published site is read-only — the "Update" and "Refresh" buttons simply load the latest published data. Timestamps throughout show how fresh the data is. Scheduled updates run roughly every 30 minutes and can occasionally be delayed.

## Notes

- The forecasting and calculation code lives in a separate private repository; this repo holds the public viewer and the scheduled publishing workflow. All five sports update independently of any owner machine.
- This is a personal trial, not a commercial hosting deployment. The static site collects no usage analytics and exposes no owner dashboard.
- No license to reuse the code or published material is granted.
