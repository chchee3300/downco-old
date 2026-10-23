# [2.1.0](https://github.com/chchee3300/sorai-toolkit/compare/v2.0.0...v2.1.0) (2026-10-23)


### Bug Fixes

* context-menu review fixes for the progress window, background starts and the menu ([b492777](https://github.com/chchee3300/sorai-toolkit/commit/b492777ea1b98157f378a097345046e9991c9f22))
* **deps:** lock the converter and downloader with right-click presets ([68d26d0](https://github.com/chchee3300/sorai-toolkit/commit/68d26d01c037318cf17b5e5ddd61dfdc8d23af5a))
* serialize context-menu writes and count toasts for E2E ([743f175](https://github.com/chchee3300/sorai-toolkit/commit/743f1754df13d57f036f669339f796d4bb559612))
* **windows:** write the context menu under SystemFileAssociations ([da167b3](https://github.com/chchee3300/sorai-toolkit/commit/da167b348aa986c0eecef7414d39828d19a460b9))
* write the context menu in call order so a quick language switch wins ([96313e1](https://github.com/chchee3300/sorai-toolkit/commit/96313e16acc794f1a70969ae8f981e0383a247ce))


### Features

* app writes the Explorer context menu from presets and language ([0df19c0](https://github.com/chchee3300/sorai-toolkit/commit/0df19c03bcbc5e7b0c599ca4f07fcf88e3c0b3a2))
* edit a right-click preset in the Converter from Settings ([d70568f](https://github.com/chchee3300/sorai-toolkit/commit/d70568fe1767c49d947231ed7d1f23168174cd7b))
* preset store and background convert via --sorai-preset ([24dc98c](https://github.com/chchee3300/sorai-toolkit/commit/24dc98c016dfb61ad6d1ef82575e4569edbf83c4))
* progress window is a frameless translucent panel in the bottom-right corner ([f8c0f74](https://github.com/chchee3300/sorai-toolkit/commit/f8c0f7422b660cf3b388e6f35ddb87ecfb6c1b0e))
* progress window runs 2 jobs, cancels, skips via Rust, notifies on success ([8e337b0](https://github.com/chchee3300/sorai-toolkit/commit/8e337b09a6bb20d0ade824d58064f52160e9bab3))
* save right-click presets from the Converter and manage them in Settings ([e4dd570](https://github.com/chchee3300/sorai-toolkit/commit/e4dd57061966215a452f602f5641bfa1a4eb326d)), closes [#settings-presets](https://github.com/chchee3300/sorai-toolkit/issues/settings-presets)
* tray icon uses the SORAI logo, white or black to match the taskbar theme ([76d255e](https://github.com/chchee3300/sorai-toolkit/commit/76d255e50a52aacebbb2b406e1fdcf6c87e5ac7f))

# [2.0.0](https://github.com/chchee3300/sorai-toolkit/compare/v1.10.2...v2.0.0) (2026-10-22)


* feat!: remove Neutralino, the app is Tauri-only ([6c90d8c](https://github.com/chchee3300/sorai-toolkit/commit/6c90d8c85efbabe1dae77a82f8b3372e17b70852))


### Bug Fixes

* **build:** rerun tauri_build when platform config or sidecars change ([58d215d](https://github.com/chchee3300/sorai-toolkit/commit/58d215dac7a81602848cf9cf4254c3ea88fd8e8f))
* **deps:** lock the Tauri plugin versions of the converter and downloader ([e925337](https://github.com/chchee3300/sorai-toolkit/commit/e925337a615246910a5821e8627d0bea34fd845f))
* **dev:** watch only sibling plugin/src, not build.rs-generated permissions ([33b6287](https://github.com/chchee3300/sorai-toolkit/commit/33b6287f537ef364b9b3e338376daf6da15b664b))
* hub review fixes (argv, notifications, launch batches, dev-only close capability) ([62d01d8](https://github.com/chchee3300/sorai-toolkit/commit/62d01d8f6e25081fd72d648eb3f063cb02e24d25))
* **linux:** ship ffmpeg/yt-dlp in /usr/lib/<app>/, drop Conflicts/Replaces/Provides ([547a043](https://github.com/chchee3300/sorai-toolkit/commit/547a0433d292033dd5e36e49c80aa61b4e637413))


### Features

* asset protocol for converter thumbnails, converter add-files E2E, drop Phase 0 probe ([419f6f5](https://github.com/chchee3300/sorai-toolkit/commit/419f6f5abbdf1f97ed83371afdc23f9963781af9))
* bundle qpdf (with DLLs) and img2pdf sidecars on Windows; PDF E2E ([a133730](https://github.com/chchee3300/sorai-toolkit/commit/a133730372efe4b6d1483dabcc462690332898b7))
* register tool plugins, cross-repo dev mode, dialogs module and E2E runner ([4f459d4](https://github.com/chchee3300/sorai-toolkit/commit/4f459d405e474365fb2a101c2d186629273c926f))
* self-install Finder Quick Actions and Nautilus scripts from Rust ([5c08f3f](https://github.com/chchee3300/sorai-toolkit/commit/5c08f3ff64dd947a612ed4118524de0c441b71c1))
* single-instance plugin with forwarded launch args and debounced pendingLaunch ([dbd79c8](https://github.com/chchee3300/sorai-toolkit/commit/dbd79c8dc9f72b3029980903e1370b89defc68bb))
* Tauri v2 shell skeleton with sidecars and native drag-drop probe ([a34d7ce](https://github.com/chchee3300/sorai-toolkit/commit/a34d7cec73ffa845bc95fba45fd2973fa2361102)), closes [neutralinojs#1795](https://github.com/neutralinojs/issues/1795)
* Tauri window lifecycle, close behavior, tray, notification and theme icon ([1bd5113](https://github.com/chchee3300/sorai-toolkit/commit/1bd5113e93c6f7ccd453831a8831746e3a36ed8d))
* **updater:** official builds update via Tauri updater plugin, self-built open release page ([2ac498f](https://github.com/chchee3300/sorai-toolkit/commit/2ac498fa3310ca854d2e3ef4f1125d780049b1c7))
* **windows:** per-user NSIS installer with context menu install hooks ([f1e03eb](https://github.com/chchee3300/sorai-toolkit/commit/f1e03ebc34355c0d1f1171bb16a077c5b6c423b3))


### BREAKING CHANGES

* 1.x (Neutralino) installs can't auto-update to this version. Windows: uninstall the old SORAI Toolkit first (Settings -> Apps), then run the new installer -- uninstalling the old one afterwards deletes the new right-click menu. macOS: replace the app in Applications. Linux: install the new .deb/.rpm over the old one.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

## [1.10.2](https://github.com/chchee3300/sorai-toolkit/compare/v1.10.1...v1.10.2) (2026-07-20)


### Bug Fixes

* window can come up genuinely iconic, not just mis-placed ([ef978b9](https://github.com/chchee3300/sorai-toolkit/commit/ef978b9c5f5f4fe64da0a88cacc62d9d5b6464cf))

## [1.10.1](https://github.com/chchee3300/sorai-toolkit/compare/v1.10.0...v1.10.1) (2026-07-20)


### Bug Fixes

* window opens off-screen (unhoverable) on primary-instance show ([0180f5d](https://github.com/chchee3300/sorai-toolkit/commit/0180f5d9d3ec8f915eba417f3a99b72df3dde17f))

# [1.10.0](https://github.com/chchee3300/sorai-toolkit/compare/v1.9.0...v1.10.0) (2026-07-20)


### Features

* background tray, settings page, and Windows Explorer context menu ([e281afe](https://github.com/chchee3300/sorai-toolkit/commit/e281afee66139f94d55fca06ef7f6d9f54c3e50f))
* macOS Finder and Linux (Dolphin/Nautilus) context-menu integration ([7b7d224](https://github.com/chchee3300/sorai-toolkit/commit/7b7d224d732a326676b791c5eb660febd7b9e22e))

# [1.9.0](https://github.com/chchee3300/sorai-toolkit/compare/v1.8.0...v1.9.0) (2026-07-18)


### Features

* split auto-update between official CI builds and self-built copies ([ea57a81](https://github.com/chchee3300/sorai-toolkit/commit/ea57a81eb48c2534de7374aba94b4266026af9e3))

# [1.8.0](https://github.com/chchee3300/sorai-toolkit/compare/v1.7.0...v1.8.0) (2026-07-18)


### Features

* make header logo icon click back to hub, remove hamburger's back-to-hub item ([4761570](https://github.com/chchee3300/sorai-toolkit/commit/47615700a196aa2b4e77bfd81e5567c4d264d589))

# [1.7.0](https://github.com/chchee3300/sorai-toolkit/compare/v1.6.0...v1.7.0) (2026-07-18)


### Features

* add About modal, theme-aware brand mark, and new app icon ([68b2c8c](https://github.com/chchee3300/sorai-toolkit/commit/68b2c8c44fa3c040173ad581f79bf02fcba514db))

# [1.6.0](https://github.com/chchee3300/sorai-toolkit/compare/v1.5.4...v1.6.0) (2026-07-18)


### Features

* bundle Inter/Noto Sans TC fonts locally, add thumbnail ffmpeg command, add dev-watch script ([9b7095b](https://github.com/chchee3300/sorai-toolkit/commit/9b7095b7fac52a87dc3b640e6d38b403d0dd44ba))

## [1.5.4](https://github.com/chchee3300/sorai-toolkit/compare/v1.5.3...v1.5.4) (2026-07-17)


### Bug Fixes

* cut a release for the trim/clip scrubber fixes ([cf4a2aa](https://github.com/chchee3300/sorai-toolkit/commit/cf4a2aa14865750c96b2f1c977982b45ac91b19f))

## [1.5.3](https://github.com/chchee3300/sorai-toolkit/compare/v1.5.2...v1.5.3) (2026-07-17)


### Bug Fixes

* keep the trim/clip playhead visible when a thumb drag reaches it ([8b9cd93](https://github.com/chchee3300/sorai-toolkit/commit/8b9cd93ad7c87d6a6f249a9edb003f5fc362dc54))

## [1.5.2](https://github.com/chchee3300/sorai-toolkit/compare/v1.5.1...v1.5.2) (2026-07-17)


### Bug Fixes

* bring GlassSelect dropdown and trim/clip scrubber up to the liquid-glass guide ([1f787da](https://github.com/chchee3300/sorai-toolkit/commit/1f787da7e6c7242764aeaf8f26239bc1db33a572))

## [1.5.1](https://github.com/chchee3300/sorai-toolkit/compare/v1.5.0...v1.5.1) (2026-07-17)


### Bug Fixes

* mount the update checker in the hub and add a manual check menu item ([a2587bc](https://github.com/chchee3300/sorai-toolkit/commit/a2587bc49bae430d8ba8acd8f70da210030bb19c))

# [1.5.0](https://github.com/chchee3300/sorai-toolkit/compare/v1.4.4...v1.5.0) (2026-07-17)


### Bug Fixes

* hamburger dropdown gray light-mode frost + off-brand pop timing ([98dd6b9](https://github.com/chchee3300/sorai-toolkit/commit/98dd6b98e853c4ba2199771f8e9e5d896cc08661))
* hamburger dropdown light-mode black wash + open pop gating ([7df89f8](https://github.com/chchee3300/sorai-toolkit/commit/7df89f89c54d974a925c4861d23dad3823919c2d))
* light-mode hamburger dropdown now reads as the page background color ([e0b9af9](https://github.com/chchee3300/sorai-toolkit/commit/e0b9af9c8778fdeb6a1a761c8f5a2a8568d45d6c))


### Features

* adopt liquid-glass-react for the hamburger dropdown ([599f11b](https://github.com/chchee3300/sorai-toolkit/commit/599f11b17c226bfe6ba9379726cb9e5f2220d5d9))
* hamburger dropdown goes near-clear -- 1px blur, light tints ([4d7f93d](https://github.com/chchee3300/sorai-toolkit/commit/4d7f93de84c4708d15ed480e8fcd8b241860753d))
* slightly more translucent hamburger dropdown in both themes ([cc65cc9](https://github.com/chchee3300/sorai-toolkit/commit/cc65cc9d60f752c93f8575afb087bc918fcc867c))

## [1.4.4](https://github.com/chchee3300/sorai-toolkit/compare/v1.4.3...v1.4.4) (2026-07-16)


### Bug Fixes

* drop the SVG glass filter for plain large-radius blur on the dropdown ([24358cb](https://github.com/chchee3300/sorai-toolkit/commit/24358cb98af5657e525e440ef045cd8de7168ed7))

## [1.4.3](https://github.com/chchee3300/sorai-toolkit/compare/v1.4.2...v1.4.3) (2026-07-16)


### Bug Fixes

* backdrop contrast compression -- panel borders no longer show through the glass ([4d10751](https://github.com/chchee3300/sorai-toolkit/commit/4d107513738b3e0578527ac72ef7cb62e37d203b))

## [1.4.2](https://github.com/chchee3300/sorai-toolkit/compare/v1.4.1...v1.4.2) (2026-07-16)


### Bug Fixes

* denser dropdown tint -- the "unrendered" right band was backdrop content ([6638cb7](https://github.com/chchee3300/sorai-toolkit/commit/6638cb7375a2bf400c706dbaa2000f54ad5a13c8))

## [1.4.1](https://github.com/chchee3300/sorai-toolkit/compare/v1.4.0...v1.4.1) (2026-07-16)


### Bug Fixes

* dead unrendered band along the liquid-glass dropdown's right edge ([bf39d85](https://github.com/chchee3300/sorai-toolkit/commit/bf39d856dcca821f5db84061070b48d1559a4650))

# [1.4.0](https://github.com/chchee3300/sorai-toolkit/compare/v1.3.2...v1.4.0) (2026-07-16)


### Features

* liquid-glass refraction on the hamburger dropdown ([8cb6731](https://github.com/chchee3300/sorai-toolkit/commit/8cb673192eaebbdd6b4bbada9c088c9c13c64adb))

## [1.3.2](https://github.com/chchee3300/sorai-toolkit/compare/v1.3.1...v1.3.2) (2026-07-16)


### Bug Fixes

* make the hamburger dropdown's backdrop blur actually render ([06d082b](https://github.com/chchee3300/sorai-toolkit/commit/06d082b519d71121b5875170e28475ed2b9a05b5))

## [1.3.1](https://github.com/chchee3300/sorai-toolkit/compare/v1.3.0...v1.3.1) (2026-07-16)


### Bug Fixes

* heavier frost on the hamburger dropdown ([2caa4a4](https://github.com/chchee3300/sorai-toolkit/commit/2caa4a425ecdbdced9477bb2b30b3ddede7db66a)), closes [hi#contrast](https://github.com/hi/issues/contrast)

# [1.3.0](https://github.com/chchee3300/sorai-toolkit/compare/v1.2.0...v1.3.0) (2026-07-16)


### Features

* multi-language architecture (i18n), Traditional Chinese support in hub shell ([306944f](https://github.com/chchee3300/sorai-toolkit/commit/306944f2c280278ca988b40fb41753ecff53885e))

# [1.2.0](https://github.com/chchee3300/sorai-toolkit/compare/v1.1.1...v1.2.0) (2026-07-16)


### Bug Fixes

* authenticate yt-dlp releases lookup to avoid CI rate-limit 403s ([837e2d8](https://github.com/chchee3300/sorai-toolkit/commit/837e2d8ad400b944860022e2c4e7bcc10bf6046f))
* free macOS runner disk space; bundle yt-dlp in macOS/Linux packages ([0ee7351](https://github.com/chchee3300/sorai-toolkit/commit/0ee7351eb138c46635e7eff570284e8585639f2b))


### Features

* Downloader queue header, add-video relabel, right-panel scroll fix ([0ba5734](https://github.com/chchee3300/sorai-toolkit/commit/0ba5734620030b37e00e5de33c56d603088dc9b9)), closes [download-settings/#download-intro](https://github.com/chchee3300/sorai-toolkit/issues/download-intro)
* redesign hub menu cards, add Downloader batch-queue support, polish hamburger menu + LiquidSelect ([557e953](https://github.com/chchee3300/sorai-toolkit/commit/557e9538634767468333af06261160474ccc6b03)), closes [mount-throu#closing-animation](https://github.com/mount-throu/issues/closing-animation)

## [1.1.1](https://github.com/chchee3300/sorai-toolkit/compare/v1.1.0...v1.1.1) (2026-07-15)


### Bug Fixes

* LiquidSelect dropdown background bleed-through ([e1fe39f](https://github.com/chchee3300/sorai-toolkit/commit/e1fe39f51f75e3bd35cdfd1d451119da0de2aaf0)), closes [#1](https://github.com/chchee3300/sorai-toolkit/issues/1) [#2](https://github.com/chchee3300/sorai-toolkit/issues/2)

# [1.1.0](https://github.com/chchee3300/sorai-toolkit/compare/v1.0.0...v1.1.0) (2026-07-15)


### Features

* add Downloader as the hub's second tool ([0fecdf0](https://github.com/chchee3300/sorai-toolkit/commit/0fecdf0105db6c918661a1ca4f99afbceab3d861))

# 1.0.0 (2026-07-15)


### Features

* scaffold SORAI Toolkit hub with main menu and hamburger navigation ([de7a0c4](https://github.com/chchee3300/sorai-toolkit/commit/de7a0c46fd6d3c73c6cc8300b42412ba475fd08b)), closes [#type-badge](https://github.com/chchee3300/sorai-toolkit/issues/type-badge)
