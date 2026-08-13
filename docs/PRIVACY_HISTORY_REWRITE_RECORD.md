# Privacy history rewrite record

Date: 2026-08-14  
Repository: `tamas-hub/tamagrid`

This record documents the owner-authorized removal of a personal email address from published Git commit metadata. The address value is intentionally never reproduced here.

## Authorization and boundary

The owner explicitly requested that no personal email address remain and asked for thorough remediation. This authorized a one-time history rewrite and force-with-lease update, stale-reference cleanup, account email-privacy controls, and local object cleanup for this repository.

It did not authorize a tag, GitHub Release, installer upload, repository visibility/ownership change, secret or signing-key creation, or repository deletion. None of those actions were performed.

## Pre-rewrite evidence

- One unique personal address appeared in author and/or committer metadata across all nine reachable `main` commits.
- Commit messages and all reachable source blobs contained zero occurrences of that address.
- GitHub pull-request bodies/comments/reviews and repository comments contained zero occurrences.
- Fifty-eight available Actions logs contained zero occurrences; one startup-failure run had no downloadable log.
- Eight bundle-smoke artifacts were downloaded and all 56 contained files were scanned; zero occurrences were found.
- The repository had no forks, tags, GitHub Releases, or other direct public heads after stale branch cleanup.
- `git-filter-repo` identified 11 affected pull requests whose GitHub-managed internal refs cannot be force-pushed by a repository owner.

## Actions performed

1. Enabled **Keep my email addresses private** for the authenticated GitHub account and verified the public profile email is absent.
2. Verified **Block command line pushes that expose my email** is enabled and kept the repository-local Git identity on the GitHub noreply form.
3. Created and verified a temporary local rollback bundle. It is not in the repository and is removed after final verification because it contains the pre-rewrite metadata.
4. Cloned an exact mirror, fetched pull-request refs, and ran upstream `git-filter-repo` 2.47.0 with an exact-match email callback. The downloaded tool matched the Git blob published at its upstream tag.
5. Confirmed the rewritten `main` has the same tree and nine-commit topology, with zero non-noreply author/committer fields.
6. Closed unmerged Dependabot pull requests #2 through #6 and deleted their branches. No dependency update was merged.
7. Temporarily disabled required signatures and administrator enforcement only for the exact force-with-lease update. The first local attempt was rejected before transmission because a mirror remote cannot accept a refspec; public state remained unchanged. The corrected single-ref update succeeded.
8. Restored all nine App-bound required checks, strict mode, pull-request requirement, administrator enforcement, required signed commits, linear history, conversation resolution, force-push prohibition, and deletion prohibition. The complete protection object was read back.
9. Deleted all 58 pre-rewrite Actions runs, their eight artifacts, and 17 Actions caches. The three newly triggered sanitized-main runs were excluded.
10. Updated the local `main`, deleted four explicitly inventoried local topic branches, expired reflogs, and pruned unreachable objects. The final object database contains nine commit objects, zero non-noreply commit fields, zero Gmail-domain blob hits, and zero unreachable objects.
11. Added a required-CI metadata check. It scans every commit reachable from `HEAD`, permits only GitHub noreply forms, and never prints an address value on failure.

## Signature and compatibility impact

Changing Git author/committer metadata changes commit IDs and invalidates embedded signatures. The nine rewritten historical commits are therefore unsigned even though their source tree is unchanged. Required signed commits is restored for future `main` changes; this record is submitted through the normal protected pull-request workflow.

Old clones must rebase or clone again rather than merge their old history, because merging an old branch can reintroduce the removed metadata. Dependabot can recreate its update branches from the rewritten `main`.

## Provider-managed residual

Repository-owner operations cannot delete GitHub's read-only pull-request refs or guarantee immediate removal of cached commit views. GitHub's official guidance requires a provider-side privacy/support request containing the repository, affected pull-request count, and first changed commit. Until GitHub completes dereferencing and garbage collection, an old commit may remain reachable by a previously known object ID.

Submitting a support or privacy form is an external message and is intentionally not represented as completed in this record. Third-party clones, if any were made before the rewrite, also cannot be remotely erased; GitHub reported zero forks at the time of cleanup.

## Recovery

During the critical force-push window, the verified local rollback bundle and the exact prior branch-protection snapshot provided recovery. After public state, checks, and local state are verified, the bundle is deleted so the personal address is not retained locally. Future recovery uses the sanitized public `main`; prior commit IDs and pre-rewrite Actions evidence are intentionally not restored.
