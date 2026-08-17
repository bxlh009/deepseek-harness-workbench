# Agent Note: Global desktop distribution

Status: implemented

English | [中文](2026-08-17-global-desktop-distribution.zh.md)

## Problem

The desktop package serves users outside Chinese-speaking environments, but a Chinese last-resort locale, Chinese-only native updater prompts, and region-specific branding make a fresh installation difficult to understand. Publishing installer metadata through concurrent publisher requests can also split one version across multiple GitHub Releases, while an open repository needs an automated credential check before changes become downloadable binaries.

## Decision

English is the last-resort locale when neither a stored preference nor a shipped browser language is available. Chinese browser variants still select Chinese, and the visible language setting preserves explicit `zh` and `en` choices. Missing translations fall back to English so global users never receive an unrelated Chinese fragment solely because a dictionary entry is absent.

The desktop package, boot page, install metadata, PWA metadata, and English sidebar use the stable `DeepSeek Harness Workbench` name with a local-first coding-agent description. Electron updater dialogs select Chinese only for a `zh` application locale and use English for every other locale.

Desktop release automation builds the NSIS installer with publishing disabled, verifies the installer, blockmap, and `latest.yml`, and then creates or updates one normal GitHub Release for the version. The repository runs Gitleaks over full history on pushes and pull requests; only two exact non-production fixture credentials are allowlisted.

## Alternatives considered

**Keep Chinese as the universal fallback.** This preserves the original product emphasis but makes unsupported browser languages unexpectedly Chinese and contradicts global distribution.

**Rename the product separately in every language.** Localized product names weaken update, installer, shortcut, and support identity. One stable English product name with localized descriptions is easier to find and diagnose.

**Let Electron Builder publish assets directly.** Its publisher may create competing draft releases when asset uploads race. Building first and publishing a verified artifact set through one GitHub CLI step gives each version one release owner.

**Ignore all test directories during credential scanning.** That would hide real credentials accidentally pasted into tests. Exact fixture-value allowlisting retains scanning for every other test value.

## Consequences

Fresh non-Chinese installations open in English, while Chinese remains a first-class selectable interface. Product identity is consistent across GitHub, Windows, PWA metadata, and update prompts. Release jobs fail when any updater artifact is missing, and secret findings block repository checks. Existing partial inline translations remain visible in their owning packages until those packages join the locale registry.
