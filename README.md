# Presence Lens Card

[![HACS Repository](https://img.shields.io/badge/HACS-Repository-41BDF5?style=flat-square)](https://my.home-assistant.io/redirect/hacs_repository/?owner=luigi-regolo&repository=presence-lens-card&category=plugin)
[![License: GPL-3.0-only](https://img.shields.io/badge/license-GPL--3.0--only-blue?style=flat-square)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/luigi-regolo/presence-lens-card?style=flat-square)](https://github.com/luigi-regolo/presence-lens-card/stargazers)

## Overview

A modern Home Assistant card for presence and radar sensors. It shows the current state, how long the sensor has been in that state, a mini radar of the detected distance and a popup with the last 24 hours. The card is read-only: it never sends commands. An unavailable or unknown sensor is never shown as "nobody there".

## Features

- Present, absent and unavailable states, each with its own icon and colour.
- "Present for / Absent for" as a duration, or as a time ("since 15:35").
- Mini radar with range rings, minimum range and an arc at the detected distance (needs a distance entity).
- Optional 24-hour strip on the card, off by default.
- Details popup: summary of the last 24 hours (detections, occupancy, longest absence, last presence), sensor values, strip and event history with filters.
- Visual editor, light and dark Edera look, optional label and title.
- Italian and English texts, chosen from the Home Assistant language.
- No external scripts, fonts or services.

## Installation

### HACS (custom repository)

1. Open HACS, then the menu in the top right and choose **Custom repositories**.
2. Add `https://github.com/luigi-regolo/presence-lens-card` with category **Dashboard**.
3. Search for **Presence Lens Card**, download it and reload the browser.

### Manual installation

1. Copy `dist/presence-lens-card.js` to `/config/www/`.
2. In **Settings → Dashboards → Resources** add `/local/presence-lens-card.js` as a **JavaScript module**.

## Configuration and Usage

### Visual editor

Add the card from the dashboard editor and configure it with the visual editor, in three sections: **Sensor**, **Look** and **Content**. Without an entity the card shows an example.

### Main configuration options

| Option | Default | Description |
| --- | --- | --- |
| `entity` | – | Presence sensor (`binary_sensor`). |
| `name` | – | Name shown in the row. |
| `distance_entity` | – | Detected distance (`sensor` or `number`). Metres, centimetres and millimetres are converted. |
| `min_distance_entity` | – | Minimum detection distance. |
| `max_distance_entity` | – | Maximum detection distance, used as the radar range. |
| `sensitivity_entity` | – | Sensitivity, shown in the popup. |
| `panel` | `radar` | `radar`, `tiles` or `none`. |
| `show_strip` | `false` | 24-hour strip on the card. |
| `since_format` | `duration` | `duration` or `time`. |
| `radar_max` | `0` | Radar range in metres when no maximum distance entity is set (`0` = 6 m). |
| `show_eyebrow`, `eyebrow` | `true`, `PRESENCE LENS CARD` | Top label. |
| `show_title`, `title` | `true`, empty | Title; empty means "Room occupancy". |
| `occupancy_label` | empty | Text of the occupancy percentage tile; empty means "Occupancy 24 h". |
| `theme_mode` | `auto` | `auto`, `light` or `dark`. |

## Compatibility / Requirements

- Home Assistant dashboards with custom cards (Lovelace resources).
- History, occupancy and the strip need the Recorder history of the sensor. Without it these parts are hidden and the card still shows the state and the time since the last change.

## Privacy and Security

The card is read-only and never calls a service or sends commands. It only reads the configured entities and, for the 24-hour history, the Recorder history through Home Assistant. It loads no external scripts, fonts or assets and sends nothing outside Home Assistant.

## Copyright & License

Copyright © 2026 luigi-regolo

Original project created and maintained by luigi-regolo.

Distributed under the terms of the GNU General Public License version 3 only (GPL-3.0-only). See the LICENSE file for the full terms.
