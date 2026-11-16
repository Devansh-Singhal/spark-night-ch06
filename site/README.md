# Nabz judge site

The site is a standalone static build. Use Node 22 or later. It serves on port 4179 and has no package dependencies.

```sh
cd site
npm test
npm run dev
```

Open <http://127.0.0.1:4179>. Run `npm run build` to generate `site/dist/` for static hosting. Run `npm start` inside `site/` to serve the existing build locally. Run the build again after edits.

## Simulator handoff

1. Start the simulator using its own branch and documented launch command. The website does not build or serve the simulator.
2. Create a file named `.env.local` inside `site/` with the simulator’s actual launch URL:

   ```dotenv
   NABZ_SIMULATOR_URL=http://127.0.0.1:5180/
   ```

   Port 5180 is an example. For hosting, set the same environment variable to the deployed HTTP(S) URL or an origin-relative route such as `/replay/` if the host serves that route. The URL is public build configuration.
3. Run `npm run dev` locally or rebuild the hosted site. Both **Run the simulation** links open the configured URL in the same tab. With no URL set, they open the site’s synthetic trace walkthrough.

At handoff, compare the actual replay with the story for Station 02, Part 0184, and three arcs out of four at cycle close. The trace’s third-arc position is schematic. Reconcile any agreed scenario and counts with the replay, then verify both entry links, run the missed-arc scenario, and use browser Back to return to the site. The public site quotes no simulator lead times, validation rates, or run savings.

## Evidence and assumptions

- The 52-car SIAM figure is 14 Škoda plus 38 Volkswagen vehicles in the 28 October 2024 entries. The missed seam was suspected.
- Intel’s figures are test ROC AUC rounded to two decimals. The paper uses robotic welding with dedicated audio and video equipment. The public Edge Impulse counts describe the published data split. Neither measures Nabz’s factory performance.
- The fictional Kundli line starts at 60,000 parts/year (240 parts/day × 250 working days), 1% affected parts, ₹400 avoidable loss per affected part, and 30% avoidable share. These are editable assumptions. The resulting gross estimate is ₹72,000/year with a ₹36,000–₹1,08,000 sensitivity at 15%–45% avoided share. The range is a scenario sensitivity and has no statistical confidence interpretation.
