# Releasing

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and keeps a
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/)-formatted `CHANGELOG.md`. Releases are
versioned source snapshots published as GitHub Releases — the app is a local dev tool and ships
no deployed artifacts.

## Cutting a release

1. **Start from a green `main`.** Make sure CI is passing and your local `main` is up to date.
2. **Bump the version.** Update `version` in `package.json`, then run `npm install` so
   `package-lock.json` picks up the same version.
3. **Update the changelog.** Move the entries under `## [Unreleased]` into a new
   `## [x.y.z] - YYYY-MM-DD` section, and refresh the link definitions at the bottom
   (`[Unreleased]` compare link + the new `[x.y.z]` tag link).
4. **Open a PR** with the version bump and changelog changes, and merge it (squash) into `main`.
5. **Tag the merge commit** and push the tag:
   ```bash
   git checkout main && git pull
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```
6. **Automated publish.** Pushing a `v*` tag triggers `.github/workflows/release.yml`, which
   builds the project and publishes the GitHub Release with generated notes.

## Notes

- The tag **must** point at a commit on `main`, so always merge the bump/changelog PR before
  tagging.
- To publish a release manually instead of via the workflow, create the GitHub Release for the
  tag through the GitHub UI (or API) and paste the matching `CHANGELOG.md` section as the body.
