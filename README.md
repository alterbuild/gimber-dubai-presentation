# GIMBER × Dubai: international marketing and growth plan

SME Marketing & Growth Strategies, EDHEC Business School, October 2026.
17 slides in one self-contained HTML file: every slide builds itself when it appears (no clicks inside a slide), with speaker notes, a timer and a presenter view.
Team: Diego Martínez, Juan Tent, Suzanne Jean, Richard Jandin, Anibal Estrada.

**Live version: https://alterbuild.github.io/gimber-dubai-presentation/**

## Open it
Open the live version above, or double-click `GIMBER_Dubai_presentation.html` (works offline, no installation).

| Key | Action |
| --- | --- |
| Arrows, space, click | next / previous slide |
| F | full screen (on Chrome and Edge you can pick the projector) |
| N | speaker notes |
| P | presenter view on a second screen |
| T | small on-screen timer |
| B or . | blank screen |
| I | info |
| Home / End | first / last slide |

## The talk: five parts, one speaker each, 15 minutes
Every speaker presents three content slides and speaks for about 2:50. Diego also opens (slides 1 and 2) and Anibal closes (slide 17). When the speaker changes, an amber "pour" covers the screen and shows the title of the next part.

| Part | Speaker | Slides | Brief questions | Planned |
| --- | --- | --- | --- | --- |
| 1 The brand and the market | Diego | 1 to 4 | Q1 | 2:50 |
| 2 From the market to the customer | Juan | 5 to 7 | Q1 SWOT, Q2, Q3 | 2:50 |
| 3 Personas, positioning and marketing mix | Suzanne | 8 to 10 | Q4, Q5, Q6, Q7 | 2:55 |
| 4 Customer journey, culture and strategy | Richard | 11 to 13 | Q8, Q9, Q10 | 2:50 |
| 5 The numbers, the message and the risks | Anibal | 14 to 17 | Q10, Q11, Q12, Q13 | 2:40 + close |

The last slide holds a bank of 26 questions with model answers in its notes (press N).

## Presenter mode (laptop + projector)
Press **P**: the presenter view opens in its own window (current, next and previous slide, speaker notes, timer, all slides; drag the panels, light or dark). Put the presentation window on the projector and press **F**. Both windows stay in step. Set the displays to Extend, not Mirror. Keys in the presenter view: arrows or space to move, T timer, B blank, + and - notes size, S notes auto-scroll, P panels menu, ? help.

## Folder
- `GIMBER_Dubai_presentation.html`: the finished deck (generated). `index.html` is an identical copy: it is the page that GitHub Pages serves.
- `src/deck.html`: the shell (colours, type, shared styles, slide engine, the pour).
- `src/slides/NN-*.html`: one file per slide (its own style and markup). Elements enter in order through `style="--d:…"` (delay in ms) and the classes `b`, `gx`, `gy`, `dr`, `pop`, `mk`, `cnt`.
- `src/notes.js`: speaker notes of every slide and the questions bank. The label of each note ("about 0:55") sets the planned time that the timer uses.
- `src/presenter.js`, `src/presenter.css`: the presenter view (from the Lleida.net deck, in teal and amber).
- `assets/`: photos (prepared from the draft deck and the report with `tools/prepare_assets.py`) and logos. The GIMBER wordmark is the real logo supplied by the team (`assets/logos/gimber-original.png`); the black and white versions are generated from it. `fonts/`: Charis SIL, Google Sans and Figtree (SIL Open Font License, texts in `fonts/licenses/`), plus Cairo for the Arabic name only.
- `tools/build.py`: assembles everything into the HTML file. `tools/route_map.py`, `tools/recipe_art.py` and `tools/phase_art.py`: draw the dotted map and the Halle to Dubai arc of the cover, the three animated recipe scenes of slide 3 and the four animated phase icons of slide 7. `tools/screenshots.py` and `tools/check_layout.py`: render the slides and check that nothing runs into the footer or the margins. `tools/make_pdf.py`: optional PDF of the final slides (needs Chrome and PyMuPDF).

## Rebuild after editing
```bash
python3 tools/build.py
```
To update the live version, commit and push; GitHub Pages redeploys in about a minute:
```bash
git add -A && git commit -m "Update the deck" && git push
```

## Design
White ground. Charis SIL for titles, quotes and key messages (the voice), Google Sans for numbers and headings (the data), Figtree for text. Teal `#0B6E6E` builds the structure, ginger amber `#E9A116` marks the one thing to remember on each slide, ember `#CF4A2D` is only for risk. Flat surfaces, no shadows. Everything the room must read is at least 24 px on the 1600 × 900 stage; the sources line is smaller on purpose.
