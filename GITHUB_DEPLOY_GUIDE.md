# GitHub upload and Pages deployment (Windows)

## A. Upload the correct files
1. Download and extract this ZIP.
2. Open the inner `AeroStat` folder. It must contain `index.html`, `css/`, `js/`, `README.md`, and `.gitignore`.
3. In your GitHub repository, choose **Add file → Upload files**. Drag the *contents* of the inner `AeroStat` folder into the upload area; do not upload only the ZIP file or a parent folder.
4. If prompted, replace existing files. Check that `index.html` is at the repository root, not inside another nested `AeroStat/AeroStat/` folder.
5. Enter commit message `Update AeroStat source assessment` and click **Commit changes**.

## B. Enable GitHub Pages
1. Open the repository **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select branch `main` and folder `/(root)`, then click **Save**. (If your repository uses another default branch, select that branch instead.)
4. Wait for the Pages deployment workflow to complete. Open the published URL shown on the Pages settings screen.
5. Hard refresh with `Ctrl + F5`. Verify the Trends chart, the source assessment card beneath it, navigation, and Compare city search.
6. Confirm the live card matches the expected data-driven output. It can show a possible pattern only when the heuristic score supports it; otherwise it should say `Insufficient Source Evidence`.

## C. If you prefer Git from VS Code
Run these commands from the inner `AeroStat` folder after creating the GitHub repository. Replace the remote URL with your own repository URL. Do not run `git remote add origin` if an origin is already configured.

```bash
git init
git add .
git status
git commit -m "Update AeroStat source assessment"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

If Git reports that `origin` already exists, use `git remote -v` to inspect it and update it only if it is the wrong repository. Never share passwords or personal access tokens in chat.
