/**
 * Static banner definitions for the Home screen (AC-112).
 *
 * Structure, keys, and image refs only.
 * User-facing title strings live in the i18n locale catalogs under the
 * titleKey values defined here — never inline them in this file.
 *
 * Images are placeholder 1×1 PNGs and can be swapped for real assets later.
 */

export interface Banner {
  id: string;
  /** i18n key for the banner title, e.g. 'home.banners.competition'. */
  titleKey: string;
  /** require(…) result — resolved at bundle time. */
  imageSource: number;
}

export const BANNERS: Banner[] = [
  {
    id: 'banner-1',
    titleKey: 'home.banners.competition',
    imageSource: require('../assets/banners/banner1.png'),
  },
  {
    id: 'banner-2',
    titleKey: 'home.banners.newRoutes',
    imageSource: require('../assets/banners/banner2.png'),
  },
  {
    id: 'banner-3',
    titleKey: 'home.banners.community',
    imageSource: require('../assets/banners/banner3.png'),
  },
];
