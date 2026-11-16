# Monté campaigns

Implemented only in new-theme-dev. Campaign content is rendered on the server; the standard theme settings are never overwritten. Product prices, automatic discounts, shipping rules and Klaviyo configuration remain independent.

## Prepare a campaign

1. Open Content > Metaobjects > Monte Campaign Placement. Create a separate entry for each location you want to change (for example, Black Friday / Home hero).
2. Set Behavior to Campaign and fill only the fields you want to override. Blank fields inherit the original content. Use Standard to keep the original block or Hidden to hide it for this campaign.
3. Open Monte Campaign and select those entries in their corresponding locations. Unassigned locations retain their standard appearance. Keep referenced entries Active; a Draft entry is not exposed to the storefront.
4. For a theme-only preview, open the unpublished theme editor > Theme settings > Monté campaigns, choose Preview selected campaign and select your campaign. This affects that theme, not just your browser. Return the mode to Follow campaign control after previewing.
5. To switch centrally, open Monte Campaign Control > Storefront, select the campaign and set Enabled to True. Set Enabled to False to restore the complete standard appearance. There is no content migration or manual rollback.

## Independent locations

| Campaign field | Location | Supported content |
| --- | --- | --- |
| Announcement | Top announcement bar | Heading, mobile body, link, icon, background and text color. Campaign mode suppresses the standard countdown. |
| Home hero | First homepage slide | Desktop/mobile image or video, heading, body/mobile body, button label/link, text color, separate content positions and frost effect. |
| Menu shop | Desktop shop menu and mobile opening banner | Desktop/mobile media, heading, body/mobile body, badge, button label/link, text and badge colors. |
| Menu bundle | Mobile Zestawy menu banner | Mobile/desktop fallback media, heading, body/mobile body, badge, button label/link, text and badge colors. |
| Spotlight one | First homepage promo card | Desktop/mobile media, heading, body, badge, button label/link, text and badge colors. |
| Spotlight two | Second homepage promo card | Same, independently configured. |
| Home bundle | Homepage Zestawy tab promo | Desktop/mobile media, heading, body, button label/link, text color. |
| Collection bundle | Zestawy collection grid promo | Same, independently configured. |
| Collection hero | Shared collection hero | Desktop/mobile media, heading, body, badge, text and badge colors. |
| Product promo | Promo above the PDP bundle selector | Heading, body, icon, background and text color. Campaign mode can show the normally disabled block. The M mark remains fixed. |
| Builder intro | Bundle builder hero | Desktop/mobile media, heading, body, badge, text and badge colors. |
| Newsletter | Footer newsletter | Heading and body. Form validation and Klaviyo subscription remain unchanged. |

The nine page areas have twelve references so paired cards and desktop/mobile menu placements can be configured independently. Placement fields are shared; fields not supported by a location are ignored. Upload an image or Shopify video to media fields, not a document. If only campaign desktop media is provided, it also serves mobile; a mobile override takes precedence. Empty media fields preserve standard assets.

Eight empty seasonal campaigns are prepared: Halloween, Black Friday, Christmas and New Year, Valentines Day, Mothers Day, Fathers Day, Brand Birthday and Summer Sale. Additional campaigns can be added at any time. Example campaign is a disabled demonstration, not sale copy ready for launch.

## Validation

- Resolver checks cover all twelve locations: on/off, theme preview, standard mode, hidden placement and missing reference.
- Browser QA uses 1440px desktop and 390px mobile previews of new-theme-dev.
- Base content and links remain in the original section/block settings and are restored when overrides are disabled.
- Campaign display does not activate discounts. Configure sale rules separately before showing promotional claims.
