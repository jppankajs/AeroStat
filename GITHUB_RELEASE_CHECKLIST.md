# GitHub release checklist

## Before pushing
- [ ] Open this folder in VS Code (the folder containing `index.html`).
- [ ] Run `py -m http.server 8000` and open `http://localhost:8000`.
- [ ] Hard-refresh with Ctrl+F5.
- [ ] Test city autocomplete in all three Compare fields (for example `hy`, `ben`, `ado`); select suggestions and confirm city labels are correct.
- [ ] Test AQI, Pollutants, Trends, and Ranking comparison tabs with two and three cities.
- [ ] Test an invalid location and temporarily disconnect the network; verify the app reports a clear error and does not present stale values as fresh.
- [ ] Test the Locate me action only if browser geolocation is available and permission is granted.
- [ ] Check the health screening labels against the displayed pollutant averaging periods and documented reference thresholds.
- [ ] Confirm that no secrets, private files, or personal data are included.
- [ ] Confirm source attributions and this project's limitations remain in the README.

## Push with Git
Run these commands from this folder after creating an empty repository on GitHub:

```bash
git init
git add .
git status
git commit -m "Prepare AeroStat environmental analytics dashboard"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

Replace the example remote URL with your own repository URL. Do not commit API keys or private credentials. This is a static educational project and its model outputs are not official station readings or medical advice.
