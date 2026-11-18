// Types partagés du moteur de rendu (spec refonte 2.3).

import type { SiteSpec } from "./site-spec.schema";

export type ClientSheet = Record<string, string>;

/** Bundle statique : chemin relatif -> contenu texte (html/css/xml/svg). */
export type SiteBundle = Record<string, string>;

export type RenderSection<T extends { type: string }> = (section: T, sheet: ClientSheet, spec: SiteSpec) => string;
