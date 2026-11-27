# ALS IV: A Massive Star Census of the Magellanic Cloud Systems

Interactive sky map of the 51 954 massive stars of the Magellanic Clouds in
the final ALS IV catalogue.

The web version is available at
<a href="https://juananmol.github.io/als-iv-stellar-atlas/" target="_blank" rel="noopener noreferrer">juananmol.github.io/als-iv-stellar-atlas</a>.

The public website is automatically deployed with GitHub Pages whenever the
`main` branch is updated.

## Run locally

From this directory:

```bash
npm run dev
```

Then open `http://localhost:3000` in a browser. Press `Ctrl+C` in the terminal
to stop the development server.

## GitHub Pages deployment

The deployment workflow is defined in `.github/workflows/deploy-pages.yml`.
Every push to `main` builds and publishes the atlas automatically.

## Update the catalogue data

The exporter searches `../Data/catalouge/selected/` for files named
`als_iv_DATE_final.fits` and automatically selects the most recent numerical
date. To regenerate the compact files used by the browser:

```bash
npm run catalog
```

To export a different catalogue version:

```bash
npm run catalog -- --source ../Data/catalouge/selected/file.fits
```
