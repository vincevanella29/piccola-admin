# Article Consumption Bot Module

This module enables querying and comparing article consumption data for the Telegram bot, with support for filtering by product, family, and subfamily, and comparative metrics by date range.

## Features
- Query article consumption by product, family, subfamily, date (YYYYMM), and local.
- Comparative metrics: MoM (month-over-month), YoY (year-over-year).
- Filtering and grouping logic mirrors the product module.
- Integrated with Telegram bot for natural language queries.

## Usage
- Ask the bot: "consumo de pastas este mes", "top consumos familia harinas vs mes pasado", etc.
- Filters: familia, subfamilia, artículo (código/nombre), mes/año, local.
- Comparative: "vs mes pasado", "vs año pasado".

## Integration
- Handler: `handle_consumos` in `bots/utils/consumos/consumos.py`.
- Spec: `consumos_spec.py` for filter schemas and catalogs.
- Registered in `telegram_bot.py` as intent `consumos`.

## Example Queries
- `consumo de harina este mes`
- `top artículos consumidos familia pastas vs mes pasado`
- `consumo subfamilia frescas en enero 2024`

## Testing
- Run the Telegram bot and issue queries as above.
- Check that filtering, grouping, and comparative logic matches expectations.

---

For questions or improvements, see the code in `bots/utils/consumos/` and update as needed.
