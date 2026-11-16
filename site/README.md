# Nabz judge site

The site is a standalone static build. Use Node 22 or later. It serves on port 4179 and has no package dependencies.

```sh
cd site
npm test
npm run dev
```

Open <http://127.0.0.1:4179>. Run `npm run build` to generate `site/dist/` for static hosting. Run `npm start` inside `site/` to serve the existing build locally. Run the build again after edits.

## Simulator handoff

1. From the repository root, run `npm start` in a separate terminal. The replay serves at <http://localhost:5173/> by default. If 5173 is in use, set `PORT=5180` before starting it. In PowerShell, use `$env:PORT = "5180"; npm start`. The same command works from a separate checkout of the [simulator branch](https://github.com/Devansh-Singhal/spark-night-ch06/tree/claude/modest-thompson-xbc2zq).
2. Create a file named `.env.local` inside `site/` with the simulator’s actual launch URL:

   ```dotenv
   NABZ_SIMULATOR_URL=http://127.0.0.1:5180/
   ```

   Use the port you started the simulator on. For hosting, set the same environment variable to the deployed HTTP(S) URL or an origin-relative route such as `/replay/` if the host serves that route. The URL is public build configuration.
3. Run `npm run dev` locally or rebuild the hosted site. Both **Run the simulation** links open the configured URL in the same tab. With no URL set, they open the site’s synthetic trace walkthrough.

The site uses the **Worn tip** scenario and default cost inputs at simulator commit [dfe4c1d](https://github.com/Devansh-Singhal/spark-night-ch06/commit/dfe4c1d58ba1e29a1ab3aeb421c6f70b1860e17b). Choose **Keep running** to see the hold on 0184. Choose **Stop & check setup** to see the earlier intervention and baseline comparison. The trace’s windows are schematic. If the simulator changes the scenario or defaults, check the case figures against the new run before presenting.

## Evidence and assumptions

- The 52-car SIAM figure is 14 Škoda plus 38 Volkswagen vehicles in the 28 October 2024 entries. The missed seam was suspected.
- Intel’s figures are test ROC AUC rounded to two decimals. The paper uses robotic welding with dedicated audio and video equipment. The public Edge Impulse counts describe the published data split. Neither measures Nabz’s factory performance.
- The Worn tip scenario stipulates a lead of 12 parts at 48 s per part = 9.6 min. It compares ₹25,200 for late discovery with ₹150 for the setup stop, a modeled difference of ₹25,050. Sorting covers handling labor for the held lot, and scrap covers the loss on the 46 scrapped parts. The figures describe one synthetic run.
- The fictional Kundli line starts at 60,000 parts/year (240 parts/day × 250 working days), 1% affected parts, ₹400 avoidable loss per affected part, and 30% avoidable share. These are editable assumptions. The resulting gross estimate is ₹72,000/year with a ₹36,000–₹1,08,000 sensitivity at 15%–45% avoided share. The range is a scenario sensitivity and has no statistical confidence interpretation.
