# List Card by [@iantrich](https://www.github.com/iantrich)
# Fork by [@ixitxachitl](https://www.github.com/ixitxachitl)

This card for [Lovelace](https://www.home-assistant.io/lovelace) on [Home Assistant](https://www.home-assistant.io/) that gives you a table generated with data from the [feedparser custom component](https://github.com/custom-components/sensor.feedparser) or any other sensor that provides data as a list of attributes.

This fork focuses on:
- A **native visual editor** that uses Home Assistant’s standard controls
- **Selectable text**
- Simple column sizing via **`col_width`** (px, %, etc.)

![example](example.png)

From left to right: [feedparser](https://github.com/custom-components/sensor.feedparser) | [aftership](https://github.com/custom-components/sensor.aftership) | [untappd](https://github.com/custom-components/sensor.untapped)

## Options

| Name | Type | Requirement | Description
| ---- | ---- | ------- | -----------
| type | string | **Required** | `custom:list-card`
| entity | string | **Required** | The entity_id of the entity you want to show.
| feed_attribute | string | **Optional** | Attribute containing the feed
| title | string | **Optional** | Add a custom title to the card.
| row_limit | number | **Optional** | Limit the number of rows to display.
| columns | object | **Optional** | List of columns to display.

## Column object

| Name | Type | Requirement | Description
| ---- | ---- | ------- | -----------
| title | string | **Required** | Column header to display.
| field | string | **Required** | key value of the entity that you wish to display.
| add_link | string | **Optional** | key value of entity that has the link property to use.
| col_width | string  | **Optional** | Column width (any CSS unit: `120px`, `25%`, `10rem`, etc.) 
| type | string | **Optional** | options are `image` and `icon`. Default is `None`. **Only set this for images or icons, otherwise leave blank**
| style | object | **Optional** | CSS styles to apply to this column.
| width | string | **Optional** | If type is image, sets the width of the image. Default 70.
| height | string | **Optional** | If type is image, sets the width of the image. Default 90.
| regex | string | **Optional** | Regex string to apply to field.
| prefix | string | **Optional** | String to prefix to field.
| postfix | string | **Optional** | String to postfix to field.

* Note: If width **and** height are set to "auto", the image will not be resized. If width **or** height are set to "auto", the aspect ratio of the image will be maintained.

## Installation

Add to [HACS](https://hacs.xyz) as a Custom Repo

### Example Configuration

```yaml
      - type: custom:list-card
        entity: sensor.engineering_feed
        title: Engineering Feed
        feed_attribute: entries
        columns:
          - title: ''
            type: image
            add_link: link
            field: image
          - title: Title
            field: title
            style:
              - white-space: nowrap
          - title: Description
            field: description
```

[Troubleshooting](https://github.com/thomasloven/hass-config/wiki/Lovelace-Plugins)

[commits-shield]: https://img.shields.io/github/commit-activity/y/custom-cards/list-card.svg?style=for-the-badge
[commits]: https://github.com/custom-cards/list-card/commits/master
[discord]: https://discord.gg/Qa5fW2R
[discord-shield]: https://img.shields.io/discord/330944238910963714.svg?style=for-the-badge
[forum-shield]: https://img.shields.io/badge/community-forum-brightgreen.svg?style=for-the-badge
[forum]: https://community.home-assistant.io/t/custom-component-rss-feed-parser/64637
[license-shield]: https://img.shields.io/github/license/custom-cards/list-card.svg?style=for-the-badge
[maintenance-shield]: https://img.shields.io/badge/maintainer-Ian%20Richardson%20%40iantrich-blue.svg?style=for-the-badge
[releases-shield]: https://img.shields.io/github/release/custom-cards/list-card.svg?style=for-the-badge
[releases]: https://github.com/custom-cards/list-card/releases
[twitter]: https://img.shields.io/twitter/follow/iantrich.svg?style=social
[github]: https://img.shields.io/github/followers/iantrich.svg?style=social
