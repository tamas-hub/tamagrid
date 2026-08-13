# Third-party notices

TamaGrid incorporates open-source software from other projects. Those projects remain subject to their own licenses and copyright notices. This file is an inventory aid for the `v0.5.0` Public Preview; it does not replace the license files supplied by upstream projects.

The exact resolved versions are recorded in [`pnpm-lock.yaml`](pnpm-lock.yaml) and [`src-tauri/Cargo.lock`](src-tauri/Cargo.lock). Release builds also include a CycloneDX inventory of the production JavaScript dependency graph as `tamagrid-js.cdx.json`.

## Production JavaScript dependencies

| Package | Resolved version | Declared license | Upstream |
| --- | ---: | --- | --- |
| `@tauri-apps/api` | 2.11.1 | Apache-2.0 OR MIT | <https://github.com/tauri-apps/tauri> |
| `react` | 19.2.8 | MIT | <https://github.com/facebook/react> |
| `react-dom` | 19.2.8 | MIT | <https://github.com/facebook/react> |
| `scheduler` | 0.27.0 | MIT | <https://github.com/facebook/react> |

## Native Rust dependencies

The locked native graph is built primarily from crates that offer MIT and/or Apache-2.0 terms, with additional permissive terms including BSD, ISC, Unicode-3.0, Zlib, 0BSD, CC0-1.0, MIT-0 and Unlicense.

The following resolved crates declare MPL-2.0:

| Crate | Resolved version |
| --- | ---: |
| `cssparser` | 0.36.0 |
| `cssparser-macros` | 0.6.1 |
| `dtoa-short` | 0.3.5 |
| `option-ext` | 0.2.0 |
| `selectors` | 0.36.1 |

The locked graph also contains Unicode data crates under Unicode-3.0 terms. Some crates offer several alternative licenses; TamaGrid relies only on a compatible offered choice and does not select GPL/LGPL terms where a package offers MIT or Apache-2.0 as an alternative.

For package-specific copyright notices and license text, use the package name and exact version from the lockfiles to inspect its upstream source distribution. The canonical license texts are also available from the SPDX license list:

- <https://spdx.org/licenses/MIT.html>
- <https://spdx.org/licenses/Apache-2.0.html>
- <https://spdx.org/licenses/MPL-2.0.html>
- <https://spdx.org/licenses/Unicode-3.0.html>

## Product and service separation

TamaGrid does not bundle OpenAI Codex, model weights, OpenAI credentials or OpenAI artwork. Users install and authenticate Codex separately. OpenAI, Codex and related names are trademarks of their respective owners; TamaGrid is an independent project and is not affiliated with or endorsed by OpenAI.

## Reporting an omission

If a dependency notice appears incomplete, open an issue without including credentials, private paths or command output containing secrets. For sensitive reports, follow [`SECURITY.md`](SECURITY.md).
