# TamaGrid maintainers and maintenance

Primary maintainer: [@flames-hub](https://github.com/flames-hub).

The primary maintainer is responsible for development, contribution review, issue triage, security follow-up, and release decisions for `tamas-hub/tamagrid`. Public [merged pull requests](https://github.com/tamas-hub/tamagrid/pulls?q=is%3Apr+is%3Amerged) and [release records](PUBLIC_RELEASE_CHECKLIST.md) document work actually performed; they are not evidence of broad adoption or an independent external review.

## Contribution and maintenance process

- Use the bug/feature templates for reproducible reports and focused proposals. Security reports follow [SECURITY.md](SECURITY.md).
- Review dependency updates for compatibility and security before merging. Scheduled scans and bot-created PRs are maintenance inputs, not proof that human review is complete.
- Merge through protected PRs after the required checks pass. Preserve signed-commit, privacy, and approval boundaries.
- Apply security fixes to `main`; the supported release scope is defined in [SECURITY.md](SECURITY.md#supported-versions).
- Publish only after the [manual release gate](docs/RELEASING.md#manual-release-gate). Changes limited to documentation or development tooling do not by themselves require a new binary release.

## Maintenance priorities

These are ongoing priorities, not completed features, delivery dates, or release promises:

- Follow Codex App Server changes with schema checks and focused protocol regression tests.
- Improve approval clarity, safe policy handling, and multi-task supervision.
- Improve keyboard access, readable status information, and desktop layout behavior.
- Keep contributor onboarding, architecture, and security documentation aligned with the implementation.
- Track upstream dependency advisories and preserve verifiable release provenance.
- Evaluate Windows signing and macOS notarization when the necessary credentials and resources are available. Preview signing limitations remain explicit until implemented and verified.

TamaGrid is an independent, unofficial project, not affiliated with or endorsed by OpenAI. See [CONTRIBUTING.md](CONTRIBUTING.md) to participate.
