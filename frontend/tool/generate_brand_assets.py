#!/usr/bin/env python3
"""Render the approved Cuppet Courier SVGs into platform image assets."""

from __future__ import annotations

import tempfile
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright


FRONTEND = Path(__file__).resolve().parents[1]
REPOSITORY = FRONTEND.parent
LOGO_ROOT = REPOSITORY / "logos" / "cuppet" / "final" / "icon"
LAUNCHER_SVG = LOGO_ROOT / "cuppet-launcher-master.svg"
MARK_SVG = LOGO_ROOT / "cuppet-icon-full-color.svg"
AVATAR_SVG = LOGO_ROOT / "cuppet-app-icon.svg"
RESAMPLE = Image.Resampling.LANCZOS


def render_svg(browser, source: Path, target: Path, size: int) -> None:
    svg = source.read_text(encoding="utf-8")
    page = browser.new_page(
        viewport={"width": size, "height": size},
        device_scale_factor=1,
    )
    page.set_content(
        """
        <!doctype html>
        <html>
          <head>
            <style>
              html, body, svg {
                width: 100%;
                height: 100%;
                margin: 0;
                padding: 0;
                overflow: hidden;
                background: transparent;
              }
              svg { display: block; }
            </style>
          </head>
          <body>
        """
        + svg
        + "</body></html>",
        wait_until="load",
    )
    page.screenshot(path=str(target), omit_background=True)
    page.close()


def resized(source: Image.Image, size: int, mode: str) -> Image.Image:
    return source.convert(mode).resize((size, size), RESAMPLE)


def save_png(source: Image.Image, size: int, target: Path, mode: str) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    resized(source, size, mode).save(target, format="PNG", optimize=True)


def main() -> None:
    for source in (LAUNCHER_SVG, MARK_SVG, AVATAR_SVG):
        if not source.exists():
            raise FileNotFoundError(source)

    with tempfile.TemporaryDirectory(prefix="cuppet-brand-") as directory:
        temp = Path(directory)
        launcher_png = temp / "launcher.png"
        mark_png = temp / "mark.png"
        avatar_png = temp / "avatar.png"

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            render_svg(browser, LAUNCHER_SVG, launcher_png, 2048)
            render_svg(browser, MARK_SVG, mark_png, 2048)
            render_svg(browser, AVATAR_SVG, avatar_png, 2048)
            browser.close()

        launcher = Image.open(launcher_png)
        mark = Image.open(mark_png)
        avatar = Image.open(avatar_png)

        logos = FRONTEND / "assets" / "logos"
        save_png(mark, 1024, logos / "cuppet-mark.png", "RGBA")
        save_png(mark, 1024, logos / "cuppet.png", "RGBA")
        save_png(avatar, 512, logos / "cuppet-app-icon.png", "RGBA")

        android = FRONTEND / "android" / "app" / "src" / "main" / "res"
        for density, size in {
            "mdpi": 48,
            "hdpi": 72,
            "xhdpi": 96,
            "xxhdpi": 144,
            "xxxhdpi": 192,
        }.items():
            save_png(
                launcher,
                size,
                android / f"mipmap-{density}" / "ic_launcher.png",
                "RGBA",
            )
            save_png(
                launcher,
                size,
                android / f"mipmap-{density}" / "ic_launcher_round.png",
                "RGBA",
            )
        save_png(
            mark,
            256,
            android / "drawable-nodpi" / "launch_image.png",
            "RGBA",
        )

        ios_icons = (
            FRONTEND
            / "ios"
            / "Runner"
            / "Assets.xcassets"
            / "AppIcon.appiconset"
        )
        for filename, size in {
            "Icon-App-20x20@1x.png": 20,
            "Icon-App-20x20@2x.png": 40,
            "Icon-App-20x20@3x.png": 60,
            "Icon-App-29x29@1x.png": 29,
            "Icon-App-29x29@2x.png": 58,
            "Icon-App-29x29@3x.png": 87,
            "Icon-App-40x40@1x.png": 40,
            "Icon-App-40x40@2x.png": 80,
            "Icon-App-40x40@3x.png": 120,
            "Icon-App-60x60@2x.png": 120,
            "Icon-App-60x60@3x.png": 180,
            "Icon-App-76x76@1x.png": 76,
            "Icon-App-76x76@2x.png": 152,
            "Icon-App-83.5x83.5@2x.png": 167,
            "Icon-App-1024x1024@1x.png": 1024,
        }.items():
            save_png(launcher, size, ios_icons / filename, "RGB")

        ios_launch = (
            FRONTEND
            / "ios"
            / "Runner"
            / "Assets.xcassets"
            / "LaunchLogo.imageset"
        )
        save_png(mark, 128, ios_launch / "LaunchLogo.png", "RGBA")
        save_png(mark, 256, ios_launch / "LaunchLogo@2x.png", "RGBA")
        save_png(mark, 384, ios_launch / "LaunchLogo@3x.png", "RGBA")

        web = FRONTEND / "web"
        save_png(launcher, 32, web / "favicon.png", "RGB")
        save_png(launcher, 192, web / "icons" / "Icon-192.png", "RGB")
        save_png(launcher, 512, web / "icons" / "Icon-512.png", "RGB")
        save_png(
            launcher,
            192,
            web / "icons" / "Icon-maskable-192.png",
            "RGB",
        )
        save_png(
            launcher,
            512,
            web / "icons" / "Icon-maskable-512.png",
            "RGB",
        )

        windows_icon = (
            FRONTEND / "windows" / "runner" / "resources" / "app_icon.ico"
        )
        windows_icon.parent.mkdir(parents=True, exist_ok=True)
        resized(launcher, 256, "RGBA").save(
            windows_icon,
            format="ICO",
            sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
        )

    print("Generated Cuppet Courier assets for Flutter, Android, iOS, web, and Windows.")


if __name__ == "__main__":
    main()
