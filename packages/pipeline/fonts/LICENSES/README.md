# Font Licenses (SIL Open Font License 1.1)

The TTF files in `packages/pipeline/fonts/` are vendored under the SIL Open Font License 1.1 (OFL-1.1). Source: https://fonts.google.com.

## Vendored Fonts

| Family | Weight | File | Source |
|--------|--------|------|--------|
| Playfair Display | Regular (400) | PlayfairDisplay-Regular.ttf | Google Fonts — by Claus Eggers Sørensen |
| Playfair Display | Bold (700) | PlayfairDisplay-Bold.ttf | Google Fonts — by Claus Eggers Sørensen |
| Source Serif Pro | Regular (400) | SourceSerifPro-Regular.ttf | Google Fonts — by Frank Grießhammer / Adobe |
| Source Serif Pro | Bold (700) | SourceSerifPro-Bold.ttf | Google Fonts — by Frank Grießhammer / Adobe |

## License Text

Full SIL OFL 1.1 text: https://scripts.sil.org/cms/scripts/page.php?site_id=nrsi&id=OFL_web

Both families are distributed under SIL OFL 1.1; redistribution is permitted with attribution preserved. We use the fonts to render PDFs server-side; no Reserved Font Name is altered.

## How to Vendor a New Font

When DesignAgent's whitelist gains a new font (Andrew's call), download the static TTFs from Google Fonts, place them in `packages/pipeline/fonts/` with the deterministic filename pattern (`{FamilyNoSpaces}-{Weight}.ttf`), and append the family/weight/license attribution to the table above.
